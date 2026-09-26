import { useCallback, useEffect, useState } from 'react'
import { useShell } from '../components/AppShell'
import MatchDialog from '../components/MatchDialog'
import ProfileCard, { useSignedPhotos } from '../components/ProfileCard'
import { Button, ErrorText, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { markNotificationsRead, type IncomingLike, type MatchResult } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
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
      </div>
    </div>
  )
}

export default function Likes() {
  const { profile } = useAuth()
  const { refreshBadges } = useShell()
  const verified = profile?.verification_status === 'approved'
  const [likes, setLikes] = useState<IncomingLike[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<IncomingLike | null>(null)
  const [matchName, setMatchName] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_incoming_likes')
    if (error) return setError(friendlyError(error))
    setLikes(data)
  }, [])

  useEffect(() => {
    load()
    markNotificationsRead('like_received')
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
      {likes?.length === 0 && (
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
