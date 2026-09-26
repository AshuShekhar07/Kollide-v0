import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useShell } from '../components/AppShell'
import MatchDialog from '../components/MatchDialog'
import ProfileCard, { useSignedPhotos } from '../components/ProfileCard'
import { ReportDialog } from '../components/SafetyDialogs'
import { Button, ErrorText, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { markNotificationsRead, type IncomingLike, type MatchResult } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { eventDate, spotsLeft, type GroupInvite } from '../lib/groups'
import { supabase } from '../lib/supabase'

function LikeTile({ like, onOpen }: { like: IncomingLike; onOpen: () => void }) {
  const [url] = useSignedPhotos(like.photo_paths.slice(0, 1))
  return (
    <button type="button" onClick={onOpen} className="relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-neutral-200 text-left">
      {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-sm font-semibold text-white">
        {like.first_name}, {like.age}
      </span>
    </button>
  )
}

function LikeDetail({
  like,
  onClose,
  onDone,
}: {
  like: IncomingLike
  onClose: () => void
  onDone: (matched: boolean) => void
}) {
  const [photo, setPhoto] = useState(0)
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState(false)

  async function respond(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline')
    setError('')
    const { data, error } = await supabase.rpc('respond_to_like', { p_swipe_id: like.swipe_id, p_accept: accept })
    setBusy(null)
    if (error) return setError(friendlyError(error))
    onDone((data as unknown as MatchResult).matched)
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-white" role="dialog" aria-modal="true" aria-label={`${like.first_name}'s profile`}>
      <div className="mx-auto max-w-md px-4 pb-8 pt-4">
        <button type="button" onClick={onClose} className="mb-3 text-sm font-semibold text-brand-700">
          ← Back to likes
        </button>
        <button
          type="button"
          className="block w-full"
          aria-label="Next photo"
          onClick={() => setPhoto((p) => p + 1)}
        >
          <ProfileCard profile={like} photoIndex={photo} className="aspect-[3/4] w-full" />
        </button>
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="mt-3 flex gap-3">
          <Button variant="secondary" onClick={() => respond(false)} loading={busy === 'decline'} disabled={!!busy}>
            Decline
          </Button>
          <Button className="flex-1" onClick={() => respond(true)} loading={busy === 'accept'} disabled={!!busy}>
            Accept
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-neutral-500">
          Declining is private. {like.first_name} won't be told.
        </p>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="mx-auto mt-6 block text-sm font-medium text-red-700 underline"
        >
          Report {like.first_name}
        </button>
      </div>
      {reporting && (
        <ReportDialog
          target={{ userId: like.user_id, name: like.first_name }}
          conversationId={null}
          onClose={() => setReporting(false)}
          onReported={() => onDone(false)}
        />
      )}
    </div>
  )
}

function InviteCard({ invite, onDone }: { invite: GroupInvite; onDone: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState('')
  const when = [eventDate(invite.event_date), invite.venue].filter(Boolean).join(' · ')

  async function respond(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline')
    setError('')
    const { error } = await supabase.rpc('respond_invite', { p_group_id: invite.group_id, p_accept: accept })
    setBusy(null)
    if (error) return setError(friendlyError(error))
    if (accept) navigate(`/groups/${invite.group_id}`)
    else onDone()
  }

  return (
    <li className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <p className="text-xs font-semibold uppercase text-brand-700">
        {invite.admin_name ? `${invite.admin_name} invited you` : "You're invited"}
      </p>
      <Link to={`/groups/${invite.group_id}`} className="mt-1 block font-semibold text-neutral-900 underline-offset-2 hover:underline">
        {invite.title}
      </Link>
      {when && <p className="text-sm text-neutral-600">{when}</p>}
      <p className="text-xs text-neutral-500">
        {invite.member_count}/{invite.max_members} people · {spotsLeft(invite)}
      </p>
      {error && (
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      <div className="mt-3 flex gap-3">
        <Button variant="secondary" className="px-4 py-2 text-sm" onClick={() => respond(false)} loading={busy === 'decline'} disabled={!!busy}>
          Decline
        </Button>
        <Button className="flex-1 px-4 py-2 text-sm" onClick={() => respond(true)} loading={busy === 'accept'} disabled={!!busy}>
          Join group
        </Button>
      </div>
    </li>
  )
}

export default function Likes() {
  const { profile } = useAuth()
  const { refreshBadges } = useShell()
  const verified = profile?.verification_status === 'approved'
  const [likes, setLikes] = useState<IncomingLike[] | null>(null)
  const [invites, setInvites] = useState<GroupInvite[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState<IncomingLike | null>(null)
  const [matchName, setMatchName] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [likes, invites] = await Promise.all([supabase.rpc('get_incoming_likes'), supabase.rpc('get_group_invites')])
    if (likes.error || invites.error) return setError(friendlyError(likes.error ?? invites.error))
    setLikes(likes.data)
    setInvites(invites.data)
  }, [])

  useEffect(() => {
    load()
    markNotificationsRead('like_received')
    markNotificationsRead('group_invite')
  }, [load])

  function onDone(matched: boolean) {
    const like = open!
    setOpen(null)
    setLikes((l) => l?.filter((x) => x.swipe_id !== like.swipe_id) ?? null)
    if (matched) setMatchName(like.first_name)
    refreshBadges()
  }

  return (
    <>
      <h1 className="text-lg font-bold text-neutral-900">Likes you</h1>
      <p className="mt-1 text-sm text-neutral-600">People who liked you. Accept to match and share socials.</p>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>
      {!likes && !error && <Spinner />}
      {invites.length > 0 && (
        <>
          <h2 className="mt-2 text-sm font-semibold text-neutral-800">Group invites</h2>
          <ul className="mt-2 space-y-3">
            {invites.map((inv) => (
              <InviteCard
                key={inv.group_id}
                invite={inv}
                onDone={() => {
                  setInvites((l) => l.filter((x) => x.group_id !== inv.group_id))
                  refreshBadges()
                }}
              />
            ))}
          </ul>
          {likes && likes.length > 0 && <h2 className="mt-5 text-sm font-semibold text-neutral-800">People</h2>}
        </>
      )}
      {likes?.length === 0 && invites.length === 0 && (
        <div className="mt-12 text-center text-neutral-500">
          <p className="font-semibold text-neutral-700">No likes yet</p>
          <p className="mt-1 text-sm">
            {verified
              ? 'Keep browsing on Discover. When someone likes you, they show up here.'
              : 'Once you’re verified, your profile is shown to others and their likes show up here.'}
          </p>
        </div>
      )}
      {likes && likes.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {likes.map((like) => (
            <li key={like.swipe_id}>
              <LikeTile like={like} onOpen={() => setOpen(like)} />
            </li>
          ))}
        </ul>
      )}

      {open && <LikeDetail like={open} onClose={() => setOpen(null)} onDone={onDone} />}
      {matchName && <MatchDialog name={matchName} onClose={() => setMatchName(null)} />}
    </>
  )
}
