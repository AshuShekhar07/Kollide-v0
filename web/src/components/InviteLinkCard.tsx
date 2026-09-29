import { Check, Copy, Link2, RefreshCw, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { friendlyError } from '../lib/errors'
import { inviteUrl } from '../lib/invite'
import { supabase } from '../lib/supabase'
import { Sheet } from './SafetyDialogs'
import { Button, ErrorText, Skeleton } from './ui'

// The group admin's shareable invite link, with copy, share and reset.
export default function InviteLinkCard({ groupId, title }: { groupId: string; title: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    supabase.rpc('get_group_invite_link', { p_group_id: groupId }).then(({ data, error }) => {
      if (error) setError(friendlyError(error))
      else setToken(data)
    })
  }, [groupId])

  const url = token ? inviteUrl(token) : ''
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it.")
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Join ${title} on Kollide`, text: `Join my group “${title}” on Kollide`, url })
    } catch {
      // Closing the share sheet rejects; nothing to do.
    }
  }

  async function reset() {
    setResetting(true)
    setError('')
    const { data, error } = await supabase.rpc('reset_group_invite_link', { p_group_id: groupId })
    setResetting(false)
    setConfirmReset(false)
    if (error) return setError(friendlyError(error))
    setToken(data)
  }

  return (
    <div className="rounded-3xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon-700 text-white">
          <Link2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-neutral-900">Invite friends with a link</p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
            Friends new to Kollide sign up and get verified first. Either way, they ask to join and you approve.
          </p>
        </div>
      </div>

      {token ? (
        <p
          className="mt-3 select-all truncate rounded-2xl border border-neutral-200 bg-surface px-3 py-2.5 font-mono text-xs text-neutral-700"
          aria-label="Invite link"
        >
          {url}
        </p>
      ) : (
        !error && <Skeleton className="mt-3 h-10" />
      )}

      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {token && (
        <>
          <div className="mt-3 flex gap-2">
            {canShare && (
              <Button className="flex-1 px-4 py-2.5 text-sm" onClick={share}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            )}
            <Button variant={canShare ? 'secondary' : 'primary'} className="flex-1 px-4 py-2.5 text-sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-white/60"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Make a new link
          </button>
        </>
      )}

      {confirmReset && (
        <Sheet label="Make a new link" onClose={() => setConfirmReset(false)}>
          <h2 className="text-lg font-bold text-neutral-900">Make a new invite link?</h2>
          <p className="mt-2 text-sm text-neutral-600">
            The current link will stop working. Anyone who already asked to join stays in your requests.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button className="flex-1" loading={resetting} onClick={reset}>
              Make new link
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
