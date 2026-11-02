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

const CANDIDATES: RecorderFormat[] = [
  { mime: 'video/mp4;codecs=avc1.640028,mp4a.40.2', ext: 'mp4', h264: true },
  { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4', h264: true },
  // contêiner MP4 sem codec declarado: o navegador escolhe (pode ser VP9/Opus)
  { mime: 'video/mp4', ext: 'mp4', h264: false },
  { mime: 'video/webm;codecs=vp9,opus', ext: 'webm', h264: false },
  { mime: 'video/webm;codecs=vp8,opus', ext: 'webm', h264: false },
  { mime: 'video/webm', ext: 'webm', h264: false },
]

export function pickFormat(): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') return null
  return CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null
}

/** Grava o canvas (vídeo) + o áudio da música em tempo real. */
export function startRecording(canvas: HTMLCanvasElement, audio: MediaStream, fps: number) {
  const fmt = pickFormat()
  if (!fmt) throw new Error('Este navegador não suporta gravação de vídeo (MediaRecorder).')

  const stream = canvas.captureStream(fps)
  audio.getAudioTracks().forEach((tr) => stream.addTrack(tr))

  const rec = new MediaRecorder(stream, {
    mimeType: fmt.mime,
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 192_000,
  })
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

  rec.start(500)
  return {
    format: fmt,
    stop(): Promise<ExportResult> {
      if (rec.state !== 'inactive') rec.stop()
      return done
    },
  }
}
