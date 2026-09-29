import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import Ghagra from './Ghagra'
import Wordmark from './landing/Wordmark'

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm font-medium text-neutral-500" role="status">
      <Ghagra className="h-8 w-8" />
      {label}
    </div>
  )
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <Logo className="text-4xl" />
      <Ghagra className="h-12 w-12" />
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  )
}

// The wordmark (dandiya-stick L's), sized by the font size of `className`.
// `brand` follows the phone's colour scheme; `white` is for dark surfaces.
export function Logo({ className = 'text-xl', tone = 'brand' }: { className?: string; tone?: 'brand' | 'white' }) {
  const size = 'h-[1.05em] w-auto'
  return (
    <span className={`inline-flex items-center align-middle ${className}`}>
      {tone === 'white' ? (
        <Wordmark tone="dark" className={size} />
      ) : (
        <>
          <Wordmark className={`${size} dark:hidden`} />
          <Wordmark tone="dark" className={`${size} hidden dark:block`} />
        </>
      )}
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS
  loading?: boolean
}

const buttonBase =
  'glint inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-bold transition duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200'

// Same buttons as the landing page: ink pills that lift on hover, and haldi
// for the big festive moments (joining, matching).
const BUTTON_VARIANTS = {
  primary: 'bg-ink text-on-ink shadow-lg shadow-maroon-950/15 hover:-translate-y-0.5 hover:shadow-xl',
  secondary: 'border border-neutral-200 bg-surface text-neutral-900 hover:border-neutral-900',
  danger: 'bg-red-600 text-white shadow-md shadow-red-600/20 hover:brightness-110',
  ghost: 'text-neutral-900 hover:bg-neutral-100',
  marigold: 'bg-marigold-400 text-maroon-950 shadow-lg shadow-marigold-500/30 hover:-translate-y-0.5 hover:brightness-105',
  rani: 'bg-rani text-white shadow-lg shadow-rani/25 hover:-translate-y-0.5 hover:brightness-110',
}

export function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${buttonBase} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

// A router link that looks like a Button.
export function LinkButton({
  variant = 'primary',
  className = '',
  ...rest
}: LinkProps & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return <Link {...rest} className={`${buttonBase} ${BUTTON_VARIANTS[variant]} ${className}`} />
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="animate-rise rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700" role="alert">
      {children}
    </p>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-neutral-800">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-2xl border border-neutral-200 bg-surface px-4 py-3 text-neutral-900 transition placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100'

export function Choice({
  checked,
  onChange,
  type = 'radio',
  name,
  children,
}: {
  checked: boolean
  onChange: () => void
  type?: 'radio' | 'checkbox'
  name?: string
  children: ReactNode
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-center rounded-full border px-4 py-2.5 text-center text-sm font-semibold transition active:scale-[0.97] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-200 ${
        checked
          ? 'border-ink bg-ink text-on-ink'
          : 'border-neutral-200 bg-surface text-neutral-700 hover:border-neutral-900'
      }`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-[28px] border border-neutral-200/80 bg-surface shadow-[0_1px_0_rgb(42_14_27/0.04)] ${className}`}>
      {children}
    </div>
  )
}

// Small uppercase label above a heading, as on the landing page.
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-bold uppercase tracking-[0.22em] text-brand-500 ${className}`}>{children}</p>
}

// Screen title with an optional eyebrow above and an action on the right.
export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  eyebrow?: ReactNode
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3 lg:mb-10">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>}
        <h1 className="text-[2.4rem] font-extrabold leading-[0.95] tracking-[-0.04em] text-neutral-900 lg:text-6xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500 lg:text-base">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// Friendly "nothing here yet" block: the icon on two tilted festive tiles, a
// line of explanation and, optionally, something to do about it.
export function EmptyState({
  icon: Icon,
  scene,
  title,
  children,
  action,
}: {
  icon: IconType
  // An illustration (see Scenes.tsx) to show instead of the icon.
  scene?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex animate-rise flex-col items-center px-4 py-12 text-center">
      {scene ? (
        <div className="mb-5 text-neutral-500">{scene}</div>
      ) : (
        <div className="relative mb-8 h-24 w-24">
          <span className="bandhani-soft absolute inset-0 translate-x-3 rotate-[10deg] rounded-[28px] bg-marigold-400" aria-hidden />
          <div className="bandhani-soft relative flex h-full w-full -rotate-6 items-center justify-center rounded-[28px] bg-maroon-700 text-cream shadow-xl shadow-maroon-950/20">
            <Icon className="h-10 w-10" strokeWidth={1.8} />
          </div>
        </div>
      )}
      <p className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">{title}</p>
      {children && <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} aria-hidden />
}

// Small rounded label, e.g. "New", "Verified", activity names.
export function Tag({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: 'neutral' | 'brand' | 'marigold' | 'haldi' | 'green' | 'amber' | 'red' | 'glass'
  className?: string
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-700',
    brand: 'bg-brand-100 text-brand-800',
    marigold: 'bg-marigold-100 text-marigold-800',
    haldi: 'bg-marigold-400 text-maroon-950',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-800',
    glass: 'bg-white/20 text-white backdrop-blur-sm',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

// Titled group of settings-style rows.
export function Section({ title, hint, action, children }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
