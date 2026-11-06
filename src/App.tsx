import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './lib/audio'
import { CALL_STYLES, buildCode } from './lib/codegen'
import { pickFormat, startRecording } from './lib/exporter'
import {
  SAMPLE_LYRICS,
  fmtTime,
  parseLyrics,
  removeTag,
  resolveLyricsDuration,
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
  IconUpload,
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
  const [recordAudio, setRecordAudio] = useState(true)
  const [exportDuration, setExportDuration] = useState<'lyrics' | 'full'>('lyrics')
  const [muteExport, setMuteExport] = useState(true)
  const [exp, setExp] = useState<ExportState>({ phase: 'idle' })

  /** null = fora do modo sincronizar; número = próxima linha a marcar */
  const [syncCursor, setSyncCursor] = useState<number | null>(null)

  const theme = getTheme(themeId)
  const terminal = codeFormat === 'terminal'
  const parsed = useMemo(() => parseLyrics(text), [text])
  const lyricsOnly = !engine.loaded || !recordAudio || exportDuration === 'lyrics'
  const effectiveDuration = useMemo(
    () => resolveLyricsDuration(parsed, duration, lyricsOnly),
    [parsed, duration, lyricsOnly],
  )
  const times = useMemo(() => resolveTimes(parsed, effectiveDuration), [parsed, effectiveDuration])
  const built = useMemo(
    () =>
      buildCode(parsed, times, meta, {
        format: codeFormat,
        style,
        indent,
        sections,
        duration: effectiveDuration,
        lyricsOnly,
      }),
    [parsed, times, meta, codeFormat, style, indent, sections, effectiveDuration, lyricsOnly],
  )
  const effectiveTotal = lyricsOnly ? built.total : (duration || built.total)
  const recFormat = useMemo(() => pickFormat(recordAudio && engine.loaded), [recordAudio, engine.loaded])
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
    if (!engine.loaded && !parsed.length) return
    if (!engine.loaded) {
      engine.setVirtualDuration(effectiveTotal)
    }
    if (engine.paused) {
      if (engine.time >= effectiveTotal && effectiveTotal > 0) {
        engine.seek(0)
      }
      await engine.play()
    } else {
      engine.pause()
    }
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
    if (!canvas) return
    cancelledRef.current = false
    setExp({ phase: 'recording' })

    const hasAudio = recordAudio && engine.loaded
    const targetDuration = effectiveTotal

    try {
      engine.pause()
      engine.seek(0)
      if (!engine.loaded) {
        engine.setVirtualDuration(targetDuration)
      }
      engine.setSpeakersMuted(muteExport && hasAudio)

      const audioStream = hasAudio ? engine.getRecordingStream() : null
      const rec = startRecording(canvas, audioStream, fps)
      recRef.current = rec

      const waitEnded = new Promise<void>((resolve) => {
        let resolved = false
        const done = () => {
          if (resolved) return
          resolved = true
          resolve()
        }

        const wallTimer = window.setTimeout(done, targetDuration * 1000 + 800)

        if (engine.loaded) {
          const onEnd = () => {
            engine.audio.removeEventListener('ended', onEnd)
            window.clearTimeout(wallTimer)
            done()
          }
          engine.audio.addEventListener('ended', onEnd)

          cancelRef.current = () => {
            engine.audio.removeEventListener('ended', onEnd)
            window.clearTimeout(wallTimer)
            done()
          }
        } else {
          cancelRef.current = () => {
            window.clearTimeout(wallTimer)
            done()
          }
        }
      })

      await engine.play()
      await waitEnded

      await new Promise((r) => setTimeout(r, 300))

      const result = await rec.stop()
      recRef.current = null
      engine.pause()
      engine.setSpeakersMuted(false)
      engine.seek(0)
      if (cancelledRef.current) {
        setExp({ phase: 'idle' })
        return
      }

      const audioSuffix = hasAudio ? '' : '-mudo'
      const name = `${built.className.toLowerCase()}-reels${audioSuffix}.${result.ext}`
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
    if (engine.loaded) engine.setSpeakersMuted(false)
    setExp({ phase: 'idle' })
  }

  const syncLine = syncCursor !== null ? parsed[syncCursor] : undefined
  const progress = effectiveTotal > 0 ? Math.min(1, time / effectiveTotal) : 0
  const canExport = !syncing && !!recFormat && (parsed.length > 0 || engine.loaded)

  return (
    <div className="min-h-screen bg-[#080808] text-[#f2f2f2] antialiased">
      {/* Barra de Navegação Superior — Editorial e Minimalista */}
      <header className="sticky top-0 z-30 border-b border-[#202020] bg-[#0c0c0c]/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 sm:h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-mono text-[11px] sm:text-xs font-bold tracking-widest text-[#f2f2f2] whitespace-nowrap">
                LYRIC STUDIO
              </span>
              <span className="border border-[#2a2a2a] bg-[#141414] px-1.5 py-0.5 font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-[#888888] whitespace-nowrap">
                PRO // 9:16
              </span>
            </div>
            <div className="hidden h-3.5 w-[1px] bg-[#222222] md:block" />
            <span className="hidden font-mono text-[11px] text-[#666666] md:inline">
              REELS &amp; TIKTOK CODE ENGINE
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!exporting ? (
              <Btn variant="primary" onClick={exportVideo} disabled={!canExport}>
                <IconDownload />
                <span className="hidden xs:inline sm:inline">Exportar Vídeo</span>
                <span className="sm:hidden">Export</span>
              </Btn>
            ) : (
              <Btn variant="danger" onClick={cancelExport}>
                <span className="hidden sm:inline">Cancelar Gravação</span>
                <span className="sm:hidden">Cancelar</span>
              </Btn>
            )}
          </div>
        </div>
      </header>

      {/* Espaço de Trabalho Editorial em 2 Colunas */}
      <main className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 pt-8 lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_420px]">
        {/* Coluna Esquerda: Espaço de Edição (approx 60-65%) */}
        <div className="space-y-6">
          {/* 01. ÁUDIO */}
          <Group
            index="01"
            title="Arquivo de Áudio"
            footer={
              engine.loaded
                ? `Áudio carregado com sucesso (${fmtTime(duration)}). Sincronização pronta.`
                : 'Modo demonstração ativo sem arquivo de áudio. Suporta MP3, WAV, M4A, OGG.'
            }
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#101010]">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#2a2a2a] bg-[#161616] text-[#cccccc]">
                  <IconWave />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[13px] font-medium text-[#f2f2f2]">
                    {engine.loaded ? engine.fileName : 'Nenhum arquivo de áudio selecionado'}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#777777]">
                    {engine.loaded
                      ? `${fmtTime(duration)} de reprodução`
                      : 'MP3 · WAV · M4A · OGG (arraste ou selecione)'}
                  </div>
                </div>
              </div>

              <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border border-[#333333] bg-[#181818] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-[#f2f2f2] transition hover:border-[#777777] hover:bg-[#222222]">
                <IconUpload />
                <span>{engine.loaded ? 'Substituir' : 'Selecionar'}</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => onAudio(e.target.files?.[0])}
                />
              </label>
            </div>
            {audioError && (
              <div className="border-t border-[#3a1a1a] bg-[#220d0d] px-4 py-2 font-mono text-xs text-[#ff7777]">
                {audioError}
              </div>
            )}
          </Group>

          {/* 02. METADADOS DA MÚSICA */}
          <Group index="02" title="Metadados da Música">
            <Row label="Título da Música" hint="Nome da faixa musical e comando base do código">
              <Field
                value={meta.title}
                placeholder="Ex: Loop do Meu Mundo"
                onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              />
            </Row>
            <Row label="Artista / Banda" hint="Autor da composição">
              <Field
                value={meta.artist}
                placeholder="Ex: Manu"
                onChange={(e) => setMeta({ ...meta, artist: e.target.value })}
              />
            </Row>
            <Row label="Ano de Lançamento" hint="Metadado de referência">
              <Field
                type="number"
                value={meta.year}
                onChange={(e) => setMeta({ ...meta, year: Number(e.target.value) })}
              />
            </Row>
          </Group>

          {/* 03. EDITOR DE LETRA */}
          <Group
            index="03"
            title="Letra da Música"
            action={
              <label className="flex cursor-pointer items-center gap-1.5 border border-[#2e2e2e] bg-[#161616] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#cccccc] transition hover:border-[#666666] hover:text-white">
                <IconUpload />
                <span>Importar .LRC</span>
                <input
                  type="file"
                  accept=".lrc,.txt,text/plain"
                  className="hidden"
                  onChange={(e) => onLrc(e.target.files?.[0])}
                />
              </label>
            }
            footer={
              <div className="space-y-1">
                <div>
                  Estrutura: 1 verso por linha · Linha em branco separa estrofes ·{' '}
                  <span className="font-mono text-[#aaaaaa]">[Refrão]</span> rotula a estrofe ·{' '}
                  <span className="font-mono text-[#aaaaaa]">[mm:ss.xx]</span> define o timestamp.
                </div>
                <div>
                  Tags de estilo de verso:{' '}
                  <span className="font-mono text-[#999999]">&#123;sudo&#125;</span>,{' '}
                  <span className="font-mono text-[#999999]">&#123;echo&#125;</span>,{' '}
                  <span className="font-mono text-[#999999]">&#123;wall&#125;</span>,{' '}
                  <span className="font-mono text-[#999999]">&#123;log&#125;</span>,{' '}
                  <span className="font-mono text-[#999999]">&#123;sing&#125;</span>.
                </div>
              </div>
            }
          >
            <div className="relative bg-[#0c0c0c]">
              <div className="flex items-center justify-between border-b border-[#1c1c1c] px-4 py-1.5 font-mono text-[10px] text-[#666666]">
                <span>EDITOR MONOESPACIAL</span>
                <span>{parsed.length} VERSOS DETECTADOS</span>
              </div>
              <textarea
                value={text}
                readOnly={syncing}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                rows={12}
                aria-label="Letra da música"
                className="block w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-6 text-[#dedede] outline-none placeholder:text-[#3a3a3a] focus:bg-[#0f0f0f]"
              />
            </div>
          </Group>

          {/* 04. SINCRONIZAÇÃO */}
          <Group
            index="04"
            title="Sincronização Rítmica"
            footer={
              syncing
                ? 'Modo de marcação ativo. Pressione Espaço no início de cada linha cantada.'
                : engine.loaded
                  ? 'Ouça a música e marque o início de cada verso no compasso.'
                  : 'Carregue um arquivo de áudio acima para habilitar a marcação rítmica.'
            }
          >
            {!syncing ? (
              <>
                <Row
                  label="Marcar tempos tocando"
                  hint="Pressione [Espaço] para marcar o verso e [Backspace] para desfazer"
                >
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={startSync}
                    disabled={!engine.loaded || !parsed.length || exporting}
                  >
                    Iniciar Sincronia
                  </Btn>
                </Row>
                <Row label="Limpar marcações de tempo" hint="Remove todos os carimbos [mm:ss.xx]">
                  <Btn
                    size="sm"
                    onClick={() => setText((p) => stripAllTags(p))}
                    disabled={exporting}
                  >
                    Limpar
                  </Btn>
                </Row>
              </>
            ) : (
              <div className="border border-[#383838] bg-[#121212] p-5">
                <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                  <span className="font-mono text-[11px] font-semibold tracking-wider text-[#888888]">
                    {syncCursor! < parsed.length
                      ? `VERSO [${syncCursor! + 1} / ${parsed.length}]`
                      : 'TODOS OS VERSOS CARIMBADOS'}
                  </span>
                  <span className="font-mono text-[11px] text-[#666666]">
                    TEMPO ATUAL: {fmtTime(time)}
                  </span>
                </div>

                <div className="my-5 min-h-[3rem] font-mono text-[18px] font-medium leading-relaxed tracking-tight text-[#f2f2f2]">
                  {syncLine ? (
                    <span>&ldquo;{syncLine.text}&rdquo;</span>
                  ) : (
                    <span className="text-[#888888]">// Concluído com sucesso</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-[#222222] pt-4">
                  <Btn variant="primary" onClick={stamp} disabled={!syncLine}>
                    Marcar [Espaço]
                  </Btn>
                  <Btn onClick={undoStamp} disabled={syncCursor === 0}>
                    Desfazer [⌫]
                  </Btn>
                  <Btn onClick={() => setSyncCursor(null)}>
                    <IconCheck />
                    <span>Concluir Sincronia</span>
                  </Btn>
                </div>
              </div>
            )}
          </Group>

          {/* 05. CONFIGURAÇÃO VISUAL & ESTILO */}
          <Group index="05" title="Configuração Visual &amp; Renderizador">
            <Row
              label="Linguagem do Código"
              hint={
                terminal
                  ? 'Estilo script shell / bash, estética brutalista'
                  : codeFormat === 'javascript'
                    ? 'Classe JavaScript com sintaxe refinada'
                    : 'Classe Python com tipagem e sintaxe elegante'
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

            <Row label="Espectro de Ondas Sonoras" hint="Barras de frequência reativas no rodapé">
              <Switch label="Ondas sonoras" checked={spectrum} onChange={setSpectrum} />
            </Row>

            <Row label="Tema Cromático" hint="Paleta de sintaxe do código">
              <Select
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
                aria-label="Tema de cores"
              >
                {THEMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Row>

            <Row label="Estrutura de cada verso" hint="Assinatura sintática gerada">
              <Select
                value={style}
                onChange={(e) => setStyle(e.target.value as CallStyleId)}
                aria-label="Forma de cada verso"
              >
                {(terminal
                  ? ([
                      'mixed',
                      'term_sudo_echo',
                      'term_echo',
                      'term_sudo_play',
                      'term_wall',
                      'term_printf',
                      'term_export',
                      'term_tee',
                      'out',
                    ] as CallStyleId[])
                  : codeFormat === 'javascript'
                    ? (['mixed', 'log', 'sing_js', 'push', 'const_js', 'emit_js', 'yield'] as CallStyleId[])
                    : (['mixed', 'print', 'sing', 'append', 'var_py', 'emit_py', 'yield'] as CallStyleId[])
                ).map((id) => (
                  <option key={id} value={id}>
                    {CALL_STYLES[id].label}
                  </option>
                ))}
              </Select>
            </Row>

            {!terminal && (
              <Row label="Indentação" hint="Espaçamento em colunas">
                <Segmented
                  value={indent}
                  onChange={setIndent}
                  options={[
                    { value: 2, label: '2 espaços' },
                    { value: 4, label: '4 espaços' },
                  ]}
                />
              </Row>
            )}

            <Row label="Tamanho Tipográfico" hint="Escala da fonte monoespacial no canvas">
              <div className="flex w-52 items-center gap-3">
                <Slider
                  label="Tamanho do texto"
                  value={fontSize}
                  min={26}
                  max={56}
                  onChange={setFontSize}
                />
                <span className="w-8 font-mono text-[12px] tabular-nums text-[#888888]">
                  {fontSize}px
                </span>
              </div>
            </Row>

            <Row
              label="Comentários de Seção"
              hint={terminal ? '[verso 1]' : codeFormat === 'javascript' ? '// Verso 1' : '# Verso 1'}
            >
              <Switch label="Rótulo das estrofes" checked={sections} onChange={setSections} />
            </Row>

            <Row label="Numeração de Linhas" hint="Exibe régua lateral no código">
              <Switch label="Números de linha" checked={lineNumbers} onChange={setLineNumbers} />
            </Row>

            <Row label="Guias da Zona Segura" hint="Referência para Reels/TikTok (apenas preview)">
              <Switch label="Guias da zona segura" checked={guides} onChange={setGuides} />
            </Row>
          </Group>

          {/* 06. PIPELINE DE EXPORTAÇÃO */}
          <Group
            index="06"
            title="Pipeline de Exportação · 1080 × 1920"
            footer={
              <>
                {recFormat
                  ? recFormat.h264
                    ? 'Navegador compatível com gravação direta em MP4 (H.264 / AAC).'
                    : `Gravação via container ${recFormat.ext.toUpperCase()}. Compatível com conversão rápida FFmpeg.`
                  : 'Navegador incompatível com gravação de vídeo. Utilize Google Chrome, Edge ou Safari.'}{' '}
                {lyricsOnly
                  ? 'A gravação será encerrada automaticamente após o término da letra.'
                  : 'A gravação renderizará a faixa completa da música em tempo real.'}
              </>
            }
          >
            <Row label="Taxa de Quadros (FPS)" hint="Fluidez do vídeo gravado">
              <Segmented
                value={fps}
                onChange={setFps}
                disabled={exporting}
                options={[
                  { value: 30, label: '30 FPS' },
                  { value: 60, label: '60 FPS' },
                ]}
              />
            </Row>

            <Row
              label="Gravar Áudio no Arquivo"
              hint={
                !engine.loaded
                  ? 'Nenhum áudio carregado (vídeo exportado em silêncio)'
                  : recordAudio
                    ? 'Faixa de áudio sintetizada no contêiner de vídeo'
                    : 'Exporta sem áudio (para anexar trilha no Instagram/TikTok)'
              }
            >
              <Switch
                label="Gravar áudio no vídeo"
                checked={recordAudio && engine.loaded}
                onChange={setRecordAudio}
                disabled={!engine.loaded || exporting}
              />
            </Row>

            <Row
              label="Duração da Renderização"
              hint={
                !engine.loaded
                  ? `Duração da digitação do código (~${fmtTime(effectiveTotal)})`
                  : lyricsOnly
                    ? `Encerra assim que a letra termina (~${fmtTime(effectiveTotal)})`
                    : `Grava a música inteira (~${fmtTime(engine.duration)})`
              }
            >
              <Segmented
                value={lyricsOnly ? 'lyrics' : 'full'}
                onChange={(v) => setExportDuration(v as 'lyrics' | 'full')}
                disabled={!engine.loaded || !recordAudio || exporting}
                options={[
                  { value: 'lyrics', label: 'Somente Letra' },
                  { value: 'full', label: 'Música Inteira' },
                ]}
              />
            </Row>

            {recordAudio && engine.loaded && (
              <Row
                label="Silenciar Alto-Falantes na Gravação"
                hint="Mantém silêncio local durante a exportação sem afetar o vídeo"
              >
                <Switch
                  label="Silenciar na gravação"
                  checked={muteExport}
                  onChange={setMuteExport}
                  disabled={exporting}
                />
              </Row>
            )}

            {exporting && (
              <Pane className="bg-[#121212]">
                <div className="flex items-center justify-between font-mono text-[11px] text-[#999999] mb-2">
                  <span>RENDERIZANDO QUADROS...</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1 w-full bg-[#202020]">
                  <div
                    className="h-full bg-[#f2f2f2] transition-all duration-200"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <p className="mt-2.5 font-mono text-[11px] text-[#666666]">
                  Gravando {fmtTime(time)} de {fmtTime(effectiveTotal)}. Mantenha esta aba ativa.
                </p>
              </Pane>
            )}

            {exp.phase === 'done' && (
              <Pane className="bg-[#141414] border-t border-[#262626]">
                <div className="flex items-center justify-between">
                  <a
                    href={exp.url}
                    download={exp.name}
                    className="font-mono text-[13px] font-semibold text-[#f2f2f2] underline underline-offset-4 hover:text-white"
                  >
                    Baixar {exp.name}
                  </a>
                  <span className="font-mono text-[11px] text-[#888888]">
                    {(exp.size / 1e6).toFixed(1)} MB
                  </span>
                </div>
                {!exp.h264 && (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#777777]">
                    Para otimização universal no Instagram, converta com FFmpeg se necessário:{' '}
                    <code className="block mt-1 bg-[#0a0a0a] p-2 text-[#cccccc] border border-[#222222]">
                      ffmpeg -i {exp.name} -c:v libx264 -pix_fmt yuv420p -c:a aac reels.mp4
                    </code>
                  </p>
                )}
              </Pane>
            )}

            {exp.phase === 'error' && (
              <div className="border-t border-[#3a1a1a] bg-[#220d0d] px-4 py-2 font-mono text-xs text-[#ff7777]">
                {exp.message}
              </div>
            )}
          </Group>
        </div>

        {/* Coluna Direita: Live Preview 9:16 Frame */}
        <aside className="lg:sticky lg:top-[72px] lg:self-start space-y-3">
          {/* Moldura Arquitetural do Preview */}
          <div className="border border-[#222222] bg-[#0c0c0c] p-2">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1c1c1c] mb-2 font-mono text-[10px] text-[#666666]">
              <span className="uppercase tracking-wider">PREVIEW // 9:16</span>
              <span className="border border-[#242424] px-1 py-0.2 text-[#888888]">
                {engine.loaded ? 'ÁUDIO REAL' : 'DEMO'}
              </span>
            </div>

            <div
              className="relative mx-auto overflow-hidden bg-black border border-[#202020]"
              style={{ width: '100%', aspectRatio: '9 / 16' }}
            >
              <Preview
                canvasRef={canvasRef}
                engine={engine}
                lines={built.lines}
                theme={theme}
                demoTotal={effectiveTotal}
                exporting={exporting}
                opts={{
                  fontSize,
                  lineNumbers,
                  showGuides: guides,
                  clean: false,
                  spectrum,
                  statusLeft: terminal
                    ? `$ ${built.varName}.sh`
                    : codeFormat === 'javascript'
                      ? `node ${built.varName}.js`
                      : `python ${built.varName}.py`,
                }}
              />

              {!playing && time < 0.05 && !exporting && (
                <button
                  onClick={togglePlay}
                  aria-label="Reproduzir prévia"
                  className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] transition hover:bg-black/30 cursor-pointer"
                >
                  <span className="flex h-14 w-14 items-center justify-center border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:scale-105">
                    <IconPlay />
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Console de Controle e Linha de Tempo de Reprodução */}
          <div className="border border-[#222222] bg-[#0e0e0e] px-3 py-2 flex items-center gap-3">
            <Btn
              variant="secondary"
              onClick={togglePlay}
              disabled={(!engine.loaded && !parsed.length) || exporting}
              aria-label={playing ? 'Pausar' : 'Reproduzir'}
              className="!h-8 !w-8 !p-0 shrink-0"
            >
              {playing ? <IconPause /> : <IconPlay />}
            </Btn>

            <Slider
              label="Posição do áudio"
              value={Math.min(time, effectiveTotal || 1)}
              min={0}
              max={effectiveTotal || 1}
              step={0.01}
              disabled={(!engine.loaded && !parsed.length) || exporting}
              onChange={(v) => {
                engine.seek(v)
                setTime(v)
              }}
              className="min-w-0 flex-1"
            />

            <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#888888]">
              {fmtTime(time)} / {fmtTime(effectiveTotal)}
            </span>
          </div>
        </aside>
      </main>
    </div>
  )
}
