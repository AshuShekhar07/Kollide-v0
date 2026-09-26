import type { Database } from './database.types'

type Functions = Database['public']['Functions']
type Enums = Database['public']['Enums']

export type ChatMessage = Functions['get_messages']['Returns'][number]

// get_conversation returns jsonb; this is its shape.
export type ChatMember = { user_id: string; first_name: string; public_code: string; photo_path: string | null }
export type Conversation = {
  id: string
  kind: Enums['conversation_kind']
  message_cap: number
  message_count: number
  is_frozen: boolean
  members: ChatMember[]
}

// Exact copy required wherever encryption comes up (PLAN.md §2.3).
export const PRIVACY_COPY =
  'Your messages are private. If a conversation is reported, our safety team reviews it to investigate.'

export const MAX_MESSAGE_LENGTH = 500

export const REPORT_REASONS: { value: Enums['report_reason']; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'safety_threat', label: 'Threats or feeling unsafe' },
  { value: 'inappropriate', label: 'Inappropriate or sexual messages' },
  { value: 'fake_profile', label: 'Fake profile or not the person in the photos' },
  { value: 'spam', label: 'Spam or selling something' },
  { value: 'other', label: 'Something else' },
]

export const REASON_LABELS = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label])) as Record<
  Enums['report_reason'],
  string
>
