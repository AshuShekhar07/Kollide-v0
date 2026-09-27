import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import BangaloreCheck from './BangaloreCheck'
import InstallPrompt from './InstallPrompt'

type ShellContext = { refreshBadges: () => Promise<void> }

export function useShell() {
  return useOutletContext<ShellContext>()
}

const TABS = [
  // Groups is part of Discover (People / Groups switch).
  { to: '/discover', label: 'Discover', badge: null, also: '/groups' },
  { to: '/likes', label: 'Likes', badge: 'likes' },
  { to: '/matches', label: 'Matches', badge: 'matches' },
  { to: '/profile', label: 'Profile', badge: null, also: '/settings' },
] as const

// Header, bottom tab bar and badge counts for the main app screens.
export default function AppShell() {
  const { profile } = useAuth()
  const location = useLocation()
  const [badges, setBadges] = useState({ likes: 0, matches: 0 })
  const uid = profile?.id

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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs text-neutral-600">
          {profile?.first_name} · {profile?.public_code}
        </span>
      </header>

      <div className="flex flex-1 flex-col px-4 pb-24 pt-4">
        <BangaloreCheck />
        <InstallPrompt />
        <Outlet context={{ refreshBadges } satisfies ShellContext} />
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-md">
          {TABS.map((tab) => {
            const count = tab.badge ? badges[tab.badge] : 0
            return (
              <li key={tab.to} className="flex-1">
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex justify-center py-3 text-sm font-semibold ${
                      isActive || ('also' in tab && location.pathname.startsWith(tab.also)) ? 'text-brand-700' : 'text-neutral-500'
                    }`
                  }
                >
                  <span className="relative">
                    {tab.label}
                    {count > 0 && (
                      <span className="absolute -right-5 -top-2 min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-[11px] leading-5 text-white">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
