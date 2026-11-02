import type { CallStyleId, Mode, Surface } from './types'

export interface Settings {
  mode: Mode
  surface: Surface
  themeId: string
  callStyle: CallStyleId
  indent: 2 | 4
  fontSize: number
  lineHeight: number
  lineNumbers: boolean
  stanzaLabels: boolean
  spectrum: boolean
  guides: boolean
  fps: 30 | 60
  muteOnExport: boolean
}

/** Cada modo tem uma tipografia e um tema próprios. */
export const MODE_DEFAULTS: Record<Mode, Pick<Settings, 'fontSize' | 'lineHeight' | 'themeId'>> = {
  terminal: { fontSize: 40, lineHeight: 1.9, themeId: 'terminal' },
  python: { fontSize: 34, lineHeight: 1.5, themeId: 'monokai' },
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'terminal',
  surface: 'minimal',
  ...MODE_DEFAULTS.terminal,
  callStyle: 'print',
  indent: 4,
  lineNumbers: false,
  stanzaLabels: true,
  spectrum: true,
  guides: true,
  fps: 30,
  muteOnExport: true,
}
