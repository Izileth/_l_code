import { useEffect, useRef, type RefObject } from 'react'
import type { AudioEngine } from '../lib/audio'
import { H, LyricCodeRenderer, W } from '../lib/renderer'
import type { CodeLine, RenderOptions, Theme } from '../lib/types'

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

      p.engine.update(dt)

      let t: number
      const total = p.demoTotal

      if (p.engine.loaded) {
        t = p.engine.time
      } else {
        if (p.exporting || !p.engine.paused) {
          t = p.engine.time
        } else {
          // modo demonstração: relógio sintético que faz loop quando ocioso
          demoT += dt
          if (demoT > p.demoTotal) {
            demoT = 0
            renderer.reset()
          }
          t = demoT
        }
      }

      renderer.render(
        ctx,
        p.lines,
        p.theme,
        { ...p.opts, total, showGuides: p.opts.showGuides && !p.exporting },
        {
          t,
          dt,
          now,
          levels: p.engine.levels,
        },
      )
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={props.canvasRef} className="block h-full w-full" />
}
