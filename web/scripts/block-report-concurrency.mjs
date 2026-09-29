// KOL-12 acceptance: blocking and reporting the same person at the same time
// never deadlocks (SQLSTATE 40P01), and both effects land.
//
// Local only. Run from web/ against `supabase start`:
//   eval "$(npx supabase status -o env | sed 's/^/export /')"
//   node scripts/block-report-concurrency.mjs
//
// Matches two seeded users (Sneha and Isha), then 60 times: Sneha reports
// Isha about their chat while one of them blocks the other, both calls fired
// at once. Isha blocking Sneha crosses the conversation lock with the pair
// lock; Sneha blocking Isha also writes the same blocks row the report does.
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

const ITERATIONS = 60
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
const pair = `(${sneha.id},${isha.id})`

// Puts the pair back to "matched, chatting, nobody blocked or reported".
async function reset(conv) {
  const both = `and(blocker_id.eq.${sneha.id},blocked_id.eq.${isha.id}),and(blocker_id.eq.${isha.id},blocked_id.eq.${sneha.id})`
  for (const q of [
    admin.from('reports').delete().in('reporter_id', [sneha.id, isha.id]).in('reported_id', [sneha.id, isha.id]),
    admin.from('blocks').delete().or(both),
    admin.from('conversations').update({ is_frozen: false, retained: false }).eq('id', conv),
  ]) {
    const { error } = await q
    if (error) throw error
  }
}

// Earlier runs must not leave a block behind that stops the likes below.
await admin.from('reports').delete().in('reporter_id', [sneha.id, isha.id]).in('reported_id', [sneha.id, isha.id])
await admin.from('blocks').delete().or(
  `and(blocker_id.eq.${sneha.id},blocked_id.eq.${isha.id}),and(blocker_id.eq.${isha.id},blocked_id.eq.${sneha.id})`,
)

for (const [me, other] of [[sneha, isha], [isha, sneha]]) {
  const { error } = await me.client.rpc('like_profile', { p_target_id: other.id, p_activity_id: garba.id })
  if (error) throw error
}
const { data: matches, error: matchError } = await sneha.client.rpc('get_matches')
if (matchError) throw matchError
const conv = matches.find((m) => m.user_id === isha.id)?.conversation_id
if (!conv) throw new Error(`Sneha and Isha ${pair} did not match`)

const isDeadlock = (e) => e && (e.code === '40P01' || /deadlock detected/i.test(e.message ?? ''))

let deadlocks = 0
let otherErrors = 0
let effectFailures = 0
const samples = []

for (let i = 0; i < ITERATIONS; i++) {
  await reset(conv)

  // Even runs: Isha blocks the person reporting her. Odd runs: Sneha blocks
  // the person she is reporting, the same blocks row the report writes.
  const blocker = i % 2 === 0 ? isha : sneha
  const blocked = blocker === isha ? sneha : isha

  const [report, block] = await Promise.all([
    sneha.client.rpc('report_user', {
      p_reported_id: isha.id,
      p_conversation_id: conv,
      p_reason: 'spam',
      p_details: null,
      p_consent: true,
    }),
    blocker.client.rpc('block_user', { p_target_id: blocked.id }),
  ])

  for (const r of [report, block]) {
    if (isDeadlock(r.error)) deadlocks++
    else if (r.error) {
      otherErrors++
      if (samples.length < 3) samples.push(r.error)
    }
  }
  if (report.error || block.error) continue

  // Both effects: the report is stored once against the chat, the chat is
  // retained and frozen, and each intended block exists.
  const { count: reports } = await admin
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', sneha.id).eq('reported_id', isha.id).eq('conversation_id', conv)
  const { data: c } = await admin.from('conversations').select('retained, is_frozen').eq('id', conv).single()
  const { data: blocks } = await admin
    .from('blocks').select('blocker_id, blocked_id')
    .in('blocker_id', [sneha.id, isha.id]).in('blocked_id', [sneha.id, isha.id])
  const has = (a, b) => blocks.some((x) => x.blocker_id === a.id && x.blocked_id === b.id)

  if (reports !== 1 || !c.retained || !c.is_frozen || !has(sneha, isha) || !has(blocker, blocked)) {
    effectFailures++
    if (samples.length < 3) samples.push({ iteration: i, reports, ...c, blocks })
  }
}

await reset(conv)

console.log({ iterations: ITERATIONS, deadlocks, otherErrors, effectFailures })

const pass = deadlocks === 0 && otherErrors === 0 && effectFailures === 0
console.log(pass ? 'PASS: no deadlocks, block and report both landed' : 'FAIL')
if (samples.length) console.log(samples)
process.exit(pass ? 0 : 1)
