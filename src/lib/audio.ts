import { BARS, type Levels } from './types'

/** Toca o áudio, analisa o espectro (FFT) e expõe um stream para gravação. */
export class AudioEngine {
  readonly audio = new Audio()
  ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gain: GainNode | null = null
  private dest: MediaStreamAudioDestinationNode | null = null
  private freq = new Uint8Array(0)
  private url: string | null = null
  private avgBass = 0
  private sinceBeat = 1

  loaded = false
  duration = 0
  fileName = ''
  levels: Levels = { bars: new Float32Array(BARS), level: 0, bass: 0, beat: 0 }

  constructor() {
    this.audio.preload = 'auto'
    this.audio.loop = false
  }

  load(file: File): Promise<void> {
    if (this.url) URL.revokeObjectURL(this.url)
    this.audio.pause()
    this.url = URL.createObjectURL(file)
    this.audio.src = this.url
    return new Promise((resolve, reject) => {
      this.audio.onloadedmetadata = () => {
        this.duration = this.audio.duration
        this.fileName = file.name
        this.loaded = true
        resolve()
      }
      this.audio.onerror = () => reject(new Error('Não foi possível ler este arquivo de áudio.'))
      this.audio.load()
    })
  }

  private ensureGraph() {
    if (this.ctx) return
    const ctx = new AudioContext()
    const source = ctx.createMediaElementSource(this.audio)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.78
    const gain = ctx.createGain()
    const dest = ctx.createMediaStreamDestination()

    source.connect(analyser)
    analyser.connect(gain)
    gain.connect(ctx.destination)
    source.connect(dest)

    this.ctx = ctx
    this.analyser = analyser
    this.gain = gain
    this.dest = dest
    this.freq = new Uint8Array(analyser.frequencyBinCount)
  }

  async play() {
    this.ensureGraph()
    await this.ctx!.resume()
    await this.audio.play()
  }

  pause() {
    this.audio.pause()
  }

  seek(t: number) {
    this.audio.currentTime = Math.min(Math.max(0, t), this.duration || t)
  }

  get time() {
    return this.audio.currentTime
  }

  get paused() {
    return this.audio.paused
  }

  /** Silencia só as caixas de som; a gravação continua recebendo o áudio. */
  setSpeakersMuted(muted: boolean) {
    this.ensureGraph()
    this.gain!.gain.value = muted ? 0 : 1
  }

  getRecordingStream(): MediaStream {
    this.ensureGraph()
    return this.dest!.stream
  }

  /** Atualiza níveis, barras do espectro e detecção de batida. */
  update(dt: number) {
    const L = this.levels
    const live = this.analyser && !this.audio.paused

    if (live) {
      this.analyser!.getByteFrequencyData(this.freq)
      const f = this.freq
      for (let i = 0; i < BARS; i++) {
        const lo = Math.floor(2 * Math.pow(140, i / BARS))
        const hi = Math.max(lo + 1, Math.floor(2 * Math.pow(140, (i + 1) / BARS)))
        let sum = 0
        for (let j = lo; j < hi; j++) sum += f[j]
        let v = sum / (hi - lo) / 255
        v = Math.min(1, v * (1 + (i / BARS) * 0.8))
        L.bars[i] = Math.max(v, L.bars[i] * 0.85)
      }
      let b = 0
      for (let j = 1; j < 7; j++) b += f[j]
      L.bass = b / 6 / 255

      this.avgBass = this.avgBass * 0.96 + L.bass * 0.04
      this.sinceBeat += dt
      if (L.bass > this.avgBass * 1.22 && L.bass > 0.45 && this.sinceBeat > 0.2) {
        L.beat = 1
        this.sinceBeat = 0
      }
    } else {
      for (let i = 0; i < BARS; i++) L.bars[i] *= 0.9
      L.bass *= 0.9
    }

    L.beat *= Math.exp(-dt * 7)
    let avg = 0
    for (let i = 0; i < BARS; i++) avg += L.bars[i]
    L.level = avg / BARS
  }
}
