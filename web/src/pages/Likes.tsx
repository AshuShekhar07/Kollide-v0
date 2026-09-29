import { ArrowLeft, CalendarDays, ChevronRight, Flag, Heart, PartyPopper, UsersRound, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AboutView from '../components/AboutView'
import { useShell } from '../components/AppShell'
import MatchDialog from '../components/MatchDialog'
import ProfileCard, { useSignedPhotos } from '../components/ProfileCard'
import { ReportDialog } from '../components/SafetyDialogs'
import ProfileStack from '../components/ProfileStack'
import { Button, LinkButton, EmptyState, ErrorText, Eyebrow, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { markNotificationsRead, type IncomingLike, type MatchResult } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { timeAgoLong } from '../lib/format'
import { eventDate, spotsLeft, type GroupInvite } from '../lib/groups'
import { supabase } from '../lib/supabase'
import { useIsDesktop } from '../lib/useIsDesktop'

// One like as a wide row: their photo, name and age, and when they liked you.
function LikeRow({ like, onOpen }: { like: IncomingLike; onOpen: () => void }) {
  const [url] = useSignedPhotos(like.photo_paths.slice(0, 1), 'thumb')
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See ${like.first_name}'s profile`}
      className="group flex w-full items-center gap-4 rounded-[28px] border border-neutral-200/80 bg-surface p-2.5 pr-4 text-left shadow-sm shadow-maroon-950/5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-maroon-950/10 active:scale-[0.99]"
    >
      <span className="relative shrink-0">
        <span className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-[1.4rem] bg-brand-100 font-display text-2xl font-bold text-white/90">
          {like.first_name.slice(0, 1)}
          {url && (
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          )}
        </span>
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-rani text-white ring-[3px] ring-surface">
          <Heart className="h-3.5 w-3.5 fill-current" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-xl font-extrabold leading-tight tracking-[-0.02em] text-neutral-900">
          {like.first_name}
          <span className="font-bold text-neutral-500">, {like.age}</span>
        </span>
        <span className="mt-1 block truncate text-sm text-neutral-500">Liked you · {timeAgoLong(like.liked_at)}</span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition group-hover:bg-rani group-hover:text-white">
        <ChevronRight className="h-5 w-5" />
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
  const desktop = useIsDesktop()
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
      <div className="mx-auto max-w-md px-4 pb-40 pt-[max(env(safe-area-inset-top),0.75rem)] lg:grid lg:max-w-5xl lg:grid-cols-[26rem_1fr] lg:gap-x-12 lg:px-10 lg:pt-10">
        <div className="mb-3 flex items-center justify-between lg:col-span-2 lg:mb-6">
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
        {desktop ? (
          <>
            <button type="button" className="sticky top-10 block w-full self-start" aria-label="Next photo" onClick={() => setPhoto((p) => p + 1)}>
              <ProfileCard profile={like} photoIndex={photo} className="aspect-[3/4] w-full" hideBio size="full" />
            </button>
            <div>
              <Eyebrow>Liked you · {timeAgoLong(like.liked_at)}</Eyebrow>
              <h2 className="mb-6 mt-2 text-5xl font-extrabold leading-none tracking-[-0.04em] text-neutral-900">
                {like.first_name}, {like.age}
              </h2>
              <AboutView userId={like.user_id} bio={like.bio} />
            </div>
          </>
        ) : (
          <ProfileStack profile={like} userId={like.user_id} />
        )}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-neutral-200/70 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-4 pt-3 lg:max-w-5xl lg:px-10">
          <ErrorText>{error}</ErrorText>
          <div className="mt-2 flex gap-3 lg:ml-auto lg:max-w-md">
            <Button variant="secondary" onClick={() => respond(false)} loading={busy === 'decline'} disabled={!!busy}>
              <X className="h-4 w-4" /> Decline
            </Button>
            <Button variant="rani" className="flex-1" onClick={() => respond(true)} loading={busy === 'accept'} disabled={!!busy}>
              <Heart className="h-4 w-4 fill-current" /> Accept and match
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-neutral-500 lg:text-right">Declining is private. {like.first_name} won't be told.</p>
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
    <li className="bandhani-soft relative animate-rise overflow-hidden rounded-[28px] bg-maroon-700 p-5 text-cream shadow-lg shadow-maroon-950/15">
      <div className="relative">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-marigold-300">
          <PartyPopper className="h-3.5 w-3.5" />
          {invite.admin_name ? `${invite.admin_name} invited you` : "You're invited"}
        </p>
        <Link to={`/groups/${invite.group_id}`} className="mt-2 block font-display text-2xl font-extrabold tracking-[-0.03em] underline-offset-2 hover:underline">
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
        eyebrow="Likes"
        title="Likes you"
        subtitle="Accept to match, chat and share socials."
        action={
          likes &&
          likes.length > 0 && (
            <span className="rounded-full bg-rani px-3 py-1 text-sm font-bold text-white shadow-md shadow-rani/25">
              {likes.length} new
            </span>
          )
        }
      />

      <ErrorText>{error}</ErrorText>
      {!likes && !error && (
        <div className="grid gap-3 lg:grid-cols-2" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[5.75rem] !rounded-[28px]" />
          ))}
        </div>
      )}
      {invites.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xl font-extrabold text-neutral-900">Group invites</h2>
          <ul className="grid gap-3 lg:grid-cols-2 lg:gap-5">
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
          {invites.length > 0 && <h2 className="mb-3 text-xl font-extrabold text-neutral-900">People</h2>}
          <ul className="grid gap-3 lg:grid-cols-2">
            {likes.map((like, i) => (
              <li key={like.swipe_id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <LikeRow like={like} onOpen={() => setOpen(like)} />
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
