import { useEffect, useRef, type RefObject } from 'react'
import type { AudioEngine } from '../lib/audio'
import { H, LyricCodeRenderer, W } from '../lib/renderer'
import { BARS, type CodeLine, type Levels, type RenderOptions, type Theme } from '../lib/types'

export interface PreviewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  engine: AudioEngine
  lines: CodeLine[]
  theme: Theme
  opts: Omit<RenderOptions, 'total'>
  demoTotal: number
  exporting: boolean
}

/** Canvas 1080×1920 sempre renderizado; o CSS só reduz para caber na tela. */
export function Preview(props: PreviewProps) {
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const canvas = props.canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = W
    canvas.height = H

    const renderer = new LyricCodeRenderer()
    const demo: Levels = { bars: new Float32Array(BARS), level: 0, bass: 0, beat: 0 }
    let demoT = 0
    let last = performance.now()
    let raf = 0

    const refit = () => renderer.invalidate()
    document.fonts?.load(`400 34px "JetBrains Mono"`).then(refit).catch(() => {})
    document.fonts?.load(`700 34px "JetBrains Mono"`).then(refit).catch(() => {})

    const loop = (nowMs: number) => {
      raf = requestAnimationFrame(loop)
      const p = propsRef.current
      const dt = Math.min(0.1, (nowMs - last) / 1000)
      last = nowMs
      const now = nowMs / 1000

      let t: number
      let levels: Levels
      let total: number

      if (p.engine.loaded) {
        p.engine.update(dt)
        t = p.engine.time
        levels = p.engine.levels
        total = p.engine.duration
      } else {
        // modo demonstração: relógio e espectro sintéticos
        demoT += dt
        if (demoT > p.demoTotal) {
          demoT = 0
          renderer.reset()
        }
        t = demoT
        for (let i = 0; i < BARS; i++) {
          demo.bars[i] = Math.min(
            1,
            0.2 + 0.5 * Math.abs(Math.sin(now * 2.1 + i * 0.45)) * (0.65 + 0.35 * Math.sin(now * 0.9)),
          )
        }
        let sum = 0
        for (let i = 0; i < BARS; i++) sum += demo.bars[i]
        demo.level = sum / BARS
        demo.beat = Math.pow(Math.max(0, Math.sin(now * Math.PI * 2 * 1.8)), 8)
        levels = demo
        total = p.demoTotal
      }

      renderer.render(ctx, p.lines, p.theme, { ...p.opts, total, showGuides: p.opts.showGuides && !p.exporting }, {
        t,
        dt,
        now,
        levels,
      })
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={props.canvasRef} className="block h-full w-full" />
}
