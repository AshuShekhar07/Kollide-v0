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

// Header, bottom tab bar and badge counts for the main app screens.
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

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col">
      <div
        className="bandhani pointer-events-none absolute inset-x-0 top-0 h-56 text-brand-300/30 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        aria-hidden
      />
      <header className="sticky top-0 z-30 flex items-center justify-between bg-canvas/85 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-lg">
        <Link to="/discover" aria-label="Kollide home">
          <Logo className="text-2xl" />
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-full border border-neutral-200 bg-surface py-1 pl-1 pr-3 shadow-sm transition active:scale-95"
        >
          <Avatar path={photo} name={profile?.first_name ?? ''} className="h-7 w-7 text-xs" />
          <span className="font-mono text-xs font-medium text-neutral-600">{profile?.public_code}</span>
        </Link>
      </header>

      <div className="flex flex-1 flex-col px-4 pb-28 pt-2">
        <BangaloreCheck />
        <InstallPrompt />
        <PendingInviteBanner />
        <Outlet context={{ refreshBadges } satisfies ShellContext} />
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200/70 bg-surface/90 backdrop-blur-xl">
        <ul className="mx-auto flex max-w-md px-2 pt-1.5">
          {TABS.map((tab) => {
            const count = tab.badge ? badges[tab.badge] : 0
            const active = location.pathname.startsWith(tab.to) || ('also' in tab && location.pathname.startsWith(tab.also))
            const Icon = tab.icon
            return (
              <li key={tab.to} className="flex-1">
                <NavLink
                  to={tab.to}
                  aria-label={count > 0 ? `${tab.label}, ${count} new` : tab.label}
                  className={`flex flex-col items-center gap-0.5 pb-1 text-[11px] font-semibold transition ${
                    active ? 'text-brand-700' : 'text-neutral-500'
                  }`}
                >
                  <span className="relative flex h-8 w-14 items-center justify-center">
                    {active && (
                      <motion.span
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-full bg-brand-100"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <Icon
                      className={`relative h-[22px] w-[22px] ${active ? 'fill-brand-700/15' : ''}`}
                      strokeWidth={active ? 2.3 : 1.9}
                    />
                    {count > 0 && (
                      <span className="absolute right-1.5 top-0 min-w-[18px] animate-pop rounded-full border-2 border-surface bg-marigold-500 px-1 text-center text-[10px] font-bold leading-[14px] text-white">
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
    </div>
  )
}
