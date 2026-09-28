import { supabase } from './supabase'

const SIGNED_URL_TTL = 60 * 60
// A cached URL is reused until this long before it expires.
const REFRESH_MARGIN_MS = 5 * 60 * 1000
const MAX_CACHED = 500

export type PhotoSize = 'thumb' | 'full'

type Entry = { url: string; expiresAt: number }

// One signed URL per path: the same path returns the same URL (so the browser
// cache can reuse the download) until it is close to expiring, and requests
// for a path already being signed share that request.
const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<string | null>>()
// Thumbnails the server said don't exist (photos uploaded before thumbnails).
const missing = new Set<string>()

function fresh(entry: Entry | undefined): entry is Entry {
  return !!entry && entry.expiresAt - REFRESH_MARGIN_MS > Date.now()
}

function remember(path: string, url: string) {
  if (cache.size >= MAX_CACHED) {
    for (const [p, e] of cache) if (!fresh(e)) cache.delete(p)
  }
  cache.set(path, { url, expiresAt: Date.now() + SIGNED_URL_TTL * 1000 })
}

// `<uid>/<id>.jpg` -> `<uid>/<id>_t.jpg`
export function thumbPath(path: string): string {
  return path.replace(/\.jpg$/, '_t.jpg')
}

// Signs the paths that aren't cached or already being signed in one batch.
async function signAll(paths: string[]): Promise<(string | null)[]> {
  const results = new Map<string, string | Promise<string | null>>()
  const need: string[] = []
  for (const path of paths) {
    if (results.has(path)) continue
    const hit = cache.get(path)
    const pending = inflight.get(path)
    if (fresh(hit)) results.set(path, hit.url)
    else if (pending) results.set(path, pending)
    else need.push(path)
  }

  if (need.length) {
    const batch = supabase.storage
      .from('photos')
      .createSignedUrls(need, SIGNED_URL_TTL)
      .then(({ data }) => {
        const urls = new Map<string, string>()
        for (const d of data ?? []) {
          if (d.signedUrl) {
            urls.set(d.path ?? '', d.signedUrl)
            remember(d.path ?? '', d.signedUrl)
          } else if (d.path && /does not exist|not found/i.test(d.error ?? '')) {
            missing.add(d.path)
          }
        }
        return urls
      })
      .catch(() => new Map<string, string>())
    for (const path of need) {
      const p = batch.then((urls) => urls.get(path) ?? null).finally(() => inflight.delete(path))
      inflight.set(path, p)
      results.set(path, p)
    }
  }

  return Promise.all(paths.map((p) => results.get(p) ?? null))
}

// Signed URLs for photo storage paths, in the same order (null if unavailable).
export function signedPhotoUrls(paths: string[]): Promise<(string | null)[]> {
  return paths.length ? signAll(paths) : Promise.resolve([])
}

// Signed URLs for the card thumbnails. Photos without a thumbnail (uploaded
// before thumbnails existed) fall back to the full image, and that is
// remembered so the thumbnail isn't asked for again.
export async function signedThumbUrls(paths: string[]): Promise<(string | null)[]> {
  if (!paths.length) return []
  const targets = paths.map((p) => (missing.has(thumbPath(p)) ? p : thumbPath(p)))
  const urls = await signAll(targets)
  const retry = paths.map((p, i) => (urls[i] === null && targets[i] !== p && missing.has(targets[i]) ? i : -1)).filter((i) => i >= 0)
  if (retry.length) {
    const full = await signAll(retry.map((i) => paths[i]))
    retry.forEach((i, k) => (urls[i] = full[k]))
  }
  return urls
}

export function signedUrlsFor(paths: string[], size: PhotoSize): Promise<(string | null)[]> {
  return size === 'thumb' ? signedThumbUrls(paths) : signedPhotoUrls(paths)
}

// Synchronous lookup, no network: what the cache already holds for a path.
export function peekPhotoUrl(path: string, size: PhotoSize): string | null {
  const target = size === 'thumb' && !missing.has(thumbPath(path)) ? thumbPath(path) : path
  const hit = cache.get(target)
  return fresh(hit) ? hit.url : null
}

export function clearPhotoCache() {
  cache.clear()
  inflight.clear()
  missing.clear()
}
