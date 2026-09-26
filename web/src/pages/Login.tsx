import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button, ErrorText, Field, FullScreenSpinner, inputClass } from '../components/ui'
import { homePathFor, useAuth } from '../lib/auth-context'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  )
}

export default function Login() {
  const { loading, session, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState<'google' | 'email' | 'code' | null>(null)
  const [error, setError] = useState('')

  if (loading) return <FullScreenSpinner />
  if (session) return <Navigate to={homePathFor(profile)} replace />

  async function signInWithGoogle() {
    setError('')
    setBusy('google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(friendlyError(error))
      setBusy(null)
    }
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy('email')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setBusy(null)
    if (error) return setError(friendlyError(error))
    setStage('code')
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy('code')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(null)
    if (error) setError(friendlyError(error))
    // On success the auth listener updates the session and this page redirects.
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Link to="/" className="text-2xl font-extrabold tracking-tight text-brand-700">
        Kollide
      </Link>
      <h1 className="mt-6 text-2xl font-bold text-neutral-900">Sign in or create an account</h1>
      <p className="mt-1 text-neutral-600">Find your Garba partner or group.</p>

      <div className="mt-8 space-y-4">
        <Button variant="secondary" className="w-full" onClick={signInWithGoogle} loading={busy === 'google'}>
          <GoogleIcon /> Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" /> or <span className="h-px flex-1 bg-neutral-200" />
        </div>

        {stage === 'email' ? (
          <form onSubmit={sendCode} className="space-y-3">
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className={inputClass}
              />
            </Field>
            <Button type="submit" className="w-full" loading={busy === 'email'}>
              Email me a code
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <Field label={`Enter the 6-digit code sent to ${email}`}>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
              />
            </Field>
            <Button type="submit" className="w-full" loading={busy === 'code'} disabled={code.length !== 6}>
              Verify and continue
            </Button>
            <button
              type="button"
              className="w-full text-sm text-neutral-500 underline underline-offset-4"
              onClick={() => {
                setStage('email')
                setCode('')
              }}
            >
              Use a different email
            </button>
          </form>
        )}

        <ErrorText>{error}</ErrorText>
      </div>

      <p className="mt-8 text-xs text-neutral-500">
        By continuing you agree to our{' '}
        <Link to="/terms" className="underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="underline">
          Privacy Policy
        </Link>
        . You must be 18 or older.
      </p>
    </main>
  )
}
