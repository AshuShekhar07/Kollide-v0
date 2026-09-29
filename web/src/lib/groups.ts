import type { ShownAnswer } from './about'
import type { Database } from './database.types'
import { supabase } from './supabase'

type Functions = Database['public']['Functions']
type Enums = Database['public']['Enums']

export type MemberStatus = Enums['group_member_status']
export type GroupListItem = Functions['get_groups']['Returns'][number]
export type MyGroup = Functions['get_my_groups']['Returns'][number]
export type GroupInvite = Functions['get_group_invites']['Returns'][number]
export type InterestedPerson = Functions['get_group_interested']['Returns'][number]

// get_group returns jsonb; this is its shape.
export type GroupMember = {
  user_id: string
  first_name: string
  public_code: string
  role: Enums['group_role']
  photo_path: string | null
}
export type GroupDetail = {
  id: string
  activity_id: string
  title: string
  description: string | null
  event_date: string | null
  venue: string | null
  max_members: number
  status: Enums['group_status']
  member_count: number
  my_status: MemberStatus | null
  my_role: Enums['group_role'] | null
  conversation_id: string | null
  pending_requests: number | null
  members: GroupMember[]
}

export const MAX_GROUP_SIZE = 10

// "Sat, 11 Oct" for a date-only value, without a timezone shift.
export function eventDate(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

export function spotsLeft(g: { member_count: number; max_members: number }) {
  const n = Math.max(g.max_members - g.member_count, 0)
  return n === 0 ? 'Full' : `${n} spot${n === 1 ? '' : 's'} left`
}

// { month: 'OCT', day: '11', weekday: 'Sat' } for the calendar chip on group cards.
export function dateParts(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    month: date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    day: String(d),
    weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }),
  }
}

// One group member's profile, for deciding whether a group is for you before
// you ask to join. get_group_member_profile returns jsonb; this is its shape.
export type MemberProfile = {
  user_id: string
  first_name: string
  age: number
  bio: string | null
  photo_paths: string[]
  answers: ShownAnswer[]
}

export async function fetchMemberProfile(groupId: string, userId: string): Promise<MemberProfile> {
  const { data, error } = await supabase.rpc('get_group_member_profile', {
    p_group_id: groupId,
    p_user_id: userId,
  })
  if (error) throw error
  return data as unknown as MemberProfile
}
