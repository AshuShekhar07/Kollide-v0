import { serviceClient } from '../_shared/admin.ts'
import { json, requireEnv, safeEqual } from '../_shared/http.ts'

const BATCH = 100
const MAX_BATCHES = 10
const BUCKETS = ['photos', 'verification-videos'] as const

// Deletes uploads older than 24 h that no photos / verification_videos row
// points at (interrupted uploads, failed submits, direct API uploads).
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!safeEqual(req.headers.get('x-kollide-secret') ?? '', requireEnv('EMAIL_HOOK_SECRET'))) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const db = serviceClient()
  const deleted: Record<string, number> = {}

  for (const bucket of BUCKETS) {
    deleted[bucket] = 0
    for (let i = 0; i < MAX_BATCHES; i++) {
      const { data, error } = await db.rpc('orphaned_storage_objects', { p_bucket: bucket, p_limit: BATCH })
      if (error) return json({ error: error.message }, 500)
      if (!data?.length) break
      // A path that's already gone isn't an error: remove() just skips it.
      const { error: removeError } = await db.storage.from(bucket).remove(data.map((o: { name: string }) => o.name))
      if (removeError) return json({ error: removeError.message }, 500)
      deleted[bucket] += data.length
      if (data.length < BATCH) break
    }
  }

  // Counts only: never paths or user ids.
  console.log(JSON.stringify({ sweep_orphan_uploads: deleted }))
  return json({ deleted }, 200)
})
