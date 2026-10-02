import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { ArrowDown, ArrowUpRight, BadgeCheck } from 'lucide-react'
import { motion, MotionConfig, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Details from '../components/landing/Details'
import { G } from '../components/landing/garba'
import HoverSwap from '../components/landing/HoverSwap'
import HoverWordmark from '../components/landing/HoverWordmark'
import HowItWorks from '../components/landing/HowItWorks'
import LogoIntro from '../components/landing/LogoIntro'
import { FadeUp, RevealText } from '../components/landing/Reveal'
import Toran from '../components/landing/Toran'
import Welcome from '../components/landing/Welcome'
import WhatsNext from '../components/landing/WhatsNext'
import Wordmark from '../components/landing/Wordmark'
import WaitlistForm from '../components/WaitlistForm'
import { supabase } from '../lib/supabase'

// The landing page uses the fixed garba palette in `garba.ts` (not the app's
// theme tokens) so it looks the same when the phone is in dark mode.

type Activity = { slug: string; name: string; status: 'live' | 'coming_soon' }

// Shown until the activities query returns (or if it fails), so the page
// always reads as multi-event.
const FALLBACK_COMING_SOON: Activity[] = [
  { slug: 'concerts', name: 'Concerts', status: 'coming_soon' },
  { slug: 'board_games', name: 'Board game nights', status: 'coming_soon' },
  { slug: 'cafe_hopping', name: 'Cafe hopping', status: 'coming_soon' },
  { slug: 'food_walks', name: 'Food walks', status: 'coming_soon' },
]

// Coming-soon activities the database has but the landing page doesn't list.
const HIDDEN_ON_LANDING = new Set(['trekking', 'badminton', 'running'])

// The intro plays once per page load, not on every in-app visit to `/`.
let introPlayed = false

// Navratri 2026 opens the night of Oct 11 (IST).
const NAVRATRI = new Date('2026-10-11T18:00:00+05:30')

function useDaysToGo() {
  const [days] = useState(() => Math.ceil((NAVRATRI.getTime() - Date.now()) / 86_400_000))
  return days
}

function Countdown() {
  const days = useDaysToGo()
  if (days <= 0) return <span>Navratri is here, Oct 11 to 19</span>
  return (
    <span>
      <strong className="font-bold">{days}</strong> day{days === 1 ? '' : 's'} to Navratri
    </span>
  )
}

// A slowly turning badge in the hero, like a garba circle: a glass disc with
// a ring of text spaced to fill it exactly, and a button in the middle that
// takes you to the next section.
function CircleBadge({ onClick }: { onClick: () => void }) {
  const reduced = useReducedMotion()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="See how it works"
      className="group relative flex h-32 w-32 items-center justify-center rounded-full bg-[#2A0E1B]/40 shadow-xl shadow-[#2A0E1B]/30 ring-1 ring-[#FFF4E4]/25 backdrop-blur-md transition duration-300 hover:scale-105 hover:ring-[#F6C33B]/60 sm:h-36 sm:w-36"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spin-slow" aria-hidden>
        <defs>
          <path id="hero-circle" d="M50 50 m-37 0 a37 37 0 1 1 74 0 a37 37 0 1 1 -74 0" />
        </defs>
        <text
          fill={G.cream}
          fontSize="8.4"
          fontWeight="800"
          style={{ textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}
        >
          {/* 2π × 37 is about 232.5; the text is stretched to fill it evenly. */}
          <textPath href="#hero-circle" textLength="230" lengthAdjust="spacing">
            Nine nights <tspan fill={G.haldi}>•</tspan> One big circle <tspan fill={G.haldi}>•</tspan>{' '}
          </textPath>
        </text>
      </svg>
      {/* A fine ring between the words and the button. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="50" cy="50" r="28" fill="none" stroke={G.cream} strokeOpacity="0.2" strokeWidth="0.6" />
      </svg>
      <span
        className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-[#F6C33B]/25 transition group-hover:scale-105 sm:h-16 sm:w-16"
        style={{ backgroundColor: G.haldi, color: G.ink }}
      >
        <motion.span
          className="flex"
          animate={reduced ? undefined : { y: [0, 3, 0] }}
          transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
        >
          <ArrowDown className="h-6 w-6" strokeWidth={2.4} />
        </motion.span>
      </span>
    </button>
  )
}

/**
 * The hero, pinned while the rest of the page slides up over it like a
 * curtain. As the curtain rises, the hero sinks back and dims.
 */
function HeroCurtain({
  ready,
  onHow,
  children,
}: {
  ready: boolean
  onHow: () => void
  children: ReactNode
}) {
  const curtainRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: curtainRef, offset: ['start end', 'start start'] })
  const heroScale = useTransform(scrollYProgress, (p) => (reduced ? 1 : 1 - 0.08 * p))
  const heroDim = useTransform(scrollYProgress, (p) => (reduced ? 0 : 0.6 * p))
  const radius = useTransform(scrollYProgress, (p) => (reduced ? 40 : 56 - 40 * p))

  // Keep the video playing whenever the hero can be seen, and stop it only
  // once the page has fully covered it. Browsers also pause muted autoplay
  // video on their own (a hidden tab, power saving, a blocked first attempt),
  // so any other pause is undone as soon as the hero is showing again.
  const covered = useRef(false)
  const syncVideo = useCallback(() => {
    const video = videoRef.current
    if (!video || reduced) return
    if (covered.current || document.hidden) {
      if (!video.paused) video.pause()
    } else if (video.paused) {
      video.play().catch(() => {})
    }
  }, [reduced])

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    covered.current = p >= 1
    syncVideo()
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video || reduced) return
    video.addEventListener('pause', syncVideo)
    video.addEventListener('canplay', syncVideo)
    document.addEventListener('visibilitychange', syncVideo)
    syncVideo()
    return () => {
      video.removeEventListener('pause', syncVideo)
      video.removeEventListener('canplay', syncVideo)
      document.removeEventListener('visibilitychange', syncVideo)
    }
  }, [reduced, syncVideo])

  return (
    <div className="relative">
      <section className="sticky top-0 h-[100svh] min-h-[600px] overflow-hidden" style={{ backgroundColor: G.maroon }}>
        <motion.div className="absolute inset-0 origin-top" style={{ scale: heroScale }}>
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            poster="/landing/garba-hero-poster.jpg"
            autoPlay={!reduced}
            muted
            loop
            playsInline
            preload={reduced ? 'none' : 'auto'}
            aria-hidden
          >
            {/* MP4 first; a browser that can't decode H.264 falls back to WebM. */}
            <source src="/landing/garba-hero.mp4" type="video/mp4" />
            <source src="/landing/garba-hero.webm" type="video/webm" />
          </video>
          {/* A warm maroon wash so the cream type reads over the dancing. */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${G.maroon}CC 0%, ${G.maroon}66 38%, ${G.ink}B3 78%, ${G.ink}F2 100%)`,
            }}
            aria-hidden
          />
          <motion.div className="absolute inset-0 bg-[#000]" style={{ opacity: heroDim }} aria-hidden />
        </motion.div>

        <div className="relative z-10 flex h-full flex-col" style={{ color: G.cream }}>
          <Toran className="text-[#FFF4E4]" />
          <header className="flex w-full items-center justify-between px-4 pt-1 sm:px-6 lg:px-8">
            <Link to="/" aria-label="Kollide home" className="-ml-1">
              <HoverWordmark tone="dark" className="h-10 w-auto sm:h-12 lg:h-14" />
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/login"
                className="rounded-full px-4 py-2.5 text-sm font-semibold transition hover:bg-[#FFF4E4]/10 active:scale-95"
              >
                Sign in
              </Link>
              <Link
                to="/login?mode=signup"
                className="rounded-full px-5 py-2.5 text-sm font-semibold transition hover:brightness-95 active:scale-95"
                style={{ backgroundColor: G.cream, color: G.ink }}
              >
                Sign up
              </Link>
            </nav>
          </header>

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-10 sm:px-8 lg:px-12">
            <FadeUp play={ready}>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base font-semibold sm:text-lg" style={{ color: G.haldi }}>
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold sm:text-base"
                  style={{ backgroundColor: G.haldi, color: G.ink }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full motion-reduce:animate-none" style={{ backgroundColor: G.rani }} />
                    <span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: G.rani }} />
                  </span>
                  Now live across India
                </span>
                Navratri starts Sunday, October 11.
              </p>
            </FadeUp>
            <RevealText
              as="h1"
              play={ready}
              delay={0.1}
              text="Find people to show up with, not just swipe past."
              accent={['show', 'up', 'with']}
              accentClassName="text-[#F6C33B]"
              className="mt-6 max-w-5xl font-display text-[2.9rem] font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-7xl lg:text-[6.5rem]"
            />
            <FadeUp play={ready} delay={0.45}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed opacity-85 sm:text-xl">
                Kollide matches you with verified people heading to the same garba nights. Go as a pair, or join a
                group of up to 10.
              </p>
            </FadeUp>
            <FadeUp play={ready} delay={0.6}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to="/login?mode=signup"
                  className="group inline-flex items-center gap-2 rounded-full py-4 pl-7 pr-6 text-base font-bold shadow-xl shadow-black/25 transition hover:-translate-y-0.5 active:scale-[0.97]"
                  style={{ backgroundColor: G.haldi, color: G.ink }}
                >
                  Sign up
                  <ArrowUpRight className="h-5 w-5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
                <button
                  type="button"
                  onClick={onHow}
                  className="rounded-full px-6 py-4 text-base font-semibold ring-1 ring-[#FFF4E4]/40 transition hover:bg-[#FFF4E4]/10"
                >
                  How it works
                </button>
              </div>
              <p className="mt-6 flex items-center gap-2 text-sm opacity-75">
                <BadgeCheck className="h-4 w-4" style={{ color: G.haldi }} /> Every profile is checked by a person before
                anyone can see it.
              </p>
            </FadeUp>
          </div>

          <motion.div
            className="absolute bottom-20 right-5 hidden sm:right-8 sm:block lg:right-12"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={ready ? { opacity: 1, scale: 1 } : undefined}
            transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 1 }}
          >
            <CircleBadge onClick={onHow} />
          </motion.div>
        </div>
      </section>

      <motion.div
        ref={curtainRef}
        className="relative z-10 -mt-12 shadow-[0_-30px_60px_-20px_rgba(42,14,27,0.45)]"
        style={{ backgroundColor: G.cream, borderTopLeftRadius: radius, borderTopRightRadius: radius }}
      >
        {children}
      </motion.div>
    </div>
  )
}

function StorySection({
  eyebrow,
  heading,
  body,
  base,
  reveal,
  frame,
  mirrored = false,
}: {
  eyebrow: string
  heading: string
  body: string
  base: { src: string; alt: string; position?: string }
  reveal: { src: string; alt: string; position?: string }
  frame: string
  mirrored?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // The coloured block behind the photo slides out from under it as you scroll.
  const shift = useTransform(scrollYProgress, (p) => (reduced ? 18 : 6 + 26 * Math.min(p * 1.6, 1)))
  const offset = useTransform(shift, (v) => `${mirrored ? -v : v}px`)

  return (
    <section
      ref={ref}
      className={`mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 md:gap-16 md:py-28 lg:px-12 ${
        mirrored ? 'md:grid-cols-[1fr_1.35fr]' : 'md:grid-cols-[1.35fr_1fr]'
      }`}
    >
      <div className={`relative mx-auto w-full max-w-md md:max-w-none ${mirrored ? 'md:order-2' : ''}`}>
        <motion.div
          className="bandhani-soft absolute inset-0 rounded-[28px]"
          style={{ backgroundColor: frame, x: offset, y: shift }}
          aria-hidden
        />
        {/* Tall on phones, landscape on wider screens. */}
        <HoverSwap base={base} reveal={reveal} className="md:aspect-[4/3]" />
      </div>
      <div className={mirrored ? 'md:order-1' : ''}>
        <FadeUp>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: G.rani }}>
            {eyebrow}
          </p>
        </FadeUp>
        <RevealText
          text={heading}
          className="mt-4 font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl"
        />
        <FadeUp delay={0.15}>
          <p className="mt-6 max-w-md text-lg leading-relaxed opacity-75">{body}</p>
        </FadeUp>
      </div>
    </section>
  )
}

export default function Landing() {
  const [comingSoon, setComingSoon] = useState<Activity[]>(FALLBACK_COMING_SOON)
  const [fromDb, setFromDb] = useState(false)
  // Read once on mount: the intro only shows on the first visit to `/`.
  const [ready, setReady] = useState(introPlayed)
  const [introDone, setIntroDone] = useState(introPlayed)
  const lenisRef = useRef<Lenis | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    supabase
      .from('activities')
      .select('slug, name, status')
      .eq('status', 'coming_soon')
      .order('sort_order')
      .then(({ data }) => {
        const shown = (data as Activity[] | null)?.filter((a) => !HIDDEN_ON_LANDING.has(a.slug))
        if (shown?.length) {
          setComingSoon(shown)
          setFromDb(true)
        }
      })
  }, [])

  // Keep the page cream around the edges (overscroll) even in dark mode.
  useEffect(() => {
    const root = document.documentElement
    const prev = { bg: root.style.backgroundColor, scheme: root.style.colorScheme }
    root.style.backgroundColor = G.cream
    root.style.colorScheme = 'light'
    return () => {
      root.style.backgroundColor = prev.bg
      root.style.colorScheme = prev.scheme
    }
  }, [])

  // Smooth scrolling for this page only, once the intro has let go of it.
  useEffect(() => {
    if (!introDone || reduced) return
    const lenis = new Lenis({ autoRaf: true })
    lenisRef.current = lenis
    return () => {
      lenis.destroy()
      lenisRef.current = null
    }
  }, [introDone, reduced])

  function scrollToId(id: string, offset = -24) {
    const target = document.getElementById(id)
    if (!target) return
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset, duration: 1.6 })
    else target.scrollIntoView({ block: 'start' })
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-clip [color-scheme:light]" style={{ backgroundColor: G.cream, color: G.ink }}>
        {!introDone && (
          <LogoIntro
            onReveal={() => setReady(true)}
            onDone={() => {
              introPlayed = true
              setIntroDone(true)
            }}
          />
        )}

        <HeroCurtain ready={ready} onHow={() => scrollToId('how-it-works', 0)}>
          <main>
            <Welcome />

            <StorySection
              eyebrow="Navratri 2026"
              heading="It's that time of the year."
              body="Nine nights of garba are almost here. Celebrate them together: make new friends, find your crowd, and assemble a group to dance with."
              base={{ src: '/landing/together-fistbump.webp', alt: 'Friends bumping fists in a circle at a garba night' }}
              reveal={{ src: '/landing/together-dandiya.webp', alt: 'Friends crossing dandiya sticks into a star' }}
              frame={G.marigold}
            />

            <StorySection
              mirrored
              eyebrow="For the nights that matter"
              heading="Find yourself a garba partner."
              body="This Navratri, find someone to share the circle with, and make your night a little more special."
              base={{
                src: '/landing/partner-dupatta.webp',
                alt: "A boy fixing a girl's skirt on the garba ground",
                position: '50% 65%',
              }}
              reveal={{ src: '/landing/partner-bangle.webp', alt: "A girl's bangle caught on a boy's kurta" }}
              frame={G.rani}
            />

            <HowItWorks />

            <Details />

            <WhatsNext activities={comingSoon} canVote={fromDb} />

            <section className="px-4 pt-16 sm:px-6 md:pt-24">
              <FadeUp className="mx-auto max-w-7xl">
                <div
                  className="bandhani-soft relative overflow-hidden rounded-[40px] px-6 pb-14 pt-4 text-center sm:px-12 sm:pb-20"
                  style={{ backgroundColor: G.maroon, color: G.cream }}
                >
                  <Toran className="-mx-6 text-[#FFF4E4] sm:-mx-12" />
                  <div className="relative mx-auto mt-10 max-w-xl">
                    <Wordmark tone="dark" className="mx-auto h-12 w-auto sm:h-14" />
                    <RevealText
                      text="Don't go alone this Navratri."
                      className="mt-8 font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl"
                    />
                    <p className="mt-5 text-lg opacity-80">
                      Sign up and get verified in time to find your people for the first night.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                      <Link
                        to="/login?mode=signup"
                        className="group inline-flex items-center gap-2 rounded-full py-4 pl-7 pr-6 text-base font-bold shadow-xl shadow-black/25 transition hover:-translate-y-0.5 active:scale-[0.97]"
                        style={{ backgroundColor: G.haldi, color: G.ink }}
                      >
                        Sign up
                        <ArrowUpRight className="h-5 w-5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </Link>
                      <Link
                        to="/login"
                        className="rounded-full px-6 py-4 text-base font-semibold ring-1 ring-[#FFF4E4]/40 transition hover:bg-[#FFF4E4]/10"
                      >
                        Sign in
                      </Link>
                    </div>
                    <p className="mt-6 flex items-center justify-center gap-1.5 text-sm opacity-80">
                      <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: G.haldi }} />
                      <Countdown />
                    </p>
                  </div>
                </div>
              </FadeUp>
            </section>

            <section id="waitlist" className="scroll-mt-6 px-5 pb-16 pt-20 sm:px-8 md:pb-24 md:pt-28 lg:px-12">
              <FadeUp className="mx-auto grid max-w-7xl items-end gap-8 md:grid-cols-[1.1fr_1fr] md:gap-16">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: G.orange }}>
                    The Kollide app
                  </p>
                  <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1] tracking-[-0.04em] sm:text-5xl">
                    Want us to keep you updated when we bring more?
                  </h2>
                  <p className="mt-5 max-w-lg text-lg leading-relaxed opacity-75">
                    We're building the Kollide app for your phone, with more than garba in it. Join the waitlist and
                    we'll email you when it's out.
                  </p>
                </div>
                <WaitlistForm tone="light" />
              </FadeUp>
            </section>
          </main>

          <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 pb-10 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <div className="flex items-center gap-3 opacity-80">
              <Wordmark className="h-6 w-auto" />
              <span>© 2026 · Made in Bangalore</span>
            </div>
            <p className="flex gap-5 opacity-70">
              <Link to="/privacy" className="underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              <Link to="/terms" className="underline-offset-4 hover:underline">
                Terms
              </Link>
            </p>
          </footer>
        </HeroCurtain>
      </div>
    </MotionConfig>
  )
}
