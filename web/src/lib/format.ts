// "now", "5m", "3h", "Tue", "12 Oct": short times for list rows.
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso)
  const mins = Math.round((Date.now() - then.getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  if (hours < 24 * 6) return then.toLocaleDateString('en-IN', { weekday: 'short' })
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// "just now", "5m ago", "3h ago", "Tue", "12 Oct".
export function timeAgoLong(iso: string | null | undefined): string {
  const short = timeAgo(iso)
  if (short === 'now') return 'just now'
  return /^\d+[mh]$/.test(short) ? `${short} ago` : short
}
