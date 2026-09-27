// Permanently deletes verification videos past their delete_after
// (PLAN.md §2.2 retention, §5.6).
//
// Called hourly by the cleanup-videos pg_cron job via pg_net, with the same
// `x-kollide-secret` header send-email uses. Files are removed through the
// Storage API: deleting storage.objects rows would leave the file behind.
import { serviceClient } from '../_shared/admin.ts'
import { json, requireEnv, safeEqual } from '../_shared/http.ts'

const BATCH = 100

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!safeEqual(req.headers.get('x-kollide-secret') ?? '', requireEnv('EMAIL_HOOK_SECRET'))) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const db = serviceClient()
  const { data: rows, error } = await db
    .from('verification_videos')
    .select('id, storage_path')
    .is('deleted_at', null)
    .lt('delete_after', new Date().toISOString())
    .order('delete_after')
    .limit(BATCH)
  if (error) return json({ error: error.message }, 500)
  if (!rows?.length) return json({ deleted: 0 }, 200)

  // A path that's already gone isn't an error: remove() just skips it.
  const { error: removeError } = await db.storage.from('verification-videos').remove(rows.map((r) => r.storage_path))
  if (removeError) return json({ error: removeError.message }, 500)

  const { error: markError } = await db
    .from('verification_videos')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', rows.map((r) => r.id))
  if (markError) return json({ error: markError.message }, 500)

  return json({ deleted: rows.length, more: rows.length === BATCH }, 200)
})
