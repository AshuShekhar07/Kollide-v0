import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from './auth-context'
import { supabase } from './supabase'
import type { Profile } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // The user id the current profile/isAdmin values belong to (null = signed out).
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    // Don't call Supabase inside this callback (supabase-js can deadlock);
    // profile loading reacts to the user id below instead.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionLoaded(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setIsAdmin(false)
      setLoadedFor(null)
      return
    }
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle(),
    ])
    setProfile(p)
    setIsAdmin(!!a)
    setLoadedFor(userId)
  }, [userId])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value: AuthState = {
    // Loading until the profile matches the current session's user, so guards
    // never act on a stale or missing profile.
    loading: !sessionLoaded || loadedFor !== (userId ?? null),
    session,
    profile,
    isAdmin,
    refreshProfile,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
