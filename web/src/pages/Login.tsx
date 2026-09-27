import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { MailCheck, MapPin } from 'lucide-react'
import SplitScreen from '../components/SplitScreen'
import { Button, ErrorText, Field, FullScreenSpinner, inputClass, Logo } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { startPathFor } from '../lib/invite'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  )
}

export default function Login() {
  const { loading, session, profile } = useAuth()
  const [email, setEmail] = useState('')
  // Code length is a Supabase Auth setting (6 locally; hosted may use up to 10).
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState<'google' | 'email' | 'code' | null>(null)
  const [error, setError] = useState('')

  if (loading) return <FullScreenSpinner />
  if (session && profile) return <Navigate to={startPathFor(profile)} replace />

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
    <SplitScreen
      image="/landing/together-fistbump.webp"
      aside={
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-marigold-300">
            Garba nights · Bangalore · Oct 11–19
          </p>
          <p className="mt-3 font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.03em]">
            Find people to show up with, not just swipe past.
          </p>
        </>
      }
    >
      <main className="flex min-h-dvh flex-col lg:justify-center">
        <div className="relative overflow-hidden bg-plum-900 px-4 pb-16 pt-[max(env(safe-area-inset-top),1.5rem)] text-white lg:hidden">
          <div className="relative mx-auto max-w-sm">
            <Link to="/" aria-label="Kollide home">
              <Logo tone="white" className="text-3xl" />
            </Link>
            <h1 className="mt-8 text-3xl font-extrabold leading-tight">Sign in or create an account</h1>
            <p className="mt-2 text-white/80">Find your Garba friends or group.</p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              <MapPin className="h-3.5 w-3.5" /> Bangalore only, for now
            </p>
          </div>
        </div>

        <div className="relative mx-auto -mt-8 w-full max-w-sm flex-1 px-4 pb-10 lg:mt-0 lg:max-w-md lg:flex-none lg:py-12">
          <div className="mb-8 hidden lg:block">
            <h1 className="text-4xl font-extrabold leading-tight text-neutral-900">Sign in or create an account</h1>
            <p className="mt-2 text-neutral-500">Find your Garba friends or group. Bangalore only, for now.</p>
          </div>
          <div className="animate-rise space-y-4 rounded-[28px] border border-neutral-200 bg-surface p-5 shadow-xl shadow-black/5 lg:p-7 lg:shadow-none">
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
                <div className="flex items-start gap-3 rounded-2xl bg-neutral-100 px-3 py-2.5 text-sm text-neutral-800">
                  <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Check your inbox. We sent a code to <strong className="break-all">{email}</strong>
                  </span>
                </div>
                <Field label="Enter the code">
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,10}"
                    maxLength={10}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Code"
                    className={`${inputClass} text-center font-mono text-2xl tracking-[0.3em]`}
                  />
                </Field>
                <Button type="submit" className="w-full" loading={busy === 'code'} disabled={code.length < 6}>
                  Verify and continue
                </Button>
                <button
                  type="button"
                  className="w-full py-1 text-sm font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-800"
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

          <p className="mt-6 px-2 text-center text-xs leading-relaxed text-neutral-500">
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
        </div>
      </main>
    </SplitScreen>
  )
}
