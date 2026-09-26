import type { Database } from './database.types'

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
