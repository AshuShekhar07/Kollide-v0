import { Compass, MessageCircle, UserRound } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useOutlet, useOutletContext } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { useFestival } from '../lib/festival'
import { supabase } from '../lib/supabase'
import BangaloreCheck from './BangaloreCheck'
import { AnimatedDandiya, DandiyaIcon } from './Dandiya'
import Avatar from './Avatar'
import Celebrate from './Celebrate'
import FabricWipe from './FabricWipe'
import { FairyLights, FestivalChip, HeaderThread } from './FestivalBits'
import InstallPrompt from './InstallPrompt'
import PendingInviteBanner from './PendingInviteBanner'
import { Logo } from './ui'

// myPhoto: the storage path of the signed-in user's first photo.
type ShellContext = { refreshBadges: () => Promise<void>; myPhoto: string | null }

export function useShell() {
  return useOutletContext<ShellContext>()
}

// How often badges refresh while the tab is visible: 45 s plus up to 10 s.
const BADGE_POLL_MS = 45_000
const BADGE_POLL_JITTER_MS = 10_000

const TABS = [
  // Groups is part of Discover (People / Groups switch).
  { to: '/discover', label: 'Discover', icon: Compass, badge: null, also: '/groups' },
  { to: '/likes', label: 'Kollides', icon: DandiyaIcon, badge: 'likes' },
  { to: '/matches', label: 'Chats', icon: MessageCircle, badge: 'matches' },
  { to: '/profile', label: 'Profile', icon: UserRound, badge: null, also: '/settings' },
] as const

