import type { CodeLine, LyricPayload, RenderOptions, Theme, Token, Levels } from './types'
import { CALL_STYLES } from './codegen'
import { fmtTime } from './lyrics'

/** Canvas 9:16 — tamanho de Reels. */
export const W = 1080
export const H = 1920

// Zona segura do Instagram Reels (a interface do app cobre topo e rodapé).
const SAFE_TOP = 250
const SAFE_BOTTOM = 1580
const CODE_TOP = SAFE_TOP
const CODE_BOTTOM = SAFE_BOTTOM - 170
const MARGIN_X = 72
const FADE = 170
const FONT_FAMILY =
  '"JetBrains Mono", "Fira Code", ui-monospace, "SF Mono", Menlo, Consolas, monospace'

export interface FrameInput {
  t: number
  dt: number
  now: number
  levels: Levels
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (x: number) => x * x * (3 - 2 * x)

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hexA(hex: string, a: number): string {
  const [r, g, b] = rgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${clamp01(a)})`
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Quebra a letra em pedaços que cabem na largura. */
export function wrapWords(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let cur = ''
  for (let w of words) {
    while (w.length > width) {
      if (cur) {
        chunks.push(cur + ' ')
        cur = ''
      }
      chunks.push(w.slice(0, width))
      w = w.slice(width)
    }
    if (!cur) cur = w
    else if ((cur + ' ' + w).length + 1 <= width) cur += ' ' + w
    else {
      chunks.push(cur + ' ')
      cur = w
    }
  }
  if (cur || chunks.length === 0) chunks.push(cur)
  return chunks
}

export function expandLyric(l: LyricPayload, maxChars: number): Token[][] {
  const style = CALL_STYLES[l.style]
  const openLen = style.open.reduce((a, t) => a + t.t.length, 0)
  const prefixLen = l.indent + openLen
  const extra = style.quote ? 2 : 0
  const avail = Math.max(8, maxChars - prefixLen - extra - style.close.length)
  const chunks = wrapWords(l.text, avail)

  return chunks.map((c, i) => {
    const toks: Token[] = []
    if (i === 0) {
      if (l.indent) toks.push({ t: ' '.repeat(l.indent), k: 'plain' })
      toks.push(...style.open)
    } else if (prefixLen) {
      toks.push({ t: ' '.repeat(prefixLen), k: 'plain' })
    }
    toks.push(style.quote ? { t: `"${c}"`, k: 'str' } : { t: c, k: 'plain' })
    if (i === chunks.length - 1 && style.close) toks.push({ t: style.close, k: 'plain' })
    return toks
  })
}

interface LineLayout {
  rows: Token[][]
  rowLens: number[]
  total: number
  first: number
  num: number
}

function progressOf(ln: CodeLine, t: number): number {
  if (ln.end <= ln.start) return t >= ln.start ? 1 : 0
  return clamp01((t - ln.start) / (ln.end - ln.start))
}

function cursorPos(L: LineLayout, reveal: number): { row: number; col: number } {
  let remaining = reveal
  for (let r = 0; r < L.rows.length; r++) {
    const len = L.rowLens[r]
    if (remaining < len || r === L.rows.length - 1) return { row: r, col: Math.min(remaining, len) }
    remaining -= len
  }
  return { row: 0, col: 0 }
}

export class LyricCodeRenderer {
  private lastLines: CodeLine[] | null = null
  private layoutKey = ''
  private layout: LineLayout[] = []
  private charW = 20
  private lineH = 51
  private gutter = 0
  private scroll = 0
  private scrollInit = false
  private alphas: number[] = []

  invalidate() {
    this.layoutKey = ''
  }

  reset() {
    this.scrollInit = false
    this.alphas = []
  }

  private ensureLayout(
    ctx: CanvasRenderingContext2D,
    lines: CodeLine[],
    fontSize: number,
    lineNumbers: boolean,
  ) {
    ctx.font = `400 ${fontSize}px ${FONT_FAMILY}`
    const charW = ctx.measureText('M').width
    const key = `${fontSize}|${lineNumbers}|${charW.toFixed(3)}`
    if (lines === this.lastLines && key === this.layoutKey) return

    this.lastLines = lines
    this.layoutKey = key
    this.charW = charW
    this.lineH = Math.round(fontSize * 1.62)
    this.gutter = lineNumbers ? charW * 4 : 0
    const maxChars = Math.max(12, Math.floor((W - MARGIN_X * 2 - this.gutter) / charW))

    let row = 0
    let num = 0
    this.layout = lines.map((ln) => {
      num++
      const rows = ln.kind === 'lyric' && ln.lyric ? expandLyric(ln.lyric, maxChars) : [ln.tokens ?? []]
      const rowLens = rows.map((r) => r.reduce((a, t) => a + t.t.length, 0))
      const out: LineLayout = {
        rows,
        rowLens,
        total: rowLens.reduce((a, b) => a + b, 0),
        first: row,
        num,
      }
      row += rows.length
      return out
    })
    this.alphas = []
  }

  render(
    ctx: CanvasRenderingContext2D,
    lines: CodeLine[],
    theme: Theme,
    o: RenderOptions,
    f: FrameInput,
  ) {
    this.ensureLayout(ctx, lines, o.fontSize, o.lineNumbers)
    const { t, dt, now, levels } = f
    const { charW, lineH, gutter } = this
    const regular = `${o.clean ? 500 : 400} ${o.fontSize}px ${FONT_FAMILY}`
    const bold = `700 ${o.fontSize}px ${FONT_FAMILY}`
    const top = CODE_TOP

    this.drawBackdrop(ctx, theme, levels, o.clean)

    // ── linha ativa e posição do cursor ───────────────────────
    let active = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].start <= t) active = i
      else break
    }
    const firstLyric = lines.findIndex((l) => l.kind === 'lyric')
    const introEnd = firstLyric >= 0 ? lines[firstLyric].start : Infinity
    const inIntro = t < introEnd

    const revealOf = (i: number) => {
      const p = progressOf(lines[i], t)
      return p >= 1 ? this.layout[i].total : Math.floor(this.layout[i].total * p)
    }
    const aLayout = this.layout[active]
    const aProg = progressOf(lines[active], t)
    const aReveal = revealOf(active)
    const cur = cursorPos(aLayout, aReveal)
    const curRow = aLayout.first + cur.row

    // ── rolagem suave: a linha digitada fica no centro ────────
    const centerY = top + (CODE_BOTTOM - top) * 0.46
    const target = top + (curRow + 0.5) * lineH - centerY
    if (!this.scrollInit || Math.abs(target - this.scroll) > H) {
      this.scroll = target
      this.scrollInit = true
    } else {
      this.scroll += (target - this.scroll) * (1 - Math.exp(-dt * 7))
    }
    const rowY = (row: number) => top + (row + 0.5) * lineH - this.scroll
    // no estilo limpo o texto fica 100% visível até bem perto da borda
    const fade = o.clean ? 70 : FADE
    const edgeOf = (y: number) =>
      smooth(clamp01((y - top) / fade)) * smooth(clamp01((CODE_BOTTOM - y) / fade))

    // ── código ────────────────────────────────────────────────
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = regular
    let curFont = regular

    for (let i = 0; i < lines.length; i++) {
      const L = this.layout[i]
      const reveal = revealOf(i)
      if (reveal <= 0) continue

      // foco: a linha atual brilha, as anteriores esmaecem com a distância
      const dist = active - i
      const targetA = o.clean || inIntro || dist <= 0 ? 1 : Math.max(0.24, 0.72 - 0.1 * dist)
      const prevA = this.alphas[i] ?? targetA
      const alpha = prevA + (targetA - prevA) * (1 - Math.exp(-dt * 9))
      this.alphas[i] = alpha

      if (i === active && !o.clean) {
        ctx.shadowColor = theme.glow
        ctx.shadowBlur = 4 + 40 * (0.45 * levels.level + 0.8 * levels.beat)
      } else {
        ctx.shadowBlur = 0
      }

      let remaining = reveal
      for (let r = 0; r < L.rows.length && remaining > 0; r++) {
        const take = Math.min(L.rowLens[r], remaining)
        remaining -= take
        const y = rowY(L.first + r)
        if (y < top - lineH || y > CODE_BOTTOM + lineH) continue
        const edge = edgeOf(y)
        if (edge < 0.01) continue
        ctx.globalAlpha = alpha * edge

        if (r === 0 && gutter > 0) {
          ctx.textAlign = 'right'
          ctx.fillStyle = theme.colors.com
          ctx.fillText(String(L.num), MARGIN_X + gutter - charW, y)
          ctx.textAlign = 'left'
        }

        let x = MARGIN_X + gutter
        let left = take
        for (const tk of L.rows[r]) {
          if (left <= 0) break
          const n = Math.min(tk.t.length, left)
          if (tk.t.trim() !== '') {
            const wanted = tk.k === 'cls' ? bold : regular
            if (wanted !== curFont) {
              ctx.font = wanted
              curFont = wanted
            }
            ctx.fillStyle = theme.colors[tk.k]
            ctx.fillText(tk.t.slice(0, n), x, y)
          }
          x += n * charW
          left -= n
        }
      }
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1

    // ── cursor em bloco (pulsa com a batida) ──────────────────
    const typing = aProg < 1 && aLayout.total > 0
    const blinkOn = typing || Math.floor(now / 0.53) % 2 === 0
    const cy = rowY(curRow)
    if (blinkOn && cy > top - lineH && cy < CODE_BOTTOM + lineH) {
      const cx = MARGIN_X + gutter + cur.col * charW
      ctx.fillStyle = theme.cursor
      if (o.clean) {
        // bloco sólido, sem brilho nem pulso
        ctx.globalAlpha = edgeOf(cy)
        ctx.fillRect(cx, cy - o.fontSize * 0.48, charW * 0.8, o.fontSize * 0.96)
      } else {
        ctx.globalAlpha = edgeOf(cy) * (0.7 + 0.3 * levels.level)
        ctx.shadowColor = theme.glow
        ctx.shadowBlur = 12 + 20 * levels.beat
        ctx.fillRect(cx, cy - lineH * 0.36, charW * (0.55 + 0.3 * levels.beat), lineH * 0.72)
        ctx.shadowBlur = 0
      }
      ctx.globalAlpha = 1
    }

    // ── espectro e status (o estilo limpo não mostra nenhum dos dois) ──
    if (o.spectrum) this.drawSpectrum(ctx, theme, levels)
    if (!o.clean) {
      ctx.font = `400 26px ${FONT_FAMILY}`
      ctx.fillStyle = theme.colors.com
      ctx.textAlign = 'left'
      ctx.fillText(o.statusLeft, MARGIN_X, SAFE_BOTTOM - 8)
      ctx.textAlign = 'right'
      const shown = Math.min(Math.max(t, 0), o.total)
      ctx.fillText(`${fmtTime(shown)} / ${fmtTime(o.total)}`, W - MARGIN_X, SAFE_BOTTOM - 8)
      ctx.textAlign = 'left'
    }

    if (o.showGuides) this.drawGuides(ctx)
  }

  /** Fundo: preto liso no estilo limpo; no outro, um brilho que respira com o áudio. */
  private drawBackdrop(ctx: CanvasRenderingContext2D, theme: Theme, levels: Levels, clean: boolean) {
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, W, H)
    if (clean) return

    const g = ctx.createRadialGradient(W / 2, H * 0.48, 40, W / 2, H * 0.48, H * 0.62)
    g.addColorStop(0, hexA(theme.accent, 0.05 + levels.level * 0.2 + levels.beat * 0.12))
    g.addColorStop(1, hexA(theme.accent, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  private drawSpectrum(ctx: CanvasRenderingContext2D, theme: Theme, levels: Levels) {
    const base = SAFE_BOTTOM - 50
    const n = levels.bars.length
    const slot = (W - MARGIN_X * 2) / n
    const bw = slot * 0.5
    const c = theme.colors
    const palette = [c.kw, c.attr, c.str, c.fn, c.num]
    for (let i = 0; i < n; i++) {
      const v = levels.bars[i]
      const h = 6 + v * 86
      const x = MARGIN_X + i * slot + (slot - bw) / 2
      ctx.globalAlpha = 0.28 + 0.62 * clamp01(v)
      ctx.fillStyle = palette[Math.min(palette.length - 1, Math.floor((i / n) * palette.length))]
      roundedRect(ctx, x, base - h, bw, h, bw / 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawGuides(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 60, 120, 0.55)'
    ctx.fillStyle = 'rgba(255, 60, 120, 0.8)'
    ctx.lineWidth = 2
    ctx.setLineDash([14, 10])
    for (const y of [SAFE_TOP, SAFE_BOTTOM]) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.font = `400 22px ${FONT_FAMILY}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('zona segura do Reels (não aparece no vídeo)', 24, SAFE_TOP - 12)
    ctx.restore()
  }
}
