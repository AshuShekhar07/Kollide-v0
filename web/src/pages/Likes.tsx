import { ArrowLeft, CalendarDays, Flag, Heart, PartyPopper, UsersRound, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AboutView from '../components/AboutView'
import { useShell } from '../components/AppShell'
import MatchDialog from '../components/MatchDialog'
import ProfileCard, { useSignedPhotos } from '../components/ProfileCard'
import { ReportDialog } from '../components/SafetyDialogs'
import { Button, LinkButton, EmptyState, ErrorText, PageHeader, Skeleton, Tag } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { markNotificationsRead, type IncomingLike, type MatchResult } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { timeAgoLong } from '../lib/format'
import { eventDate, spotsLeft, type GroupInvite } from '../lib/groups'
import { supabase } from '../lib/supabase'

function LikeTile({ like, onOpen }: { like: IncomingLike; onOpen: () => void }) {
  const [url] = useSignedPhotos(like.photo_paths.slice(0, 1))
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-brand-200 to-marigold-100 text-left shadow-md shadow-plum-900/10 transition active:scale-[0.97]"
    >
      {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
      <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand-600 shadow">
        <Heart className="h-4 w-4 fill-current" />
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-white">
        <span className="block font-display text-lg font-bold leading-tight">
          {like.first_name}, {like.age}
        </span>
        <span className="text-[11px] text-white/70">Liked you · {timeAgoLong(like.liked_at)}</span>
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
    <motion.div
      className="fixed inset-0 z-40 overflow-y-auto bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={`${like.first_name}'s profile`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
    >
      <div className="mx-auto max-w-md px-4 pb-40 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to likes"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-surface text-neutral-800 shadow-sm active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            <Flag className="h-4 w-4" /> Report
          </button>
        </div>
        <button type="button" className="block w-full" aria-label="Next photo" onClick={() => setPhoto((p) => p + 1)}>
          <ProfileCard profile={like} photoIndex={photo} className="aspect-[3/4] w-full" hideBio />
        </button>
        <div className="mt-5">
          <AboutView userId={like.user_id} bio={like.bio} />
        </div>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-neutral-200/70 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-4 pt-3">
          <ErrorText>{error}</ErrorText>
          <div className="mt-2 flex gap-3">
            <Button variant="secondary" onClick={() => respond(false)} loading={busy === 'decline'} disabled={!!busy}>
              <X className="h-4 w-4" /> Decline
            </Button>
            <Button className="flex-1" onClick={() => respond(true)} loading={busy === 'accept'} disabled={!!busy}>
              <Heart className="h-4 w-4 fill-current" /> Accept and match
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-neutral-500">Declining is private. {like.first_name} won't be told.</p>
        </div>
      </div>
      {reporting && (
        <ReportDialog
          target={{ userId: like.user_id, name: like.first_name }}
          conversationId={null}
          onClose={() => setReporting(false)}
          onReported={() => onDone(false)}
        />
      )}
    </motion.div>
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
    <li className="relative animate-rise overflow-hidden rounded-3xl bg-gradient-to-br from-plum-600 to-plum-800 p-4 text-white shadow-lg shadow-plum-900/20">
      <div className="bandhani pointer-events-none absolute inset-0 text-white/[0.07]" aria-hidden />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-marigold-300">
          <PartyPopper className="h-3.5 w-3.5" />
          {invite.admin_name ? `${invite.admin_name} invited you` : "You're invited"}
        </p>
        <Link to={`/groups/${invite.group_id}`} className="mt-1.5 block font-display text-xl font-bold underline-offset-2 hover:underline">
          {invite.title}
        </Link>
        {when && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
            <CalendarDays className="h-4 w-4" /> {when}
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/80">
          <UsersRound className="h-4 w-4" /> {invite.member_count}/{invite.max_members} people · {spotsLeft(invite)}
        </p>
        {error && (
          <div className="mt-2">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            variant="ghost"
            className="px-4 py-2 text-sm !text-white hover:!bg-white/10"
            onClick={() => respond(false)}
            loading={busy === 'decline'}
            disabled={!!busy}
          >
            Decline
          </Button>
          <Button
            variant="marigold"
            className="flex-1 px-4 py-2 text-sm"
            onClick={() => respond(true)}
            loading={busy === 'accept'}
            disabled={!!busy}
          >
            Join group
          </Button>
        </div>
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
  const [matchName, setMatchName] = useState<{ name: string; photo: string | null } | null>(null)

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
    if (matched) setMatchName({ name: like.first_name, photo: like.photo_paths[0] ?? null })
    refreshBadges()
  }

  return (
    <>
      <PageHeader
        title="Likes you"
        subtitle="Accept to match, chat and share socials."
        action={likes && likes.length > 0 && <Tag tone="brand">{likes.length}</Tag>}
      />

      <ErrorText>{error}</ErrorText>
      {!likes && !error && (
        <div className="grid grid-cols-2 gap-3" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] !rounded-3xl" />
          ))}
        </div>
      )}
      {invites.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2.5 text-sm font-bold text-neutral-800">Group invites</h2>
          <ul className="space-y-3">
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
        </section>
      )}
      {likes?.length === 0 && invites.length === 0 && (
        <EmptyState
          icon={Heart}
          title="No likes yet"
          action={
            verified && (
              <LinkButton to="/discover">
                Keep discovering
              </LinkButton>
            )
          }
        >
          {verified
            ? 'When someone likes you, they show up here. Liking people helps them find you too.'
            : 'Once you’re verified, your profile is shown to others and their likes show up here.'}
        </EmptyState>
      )}
      {likes && likes.length > 0 && (
        <section>
          {invites.length > 0 && <h2 className="mb-2.5 text-sm font-bold text-neutral-800">People</h2>}
          <ul className="grid grid-cols-2 gap-3">
            {likes.map((like, i) => (
              <li key={like.swipe_id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <LikeTile like={like} onOpen={() => setOpen(like)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && <LikeDetail like={open} onClose={() => setOpen(null)} onDone={onDone} />}
      {matchName && <MatchDialog name={matchName.name} photoPath={matchName.photo} onClose={() => setMatchName(null)} />}
    </>
  )
}
