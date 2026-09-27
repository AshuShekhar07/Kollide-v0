// Returns a 5-minute signed URL for a verification video (PLAN.md §5.6).
// Caller must be in `admins`; every successful call is logged before the URL
// is issued.
import { serviceClient } from '../_shared/admin.ts'
import { corsHeaders, json, UUID_RE } from '../_shared/http.ts'

const SIGNED_URL_TTL_SECONDS = 300

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

  const db = serviceClient()

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData } = await db.auth.getUser(token)
  const user = userData?.user
  if (!user) return json({ error: 'Please sign in again' }, 401, cors)

  const { data: adminRow } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return json({ error: 'Admins only' }, 403, cors)

  const body = await req.json().catch(() => ({}))
  const videoId = typeof body?.video_id === 'string' ? body.video_id : ''
  if (!UUID_RE.test(videoId)) return json({ error: 'Invalid video id' }, 400, cors)

  const { data: video } = await db
    .from('verification_videos')
    .select('id, storage_path, deleted_at')
    .eq('id', videoId)
    .maybeSingle()
  if (!video || video.deleted_at) return json({ error: 'Video not found or already deleted' }, 404, cors)

  const { error: logError } = await db.from('admin_access_log').insert({
    admin_id: user.id,
    action: 'view_video',
    target_type: 'verification_video',
    target_id: video.id,
  })
  if (logError) return json({ error: 'Could not record access' }, 500, cors)

  const { data: signed, error: signError } = await db.storage
    .from('verification-videos')
    .createSignedUrl(video.storage_path, SIGNED_URL_TTL_SECONDS)
  // The row exists but the file doesn't (e.g. the upload never finished).
  if (signError || !signed) {
    return json({ error: 'The video file is missing. Reject with a reason so they can record it again.' }, 404, cors)
  }

  // Locally SUPABASE_URL is the internal Docker host (kong); rewrite for the
  // browser. Hosted URLs are already public and are never rewritten.
  let url = signed.signedUrl
  const publicApi = Deno.env.get('PUBLIC_API_URL')
  const parsed = new URL(url)
  if (publicApi && parsed.hostname === 'kong') url = publicApi + parsed.pathname + parsed.search

  return json({ url, expires_in: SIGNED_URL_TTL_SECONDS }, 200, cors)
})
