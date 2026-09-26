// Maps any Supabase/RPC/network error to a message safe to show users.
// RPCs raise 22023 (validation) and KL0xx (app-specific) with user-facing
// messages; everything else gets a generic message.

type MaybeError = { code?: string; message?: string; name?: string } | null | undefined

const SHOW_SERVER_MESSAGE = /^(22023|KL\d{3})$/

export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = error as MaybeError
  if (!e) return fallback
  if (e.code && SHOW_SERVER_MESSAGE.test(e.code) && e.message) return e.message
  if (e.code === '42501') return e.message === 'Admins only' ? e.message : "You don't have permission to do that."
  if (e.name === 'FunctionsFetchError' || /Failed to fetch|NetworkError/i.test(e.message ?? '')) {
    return 'Check your internet connection and try again.'
  }
  if (e.name === 'AuthApiError' && e.message) {
    if (/expired|invalid/i.test(e.message)) return 'That code is invalid or has expired. Request a new one.'
    if (/rate limit/i.test(e.message)) return 'Too many attempts. Please wait a minute and try again.'
  }
  return fallback
}

// Edge functions return {error} bodies; supabase-js wraps non-2xx responses.
export async function functionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (typeof body?.error === 'string') return body.error
    } catch {
      /* fall through */
    }
  }
  return friendlyError(error)
}
