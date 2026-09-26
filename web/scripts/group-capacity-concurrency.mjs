// Phase 4 acceptance: a group never exceeds max_members, even when many
// invitees accept at the same moment (PLAN.md §7, Phase 4).
//
// Local only. Run from web/ against `supabase start`:
//   eval "$(npx supabase status -o env | sed 's/^/export /')"
//   node scripts/group-capacity-concurrency.mjs
//
// Diya creates a group of 3, invites 8 seeded users, then all 8 accept at once.
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
const TITLE = 'Concurrency test'
const MAX = 3

async function signIn(email) {
  const client = createClient(API_URL, ANON_KEY, opts)
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' })
  if (error) throw error
  return { client, id: data.user.id }
}

// Earlier runs' groups would count against Diya's 3-group limit.
await admin.from('groups').delete().eq('title', TITLE)

const diya = await signIn('approved11@kollide.test')
const invitees = await Promise.all(
  Array.from({ length: 8 }, (_, i) => signIn(`approved${String(i + 1).padStart(2, '0')}@kollide.test`)),
)
const { data: garba } = await admin.from('activities').select('id').eq('slug', 'garba').single()

const { data: created, error: createError } = await diya.client.rpc('create_group', {
  p_activity_id: garba.id,
  p_title: TITLE,
  p_description: null,
  p_event_date: null,
  p_venue: null,
  p_max_members: MAX,
})
if (createError) throw createError
const gid = created.group_id

for (const u of invitees) {
  const { error } = await diya.client.rpc('invite_to_group', { p_group_id: gid, p_user_id: u.id })
  if (error) throw error
}

const results = await Promise.all(
  invitees.map((u) => u.client.rpc('respond_invite', { p_group_id: gid, p_accept: true })),
)

const ok = results.filter((r) => !r.error).length
const full = results.filter((r) => r.error?.message === 'This group is full').length
const other = results.filter((r) => r.error && r.error.message !== 'This group is full')
const { count: members } = await admin
  .from('group_members')
  .select('user_id', { count: 'exact', head: true })
  .eq('group_id', gid)
  .eq('status', 'approved')
const { data: group } = await admin.from('groups').select('status').eq('id', gid).single()
const { data: conv } = await admin.from('conversations').select('id, message_cap').eq('group_id', gid).single()
const { count: chatMembers } = await admin
  .from('conversation_members')
  .select('user_id', { count: 'exact', head: true })
  .eq('conversation_id', conv.id)
  .is('left_at', null)

console.log({ attempted: results.length, ok, full, otherErrors: other.length, members, chatMembers, status: group.status, cap: conv.message_cap })

const pass = ok === MAX - 1 && full === results.length - ok && other.length === 0 &&
  members === MAX && chatMembers === MAX && group.status === 'full' && conv.message_cap === 50 * MAX
console.log(pass ? 'PASS: member limit held under concurrent accepts' : 'FAIL')
if (other.length) console.log(other.slice(0, 3).map((r) => r.error))

await admin.from('groups').delete().eq('id', gid)
process.exit(pass ? 0 : 1)
