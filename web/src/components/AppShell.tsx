import { Compass, Heart, MessageCircle, UserRound } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import BangaloreCheck from './BangaloreCheck'
import Avatar from './Avatar'
import InstallPrompt from './InstallPrompt'
import PendingInviteBanner from './PendingInviteBanner'
import { Logo } from './ui'

type ShellContext = { refreshBadges: () => Promise<void> }

export function useShell() {
  return useOutletContext<ShellContext>()
}

const TABS = [
  // Groups is part of Discover (People / Groups switch).
  { to: '/discover', label: 'Discover', icon: Compass, badge: null, also: '/groups' },
  { to: '/likes', label: 'Likes', icon: Heart, badge: 'likes' },
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
    const [likes, invites, matches, groups] = await Promise.all([
      supabase.rpc('get_incoming_likes'),
      supabase.rpc('get_group_invites'),
      supabase.rpc('get_matches'),
      supabase.rpc('get_my_groups'),
    ])
    setBadges({
      likes: (likes.data?.length ?? 0) + (invites.data?.length ?? 0),
      matches:
        (matches.data?.filter((m) => m.is_new || m.unread).length ?? 0) +
        (groups.data?.filter((g) => g.is_new || g.unread || g.pending_requests > 0).length ?? 0),
    })
  }, [])

  useEffect(() => {
    refreshBadges()
  }, [refreshBadges, location.pathname])

  // New likes and matches arrive as notification rows, new chat messages as
  // message rows (RLS limits both to our own).
  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => refreshBadges(),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => refreshBadges())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
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
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-neutral-200 bg-surface px-4 py-6 lg:flex">
        <Link to="/discover" aria-label="Kollide home" className="px-3">
          <Logo className="text-[1.9rem]" />
        </Link>
        <nav className="mt-10" aria-label="Main">
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
                    className={`relative flex items-center gap-3 rounded-full px-4 py-3 text-[15px] font-semibold transition ${
                      active ? 'text-on-ink' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="side-pill"
                        className="absolute inset-0 rounded-full bg-ink"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <Icon className="relative h-5 w-5" strokeWidth={active ? 2.3 : 1.9} />
                    <span className="relative flex-1">{tab.label}</span>
                    {count > 0 && (
                      <span className="relative min-w-[22px] rounded-full bg-brand-500 px-1.5 text-center text-xs font-bold leading-[22px] text-white">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="mt-auto space-y-3">
          <p className="px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-500">Navratri · Oct 11–19</p>
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-2.5 transition hover:border-neutral-900"
          >
            <Avatar path={photo} name={profile?.first_name ?? ''} className="h-10 w-10 text-sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-neutral-900">{profile?.first_name}</span>
              <span className="block font-mono text-xs text-neutral-500">{profile?.public_code}</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-64">
        {/* Phone header */}
        {!immersive && (
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200/70 bg-canvas/85 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-lg lg:hidden">
            <Link to="/discover" aria-label="Kollide home">
              <Logo className="text-[1.6rem]" />
            </Link>
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-full border border-neutral-200 bg-surface py-1 pl-1 pr-3 transition active:scale-95"
            >
              <Avatar path={photo} name={profile?.first_name ?? ''} className="h-7 w-7 text-xs" />
              <span className="font-mono text-xs font-medium text-neutral-600">{profile?.public_code}</span>
            </Link>
          </header>
        )}

        {immersive ? (
          <Outlet context={{ refreshBadges } satisfies ShellContext} />
        ) : (
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28 pt-4 md:max-w-2xl lg:max-w-5xl lg:px-10 lg:pb-16 lg:pt-10">
            <BangaloreCheck />
            <InstallPrompt />
            <PendingInviteBanner />
            <Outlet context={{ refreshBadges } satisfies ShellContext} />
          </main>
        )}
      </div>

      {/* Phone tab bar */}
      {!immersive && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200/70 bg-surface/90 backdrop-blur-xl lg:hidden">
          <ul className="mx-auto flex max-w-md px-2 pt-1.5">
            {TABS.map((tab) => {
              const count = tab.badge ? badges[tab.badge] : 0
              const active = isActive(tab)
              const Icon = tab.icon
              return (
                <li key={tab.to} className="flex-1">
                  <NavLink
                    to={tab.to}
                    aria-label={count > 0 ? `${tab.label}, ${count} new` : tab.label}
                    className={`flex flex-col items-center gap-0.5 pb-1 text-[11px] font-semibold transition ${
                      active ? 'text-neutral-900' : 'text-neutral-500'
                    }`}
                  >
                    <span className="relative flex h-8 w-14 items-center justify-center">
                      {active && (
                        <motion.span
                          layoutId="tab-pill"
                          className="absolute inset-0 rounded-full bg-ink"
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                      <Icon
                        className={`relative h-[22px] w-[22px] ${active ? 'text-on-ink' : ''}`}
                        strokeWidth={active ? 2.3 : 1.9}
                      />
                      {count > 0 && (
                        <span className="absolute right-1.5 top-0 min-w-[18px] animate-pop rounded-full border-2 border-surface bg-brand-500 px-1 text-center text-[10px] font-bold leading-[14px] text-white">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </span>
                    {tab.label}
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
