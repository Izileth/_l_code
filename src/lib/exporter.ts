export interface RecorderFormat {
  mime: string
  ext: 'mp4' | 'webm'
  /** true só quando o codec de vídeo é H.264 declarado explicitamente (o que o Instagram espera) */
  h264: boolean
}

export interface ExportResult {
  blob: Blob
  ext: 'mp4' | 'webm'
  mime: string
  h264: boolean
}

// Candidatos com áudio — testados em ordem de preferência
const CANDIDATES_WITH_AUDIO: RecorderFormat[] = [
  { mime: 'video/mp4;codecs=avc1.640028,mp4a.40.2', ext: 'mp4', h264: true },
  { mime: 'video/mp4;codecs=avc1,mp4a.40.2',        ext: 'mp4', h264: true },
  { mime: 'video/mp4',                               ext: 'mp4', h264: false },
  { mime: 'video/webm;codecs=vp9,opus',              ext: 'webm', h264: false },
  { mime: 'video/webm;codecs=vp8,opus',              ext: 'webm', h264: false },
  { mime: 'video/webm',                              ext: 'webm', h264: false },
]

// Candidatos somente vídeo — Chrome/Edge exigem codec sem áudio explícito
// Na prática a maioria dos navegadores aceita 'video/webm' sem faixas de áudio
const CANDIDATES_VIDEO_ONLY: RecorderFormat[] = [
  { mime: 'video/webm;codecs=vp9', ext: 'webm', h264: false },
  { mime: 'video/webm;codecs=vp8', ext: 'webm', h264: false },
  { mime: 'video/webm',            ext: 'webm', h264: false },
  // MP4 sem faixa de áudio raramente funciona no MediaRecorder; tentativa por último
  { mime: 'video/mp4;codecs=avc1.640028', ext: 'mp4', h264: true },
  { mime: 'video/mp4;codecs=avc1',        ext: 'mp4', h264: true },
  { mime: 'video/mp4',                    ext: 'mp4', h264: false },
]

export function pickFormat(hasAudio = true): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') return null
  const list = hasAudio ? CANDIDATES_WITH_AUDIO : CANDIDATES_VIDEO_ONLY
  return list.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null
}

/** Grava o canvas (vídeo) e opcionalmente o áudio da música em tempo real. */
export function startRecording(canvas: HTMLCanvasElement, audio: MediaStream | null, fps: number) {
  const hasAudio = !!audio && audio.getAudioTracks().length > 0
  const fmt = pickFormat(hasAudio)
  if (!fmt) throw new Error('Este navegador não suporta gravação de vídeo (MediaRecorder).')

  const stream = canvas.captureStream(fps)
  if (hasAudio && audio) {
    audio.getAudioTracks().forEach((tr) => stream.addTrack(tr))
  }

  const recOptions: MediaRecorderOptions = {
    mimeType: fmt.mime,
    videoBitsPerSecond: 10_000_000,
  }
  if (hasAudio) {
    recOptions.audioBitsPerSecond = 192_000
  }

  const rec = new MediaRecorder(stream, recOptions)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }

  const done = new Promise<ExportResult>((resolve) => {
    rec.onstop = () => {
      stream.getVideoTracks().forEach((t) => t.stop())
      resolve({
        blob: new Blob(chunks, { type: fmt.mime.split(';')[0] }),
        ext: fmt.ext,
        mime: fmt.mime,
        h264: fmt.h264,
      })
    }
  })

  // timeslice de 100ms: chunks frequentes garantem que o vídeo não seja truncado
  // no arquivo final mesmo em dispositivos com baixa performance
  rec.start(100)

  return {
    format: fmt,
    stop(): Promise<ExportResult> {
      if (rec.state === 'recording') {
        try { rec.requestData() } catch { /* pode falhar se já parou */ }
      }
      if (rec.state !== 'inactive') rec.stop()
      return done
    },
  }
}
