import { ArrowRight, PartyPopper, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { clearPendingInvite, pendingInvite, type InvitePreview } from '../lib/invite'
import { supabase } from '../lib/supabase'

// Reminder of a group invite link opened before the person could use it
// (while signing up or waiting on verification).
export default function PendingInviteBanner() {
  const { profile } = useAuth()
  const [token, setToken] = useState(pendingInvite)
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const verified = profile?.verification_status === 'approved'

  useEffect(() => {
    if (!token) return
    let cancelled = false
    supabase.rpc('get_group_invite', { p_token: token }).then(({ data, error }) => {
      if (cancelled || error) return
      const preview = data as unknown as InvitePreview | null
      if (!preview || preview.my_status) {
        // Dead link, or already acted on.
        clearPendingInvite()
        setToken(null)
      } else setInvite(preview)
    })
    return () => {
      cancelled = true
    }
  }, [token, verified])

  if (!token || !invite) return null

  const dismiss = () => {
    clearPendingInvite()
    setToken(null)
  }
  const hint = !profile?.onboarding_complete
    ? 'Finish signing up and get verified to ask to join.'
    : verified
      ? "You're verified. Ask to join now!"
      : "You can ask to join once you're verified."

  return (
    <div className="relative mb-3 flex animate-rise items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-plum-600 to-plum-800 p-3 pr-2 text-white shadow-md shadow-plum-900/20">
      <div className="bandhani pointer-events-none absolute inset-0 text-white/[0.07]" aria-hidden />
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marigold-400 text-plum-900">
        <PartyPopper className="h-5 w-5" />
      </span>
      <Link to={`/join/${token}`} className="relative min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold leading-snug">
          {invite.admin_name ?? 'A friend'} invited you to {invite.title}
        </span>
        <span className="flex items-center gap-1 text-xs text-white/80">
          {hint} {verified && <ArrowRight className="h-3.5 w-3.5" />}
        </span>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss invite"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
