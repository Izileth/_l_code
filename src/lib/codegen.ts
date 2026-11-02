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
  mixed: {
    label: '✨ Mixar palavras-chave (dinâmico)',
    open: [{ t: 'print', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  print: { label: 'print("…")', open: [{ t: 'print', k: 'fn' }, p('(')], close: ')', quote: true },
  log: {
    label: 'console.log("…")',
    open: [{ t: 'console', k: 'plain' }, p('.'), { t: 'log', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  sing: {
    label: 'self.sing("…")',
    open: [p('self'), p('.'), { t: 'sing', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  sing_js: {
    label: 'this.sing("…")',
    open: [p('this'), p('.'), { t: 'sing', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  append: {
    label: 'lyrics.append("…")',
    open: [p('lyrics'), p('.'), { t: 'append', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  push: {
    label: 'lyrics.push("…")',
    open: [p('lyrics'), p('.'), { t: 'push', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  const_js: {
    label: 'const verse = "…"',
    open: [{ t: 'const', k: 'kw' }, p(' verse = ')],
    close: '',
    quote: true,
  },
  let_js: {
    label: 'let verse = "…"',
    open: [{ t: 'let', k: 'kw' }, p(' verse = ')],
    close: '',
    quote: true,
  },
  emit_js: {
    label: 'emit("…")',
    open: [{ t: 'emit', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  var_py: {
    label: 'verse = "…"',
    open: [p('verse = ')],
    close: '',
    quote: true,
  },
  emit_py: {
    label: 'emit("…")',
    open: [{ t: 'emit', k: 'fn' }, p('(')],
    close: ')',
    quote: true,
  },
  term_sudo_echo: {
    label: '$ sudo echo "…"',
    open: [{ t: '$ ', k: 'plain' }, { t: 'sudo ', k: 'kw' }, { t: 'echo ', k: 'fn' }],
    close: '',
    quote: true,
  },
  term_echo: {
    label: '$ echo "…"',
    open: [{ t: '$ ', k: 'plain' }, { t: 'echo ', k: 'fn' }],
    close: '',
    quote: true,
  },
  term_sudo_play: {
    label: '$ sudo play "…"',
    open: [{ t: '$ ', k: 'plain' }, { t: 'sudo ', k: 'kw' }, { t: 'play ', k: 'ok' }],
    close: '',
    quote: true,
  },
  term_wall: {
    label: '$ sudo wall "…"',
    open: [{ t: '$ ', k: 'plain' }, { t: 'sudo ', k: 'kw' }, { t: 'wall ', k: 'attr' }],
    close: '',
    quote: true,
  },
  term_printf: {
    label: '$ printf "…\\n"',
    open: [{ t: '$ ', k: 'plain' }, { t: 'printf ', k: 'fn' }],
    close: '\\n',
    quote: true,
  },
  term_export: {
    label: '$ export VERSE="…"',
    open: [{ t: '$ ', k: 'plain' }, { t: 'export ', k: 'kw' }, { t: 'VERSE=', k: 'attr' }],
    close: '',
    quote: true,
  },
  term_tee: {
    label: '$ sudo tee <<< "…"',
    open: [{ t: '$ ', k: 'plain' }, { t: 'sudo ', k: 'kw' }, { t: 'tee <<< ', k: 'fn' }],
    close: '',
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
  lyricsOnly?: boolean
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

export function resolveLineStyle(
  styleHint: string | undefined,
  baseStyle: CallStyleId,
  isJs: boolean,
  terminal: boolean,
  stanza: number,
  lineInStanza: number,
): CallStyleId {
  // Modo Terminal (Linux)
  if (terminal) {
    if (styleHint) {
      const hint = styleHint.toLowerCase()
      if (hint === 'sudo' || hint === 'sudo_echo') return 'term_sudo_echo'
      if (hint === 'echo') return 'term_echo'
      if (hint === 'play' || hint === 'sudo_play') return 'term_sudo_play'
      if (hint === 'wall' || hint === 'sudo_wall') return 'term_wall'
      if (hint === 'printf') return 'term_printf'
      if (hint === 'export') return 'term_export'
      if (hint === 'tee' || hint === 'sudo_tee') return 'term_tee'
      if (hint === 'out' || hint === 'plain' || hint === 'raw') return 'out'
    }

    if (baseStyle !== 'mixed') {
      if (
        baseStyle === 'term_sudo_echo' ||
        baseStyle === 'term_echo' ||
        baseStyle === 'term_sudo_play' ||
        baseStyle === 'term_wall' ||
        baseStyle === 'term_printf' ||
        baseStyle === 'term_export' ||
        baseStyle === 'term_tee' ||
        baseStyle === 'out'
      ) {
        return baseStyle
      }
      return 'term_sudo_echo'
    }

    // Mix dinâmico com terminologia Linux autêntica (sudo, echo, wall, tee, etc.)
    const pool =
      stanza % 2 === 0
        ? (['term_sudo_play', 'term_echo', 'term_tee', 'term_printf'] as const)
        : (['term_sudo_echo', 'term_wall', 'term_export', 'term_sudo_play'] as const)
    return pool[lineInStanza % pool.length]
  }

  // Tag explícita no verso, ex: {log}, {sing}, {push}, etc.
  if (styleHint) {
    const hint = styleHint.toLowerCase()
    if (isJs) {
      if (hint === 'log' || hint === 'console' || hint === 'print') return 'log'
      if (hint === 'sing' || hint === 'sing_js' || hint === 'this.sing') return 'sing_js'
      if (hint === 'push' || hint === 'append') return 'push'
      if (hint === 'const' || hint === 'let' || hint === 'var') return 'const_js'
      if (hint === 'emit' || hint === 'play') return 'emit_js'
      if (hint === 'yield') return 'yield'
      if (hint === 'out') return 'out'
    } else {
      if (hint === 'print' || hint === 'log' || hint === 'console') return 'print'
      if (hint === 'sing' || hint === 'sing_py' || hint === 'self.sing') return 'sing'
      if (hint === 'append' || hint === 'push') return 'append'
      if (hint === 'var' || hint === 'const' || hint === 'let') return 'var_py'
      if (hint === 'emit' || hint === 'play') return 'emit_py'
      if (hint === 'yield') return 'yield'
      if (hint === 'out') return 'out'
    }
  }

  // Se o usuário selecionou um estilo fixo específico
  if (baseStyle !== 'mixed') {
    if (isJs) {
      if (baseStyle === 'print') return 'log'
      if (baseStyle === 'sing') return 'sing_js'
      if (baseStyle === 'append') return 'push'
      if (baseStyle === 'var_py') return 'const_js'
      if (baseStyle === 'emit_py') return 'emit_js'
      return baseStyle
    } else {
      if (baseStyle === 'log') return 'print'
      if (baseStyle === 'sing_js') return 'sing'
      if (baseStyle === 'push') return 'append'
      if (baseStyle === 'const_js' || baseStyle === 'let_js') return 'var_py'
      if (baseStyle === 'emit_js') return 'emit_py'
      return baseStyle
    }
  }

  // Modo 'mixed' dinâmico: varia as palavras-chave a cada trecho/linha
  if (isJs) {
    const pool =
      stanza % 2 === 0
        ? (['const_js', 'sing_js', 'push', 'log'] as const)
        : (['log', 'sing_js', 'emit_js', 'yield'] as const)
    return pool[lineInStanza % pool.length]
  } else {
    const pool =
      stanza % 2 === 0
        ? (['var_py', 'sing', 'append', 'print'] as const)
        : (['print', 'sing', 'emit_py', 'yield'] as const)
    return pool[lineInStanza % pool.length]
  }
}

export function buildCode(
  parsed: ParsedLine[],
  times: number[],
  meta: Meta,
  o: BuildOptions,
): BuildResult {
  const terminal = o.format === 'terminal'
  const isJs = o.format === 'javascript'
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
        { t: 'sudo ', k: 'kw' },
        { t: 'systemctl start ', k: 'fn' },
        { t: `"${esc(short(meta.title))}"`, k: 'str' },
      ],
      [
        { t: '[audio] ', k: 'com' },
        { t: `${short(meta.artist, 20)} · ${year}`, k: 'plain' },
      ],
    ]
    head.forEach((tk, i) => lines.push(toks(tk, (win * i) / head.length, (win * (i + 1)) / head.length)))
  } else if (isJs) {
    const header = [
      "import { Track } from 'reels'",
      '',
      `class ${className} {`,
      `${ind}constructor() {`,
      `${ind}${ind}this.title = "${esc(short(meta.title))}"`,
      `${ind}${ind}this.artist = "${esc(short(meta.artist))}"`,
      `${ind}${ind}this.year = ${year}`,
      `${ind}}`,
      '',
      `${ind}play() {`,
    ]
    header.forEach((s, i) => {
      lines.push(stat(s, (win * i) / header.length, (win * (i + 1)) / header.length))
    })
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
  let lineInStanza = 0
  parsed.forEach((l, i) => {
    const start = times[i]
    const nextStart = i + 1 < parsed.length ? times[i + 1] : start + 3
    const typeDur = clamp((nextStart - start) * 0.6, 0.3, 2.4)

    if (l.stanza !== prevStanza) {
      lineInStanza = 0
      if (prevStanza !== -1) lines.push(stat('', start - 0.7, start - 0.7))
      if (o.sections) {
        const label = l.label ?? `Verso ${l.stanza + 1}`
        if (terminal) {
          lines.push(toks([{ t: `[${label.toLowerCase()}]`, k: 'attr' }], start - 0.6, start - 0.05))
        } else if (isJs) {
          lines.push(stat(`${ind}${ind}// ${label}`, start - 0.6, start - 0.05))
        } else {
          lines.push(stat(`${ind}${ind}# ${label}`, start - 0.6, start - 0.05))
        }
      }
      prevStanza = l.stanza
    }

    const lineStyle = resolveLineStyle(l.styleHint, o.style, isJs, terminal, l.stanza, lineInStanza)
    const quote = CALL_STYLES[lineStyle]?.quote ?? true

    lines.push({
      kind: 'lyric',
      lyric: {
        text: quote ? esc(l.text) : l.text,
        indent: terminal ? 0 : o.indent * 2,
        style: lineStyle,
      },
      start,
      end: start + typeDur,
    })
    lineInStanza++
  })

  // ── rodapé ─────────────────────────────────────────────────
  const lastStart = parsed.length ? times[times.length - 1] : 3
  const s0 =
    o.duration > 0 && !o.lyricsOnly
      ? Math.max(lastStart + 2.2, o.duration - 2.6)
      : lastStart + 2.4
  lines.push(stat('', s0, s0))
  if (terminal) {
    lines.push(
      toks(
        [
          { t: '[system] ', k: 'com' },
          { t: 'faixa concluída com sucesso ', k: 'plain' },
          { t: '(status: 0)', k: 'ok' },
        ],
        s0,
        s0 + 0.7,
      ),
    )
    lines.push(toks([{ t: '$ ', k: 'plain' }, { t: 'exit 0', k: 'fn' }], s0 + 0.9, s0 + 1.0))
  } else if (isJs) {
    lines.push(stat(`${ind}}`, s0, s0 + 0.2))
    lines.push(stat('}', s0 + 0.2, s0 + 0.4))
    lines.push(stat('', s0 + 0.4, s0 + 0.4))
    lines.push(stat('// Executar', s0 + 0.4, s0 + 0.8))
    lines.push(stat(`const ${varName} = new ${className}()`, s0 + 0.8, s0 + 1.3))
    lines.push(stat(`${varName}.play()`, s0 + 1.3, s0 + 1.8))
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
