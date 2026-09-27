import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm font-medium text-neutral-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  )
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2">
      <Logo className="animate-pulse text-3xl" />
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  )
}

// The wordmark, ending in a marigold dot.
export function Logo({ className = 'text-xl', tone = 'brand' }: { className?: string; tone?: 'brand' | 'white' }) {
  return (
    <span
      className={`font-display font-extrabold tracking-tight ${tone === 'white' ? 'text-white' : 'text-brand-700'} ${className}`}
    >
      Kollide<span className="ml-[0.06em] inline-block h-[0.24em] w-[0.24em] rounded-full bg-marigold-400" />
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'marigold'
  loading?: boolean
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200'

const BUTTON_VARIANTS = {
  primary:
    'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-600/25 hover:brightness-110',
  secondary: 'border border-neutral-200 bg-surface text-neutral-800 shadow-sm hover:border-neutral-300 hover:bg-neutral-50',
  danger: 'bg-red-600 text-white shadow-md shadow-red-600/20 hover:brightness-110',
  ghost: 'text-brand-700 hover:bg-brand-50',
  marigold: 'bg-marigold-400 text-plum-900 shadow-md shadow-marigold-500/30 hover:brightness-105',
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
  'w-full rounded-2xl border border-neutral-200 bg-surface px-4 py-3 text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100'

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
          ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/20'
          : 'border-neutral-200 bg-surface text-neutral-700 hover:border-brand-300'
      }`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl border border-neutral-200/80 bg-surface shadow-sm ${className}`}>{children}</div>
}

// Screen title with an optional action on the right.
export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// Friendly "nothing here yet" block: an icon in a festive badge, a line of
// explanation and, optionally, something to do about it.
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: IconType
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex animate-rise flex-col items-center px-4 py-12 text-center">
      <div className="relative mb-5">
        <div className="bandhani absolute -inset-5 rounded-full text-brand-300/50 [mask-image:radial-gradient(circle,black_40%,transparent_72%)]" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-plum-500 to-plum-700 text-white shadow-lg shadow-brand-600/30">
          <Icon className="h-9 w-9" strokeWidth={1.8} />
        </div>
        <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full border-4 border-canvas bg-marigold-400" />
      </div>
      <p className="font-display text-xl font-bold text-neutral-900">{title}</p>
      {children && <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
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
  tone?: 'neutral' | 'brand' | 'marigold' | 'green' | 'amber' | 'red' | 'glass'
  className?: string
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-700',
    brand: 'bg-brand-100 text-brand-700',
    marigold: 'bg-marigold-100 text-marigold-800',
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
    <section className="mt-7">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
