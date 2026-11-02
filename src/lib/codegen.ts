import type { CallStyleId, CodeLine, FormatId, Meta, Token } from './types'
import type { ParsedLine } from './lyrics'
import { tokenize } from './tokenize'

export interface CallStyle {
  label: string
  open: Token[]
  close: string
  /** envolve o verso em aspas (Python) ou imprime texto puro (terminal) */
  quote: boolean
}

const p = (t: string): Token => ({ t, k: 'plain' })

export const CALL_STYLES: Record<CallStyleId, CallStyle> = {
  print: { label: 'print("…")', open: [{ t: 'print', k: 'fn' }, p('(')], close: ')', quote: true },
  sing: {
    label: 'self.sing("…")',
    open: [p('self'), p('.'), { t: 'sing', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  append: {
    label: 'lyrics.append("…")',
    open: [p('lyrics'), p('.'), { t: 'append', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  yield: { label: 'yield ("…")', open: [{ t: 'yield', k: 'kw' }, p(' (')], close: ')', quote: true },
  out: { label: 'texto puro', open: [], close: '', quote: false },
}

export interface BuildOptions {
  format: FormatId
  style: CallStyleId
  indent: 2 | 4
  sections: boolean
  duration: number
}

export interface BuildResult {
  lines: CodeLine[]
  className: string
  varName: string
  total: number
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const short = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const plainWords = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)

export function toClassName(title: string): string {
  const name = plainWords(title)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
    .slice(0, 24)
  if (!name) return 'Song'
  return /^\d/.test(name) ? 'Song' + name : name
}

export function toVarName(artist: string): string {
  const name = plainWords(artist)
    .map((w) => w.toLowerCase())
    .join('_')
    .slice(0, 20)
  if (!name || /^\d/.test(name)) return 'song'
  return name
}

export function buildCode(
  parsed: ParsedLine[],
  times: number[],
  meta: Meta,
  o: BuildOptions,
): BuildResult {
  const terminal = o.format === 'terminal'
  const style: CallStyleId = terminal ? 'out' : o.style === 'out' ? 'print' : o.style
  const quote = CALL_STYLES[style].quote
  const ind = ' '.repeat(o.indent)
  const className = toClassName(meta.title)
  const varName = toVarName(meta.artist)
  const year = Math.round(meta.year) || 2026
  const lines: CodeLine[] = []

  const stat = (src: string, start: number, end: number): CodeLine => ({
    kind: 'static',
    tokens: tokenize(src),
    start,
    end,
  })
  const toks = (tokens: Token[], start: number, end: number): CodeLine => ({
    kind: 'static',
    tokens,
    start,
    end,
  })

  // ── cabeçalho ──────────────────────────────────────────────
  const first = parsed.length ? times[0] : 3
  const win = parsed.length ? clamp(first - 0.15, 0, 2.2) : 1.5

  if (terminal) {
    const head: Token[][] = [
      [
        { t: '$ ', k: 'plain' },
        { t: 'play', k: 'ok' },
        { t: ' ', k: 'plain' },
        { t: `"${esc(short(meta.title))}"`, k: 'str' },
      ],
      [
        { t: '[audio] ', k: 'com' },
        { t: `${short(meta.artist, 20)} · ${year}`, k: 'plain' },
      ],
    ]
    head.forEach((tk, i) => lines.push(toks(tk, (win * i) / head.length, (win * (i + 1)) / head.length)))
  } else {
    const header = [
      'import time',
      '',
      `class ${className}:`,
      `${ind}def __init__(self):`,
      `${ind}${ind}self.title = "${esc(short(meta.title))}"`,
      `${ind}${ind}self.artist = "${esc(short(meta.artist))}"`,
      `${ind}${ind}self.year = ${year}`,
      '',
      `${ind}def play(self):`,
    ]
    header.forEach((s, i) => {
      lines.push(stat(s, (win * i) / header.length, (win * (i + 1)) / header.length))
    })
  }

  // ── letra ──────────────────────────────────────────────────
  let prevStanza = -1
  parsed.forEach((l, i) => {
    const start = times[i]
    const nextStart = i + 1 < parsed.length ? times[i + 1] : start + 3
    const typeDur = clamp((nextStart - start) * 0.6, 0.3, 2.4)

    if (l.stanza !== prevStanza) {
      if (prevStanza !== -1) lines.push(stat('', start - 0.7, start - 0.7))
      if (o.sections) {
        const label = l.label ?? `Verso ${l.stanza + 1}`
        if (terminal) {
          lines.push(toks([{ t: `[${label.toLowerCase()}]`, k: 'attr' }], start - 0.6, start - 0.05))
        } else {
          lines.push(stat(`${ind}${ind}# ${label}`, start - 0.6, start - 0.05))
        }
      }
      prevStanza = l.stanza
    }

    lines.push({
      kind: 'lyric',
      lyric: {
        text: quote ? esc(l.text) : l.text,
        indent: terminal ? 0 : o.indent * 2,
        style,
      },
      start,
      end: start + typeDur,
    })
  })

  // ── rodapé ─────────────────────────────────────────────────
  const lastStart = parsed.length ? times[times.length - 1] : 3
  const s0 = o.duration > 0 ? Math.max(lastStart + 2.2, o.duration - 2.6) : lastStart + 3
  lines.push(stat('', s0, s0))
  if (terminal) {
    lines.push(
      toks(
        [
          { t: 'fim da faixa ', k: 'plain' },
          { t: '(ok.)', k: 'ok' },
        ],
        s0,
        s0 + 0.7,
      ),
    )
    lines.push(toks([{ t: '$ ', k: 'plain' }], s0 + 0.9, s0 + 1.0))
  } else {
    lines.push(stat('# Executar', s0, s0 + 0.5))
    lines.push(stat(`${varName} = ${className}()`, s0 + 0.5, s0 + 1.1))
    lines.push(stat(`${varName}.play()`, s0 + 1.1, s0 + 1.6))
  }

  // ── garante ordem cronológica ──────────────────────────────
  for (let i = 1; i < lines.length; i++) {
    lines[i].start = Math.max(lines[i].start, lines[i - 1].start + 0.001)
  }
  for (const ln of lines) ln.end = Math.max(ln.end, ln.start)

  return {
    lines,
    className,
    varName,
    total: lines[lines.length - 1].end + 2,
  }
}
