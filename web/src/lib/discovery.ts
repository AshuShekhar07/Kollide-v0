import type { Database } from './database.types'
import { supabase } from './supabase'

type Functions = Database['public']['Functions']

// get_feed / like_profile / respond_to_like return jsonb; these are their shapes.
export type FeedProfile = {
  id: string
  first_name: string
  public_code: string
  age: number
  gender: Database['public']['Enums']['gender']
  bio: string | null
  photo_paths: string[]
}
export type Feed = { profiles: FeedProfile[]; views_left: number | null }
export type MatchResult = { matched: boolean; status?: string; match_id?: string; conversation_id?: string }

export type IncomingLike = Functions['get_incoming_likes']['Returns'][number]
export type MatchItem = Functions['get_matches']['Returns'][number]

export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', href: (h: string) => `https://instagram.com/${h}` },
  { key: 'snapchat', label: 'Snapchat', href: (h: string) => `https://snapchat.com/add/${h}` },
  { key: 'whatsapp', label: 'WhatsApp', href: (h: string) => `https://wa.me/${h.replace(/\D/g, '')}` },
  { key: 'telegram', label: 'Telegram', href: (h: string) => `https://t.me/${h}` },
] as const
export type Contact = Partial<Record<(typeof SOCIALS)[number]['key'], string>>

export type LiveActivity = { id: string; name: string }

// The first live activity the user picked (Garba during the pilot).
export async function fetchLiveActivity(uid: string): Promise<LiveActivity | null> {
  const { data, error } = await supabase
    .from('user_activities')
    .select('activities!inner(id, name, status, sort_order)')
    .eq('user_id', uid)
    .eq('activities.status', 'live')
  if (error) throw error
  const live = (data ?? []).map((r) => r.activities).sort((a, b) => a.sort_order - b.sort_order)
  return live[0] ? { id: live[0].id, name: live[0].name } : null
}

export async function markNotificationsRead(type: string) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('type', type)
    .is('read_at', null)
}
