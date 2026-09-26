import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Profile } from './types'

export type AuthState = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

// Where a signed-in user belongs right now.
export function homePathFor(profile: Profile | null): string {
  if (!profile) return '/login'
  if (!profile.onboarding_complete) return '/onboarding'
  if (profile.verification_status === 'unsubmitted' || profile.verification_status === 'rejected') {
    return '/onboarding'
  }
  return '/discover'
}
