import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './lib/audio'
import { CALL_STYLES, buildCode } from './lib/codegen'
import { pickFormat, startRecording } from './lib/exporter'
import {
  SAMPLE_LYRICS,
  fmtTime,
  parseLyrics,
  removeTag,
  resolveTimes,
  setTag,
  stripAllTags,
} from './lib/lyrics'
import { THEMES, getTheme } from './lib/themes'
import type { CallStyleId, FormatId, Meta } from './lib/types'
import { Preview } from './components/Preview'
import {
  Btn,
  Field,
  Group,
  IconCheck,
  IconDownload,
  IconPause,
  IconPlay,
  IconWave,
  Pane,
  Row,
  Segmented,
  Select,
  Slider,
  Switch,
} from './components/ui'

const SYNC_LATENCY = 0.12 // compensa o tempo de reação ao tocar

type ExportState =
  | { phase: 'idle' }
  | { phase: 'recording' }
  | { phase: 'done'; url: string; ext: string; size: number; name: string; h264: boolean }
  | { phase: 'error'; message: string }

export default function App() {
  const engine = useMemo(() => new AudioEngine(), [])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recRef = useRef<ReturnType<typeof startRecording> | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const cancelledRef = useRef(false)

  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [audioError, setAudioError] = useState('')

  const [meta, setMeta] = useState<Meta>({ title: 'Loop do Meu Mundo', artist: 'Manu', year: 2026 })
  const [text, setText] = useState(SAMPLE_LYRICS)

  const [codeFormat, setCodeFormat] = useState<FormatId>('terminal')
  const [themeId, setThemeId] = useState('shell')
  const [style, setStyle] = useState<CallStyleId>('mixed')
  const [indent, setIndent] = useState<2 | 4>(4)
  const [fontSize, setFontSize] = useState(42)
  const [spectrum, setSpectrum] = useState(false)
  const [lineNumbers, setLineNumbers] = useState(false)
  const [sections, setSections] = useState(true)
  const [guides, setGuides] = useState(true)

  const [fps, setFps] = useState(30)
  const [muteExport, setMuteExport] = useState(true)
  const [exp, setExp] = useState<ExportState>({ phase: 'idle' })

  /** null = fora do modo sincronizar; número = próxima linha a marcar */
  const [syncCursor, setSyncCursor] = useState<number | null>(null)

  const theme = getTheme(themeId)
  const terminal = codeFormat === 'terminal'
  const parsed = useMemo(() => parseLyrics(text), [text])
  const times = useMemo(() => resolveTimes(parsed, duration), [parsed, duration])
  const built = useMemo(
    () => buildCode(parsed, times, meta, { format: codeFormat, style, indent, sections, duration }),
    [parsed, times, meta, codeFormat, style, indent, sections, duration],
  )
  const recFormat = useMemo(() => pickFormat(), [])
  const exporting = exp.phase === 'recording'
  const syncing = syncCursor !== null

  // ── relógio da interface ───────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setTime(engine.time)
      setPlaying(!engine.paused)
    }, 100)
    return () => clearInterval(id)
  }, [engine])

  const changeFormat = (f: FormatId) => {
    setCodeFormat(f)
    setSpectrum(f !== 'terminal')
    if (f === 'javascript') {
      if (themeId === 'shell' || themeId === 'preto') setThemeId('javascript')
    } else if (f === 'python') {
      if (themeId === 'javascript' || themeId === 'shell') setThemeId('preto')
    } else if (f === 'terminal') {
      if (themeId === 'preto' || themeId === 'javascript') setThemeId('shell')
    }
    if (fontSize === 34 || fontSize === 42) setFontSize(f === 'terminal' ? 42 : 34)
  }

  // ── áudio ──────────────────────────────────────────────────
  const onAudio = async (file: File | undefined) => {
    if (!file) return
    setAudioError('')
    try {
      await engine.load(file)
      setDuration(engine.duration)
      setTime(0)
      setSyncCursor(null)
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : 'Erro ao carregar o áudio.')
    }
  }

  const togglePlay = async () => {
    if (!engine.loaded) return
    if (engine.paused) await engine.play()
    else engine.pause()
    setPlaying(!engine.paused)
  }

  // ── sincronização por toque ────────────────────────────────
  const startSync = async () => {
    if (!engine.loaded || !parsed.length) return
    setText((p) => stripAllTags(p))
    setSyncCursor(0)
    engine.seek(0)
    await engine.play()
  }

  const stamp = useCallback(() => {
    if (syncCursor === null) return
    const line = parsed[syncCursor]
    if (!line) return
    const t = Math.max(0, engine.time - SYNC_LATENCY)
    setText((p) => setTag(p, line.rawIndex, t))
    setSyncCursor(syncCursor + 1)
  }, [syncCursor, parsed, engine])

  const undoStamp = useCallback(() => {
    if (syncCursor === null || syncCursor <= 0) return
    const prev = parsed[syncCursor - 1]
    if (prev.time !== null) engine.seek(Math.max(0, prev.time - 1.5))
    setText((p) => removeTag(p, prev.rawIndex))
    setSyncCursor(syncCursor - 1)
  }, [syncCursor, parsed, engine])

  useEffect(() => {
    if (!syncing) return
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) stamp()
      } else if (e.code === 'Backspace') {
        e.preventDefault()
        undoStamp()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [syncing, stamp, undoStamp])

  const onLrc = async (file: File | undefined) => {
    if (!file) return
    setText(await file.text())
  }

  // ── exportação ─────────────────────────────────────────────
  const exportVideo = async () => {
    const canvas = canvasRef.current
    if (!canvas || !engine.loaded) return
    cancelledRef.current = false
    setExp({ phase: 'recording' })
    try {
      engine.pause()
      engine.seek(0)
      engine.setSpeakersMuted(muteExport)
      const rec = startRecording(canvas, engine.getRecordingStream(), fps)
      recRef.current = rec

      const ended = new Promise<void>((resolve) => {
        const onEnd = () => {
          engine.audio.removeEventListener('ended', onEnd)
          resolve()
        }
        engine.audio.addEventListener('ended', onEnd)
        cancelRef.current = () => {
          engine.audio.removeEventListener('ended', onEnd)
          resolve()
        }
      })
      await engine.play()
      await ended
      await new Promise((r) => setTimeout(r, 600))

      const result = await rec.stop()
      recRef.current = null
      engine.pause()
      engine.setSpeakersMuted(false)
      engine.seek(0)
      if (cancelledRef.current) {
        setExp({ phase: 'idle' })
        return
      }

      const name = `${built.className.toLowerCase()}-reels.${result.ext}`
      const url = URL.createObjectURL(result.blob)
      setExp({ phase: 'done', url, ext: result.ext, size: result.blob.size, name, h264: result.h264 })
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
    } catch (e) {
      engine.pause()
      engine.setSpeakersMuted(false)
      setExp({ phase: 'error', message: e instanceof Error ? e.message : 'Falha ao exportar.' })
    }
  }

  const cancelExport = async () => {
    cancelledRef.current = true
    cancelRef.current?.()
    if (recRef.current) await recRef.current.stop()
    engine.pause()
    engine.setSpeakersMuted(false)
    setExp({ phase: 'idle' })
  }

  const syncLine = syncCursor !== null ? parsed[syncCursor] : undefined
  const progress = duration > 0 ? Math.min(1, time / duration) : 0
  const canExport = engine.loaded && !syncing && !!recFormat

  return (
    <div className="relative min-h-screen text-white">
      {/* fundo: malha de cor desfocada que o vidro refrata */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-[#09090d]" aria-hidden>
        <div className="absolute -left-48 -top-48 h-[640px] w-[640px] rounded-full bg-[#4b3bff]/30 blur-[130px]" />
        <div className="absolute -right-40 top-[18%] h-[560px] w-[560px] rounded-full bg-[#ff3d7f]/[0.16] blur-[130px]" />
        <div className="absolute -bottom-52 left-[28%] h-[600px] w-[600px] rounded-full bg-[#00b8ff]/[0.17] blur-[130px]" />
      </div>

      {/* barra de ferramentas */}
      <header className="glass-bar sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-white/[0.12] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
              <IconWave />
            </span>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Lyric Studio</h1>
              <p className="text-[11px] text-white/45">Letra em código · Reels 9:16</p>
            </div>
          </div>
          {!exporting ? (
            <Btn variant="primary" onClick={exportVideo} disabled={!canExport}>
              <IconDownload />
              Exportar
            </Btn>
          ) : (
            <Btn variant="danger" onClick={cancelExport}>
              Cancelar gravação
            </Btn>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-7">
          {/* áudio */}
          <Group
            title="Áudio"
            footer={
              engine.loaded
                ? undefined
                : 'Sem áudio, o preview roda em modo demonstração, com espectro simulado.'
            }
          >
            <label className="group flex cursor-pointer items-center gap-4 px-4 py-4 transition hover:bg-white/[0.04]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.1] text-white/80">
                <IconWave />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">
                  {engine.loaded ? engine.fileName : 'Escolher arquivo de áudio'}
                </span>
                <span className="block text-xs text-white/45">
                  {engine.loaded ? `${fmtTime(duration)} de duração` : 'mp3, wav, m4a, ogg'}
                </span>
              </span>
              <span className="text-[13px] text-accent">{engine.loaded ? 'Trocar' : 'Selecionar'}</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => onAudio(e.target.files?.[0])}
              />
            </label>
            {audioError && <Row label={<span className="text-[#ff6961]">{audioError}</span>} />}
          </Group>

          {/* música */}
          <Group title="Música">
            <Row label="Título" hint="Vira o comando ou o nome da classe">
              <Field value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
            </Row>
            <Row label="Artista">
              <Field value={meta.artist} onChange={(e) => setMeta({ ...meta, artist: e.target.value })} />
            </Row>
            <Row label="Ano">
              <Field
                type="number"
                value={meta.year}
                onChange={(e) => setMeta({ ...meta, year: Number(e.target.value) })}
              />
            </Row>
          </Group>

          {/* letra */}
          <Group
            title="Letra"
            action={
              <label className="cursor-pointer text-[13px] text-accent transition hover:opacity-75">
                Importar .lrc
                <input
                  type="file"
                  accept=".lrc,.txt,text/plain"
                  className="hidden"
                  onChange={(e) => onLrc(e.target.files?.[0])}
                />
              </label>
            }
            footer={
              <>
                Um verso por linha. Linha em branco separa estrofes e <code className="font-mono">[Refrão]</code> nomeia a
                estrofe. Versos com <code className="font-mono">[mm:ss.xx]</code> usam esse tempo. Você pode mixar estilos
                automaticamente ou usar tags como <code className="font-mono">{'{log}'}</code>, <code className="font-mono">{'{sing}'}</code>, <code className="font-mono">{'{push}'}</code>, <code className="font-mono">{'{const}'}</code> em cada verso.
              </>
            }
          >
            <Pane>
              <textarea
                value={text}
                readOnly={syncing}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                rows={11}
                aria-label="Letra da música"
                className="block w-full resize-y bg-transparent font-mono text-[13px] leading-6 text-white/85 outline-none placeholder:text-white/25"
              />
            </Pane>
          </Group>

          {/* sincronização */}
          <Group
            title="Sincronização"
            footer={
              syncing
                ? undefined
                : engine.loaded
                  ? 'Ouça a música e marque o início de cada verso no ritmo.'
                  : 'Carregue um áudio para marcar os tempos tocando.'
            }
          >
            {!syncing ? (
              <>
                <Row label="Marcar tempos tocando" hint="Espaço marca o início do verso, ⌫ desfaz">
                  <Btn variant="primary" size="sm" onClick={startSync} disabled={!engine.loaded || !parsed.length || exporting}>
                    Iniciar
                  </Btn>
                </Row>
                <Row label="Limpar tempos">
                  <Btn size="sm" onClick={() => setText((p) => stripAllTags(p))} disabled={exporting}>
                    Limpar
                  </Btn>
                </Row>
              </>
            ) : (
              <Pane>
                <p className="text-xs text-white/45">
                  {syncCursor! < parsed.length
                    ? `Verso ${syncCursor! + 1} de ${parsed.length}`
                    : 'Todos os versos marcados'}
                </p>
                <p className="my-2 min-h-[2.25rem] text-[19px] font-semibold leading-snug tracking-[-0.01em]">
                  {syncLine ? syncLine.text : 'Concluído'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="primary" onClick={stamp} disabled={!syncLine}>
                    Marcar
                  </Btn>
                  <Btn onClick={undoStamp} disabled={syncCursor === 0}>
                    Desfazer
                  </Btn>
                  <Btn onClick={() => setSyncCursor(null)}>
                    <IconCheck />
                    Concluir
                  </Btn>
                </div>
              </Pane>
            )}
          </Group>

          {/* aparência */}
          <Group title="Aparência">
            <Row
              label="Formato"
              hint={
                terminal
                  ? 'Só o código sendo escrito, em preto liso'
                  : codeFormat === 'javascript'
                    ? 'Classe JavaScript com brilho e reação ao áudio'
                    : 'Classe Python com brilho e reação ao áudio'
              }
            >
              <Segmented
                value={codeFormat}
                onChange={changeFormat}
                options={[
                  { value: 'terminal', label: 'Terminal' },
                  { value: 'python', label: 'Python' },
                  { value: 'javascript', label: 'JavaScript' },
                ]}
              />
            </Row>
            <Row label="Ondas sonoras" hint="Barras de espectro no rodapé do vídeo">
              <Switch label="Ondas sonoras" checked={spectrum} onChange={setSpectrum} />
            </Row>
            <Row label="Tema">
              <Select value={themeId} onChange={(e) => setThemeId(e.target.value)} aria-label="Tema de cores">
                {THEMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Row>
            {!terminal && (
              <>
                <Row label="Cada verso como">
                  <Select
                    value={style}
                    onChange={(e) => setStyle(e.target.value as CallStyleId)}
                    aria-label="Forma de cada verso"
                  >
                    {(codeFormat === 'javascript'
                      ? (['mixed', 'log', 'sing_js', 'push', 'const_js', 'emit_js', 'yield'] as CallStyleId[])
                      : (['mixed', 'print', 'sing', 'append', 'var_py', 'emit_py', 'yield'] as CallStyleId[])
                    ).map((id) => (
                      <option key={id} value={id}>
                        {CALL_STYLES[id].label}
                      </option>
                    ))}
                  </Select>
                </Row>
                <Row label="Indentação">
                  <Segmented
                    value={indent}
                    onChange={setIndent}
                    options={[
                      { value: 2, label: '2' },
                      { value: 4, label: '4' },
                    ]}
                  />
                </Row>
              </>
            )}
            <Row label="Tamanho do texto">
              <div className="flex w-52 items-center gap-3">
                <Slider label="Tamanho do texto" value={fontSize} min={26} max={56} onChange={setFontSize} />
                <span className="w-8 text-right text-[13px] tabular-nums text-white/50">{fontSize}</span>
              </div>
            </Row>
            <Row
              label="Rótulo das estrofes"
              hint={terminal ? '[verso 1]' : codeFormat === 'javascript' ? '// Verso 1' : '# Verso 1'}
            >
              <Switch label="Rótulo das estrofes" checked={sections} onChange={setSections} />
            </Row>
            <Row label="Números de linha">
              <Switch label="Números de linha" checked={lineNumbers} onChange={setLineNumbers} />
            </Row>
            <Row label="Guias da zona segura" hint="Só no preview, nunca no vídeo">
              <Switch label="Guias da zona segura" checked={guides} onChange={setGuides} />
            </Row>
          </Group>

          {/* exportação */}
          <Group
            title="Exportação · 1080 × 1920"
            footer={
              <>
                {recFormat
                  ? recFormat.h264
                    ? 'Este navegador grava em MP4 com H.264/AAC, pronto para o Instagram.'
                    : `Este navegador grava em ${recFormat.ext.toUpperCase()} sem garantia de H.264. Se necessário, o app mostra como converter.`
                  : 'Este navegador não suporta gravação de vídeo. Use Chrome, Edge ou Safari recente.'}{' '}
                A gravação acontece em tempo real, na duração da música.
              </>
            }
          >
            <Row label="Quadros por segundo">
              <Segmented
                value={fps}
                onChange={setFps}
                disabled={exporting}
                options={[
                  { value: 30, label: '30' },
                  { value: 60, label: '60' },
                ]}
              />
            </Row>
            <Row label="Silenciar durante a gravação">
              <Switch label="Silenciar durante a gravação" checked={muteExport} onChange={setMuteExport} disabled={exporting} />
            </Row>
            {exporting && (
              <Pane>
                <div className="h-1 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
                </div>
                <p className="mt-2 text-xs text-white/45">
                  Gravando {fmtTime(time)} de {fmtTime(duration)}. Mantenha esta aba aberta e visível.
                </p>
              </Pane>
            )}
            {exp.phase === 'done' && (
              <Pane>
                <a href={exp.url} download={exp.name} className="text-[15px] font-medium text-accent hover:underline">
                  Baixar {exp.name}
                </a>
                <span className="ml-2 text-xs text-white/40">{(exp.size / 1e6).toFixed(1)} MB</span>
                {!exp.h264 && (
                  <p className="mt-1.5 text-xs leading-relaxed text-white/45">
                    Este navegador não gravou em H.264/AAC, que é o que o Instagram espera. Converta antes de postar:{' '}
                    <code className="font-mono text-white/65">
                      ffmpeg -i {exp.name} -c:v libx264 -pix_fmt yuv420p -c:a aac reels.mp4
                    </code>
                  </p>
                )}
              </Pane>
            )}
            {exp.phase === 'error' && <Row label={<span className="text-[#ff6961]">{exp.message}</span>} />}
          </Group>
        </div>

        {/* preview */}
        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <div className="glass rounded-[34px] p-2.5">
            <div
              className="relative mx-auto overflow-hidden rounded-[26px] bg-black ring-1 ring-white/10"
              style={{ width: 'min(100%, calc(66vh * 9 / 16))', aspectRatio: '9 / 16' }}
            >
              <Preview
                canvasRef={canvasRef}
                engine={engine}
                lines={built.lines}
                theme={theme}
                demoTotal={built.total}
                exporting={exporting}
                opts={{
                  fontSize,
                  lineNumbers,
                  showGuides: guides,
                  clean: terminal,
                  spectrum,
                  statusLeft: `$ python ${built.varName}.py`,
                }}
              />
              {engine.loaded && !playing && time < 0.05 && !exporting && (
                <button
                  onClick={togglePlay}
                  aria-label="Reproduzir"
                  className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px] transition hover:bg-black/25"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-white shadow-lg backdrop-blur-xl">
                    <IconPlay />
                  </span>
                </button>
              )}
              {!engine.loaded && (
                <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white/70 backdrop-blur-md">
                  Demonstração
                </span>
              )}
            </div>
          </div>

          <div className="glass mt-3 flex items-center gap-3 rounded-full py-2 pl-2 pr-4">
            <Btn
              variant="glass"
              onClick={togglePlay}
              disabled={!engine.loaded || exporting}
              aria-label={playing ? 'Pausar' : 'Reproduzir'}
              className="!h-9 !w-9 !p-0"
            >
              {playing ? <IconPause /> : <IconPlay />}
            </Btn>
            <Slider
              label="Posição da música"
              value={Math.min(time, duration || 1)}
              min={0}
              max={duration || 1}
              step={0.01}
              disabled={!engine.loaded || exporting}
              onChange={(v) => {
                engine.seek(v)
                setTime(v)
              }}
              className="min-w-0 flex-1"
            />
            <span className="w-[88px] text-right text-xs tabular-nums text-white/50">
              {fmtTime(time)} / {fmtTime(duration)}
            </span>
          </div>
        </aside>
      </main>
    </div>
  )
}
