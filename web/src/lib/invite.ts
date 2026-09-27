import { homePathFor } from './auth-context'
import type { MemberStatus } from './groups'
import type { Profile } from './types'

// get_group_invite returns jsonb; this is its shape. group_id and my_status
// are only filled in for verified viewers.
export type InvitePreview = {
  title: string
  activity_name: string | null
  event_date: string | null
  status: 'open' | 'full' | 'closed'
  member_count: number
  max_members: number
  admin_name: string | null
  group_id: string | null
  my_status: MemberStatus | null
}

// A friend who opens an invite link may need to sign up and get verified
// first, so the link's token is kept on this device until they can use it.
const KEY = 'kollide:invite'

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function savePendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // Private mode: the link still works if they open it again.
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function inviteUrl(token: string) {
  return `${window.location.origin}/join/${token}`
}

// Where to send someone after sign-in: back to their invite once they're
// through onboarding, otherwise the usual place.
export function startPathFor(profile: Profile | null) {
  const home = homePathFor(profile)
  const token = pendingInvite()
  return home === '/discover' && token ? `/join/${token}` : home
}
