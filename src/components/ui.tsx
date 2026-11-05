import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

/* ── Ícones Minimalistas Monocromáticos (SVG) ─────────────────── */

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const IconPlay = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
)

export const IconPause = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <rect x="6" y="5" width="4" height="14" rx="0.5" />
    <rect x="14" y="5" width="4" height="14" rx="0.5" />
  </svg>
)

export const IconDownload = () => (
  <svg {...svgProps} className="h-4 w-4" aria-hidden>
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 20h16" />
  </svg>
)

export const IconWave = () => (
  <svg {...svgProps} className="h-5 w-5" aria-hidden>
    <path d="M3 10v4M7 6v12M11 3v18M15 7v10M19 10v4M22 12v0" />
  </svg>
)

export const IconCheck = () => (
  <svg {...svgProps} className="h-3.5 w-3.5" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const IconUpload = () => (
  <svg {...svgProps} className="h-4 w-4" aria-hidden>
    <path d="M12 17V5m0 0-4 4m4-4 4 4M4 20h16" />
  </svg>
)

/* ── Estruturas Editoriais e Painéis ─────────────────────────── */

export function Group({
  title,
  index,
  action,
  footer,
  children,
}: {
  title?: string
  index?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border border-[#222222] bg-[#0e0e0e] transition-colors duration-150">
      {(title || action || index) && (
        <div className="flex items-center justify-between border-b border-[#222222] bg-[#121212] px-4 py-2.5">
          <div className="flex items-center gap-2">
            {index && (
              <span className="font-mono text-[11px] font-semibold tracking-wider text-[#666666]">
                {index}
              </span>
            )}
            <h2 className="font-mono text-[11px] font-medium tracking-wider text-[#aaaaaa] uppercase">
              {title}
            </h2>
          </div>
          {action}
        </div>
      )}
      <div className="divide-y divide-[#1e1e1e]">{children}</div>
      {footer && (
        <div className="border-t border-[#1c1c1c] bg-[#0a0a0a] px-4 py-2 text-[11px] leading-relaxed text-[#707070]">
          {footer}
        </div>
      )}
    </section>
  )
}

export function Row({
  label,
  hint,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-[46px] items-center justify-between gap-4 px-4 py-2.5 hover:bg-[#121212]/50 transition-colors">
      <div className="min-w-0 pr-2">
        <div className="text-[13px] font-normal tracking-[-0.01em] text-[#e8e8e8]">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-tight text-[#6e6e6e]">{hint}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center">{children}</div>}
    </div>
  )
}

export function Pane({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}

/* ── Controles e Entradas ─────────────────────────────────────── */

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return (
    <input
      {...rest}
      className={`h-8 w-52 max-w-full rounded-none border border-[#262626] bg-[#141414] px-2.5 text-right font-mono text-[12px] text-[#f2f2f2] outline-none transition focus:border-[#777777] placeholder:text-[#444444] ${className}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <div className="relative">
      <select
        {...rest}
        className={`h-8 cursor-pointer appearance-none rounded-none border border-[#2a2a2a] bg-[#141414] py-1 pl-3 pr-8 text-[12px] font-mono text-[#e5e5e5] outline-none transition hover:border-[#444444] focus:border-[#888888] disabled:opacity-40 [&>option]:bg-[#121212] [&>option]:text-[#e0e0e0] ${className}`}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#777777]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div
      className={`inline-flex border border-[#262626] bg-[#121212] p-[2px] ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      role="radiogroup"
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1 font-mono text-[11px] uppercase tracking-wide transition focus-visible:outline-none ${
              on
                ? 'bg-[#f2f2f2] text-[#080808] font-semibold'
                : 'text-[#888888] hover:text-[#d0d0d0]'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[40px] shrink-0 border transition-colors focus-visible:outline-none focus-visible:border-white disabled:opacity-30 ${
        checked
          ? 'border-[#f2f2f2] bg-[#f2f2f2]'
          : 'border-[#333333] bg-[#161616]'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[16px] w-[16px] transition-transform duration-150 ${
          checked
            ? 'translate-x-[19px] bg-[#080808]'
            : 'translate-x-[2px] bg-[#666666]'
        }`}
      />
    </button>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  label,
  className = '',
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  disabled?: boolean
  label: string
  className?: string
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`slider ${className}`}
      style={{ '--p': `${pct}%` } as CSSProperties}
    />
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'glass' | 'danger'
  size?: 'sm' | 'md'
}

export function Btn({ variant = 'secondary', size = 'md', className = '', ...rest }: BtnProps) {
  const base =
    'inline-flex shrink-0 items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-wider transition active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-35 cursor-pointer'
  const sizes = { sm: 'h-7 px-2.5', md: 'h-8 px-3.5' }[size]
  const styles = {
    primary:
      'bg-[#f2f2f2] text-[#080808] font-semibold border border-[#f2f2f2] hover:bg-white',
    secondary:
      'bg-[#161616] text-[#e0e0e0] border border-[#2e2e2e] hover:border-[#666666] hover:bg-[#1f1f1f]',
    glass:
      'bg-[#161616] text-[#e0e0e0] border border-[#2e2e2e] hover:border-[#666666] hover:bg-[#1f1f1f]',
    danger:
      'bg-[#220d0d] text-[#ff7777] border border-[#ff453a]/40 hover:bg-[#331414] hover:border-[#ff453a]/70',
  }[variant]
  return <button {...rest} className={`${base} ${sizes} ${styles} ${className}`} />
}
