import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-neutral-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  )
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
}

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-brand-700 hover:bg-brand-50',
}

export function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {children}
    </p>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100'

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
      className={`flex cursor-pointer items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition ${
        checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:border-brand-500'
      }`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  )
}
