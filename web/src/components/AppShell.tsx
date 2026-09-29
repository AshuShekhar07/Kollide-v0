import { ChevronRight, Compass, MessageCircle, UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { navratriStatus } from '../lib/format'
import { supabase } from '../lib/supabase'
import BangaloreCheck from './BangaloreCheck'
import { DandiyaIcon } from './Dandiya'
import Avatar from './Avatar'
import InstallPrompt from './InstallPrompt'
import Toran from './landing/Toran'
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

// Sidebar (desktop) or header and bottom tab bar (phones), plus badge
// counts, for the main app screens.
export default function AppShell() {
  const { profile } = useAuth()
  const location = useLocation()
  const [badges, setBadges] = useState({ likes: 0, matches: 0 })
  const [photo, setPhoto] = useState<string | null>(null)
  const uid = profile?.id

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
    if (counts) setBadges({ likes: counts.likes, matches: counts.matches })
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
      {/* Desktop sidebar: the landing page's maroon hero, toran and all. */}
      <aside className="bandhani-soft fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-maroon-700 pb-5 text-cream lg:flex">
        <Toran count={10} className="-mx-1 shrink-0 text-cream" />
        <Link to="/discover" aria-label="Kollide home" className="mt-2 self-start px-7">
          <Logo tone="white" className="text-[2rem]" />
        </Link>
        <nav className="mt-10 px-4" aria-label="Main">
          <ul className="space-y-1">
            {TABS.map((tab) => {
              const count = tab.badge ? badges[tab.badge] : 0
              const active = isActive(tab)
              const Icon = tab.icon
              return (
                <li key={tab.to}>
                  <NavLink
                    to={tab.to}
                    aria-label={count > 0 ? `${tab.label}, ${count} new` : tab.label}
                    className={`relative flex items-center gap-3 rounded-full px-4 py-3 text-[15px] font-bold transition ${
                      active ? 'text-maroon-950' : 'text-cream/75 hover:bg-white/10 hover:text-cream'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="side-pill"
                        className="absolute inset-0 rounded-full bg-marigold-400 shadow-lg shadow-maroon-950/30"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <Icon className="relative h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                    <span className="relative flex-1">{tab.label}</span>
                    {count > 0 && (
                      <span className="relative min-w-[22px] rounded-full bg-rani px-1.5 text-center text-xs font-bold leading-[22px] text-white ring-2 ring-maroon-700">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="mt-auto space-y-3 px-4">
          <Countdown />
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-full bg-white/10 p-1.5 pr-4 ring-1 ring-white/10 transition hover:bg-white/15"
          >
            <Avatar path={photo} name={profile?.first_name ?? ''} className="h-10 w-10 text-sm ring-2 ring-marigold-400" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{profile?.first_name}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
          </Link>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-64">
        {/* Phone header */}
        {!immersive && (
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-canvas/85 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-lg lg:hidden">
            <Link to="/discover" aria-label="Kollide home">
              <Logo className="text-[1.6rem]" />
            </Link>
            <div className="flex items-center gap-2">
              <CountdownChip />
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
          <Outlet context={{ refreshBadges, myPhoto: photo } satisfies ShellContext} />
        ) : (
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28 pt-3 md:max-w-2xl lg:max-w-5xl lg:px-10 lg:pb-16 lg:pt-12">
            <BangaloreCheck />
            <InstallPrompt />
            <PendingInviteBanner />
            <Outlet context={{ refreshBadges, myPhoto: photo } satisfies ShellContext} />
          </main>
        )}
      </div>

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
                      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
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

// Days to go, or which night it is, in the sidebar.
function Countdown() {
  const [status] = useState(() => navratriStatus())
  return (
    <div className="rounded-3xl bg-maroon-950/35 p-4 ring-1 ring-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-marigold-400">Navratri · Oct 11–19</p>
      <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight tracking-[-0.03em]">
        {status.phase === 'before' ? (
          <>
            <span className="text-marigold-400">{status.days}</span> day{status.days === 1 ? '' : 's'} to go
          </>
        ) : status.phase === 'during' ? (
          <>
            Night <span className="text-marigold-400">{status.night}</span> of 9
          </>
        ) : (
          'See you next year'
        )}
      </p>
    </div>
  )
}

// The same, squeezed into the phone header.
function CountdownChip() {
  const [status] = useState(() => navratriStatus())
  if (status.phase === 'after') return null
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-maroon-700 px-3 py-1.5 text-xs font-bold text-cream">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-marigold-400" aria-hidden />
      {status.phase === 'before' ? `${status.days}d to Navratri` : `Night ${status.night} of 9`}
    </span>
  )
}
