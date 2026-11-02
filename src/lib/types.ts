export type TokenKind =
  | 'kw'
  | 'fn'
  | 'cls'
  | 'attr'
  | 'str'
  | 'num'
  | 'com'
  | 'plain'
  | 'ok'
  | 'err'

export interface Token {
  t: string
  k: TokenKind
}

export type FormatId = 'python' | 'terminal' | 'javascript'

/** 'out' = texto puro (usado no formato terminal). */
export type CallStyleId =
  | 'mixed'
  | 'print'
  | 'sing'
  | 'append'
  | 'yield'
  | 'out'
  | 'log'
  | 'sing_js'
  | 'push'
  | 'const_js'
  | 'let_js'
  | 'emit_js'
  | 'var_py'
  | 'emit_py'

export interface LyricPayload {
  text: string
  indent: number
  style: CallStyleId
}

export interface CodeLine {
  kind: 'static' | 'lyric'
  tokens?: Token[]
  lyric?: LyricPayload
  start: number
  end: number
}

export interface Meta {
  title: string
  artist: string
  year: number
}

export interface Theme {
  id: string
  name: string
  bg: string
  accent: string
  glow: string
  cursor: string
  colors: Record<TokenKind, string>
}

export const BARS = 32

export interface Levels {
  bars: Float32Array
  level: number
  bass: number
  beat: number
}

export interface RenderOptions {
  fontSize: number
  lineNumbers: boolean
  showGuides: boolean
  /** estilo limpo da referência: preto liso, só o texto e o cursor */
  clean: boolean
  /** barras de espectro de áudio no rodapé */
  spectrum: boolean
  statusLeft: string
  total: number
}
