// Phase 3 acceptance: two clients sending at the same time can never push
// message_count past message_cap (PLAN.md §7, Phase 3).
//
// Local only. Run from web/ against `supabase start`:
//   eval "$(npx supabase status -o env | sed 's/^/export /')"
//   node scripts/chat-cap-concurrency.mjs
//
// Matches two seeded users (Sneha and Isha), puts their chat 20 messages
// short of the cap, then fires 30 sends from each client at once.
import { createClient } from '@supabase/supabase-js'

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env
if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Set API_URL, ANON_KEY and SERVICE_ROLE_KEY (see the header comment).')
  process.exit(1)
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(API_URL)) {
  console.error('Refusing to run against a non-local project.')
  process.exit(1)
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(API_URL, SERVICE_ROLE_KEY, opts)

async function signIn(email) {
  const client = createClient(API_URL, ANON_KEY, opts)
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' })
  if (error) throw error
  return { client, id: data.user.id }
}

const sneha = await signIn('approved07@kollide.test')
const isha = await signIn('approved08@kollide.test')
const { data: garba } = await admin.from('activities').select('id').eq('slug', 'garba').single()

for (const [me, other] of [[sneha, isha], [isha, sneha]]) {
  const { error } = await me.client.rpc('like_profile', { p_target_id: other.id, p_activity_id: garba.id })
  if (error) throw error
}
const { data: matches, error: matchError } = await sneha.client.rpc('get_matches')
if (matchError) throw matchError
const conv = matches.find((m) => m.user_id === isha.id)?.conversation_id
if (!conv) throw new Error('Sneha and Isha did not match')

const { data: before } = await admin.from('conversations').select('message_cap').eq('id', conv).single()
const start = before.message_cap - 20
await admin.from('messages').delete().eq('conversation_id', conv)
await admin.from('conversations').update({ message_count: start, is_frozen: false }).eq('id', conv)

const PER_CLIENT = 30
const sends = [sneha, isha].flatMap((u) =>
  Array.from({ length: PER_CLIENT }, (_, i) =>
    u.client.rpc('send_message', { p_conversation_id: conv, p_body: `msg ${i} from ${u.id.slice(-2)}` }),
  ),
)
const results = await Promise.all(sends)

const ok = results.filter((r) => !r.error).length
const capped = results.filter((r) => r.error?.code === 'KL002').length
const other = results.filter((r) => r.error && r.error.code !== 'KL002')
const { data: after } = await admin.from('conversations').select('message_count, message_cap').eq('id', conv).single()
const { count: stored } = await admin.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv)

console.log({ attempted: sends.length, ok, capped, otherErrors: other.length, ...after, stored })

const pass = ok === 20 && capped === sends.length - 20 && other.length === 0 &&
  after.message_count === after.message_cap && stored === 20
console.log(pass ? 'PASS: cap held under concurrent sends' : 'FAIL')
if (other.length) console.log(other.slice(0, 3).map((r) => r.error))
process.exit(pass ? 0 : 1)
