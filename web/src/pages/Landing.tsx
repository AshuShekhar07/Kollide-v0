import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { ArrowDown, ArrowUpRight, BadgeCheck } from 'lucide-react'
import { motion, MotionConfig, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Details from '../components/landing/Details'
import { G } from '../components/landing/garba'
import HoverSwap from '../components/landing/HoverSwap'
import HoverWordmark from '../components/landing/HoverWordmark'
import HowItWorks from '../components/landing/HowItWorks'
import LogoIntro from '../components/landing/LogoIntro'
import NineNights from '../components/landing/NineNights'
import { FadeUp, RevealText } from '../components/landing/Reveal'
import Toran from '../components/landing/Toran'
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
  { slug: 'trekking', name: 'Trekking', status: 'coming_soon' },
  { slug: 'badminton', name: 'Badminton', status: 'coming_soon' },
  { slug: 'concerts', name: 'Concerts', status: 'coming_soon' },
  { slug: 'running', name: 'Running clubs', status: 'coming_soon' },
  { slug: 'board_games', name: 'Board game nights', status: 'coming_soon' },
  { slug: 'cafe_hopping', name: 'Cafe hopping', status: 'coming_soon' },
]

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

// A slowly spinning circular badge in the hero, like a garba circle. It also
// takes you to the next section.
function CircleBadge({ onClick }: { onClick: () => void }) {
  const text = 'nine nights · one big circle · '
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="See how it works"
      className="group relative flex h-28 w-28 items-center justify-center rounded-full transition hover:scale-105 sm:h-32 sm:w-32"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spin-slow" aria-hidden>
        <defs>
          <path id="hero-circle" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
        </defs>
        <text fill={G.cream} fontSize="9.2" fontWeight="700" letterSpacing="1.6" style={{ textTransform: 'uppercase' }}>
          <textPath href="#hero-circle">{text}</textPath>
        </text>
      </svg>
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full transition group-hover:translate-y-0.5"
        style={{ backgroundColor: G.haldi, color: G.ink }}
      >
        <ArrowDown className="h-5 w-5" />
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
  onJoin,
  onHow,
  children,
}: {
  ready: boolean
  onJoin: () => void
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

  // Once the page has fully covered the hero, stop the video playing unseen.
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const video = videoRef.current
    if (!video || reduced) return
    if (p >= 1 && !video.paused) video.pause()
    else if (p < 1 && video.paused) video.play().catch(() => {})
  })

  return (
    <div className="relative">
      <section className="sticky top-0 h-[100svh] min-h-[600px] overflow-hidden" style={{ backgroundColor: G.maroon }}>
        <motion.div className="absolute inset-0 origin-top" style={{ scale: heroScale }}>
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src="/landing/garba-hero.mp4"
            poster="/landing/garba-hero-poster.jpg"
            autoPlay={!reduced}
            muted
            loop
            playsInline
            preload={reduced ? 'none' : 'auto'}
            aria-hidden
          />
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
            <Link
              to="/start"
              className="rounded-full px-5 py-2.5 text-sm font-semibold transition hover:brightness-95 active:scale-95"
              style={{ backgroundColor: G.cream, color: G.ink }}
            >
              Sign in
            </Link>
          </header>

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-10 sm:px-8 lg:px-12">
            <FadeUp play={ready}>
              <p className="text-base font-semibold sm:text-lg" style={{ color: G.haldi }}>
                Navratri starts Sunday, October 11, in Bangalore.
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
                <button
                  type="button"
                  onClick={onJoin}
                  className="group inline-flex items-center gap-2 rounded-full py-4 pl-7 pr-6 text-base font-bold shadow-xl shadow-black/25 transition hover:-translate-y-0.5 active:scale-[0.97]"
                  style={{ backgroundColor: G.haldi, color: G.ink }}
                >
                  Join the waitlist
                  <ArrowUpRight className="h-5 w-5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
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
        if (data?.length) {
          setComingSoon(data as Activity[])
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

        <HeroCurtain ready={ready} onJoin={() => scrollToId('waitlist')} onHow={() => scrollToId('how-it-works', 0)}>
          <main>
            <NineNights />

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

            <section id="waitlist" className="scroll-mt-6 px-4 pb-16 pt-16 sm:px-6 md:pt-24">
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
                      Join the waitlist and we'll email you the moment Kollide opens in Bangalore.
                    </p>
                    <div className="mx-auto mt-8 max-w-md text-left">
                      <WaitlistForm />
                    </div>
                    <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm opacity-80">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: G.haldi }} /> Opening
                        Sunday, Oct 4
                      </span>
                      <Countdown />
                    </p>
                  </div>
                </div>
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
