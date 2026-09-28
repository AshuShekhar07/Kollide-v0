import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { motion, MotionConfig, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import HoverSwap from '../components/landing/HoverSwap'
import HoverWordmark from '../components/landing/HoverWordmark'
import HowItWorks from '../components/landing/HowItWorks'
import LogoIntro from '../components/landing/LogoIntro'
import { FadeUp, RevealText } from '../components/landing/Reveal'
import WhatsNext from '../components/landing/WhatsNext'
import Wordmark from '../components/landing/Wordmark'
import WaitlistForm from '../components/WaitlistForm'
import { supabase } from '../lib/supabase'

// The landing page uses fixed hex colours (not the theme's neutral-* tokens)
// so it stays white and near-black when the phone is in dark mode.

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

function Countdown() {
  const [days] = useState(() => Math.ceil((NAVRATRI.getTime() - Date.now()) / 86_400_000))
  if (days <= 0) return <span>Navratri is here · Oct 11–19</span>
  return (
    <span>
      <strong className="font-bold text-[#fff]">{days}</strong> day{days === 1 ? '' : 's'} to Navratri · Oct 11–19
    </span>
  )
}

function Eyebrow({ children, className = 'text-[#E0661A]' }: { children: string; className?: string }) {
  return <p className={`text-xs font-bold uppercase tracking-[0.22em] ${className}`}>{children}</p>
}

const HEADING = 'font-extrabold leading-[1.05] tracking-[-0.025em]'

function Hero({ ready, onJoin }: { ready: boolean; onJoin: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const videoScale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [1, 1.15])
  const textY = useTransform(scrollYProgress, [0, 1], reduced ? ['0%', '0%'] : ['0%', '-35%'])
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], reduced ? [1, 1] : [1, 0])

  return (
    <section ref={ref} className="relative flex h-[100svh] min-h-[560px] flex-col overflow-hidden">
      <motion.div className="absolute inset-0" style={{ scale: videoScale }} aria-hidden>
        <video
          className="h-full w-full object-cover opacity-50"
          src="/landing/garba-hero.mp4"
          poster="/landing/garba-hero-poster.jpg"
          autoPlay={!reduced}
          muted
          loop
          playsInline
          preload={reduced ? 'none' : 'auto'}
        />
      </motion.div>
      {/* A soft white wash behind the text, and a fade into the page below. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 62% 48% at 50% 50%, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0) 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-[#fff]/0 to-[#fff]"
        aria-hidden
      />

      <header className="relative z-10 flex w-full items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-6 lg:px-8">
        <Link to="/" aria-label="Kollide home" className="-ml-1">
          <HoverWordmark className="h-10 w-auto sm:h-12 lg:h-14" />
        </Link>
        <Link
          to="/start"
          className="rounded-full bg-[#111] px-5 py-2.5 text-sm font-semibold text-[#fff] transition hover:bg-[#333] active:scale-95"
        >
          Sign in
        </Link>
      </header>

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 text-center"
        style={{ y: textY, opacity: textOpacity }}
      >
        <FadeUp play={ready}>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#111]/70 sm:text-xs sm:tracking-[0.22em]">
            Garba nights · Bangalore · Oct 11–19
          </p>
        </FadeUp>
        <RevealText
          as="h1"
          play={ready}
          delay={0.1}
          text="Find people to show up with, not just swipe past."
          className="mt-5 text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-7xl"
        />
        <FadeUp play={ready} delay={0.55}>
          <button
            type="button"
            onClick={onJoin}
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-[#111] py-3.5 pl-6 pr-5 font-semibold text-[#fff] shadow-lg shadow-black/15 transition hover:bg-[#333] active:scale-[0.97]"
          >
            Join the waitlist
            <ArrowUpRight className="h-5 w-5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        </FadeUp>
      </motion.div>

      <motion.div className="relative z-10" style={{ opacity: textOpacity }} aria-hidden>
        <motion.div
          className="flex flex-col items-center gap-1 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-xs font-semibold uppercase tracking-[0.2em] text-[#111]/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: 0.6, delay: ready ? 1 : 0 }}
        >
          Scroll
          <motion.span
            animate={reduced ? undefined : { y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowDown className="h-4 w-4" />
          </motion.span>
        </motion.div>
      </motion.div>
    </section>
  )
}

function StorySection({
  eyebrow,
  heading,
  body,
  base,
  reveal,
  mirrored = false,
}: {
  eyebrow: string
  heading: string
  body: string
  base: { src: string; alt: string; position?: string }
  reveal: { src: string; alt: string; position?: string }
  mirrored?: boolean
}) {
  return (
    <section
      className={`mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:gap-14 md:py-28 ${
        mirrored ? 'md:grid-cols-[1fr_1.4fr]' : 'md:grid-cols-[1.4fr_1fr]'
      }`}
    >
      {/* Tall on phones, landscape on wider screens. */}
      <div className={`mx-auto w-full max-w-md md:max-w-none ${mirrored ? 'md:order-2' : ''}`}>
        <HoverSwap base={base} reveal={reveal} className="md:aspect-[4/3]" />
      </div>
      <div className={mirrored ? 'md:order-1' : ''}>
        <FadeUp>
          <Eyebrow>{eyebrow}</Eyebrow>
        </FadeUp>
        <RevealText text={heading} className={`mt-4 text-4xl sm:text-5xl lg:text-6xl ${HEADING}`} />
        <FadeUp delay={0.15}>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#111]/70">{body}</p>
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

  // Keep the page white around the edges (overscroll) even in dark mode.
  useEffect(() => {
    const root = document.documentElement
    const prev = { bg: root.style.backgroundColor, scheme: root.style.colorScheme }
    root.style.backgroundColor = '#fff'
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

  function scrollToWaitlist() {
    const target = document.getElementById('waitlist')
    if (!target) return
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -24, duration: 1.6 })
    else target.scrollIntoView({ block: 'start' })
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-clip bg-[#fff] text-[#111] [color-scheme:light]">
        {!introDone && (
          <LogoIntro
            onReveal={() => setReady(true)}
            onDone={() => {
              introPlayed = true
              setIntroDone(true)
            }}
          />
        )}

        <Hero ready={ready} onJoin={scrollToWaitlist} />

        <main>
          <StorySection
            eyebrow="Navratri 2026"
            heading="It's that time of the year."
            body="Nine nights of garba are almost here. Celebrate them together: make new friends, find your crowd, and assemble a group to dance with."
            base={{ src: '/landing/together-fistbump.webp', alt: 'Friends bumping fists in a circle at a garba night' }}
            reveal={{ src: '/landing/together-dandiya.webp', alt: 'Friends crossing dandiya sticks into a star' }}
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
          />

          <HowItWorks />

          <WhatsNext activities={comingSoon} canVote={fromDb} />

          <section id="waitlist" className="scroll-mt-6 px-4 pb-16 pt-16 sm:px-6 md:pt-24">
            <FadeUp className="mx-auto max-w-6xl">
              <div className="relative overflow-hidden rounded-[2rem] bg-[#111] px-6 py-14 text-center text-[#fff] sm:px-12 sm:py-20">
                <div
                  className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[#E0661A]/20 blur-3xl"
                  aria-hidden
                />
                <div className="relative mx-auto max-w-xl">
                  <Wordmark tone="dark" className="mx-auto h-12 w-auto sm:h-14" />
                  <RevealText
                    text="Don't go alone this Navratri."
                    className={`mt-8 text-4xl sm:text-5xl ${HEADING}`}
                  />
                  <p className="mt-4 text-[#fff]/70">
                    Join the waitlist and we'll email you the moment Kollide opens in Bangalore.
                  </p>
                  <div className="mx-auto mt-8 max-w-md text-left">
                    <WaitlistForm />
                  </div>
                  <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-[#fff]/70">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#E0661A]" /> Opening Sunday, Oct 4
                    </span>
                    <Countdown />
                  </p>
                </div>
              </div>
            </FadeUp>
          </section>
        </main>

        <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-10 pt-4 text-sm text-[#111]/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Wordmark className="h-6 w-auto" />
            <span>© 2026 · Made in Bangalore</span>
          </div>
          <p className="flex gap-5">
            <Link to="/privacy" className="underline-offset-4 hover:text-[#111] hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="underline-offset-4 hover:text-[#111] hover:underline">
              Terms
            </Link>
          </p>
        </footer>
      </div>
    </MotionConfig>
  )
}
