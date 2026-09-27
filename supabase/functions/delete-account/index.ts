// Deletes the caller's account (PLAN.md §6.1 settings, §8 legal).
//
// Removes their photo files and any unreviewed verification video, then the
// auth user; the database cascades the rest (groups hand over first). Kept on
// purpose: reports and their snapshots (§2.4), bans, and reviewed videos until
// their scheduled deletion (cleanup-videos). Body must be {"confirm": "DELETE"}.
import { serviceClient } from '../_shared/admin.ts'
import { corsHeaders, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  const db = serviceClient()
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData } = await db.auth.getUser(token)
  const user = userData?.user
  if (!user) return json({ error: 'Please sign in again' }, 401, cors)

  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm' }, 400, cors)

  // Photos: everything in their folder, including files no row points at.
  const { data: files, error: listError } = await db.storage.from('photos').list(user.id, { limit: 100 })
  if (listError) return json({ error: 'Could not delete your photos. Please try again.' }, 500, cors)
  if (files?.length) {
    const { error } = await db.storage.from('photos').remove(files.map((f) => `${user.id}/${f.name}`))
    if (error) return json({ error: 'Could not delete your photos. Please try again.' }, 500, cors)
  }

  // A video nobody has reviewed yet goes now.
  const { data: videos } = await db
    .from('verification_videos')
    .select('id, storage_path')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .is('delete_after', null)
  if (videos?.length) {
    const { error } = await db.storage.from('verification-videos').remove(videos.map((v) => v.storage_path))
    if (error) return json({ error: 'Could not delete your video. Please try again.' }, 500, cors)
    await db.from('verification_videos').update({ deleted_at: new Date().toISOString() }).in('id', videos.map((v) => v.id))
  }

  const { error: deleteError } = await db.auth.admin.deleteUser(user.id)
  if (deleteError) return json({ error: 'Could not delete your account. Please try again.' }, 500, cors)

  await db.from('events_log').insert({ name: 'account_deleted' })
  return json({ deleted: true }, 200, cors)
})
