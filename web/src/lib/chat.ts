import type { Database } from './database.types'

type Functions = Database['public']['Functions']
type Enums = Database['public']['Enums']

export type ChatMessage = Omit<Functions['get_messages']['Returns'][number], 'starred_at'> & {
  starred_at: string | null
}

// get_conversation returns jsonb; this is its shape.
export type ChatMember = { user_id: string; first_name: string; public_code: string; photo_path: string | null }
export type Conversation = {
  id: string
  kind: Enums['conversation_kind']
  // How many messages the chat keeps (50 × members), starred ones included.
  message_cap: number
  // Every message ever sent.
  message_count: number
  starred_count: number
  is_frozen: boolean
  members: ChatMember[]
  // Group chats only. `names` covers everyone who has been in the chat.
  group: { id: string; title: string; is_admin: boolean; names: Record<string, string> } | null
}

// Exact copy required wherever encryption comes up (PLAN.md §2.3).
export const PRIVACY_COPY =
  'Your messages are private. If a conversation is reported, our safety team reviews it to investigate.'

export const MAX_MESSAGE_LENGTH = 500

// The chat keeps its starred messages plus the newest (cap - starred) others;
// the server deletes older ones as new messages arrive (20261017000001).
// `messages` is oldest first, and so is the result.
export function keptMessages(messages: ChatMessage[], cap: number, starred: number) {
  let room = cap - starred
  const kept: ChatMessage[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.starred_at) kept.push(m)
    else if (room > 0) {
      kept.push(m)
      room--
    }
  }
  return kept.reverse()
}

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
