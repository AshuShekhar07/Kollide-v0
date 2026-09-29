import { MailCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { G } from '../components/landing/garba'
import Toran from '../components/landing/Toran'
import { FullScreenSpinner, Logo } from '../components/ui'
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

const FIELD =
  'w-full rounded-2xl border border-[#2A0E1B]/15 bg-[#fff] px-4 py-3 text-[#2A0E1B] transition placeholder:text-[#2A0E1B]/35 focus:border-[#D4246B] focus:outline-none focus:ring-4 focus:ring-[#D4246B]/15'
const PRIMARY =
  'flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 font-bold shadow-lg shadow-[#7A0F2E]/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50'

function Spin() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
}

// Sharad Navratri 2026: Sunday Oct 11 to Monday Oct 19.
const NIGHTS = Array.from({ length: 9 }, (_, i) => {
  const d = new Date(2026, 9, 11 + i)
  return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), date: d.getDate() }
})
const NIGHT_COLORS = [G.rani, G.marigold, G.peacock, G.haldi, G.orange, G.leaf, G.rani, G.marigold, G.peacock]
const LIGHT = new Set<string>([G.marigold, G.haldi])

// The backdrop: a garba ground at night, blurred into glowing lights, with
// the nine nights of Navratri turning slowly around the card like a circle
// of dancers.
function GarbaNight() {
  const turn = { animationDuration: '90s' }
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <img
        src="/landing/step-venue.webp"
        alt=""
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-90 blur-xl saturate-150"
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, ${G.maroon}B3 0%, ${G.maroon}80 40%, ${G.ink}D9 100%)`,
        }}
      />
      <div className="bandhani-soft absolute inset-0 opacity-60" />

      <div className="absolute left-1/2 top-1/2 aspect-square w-[max(118vw,40rem)] -translate-x-1/2 -translate-y-1/2 sm:w-[min(56rem,90vh)]">
        <div className="absolute inset-[6%] rounded-full border-2 border-dashed border-[#FFF4E4]/15" />
        <ol className="absolute inset-0 animate-spin-slow" style={turn}>
          {NIGHTS.map((n, i) => {
            const angle = (i / NIGHTS.length) * Math.PI * 2 - Math.PI / 2
            const color = NIGHT_COLORS[i]
            return (
              <li
                key={n.date}
                className="absolute -ml-9 -mt-9 h-[4.5rem] w-[4.5rem] sm:-ml-11 sm:-mt-11 sm:h-[5.5rem] sm:w-[5.5rem]"
                style={{ left: `${50 + 44 * Math.cos(angle)}%`, top: `${50 + 44 * Math.sin(angle)}%` }}
              >
                <span
                  className="flex h-full w-full animate-spin-slow flex-col items-center justify-center rounded-full shadow-xl shadow-black/30"
                  style={{
                    ...turn,
                    animationDirection: 'reverse',
                    backgroundColor: color,
                    color: LIGHT.has(color) ? G.ink : G.cream,
                  }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 sm:text-xs">{n.day}</span>
                  <span className="font-display text-xl font-extrabold leading-none sm:text-2xl">{n.date}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
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
  // Sign in and sign up are the same flow; `?mode=signup` only changes the wording.
  const [params] = useSearchParams()
  const signup = params.get('mode') === 'signup'
  const heading = signup ? 'Create your account' : 'Welcome back'

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
    <main className="relative flex min-h-dvh flex-col overflow-hidden" style={{ backgroundColor: G.maroon, color: G.cream }}>
      <GarbaNight />

      <header className="relative z-10">
        <Toran count={32} className="text-[#FFF4E4]" />
        <div className="px-5 pt-1 sm:px-8">
          <Link to="/" aria-label="Back to Kollide" className="inline-block">
            <Logo tone="white" className="text-3xl sm:text-4xl" />
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          className="w-full max-w-[26rem] rounded-[32px] p-6 shadow-2xl shadow-black/40 sm:p-8"
          style={{ backgroundColor: G.cream, color: G.ink }}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        >
          <h1 className="font-display text-[2.1rem] font-extrabold leading-[1.02] tracking-[-0.035em]">{heading}</h1>
          <p className="mt-2 text-[15px] leading-relaxed opacity-70">
            {signup
              ? 'Meet verified people heading to the same garba nights in Bangalore.'
              : 'Sign in to find your garba people.'}
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy === 'google'}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#fff] px-5 py-3.5 font-semibold ring-1 ring-[#2A0E1B]/15 transition hover:ring-[#2A0E1B]/40 active:scale-[0.98] disabled:opacity-60"
          >
            {busy === 'google' ? <Spin /> : <GoogleIcon />} Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] opacity-50">
            <span className="h-px flex-1 bg-current opacity-40" /> or <span className="h-px flex-1 bg-current opacity-40" />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {stage === 'email' ? (
              <motion.form
                key="email"
                onSubmit={sendCode}
                className="space-y-3"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className={FIELD}
                  />
                </label>
                <button type="submit" disabled={busy === 'email'} className={PRIMARY} style={{ backgroundColor: G.maroon, color: G.cream }}>
                  {busy === 'email' && <Spin />} Email me a code
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="code"
                onSubmit={verifyCode}
                className="space-y-3"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25 }}
              >
                <p className="flex items-start gap-2.5 rounded-2xl bg-[#2A0E1B]/[0.06] px-3.5 py-3 text-sm">
                  <MailCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: G.rani }} />
                  <span>
                    We sent a code to <strong className="break-all">{email}</strong>. Check your inbox.
                  </span>
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Enter the code</span>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,10}"
                    maxLength={10}
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Code"
                    className={`${FIELD} text-center font-mono text-2xl tracking-[0.35em]`}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy === 'code' || code.length < 6}
                  className={PRIMARY}
                  style={{ backgroundColor: G.maroon, color: G.cream }}
                >
                  {busy === 'code' && <Spin />} Verify and continue
                </button>
                <button
                  type="button"
                  className="w-full py-1 text-sm font-medium underline underline-offset-4 opacity-60 hover:opacity-100"
                  onClick={() => {
                    setStage('email')
                    setCode('')
                  }}
                >
                  Use a different email
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {error && (
            <p className="mt-4 rounded-2xl bg-[#B3234C]/10 px-4 py-2.5 text-sm font-medium text-[#9A1740]" role="alert">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-sm">
            <span className="opacity-70">{signup ? 'Already have an account? ' : 'New to Kollide? '}</span>
            <Link
              to={signup ? '/login' : '/login?mode=signup'}
              replace
              className="font-semibold underline underline-offset-4"
              style={{ color: G.rani }}
            >
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </motion.div>
      </div>

      <p className="relative z-10 mx-auto max-w-sm px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-xs leading-relaxed opacity-75">
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