// Top bar (desktop) or header and floating dock (phones), plus badge counts
// and page transitions, for the main app screens.
export default function AppShell() {
  const { profile } = useAuth()
  const location = useLocation()
  const [badges, setBadges] = useState({ likes: 0, matches: 0 })
  const [photo, setPhoto] = useState<string | null>(null)
  // Bumped to make the Kollides dandiya clack: on hover or tap, and when a
  // new kollide arrives.
  const [clack, setClack] = useState(0)
  const lastLikes = useRef(0)
  const uid = profile?.id
  const festival = useFestival()
  // Fairy lights go up after dark, until the festival's over.
  const lights = festival.isNight && festival.phase !== 'after'
  // Petals for anyone verified in the last week who hasn't seen them yet.
  const [openedAt] = useState(() => Date.now())
  const newlyVerified =
    profile?.verification_status === 'approved' &&
    !!profile.verified_at &&
    openedAt - new Date(profile.verified_at).getTime() < 7 * 86_400_000

  // The first photo is the profile picture. Re-read on navigation so a
  // reorder on /profile shows up straight away.
  useEffect(() => {
    if (!uid) return
    supabase
      .from('photos')
      .select('storage_path')
      .eq('user_id', uid)
      .order('position')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPhoto(data?.storage_path ?? null))
  }, [uid, location.pathname])

  const refreshBadges = useCallback(async () => {
    const { data } = await supabase.rpc('get_badge_counts')
    const counts = data?.[0]
    if (!counts) return
    if (counts.likes > lastLikes.current) setClack((n) => n + 1)
    lastLikes.current = counts.likes
    setBadges({ likes: counts.likes, matches: counts.matches })
  }, [])

  useEffect(() => {
    refreshBadges()
  }, [refreshBadges, location.pathname])

  // New likes and matches arrive as notification rows (filtered to our own).
  // Unread chats have no live feed here, so the poll below picks them up.
  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => refreshBadges(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [uid, refreshBadges])

  // Also refresh on a timer while the tab is showing, so badges still move if
  // the socket can't connect. Jitter keeps tabs from all asking at once.
  useEffect(() => {
    if (!uid) return
    let timer: number | undefined
    const stop = () => window.clearTimeout(timer)
    const schedule = () => {
      stop()
      timer = window.setTimeout(() => {
        refreshBadges()
        schedule()
      }, BADGE_POLL_MS + Math.random() * BADGE_POLL_JITTER_MS)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshBadges()
        schedule()
      } else {
        stop()
      }
    }
    if (document.visibilityState === 'visible') schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [uid, refreshBadges])

  // A chat fills the screen on phones (no header or tab bar); on desktop it
  // sits next to the sidebar like any other page.
  const immersive = location.pathname.startsWith('/chat/')
  const isActive = (tab: (typeof TABS)[number]) =>
    location.pathname.startsWith(tab.to) ||
    ('also' in tab && location.pathname.startsWith(tab.also)) ||
    (tab.to === '/matches' && immersive)

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop top bar: logo, the four sections centred, and you on the right. */}
      <header className="sticky top-0 z-40 hidden bg-canvas/80 backdrop-blur-xl lg:block">
        <div className="mx-auto grid h-[4.5rem] max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-8">
          <Link to="/discover" aria-label="Kollide home" className="justify-self-start">
            <Logo className="text-[1.9rem]" />
          </Link>
          <nav aria-label="Main">
            <ul className="flex items-center gap-1 rounded-full bg-neutral-100/90 p-1 ring-1 ring-neutral-200/70">
              {TABS.map((tab) => {
                const count = tab.badge ? badges[tab.badge] : 0
                const active = isActive(tab)
                const Icon = tab.icon
                return (
                  <li key={tab.to}>
                    <NavLink
                      to={tab.to}
                      aria-label={count > 0 ? `${tab.label}, ${count} new` : tab.label}
                      onPointerEnter={tab.to === '/likes' ? () => setClack((n) => n + 1) : undefined}
                      onClick={tab.to === '/likes' ? () => setClack((n) => n + 1) : undefined}
                      className={`relative flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-bold transition-colors ${
                        active ? 'text-cream' : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="top-pill"
                          className="absolute inset-0 rounded-full bg-maroon-700 shadow-md shadow-maroon-950/25"
                          transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                        />
                      )}
                      {tab.to === '/likes' ? (
                        <AnimatedDandiya className="relative h-5 w-5" strokeWidth={active ? 2.4 : 2} play={clack} />
                      ) : (
                        <Icon className="relative h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                      )}
                      <span className="relative">{tab.label}</span>
                      {count > 0 && (
                        <span className="relative -mr-1 min-w-[20px] animate-pop rounded-full bg-rani px-1.5 text-center text-[11px] font-bold leading-5 text-white">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-3 justify-self-end">
            <FestivalChip festival={festival} long />
            <Link
              to="/profile"
              className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-4 ring-1 ring-neutral-200 transition hover:ring-neutral-400"
            >
              <Avatar path={photo} name={profile?.first_name ?? ''} className="h-9 w-9 text-sm ring-2 ring-marigold-400" />
              <span className="max-w-[8rem] truncate text-sm font-bold text-neutral-900">{profile?.first_name}</span>
            </Link>
          </div>
        </div>
        {/* A festive thread under the bar, and fairy lights hung from it at night. */}
        <HeaderThread festival={festival} />
        {lights && <FairyLights festival={festival} />}
      </header>

      <div className="flex min-h-dvh flex-col lg:min-h-[calc(100dvh-4.75rem)]">
        {/* Phone header */}
        {!immersive && (
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-canvas/85 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-lg lg:hidden">
            <Link to="/discover" aria-label="Kollide home">
              <Logo className="text-[1.6rem]" />
            </Link>
            {lights && <FairyLights festival={festival} />}
            <div className="flex items-center gap-2">
              <FestivalChip festival={festival} />
              <Link to="/profile" aria-label="Your profile" className="rounded-full transition active:scale-95">
                <Avatar
                  path={photo}
                  name={profile?.first_name ?? ''}
                  className="h-9 w-9 text-sm ring-2 ring-marigold-400 ring-offset-2 ring-offset-canvas"
                />
              </Link>
            </div>
          </header>
        )}

        {immersive ? (
          <AnimatedOutlet context={{ refreshBadges, myPhoto: photo } satisfies ShellContext} />
        ) : (
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28 pt-3 md:max-w-2xl lg:max-w-6xl lg:px-8 lg:pb-16 lg:pt-10">
            <BangaloreCheck />
            <InstallPrompt />
            <PendingInviteBanner />
            <AnimatedOutlet context={{ refreshBadges, myPhoto: photo } satisfies ShellContext} />
          </main>
        )}
      </div>

      <FabricWipe section={sectionIndex(location.pathname)} />
      <Celebrate
        id={`verified:${uid}`}
        when={newlyVerified}
        message="You’re verified! Your diya is lit and your kollides are on their way."
      />

      {/* Phone dock: floats over the page, the open tab grows to show its name. */}
      {!immersive && (
        <nav
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:hidden"
          aria-label="Main"
        >
          <ul className="pointer-events-auto mx-auto flex max-w-md items-center gap-1 rounded-full bg-maroon-950/95 p-1.5 shadow-2xl shadow-maroon-950/40 ring-1 ring-white/10 backdrop-blur-xl">
            {TABS.map((tab) => {
              const count = tab.badge ? badges[tab.badge] : 0
              const active = isActive(tab)
              const Icon = tab.icon
              return (
                <li key={tab.to} className={`transition-[flex-grow] duration-300 ${active ? 'flex-[1.7]' : 'flex-1'}`}>
                  <NavLink
                    to={tab.to}
                    aria-label={count > 0 ? `${tab.label}, ${count} new` : tab.label}
                    onClick={tab.to === '/likes' ? () => setClack((n) => n + 1) : undefined}
                    className={`relative flex h-12 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition active:scale-95 ${
                      active ? 'text-maroon-950' : 'text-cream/65'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-full bg-marigold-400"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative">
                      {tab.to === '/likes' ? (
                        <AnimatedDandiya className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} play={clack} />
                      ) : (
                        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                      )}
                      {count > 0 && !active && (
                        <span className="absolute -right-2.5 -top-1.5 min-w-[18px] animate-pop rounded-full bg-rani px-1 text-center text-[10px] font-bold leading-[16px] text-white ring-2 ring-maroon-950">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </span>
                    {active && <span className="relative animate-rise truncate">{tab.label}</span>}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}

// Which section a path belongs to, left to right, for the slide direction.
function sectionIndex(path: string) {
  const i = TABS.findIndex((t) => path.startsWith(t.to) || ('also' in t && path.startsWith(t.also)))
  return i === -1 && path.startsWith('/chat/') ? 2 : i
}

const EASE = [0.22, 1, 0.36, 1] as const

// The current page, sliding in from the side of the section you moved to
// (or rising, within a section) and out the other way.
function AnimatedOutlet({ context }: { context: ShellContext }) {
  const location = useLocation()
  const outlet = useOutlet(context)
  const reduced = useReducedMotion()
  const index = sectionIndex(location.pathname)
  // Remember the last page and the direction we moved (updated during render,
  // React's pattern for state derived from a changing prop).
  const [last, setLast] = useState({ path: location.pathname, index, dir: 0 })
  let dir = last.dir
  if (last.path !== location.pathname) {
    dir = index === last.index ? 0 : index > last.index ? 1 : -1
    setLast({ path: location.pathname, index, dir })
  }

  if (reduced) return outlet
  return (
    // No initial={false} here: it would be inherited by every motion component
    // inside the first page and silently skip their entrance animations.
    <AnimatePresence mode="wait" custom={dir} onExitComplete={() => window.scrollTo(0, 0)}>
      <motion.div
        key={location.pathname}
        className="flex flex-1 flex-col"
        custom={dir}
        variants={{
          enter: (d: number) => ({ opacity: 0, x: d * 36, y: d ? 0 : 14 }),
          center: { opacity: 1, x: 0, y: 0 },
          exit: (d: number) => ({ opacity: 0, x: d * -36, y: d ? 0 : -8 }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.26, ease: EASE }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
