import { MailCheck } from 'lucide-react'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'motion/react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { G } from '../components/landing/garba'
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
  'flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 font-bold shadow-lg shadow-[#161A3D]/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50'

function Spin() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
}

// The backdrop: dark woven fabric covered in abhla bharat, the little round
// mirrors stitched onto chaniya cholis. A soft light follows the cursor (or
// drifts on its own on phones and when idle) and the mirrors near it glint.
const FABRIC = '#161A3D'
const TILE = 128

// One embroidered motif per tile: a big mirror in a ring of rani thread with
// marigold petal stitches and haldi dots, and small peacock-rimmed mirrors at
// the corners (which meet their neighbours to form a staggered pattern).
function Motif({ lit = false }: { lit?: boolean }) {
  const c = TILE / 2
  const petals = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2)
  const glass = lit ? 'url(#mw-lit)' : 'url(#mw-glass)'
  if (lit) {
    return (
      <>
        {/* A soft halo so lit mirrors glow, not just brighten. */}
        <circle cx={c} cy={c} r={24} fill="url(#mw-halo)" />
        <circle cx={c} cy={c} r={12} fill={glass} />
        {[0, TILE].flatMap((x) =>
          [0, TILE].map((y) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={13} fill="url(#mw-halo)" />
              <circle cx={x} cy={y} r={6} fill={glass} />
            </g>
          )),
        )}
      </>
    )
  }
  return (
    <>
      {petals.map((t) => (
        <line
          key={t}
          x1={c + 17 * Math.cos(t)}
          y1={c + 17 * Math.sin(t)}
          x2={c + 26 * Math.cos(t)}
          y2={c + 26 * Math.sin(t)}
          stroke={G.marigold}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="3 2.5"
          opacity={0.85}
        />
      ))}
      {petals.map((t) => (
        <circle key={`d${t}`} cx={c + 31 * Math.cos(t + Math.PI / 8)} cy={c + 31 * Math.sin(t + Math.PI / 8)} r={1.6} fill={G.haldi} opacity={0.8} />
      ))}
      <circle cx={c} cy={c} r={14} fill="none" stroke={G.rani} strokeWidth={3.2} strokeDasharray="2.2 1.4" />
      <circle cx={c} cy={c} r={12} fill={glass} />
      <circle cx={c - 4} cy={c - 4} r={1.8} fill="#fff" opacity={0.55} />
      {[0, TILE].flatMap((x) =>
        [0, TILE].map((y) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={8} fill="none" stroke={G.peacock} strokeWidth={2.4} strokeDasharray="2 1.3" />
            <circle cx={x} cy={y} r={6} fill={glass} />
          </g>
        )),
      )}
    </>
  )
}

