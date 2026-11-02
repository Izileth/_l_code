export interface ParsedLine {
  /** índice da linha no texto bruto (para gravar/remover a marcação de tempo) */
  rawIndex: number
  text: string
  /** tempo em segundos vindo de uma marcação [mm:ss.xx], ou null */
  time: number | null
  stanza: number
  /** rótulo da estrofe, ex.: [Refrão] */
  label?: string
  /** dica de estilo/palavra-chave, ex.: {log}, {sing}, {push}, etc. */
  styleHint?: string
}

const TAG = /^\s*\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*/
const META = /^\s*\[[A-Za-z]+:[^\]]*\]\s*$/
const SECTION = /^\s*\[([^\]\d][^\]]*)\]\s*$/
const STYLE_TAG = /^\s*\{([a-zA-Z_.]+)\}\s*/

export function parseLyrics(raw: string): ParsedLine[] {
  const out: ParsedLine[] = []
  let stanza = 0
  let pendingBreak = false
  let pendingLabel: string | undefined

  raw.split(/\r?\n/).forEach((line, rawIndex) => {
    if (META.test(line)) return
    const sec = line.match(SECTION)
    if (sec) {
      pendingLabel = sec[1].trim()
      if (out.length) pendingBreak = true
      return
    }

    let text = line.trim()
    let time: number | null = null
    let styleHint: string | undefined

    // Suporta [00:04.20] e {sing} em qualquer ordem no início do verso
    for (let pass = 0; pass < 2; pass++) {
      const tm = text.match(TAG)
      if (tm) {
        const frac = tm[3] ? parseInt(tm[3], 10) / Math.pow(10, tm[3].length) : 0
        time = parseInt(tm[1], 10) * 60 + parseInt(tm[2], 10) + frac
        text = text.slice(tm[0].length).trim()
        continue
      }
      const sm = text.match(STYLE_TAG)
      if (sm) {
        styleHint = sm[1].toLowerCase()
        text = text.slice(sm[0].length).trim()
        continue
      }
    }

    if (!text) {
      if (out.length) pendingBreak = true
      return
    }

    const newStanza = pendingBreak
    if (pendingBreak) {
      stanza++
      pendingBreak = false
    }
    const label = out.length === 0 || newStanza ? pendingLabel : undefined
    pendingLabel = undefined

    out.push({ rawIndex, text, time, stanza, label, styleHint })
  })
  return out
}

/**
 * Resolve o tempo de início de cada linha. Linhas com marcação mantêm o tempo;
 * as demais são distribuídas entre as âncoras, proporcionalmente ao tamanho do texto.
 */
export function resolveTimes(lines: ParsedLine[], duration: number): number[] {
  const n = lines.length
  if (n === 0) return []

  const intro = duration > 20 ? 2.5 : 1
  const outro = duration > 20 ? 3 : 1
  const endT = duration > 0 ? Math.max(duration - outro, intro + 1) : intro + n * 3
  const times: (number | null)[] = lines.map((l) => l.time)
  const weight = (i: number) => Math.max(8, lines[i].text.length)

  let i = 0
  while (i < n) {
    if (times[i] !== null) {
      i++
      continue
    }
    let k = i
    while (k < n && times[k] === null) k++
    const startIdx = i > 0 ? i - 1 : i
    const prevT = i > 0 ? (times[i - 1] as number) : intro
    const nextT = k < n ? (times[k] as number) : Math.max(endT, prevT + 1)
    let total = 0
    for (let j = startIdx; j < k; j++) total += weight(j)
    let cum = 0
    for (let j = startIdx; j < k; j++) {
      if (j >= i) times[j] = prevT + ((nextT - prevT) * cum) / total
      cum += weight(j)
    }
    i = k
  }

  const result = times.map((t) => t as number)
  for (let j = 1; j < n; j++) result[j] = Math.max(result[j], result[j - 1] + 0.05)
  return result
}

export function fmtTag(t: number): string {
  const total = Math.max(0, Math.round(t * 100))
  const m = Math.floor(total / 6000)
  const s = (total % 6000) / 100
  return `[${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}]`
}

export function setTag(raw: string, rawIndex: number, t: number): string {
  const lines = raw.split(/\r?\n/)
  if (rawIndex < 0 || rawIndex >= lines.length) return raw
  lines[rawIndex] = `${fmtTag(t)} ${lines[rawIndex].replace(TAG, '')}`
  return lines.join('\n')
}

export function removeTag(raw: string, rawIndex: number): string {
  const lines = raw.split(/\r?\n/)
  if (rawIndex < 0 || rawIndex >= lines.length) return raw
  lines[rawIndex] = lines[rawIndex].replace(TAG, '')
  return lines.join('\n')
}

export function stripAllTags(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(TAG, ''))
    .join('\n')
}

/** Calcula a duração de referência quando o usuário deseja exportar apenas a letra */
export function resolveLyricsDuration(
  parsed: ParsedLine[],
  totalAudioDuration: number,
  lyricsOnly: boolean,
): number {
  if (!lyricsOnly) return totalAudioDuration
  const customTimes = parsed.filter((l) => l.time !== null).map((l) => l.time!)
  if (!customTimes.length) return 0
  const maxCustom = Math.max(...customTimes)
  return maxCustom + 4
}

export function fmtTime(t: number): string {
  if (!isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const SAMPLE_LYRICS = `[Verso 1]
Acordei com o café no teclado
Um bug no peito, o dia compilado
Deploy de sonhos na madrugada
Sem erro, sem aviso, sem mais nada

[Refrão]
Roda de novo, roda de novo
Cada linha é um verso que eu escrevo
Roda de novo, e o som me leva
Pro próximo loop do meu mundo novo`
