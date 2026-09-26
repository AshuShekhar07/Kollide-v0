import { supabase } from './supabase'

const SIGNED_URL_TTL = 60 * 60

// Signed URLs for photo storage paths, in the same order (null if unavailable).
export async function signedPhotoUrls(paths: string[]): Promise<(string | null)[]> {
  if (!paths.length) return []
  const { data } = await supabase.storage.from('photos').createSignedUrls(paths, SIGNED_URL_TTL)
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return paths.map((p) => byPath.get(p) ?? null)
}