function MirrorPattern({ lit = false }: { lit?: boolean }) {
  const id = lit ? 'mw-pattern-lit' : 'mw-pattern'
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="mw-glass" cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#8d91ad" />
          <stop offset="60%" stopColor="#4a4e70" />
          <stop offset="100%" stopColor="#2c3052" />
        </radialGradient>
        <radialGradient id="mw-lit" cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#fff3d6" />
          <stop offset="100%" stopColor="#d9dcef" />
        </radialGradient>
        <radialGradient id="mw-halo">
          <stop offset="0%" stopColor="#fff3d6" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#fff3d6" stopOpacity="0" />
        </radialGradient>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <Motif lit={lit} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

function MirrorWork({ sweep }: { sweep: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const x = useMotionValue(50)
  const y = useMotionValue(40)
  const drift = useRef<AnimationPlaybackControls[]>([])

  useMotionValueEvent(x, 'change', (v) => ref.current?.style.setProperty('--lx', `${v}%`))
  useMotionValueEvent(y, 'change', (v) => ref.current?.style.setProperty('--ly', `${v}%`))

  const stopDrift = useCallback(() => {
    drift.current.forEach((c) => c.stop())
    drift.current = []
  }, [])
  const startDrift = useCallback(() => {
    stopDrift()
    drift.current = [
      animate(x, [x.get(), 18, 82, 50], { duration: 16, repeat: Infinity, ease: 'easeInOut' }),
      animate(y, [y.get(), 70, 25, 40], { duration: 11, repeat: Infinity, ease: 'easeInOut' }),
    ]
  }, [x, y, stopDrift])

  // Follow a mouse; drift on touch screens and after a few idle seconds.
  useEffect(() => {
    if (reduced) return
    let idle = 0
    startDrift()
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      stopDrift()
      x.set((e.clientX / window.innerWidth) * 100)
      y.set((e.clientY / window.innerHeight) * 100)
      window.clearTimeout(idle)
      idle = window.setTimeout(startDrift, 3000)
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.clearTimeout(idle)
      stopDrift()
    }
  }, [reduced, x, y, startDrift, stopDrift])

  // A sweep of light across every mirror (when the code is sent).
  useEffect(() => {
    if (!sweep || reduced) return
    stopDrift()
    y.set(50)
    const run = animate(x, [-20, 120], { duration: 1.3, ease: [0.45, 0, 0.2, 1] })
    run.then(startDrift)
    return () => run.stop()
  }, [sweep, reduced, x, y, startDrift, stopDrift])

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0"
      style={{ backgroundColor: FABRIC, ['--lx' as string]: '50%', ['--ly' as string]: '40%' }}
      aria-hidden
    >
      {/* The weave of the fabric. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.035) 0 1px, transparent 1px 5px), repeating-linear-gradient(-45deg, rgb(0 0 0 / 0.18) 0 1px, transparent 1px 5px)',
        }}
      />
      <MirrorPattern />
      {/* The same mirrors, bright, showing only where the light is. */}
      <div
        className="absolute inset-0"
        style={{
          maskImage: 'radial-gradient(circle 250px at var(--lx) var(--ly), #000 0%, rgb(0 0 0 / 0.55) 40%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(circle 250px at var(--lx) var(--ly), #000 0%, rgb(0 0 0 / 0.55) 40%, transparent 75%)',
        }}
      >
        <MirrorPattern lit />
      </div>
      {/* The light falling on the cloth itself. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle 380px at var(--lx) var(--ly), rgb(255 214 160 / 0.12), transparent 70%)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgb(8 9 26 / 0.75) 100%)' }}
      />
    </div>
  )
}

// One mirror per digit typed, under the code field.
function CodeMirrors({ count }: { count: number }) {
  const slots = Math.max(6, count)
  return (
    <div className="flex justify-center gap-2" aria-hidden>
      {Array.from({ length: slots }, (_, i) => {
        const on = i < count
        return (
          <motion.span
            key={i}
            className="h-3.5 w-3.5 rounded-full ring-2"
            style={{
              ['--tw-ring-color' as string]: on ? G.marigold : 'rgb(42 14 27 / 0.15)',
              background: on
                ? 'radial-gradient(circle at 38% 38%, #fff 0 1.5px, #dfe1ec 2px, #8e92ad 100%)'
                : 'transparent',
            }}
            animate={on ? { scale: [1, 1.45, 1] } : { scale: 1 }}
            transition={{ duration: 0.35 }}
          />
        )
      })}
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
  // Bumped when a code is sent, to sweep light across the mirrors.
  const [sweep, setSweep] = useState(0)
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
    setSweep((n) => n + 1)
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
    <main className="relative flex min-h-dvh flex-col overflow-hidden" style={{ color: G.cream }}>
      <MirrorWork sweep={sweep} />

      <header className="relative z-10">
        <div className="px-5 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-8">
          <Link to="/" aria-label="Back to Kollide" className="inline-block">
            <Logo tone="white" className="text-3xl sm:text-4xl" />
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          className="relative w-full max-w-[26rem] rounded-[32px] p-6 shadow-2xl shadow-black/50 sm:max-w-[36rem] sm:p-10 lg:px-12"
          style={{ backgroundColor: G.cream, color: G.ink }}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        >
          {/* Embroidered edge: a running stitch just inside the card. */}
          <span
            className="pointer-events-none absolute inset-2.5 rounded-[26px] border-2 border-dashed"
            style={{ borderColor: `${G.marigold}66` }}
            aria-hidden
          />
          <h1 className="relative font-display text-[2.1rem] font-extrabold leading-[1.02] tracking-[-0.035em]">{heading}</h1>
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
                initial={{ opacity: 0, y: -28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -28 }}
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
                <button type="submit" disabled={busy === 'email'} className={PRIMARY} style={{ backgroundColor: FABRIC, color: G.cream }}>
                  {busy === 'email' && <Spin />} Email me a code
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="code"
                onSubmit={verifyCode}
                className="space-y-3"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 28 }}
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
                <CodeMirrors count={code.length} />
                <button
                  type="submit"
                  disabled={busy === 'code' || code.length < 6}
                  className={PRIMARY}
                  style={{ backgroundColor: FABRIC, color: G.cream }}
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

      <p className="relative z-10 mx-auto mb-[max(env(safe-area-inset-bottom),1.25rem)] max-w-sm rounded-2xl bg-[#161A3D]/80 px-5 py-2.5 text-center text-xs leading-relaxed text-[#FFF4E4]/80 backdrop-blur-sm">
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
