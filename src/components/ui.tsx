import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

/* ── ícones (SVG, herdam currentColor) ───────────────────────── */

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const IconPlay = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
    <path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.4-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6Z" />
  </svg>
)
export const IconPause = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
    <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
  </svg>
)
export const IconDownload = () => (
  <svg {...svg} className="h-[17px] w-[17px]" aria-hidden>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19.5h14" />
  </svg>
)
export const IconWave = () => (
  <svg {...svg} className="h-6 w-6" aria-hidden>
    <path d="M4 10v4M8 6.5v11M12 3.5v17M16 8v8M20 10.5v3" />
  </svg>
)
export const IconCheck = () => (
  <svg {...svg} className="h-4 w-4" aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

/* ── agrupamentos estilo "Ajustes" ───────────────────────────── */

export function Group({
  title,
  action,
  footer,
  children,
}: {
  title?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      {(title || action) && (
        <div className="mb-2 flex items-end justify-between px-4">
          <h2 className="text-[13px] font-medium text-white/50">{title}</h2>
          {action}
        </div>
      )}
      <div className="glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">{children}</div>
      {footer && <p className="mt-2 px-4 text-xs leading-relaxed text-white/40">{footer}</p>}
    </section>
  )
}

export function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <div className="text-[15px] text-white/90">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-white/40">{hint}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center">{children}</div>}
    </div>
  )
}

export function Pane({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 py-3.5 ${className}`}>{children}</div>
}

/* ── controles ───────────────────────────────────────────────── */

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return (
    <input
      {...rest}
      className={`w-48 max-w-full bg-transparent text-right text-[15px] text-white/60 outline-none transition placeholder:text-white/25 focus:text-white ${className}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <div className="relative">
      <select
        {...rest}
        className={`cursor-pointer appearance-none rounded-lg bg-white/[0.09] py-1.5 pl-3 pr-8 text-[14px] text-white/90 outline-none transition hover:bg-white/[0.13] focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40 [&>option]:bg-zinc-900 ${className}`}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m7 10 5 5 5-5" />
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
    <div className={`inline-flex rounded-[10px] bg-white/[0.08] p-0.5 ${disabled ? 'opacity-40' : ''}`} role="radiogroup">
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
            className={`rounded-[8px] px-3 py-1 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              on ? 'bg-white/[0.22] text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]' : 'text-white/55 hover:text-white/85'
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
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40 ${
        checked ? 'bg-[#30d158]' : 'bg-white/[0.2]'
      }`}
    >
      <span
        className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
          checked ? 'translate-x-[20px]' : ''
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
  variant?: 'primary' | 'glass' | 'danger'
  size?: 'sm' | 'md'
}

export function Btn({ variant = 'glass', size = 'md', className = '', ...rest }: BtnProps) {
  const base =
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40'
  const sizes = { sm: 'px-3 py-1 text-[13px]', md: 'px-4 py-1.5 text-[14px]' }[size]
  const styles = {
    primary: 'bg-accent text-white shadow-[0_4px_16px_rgba(10,132,255,0.35)] hover:brightness-110',
    glass: 'bg-white/[0.11] text-white/90 hover:bg-white/[0.17]',
    danger: 'bg-[#ff453a]/20 text-[#ff6961] hover:bg-[#ff453a]/30',
  }[variant]
  return <button {...rest} className={`${base} ${sizes} ${styles} ${className}`} />
}
