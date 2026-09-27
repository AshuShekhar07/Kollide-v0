import { BadgeCheck, Hourglass, Link2Off, PartyPopper, ShieldCheck, UserPlus, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Capacity, DateChip } from '../components/GroupBits'
import { Button, EmptyState, ErrorText, FullScreenSpinner, LinkButton, Logo, Tag } from '../components/ui'
import { homePathFor, useAuth } from '../lib/auth-context'
import { friendlyError } from '../lib/errors'
import { eventDate, spotsLeft } from '../lib/groups'
import { clearPendingInvite, savePendingInvite, type InvitePreview } from '../lib/invite'
import { supabase } from '../lib/supabase'

function Steps({ current }: { current: 0 | 1 | 2 }) {
  const steps = ['Create your account', 'Verify with a 10-second face video', 'Ask to join the group']
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-3 text-sm">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              i < current
                ? 'bg-green-100 text-green-800'
                : i === current
                  ? 'bg-ink text-on-ink'
                  : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {i < current ? <BadgeCheck className="h-4 w-4" /> : i + 1}
          </span>
          <span className={i === current ? 'font-semibold text-neutral-900' : 'text-neutral-600'}>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function Notice({ tone, icon, title, children }: { tone: 'amber' | 'green' | 'neutral'; icon: ReactNode; title: string; children?: ReactNode }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    green: 'border-green-100 bg-green-50 text-green-800',
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  }
  return (
    <div className={`rounded-3xl border p-4 text-sm ${tones[tone]}`}>
      <p className="flex items-center gap-2 font-semibold">
        {icon} {title}
      </p>
      {children && <p className="mt-1">{children}</p>}
    </div>
  )
}

// /join/:token — where a group's invite link lands. Works signed out too:
// the token is kept on the device through sign-up and verification, and the
// app brings the person back here once they can ask to join.
export default function JoinGroup() {
  const { token = '' } = useParams()
  const { loading, session, profile } = useAuth()
  const [invite, setInvite] = useState<InvitePreview | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const uid = session?.user.id
  const verified = profile?.verification_status === 'approved'

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_group_invite', { p_token: token })
    if (error) return setError(friendlyError(error))
    const preview = data as unknown as InvitePreview | null
    setInvite(preview)
    const done = !preview || ['approved', 'requested', 'rejected', 'removed'].includes(preview.my_status ?? '')
    if (done) clearPendingInvite()
    else savePendingInvite(token)
  }, [token])

  // Re-check when the viewer signs in or gets verified.
  useEffect(() => {
    if (!loading) load()
  }, [load, loading, uid, verified])

  async function askToJoin() {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('request_join_by_link', { p_token: token })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    await load()
  }

  if (loading || (session && !profile) || invite === undefined) {
    return error ? (
      <main className="mx-auto max-w-md px-4 py-10">
        <ErrorText>{error}</ErrorText>
      </main>
    ) : (
      <FullScreenSpinner />
    )
  }

  if (invite === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4">
        <EmptyState
          icon={Link2Off}
          title="This invite link doesn't work any more"
          action={<LinkButton to={session ? '/start' : '/'}>Go to Kollide</LinkButton>}
        >
          The group may have closed, or the admin made a new link. Ask the person who sent it for a fresh one.
        </EmptyState>
      </main>
    )
  }

  const who = invite.admin_name ?? 'A friend'
  const full = invite.status === 'full' || invite.member_count >= invite.max_members
  const onboarding = session && homePathFor(profile) === '/onboarding'

  let action: ReactNode
  if (!session) {
    action = (
      <>
        <Steps current={0} />
        <LinkButton to="/login" className="mt-5 w-full">
          <UserPlus className="h-5 w-5" /> Sign up to join
        </LinkButton>
        <p className="mt-2.5 text-center text-xs text-neutral-500">Already on Kollide? The same button signs you in.</p>
      </>
    )
  } else if (onboarding) {
    const rejected = profile?.verification_status === 'rejected'
    action = (
      <>
        <Steps current={profile?.onboarding_complete ? 1 : 0} />
        <LinkButton to="/onboarding" className="mt-5 w-full">
          {rejected ? 'Redo your verification' : 'Finish signing up'}
        </LinkButton>
        <p className="mt-2.5 text-center text-xs text-neutral-500">We've saved this invite for you.</p>
      </>
    )
  } else if (!verified) {
    action = (
      <>
        <Steps current={1} />
        <div className="mt-5">
          <Notice tone="amber" icon={<Hourglass className="h-4 w-4" />} title="Waiting on your verification">
            Our team usually checks videos within 24 hours. Once you're verified, open Kollide and you can ask to join.
          </Notice>
        </div>
        <LinkButton to="/discover" variant="secondary" className="mt-3 w-full">
          Explore Kollide
        </LinkButton>
      </>
    )
  } else if (invite.my_status === 'approved') {
    action = (
      <>
        <Notice tone="green" icon={<PartyPopper className="h-4 w-4" />} title="You're in this group" />
        {invite.group_id && (
          <LinkButton to={`/groups/${invite.group_id}`} className="mt-3 w-full">
            Open group
          </LinkButton>
        )}
      </>
    )
  } else if (invite.my_status === 'requested') {
    action = (
      <>
        <Notice tone="amber" icon={<Hourglass className="h-4 w-4" />} title="Request sent">
          {who} will get back to you. You'll find the group chat in Chats once you're in.
        </Notice>
        {invite.group_id && (
          <LinkButton to={`/groups/${invite.group_id}`} variant="secondary" className="mt-3 w-full">
            View group
          </LinkButton>
        )}
      </>
    )
  } else if (invite.my_status === 'rejected' || invite.my_status === 'removed') {
    action = <Notice tone="neutral" icon={<Link2Off className="h-4 w-4" />} title="This group isn't open to you" />
  } else if (invite.my_status === 'invited') {
    action = (
      <Button className="w-full" loading={busy} onClick={askToJoin}>
        <PartyPopper className="h-5 w-5" /> Join group
      </Button>
    )
  } else if (full) {
    action = <Notice tone="neutral" icon={<UsersRound className="h-4 w-4" />} title="This group is full" />
  } else {
    action = (
      <>
        <Steps current={2} />
        <Button className="mt-5 w-full" loading={busy} onClick={askToJoin}>
          <UserPlus className="h-5 w-5" /> Ask to join
        </Button>
      </>
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <div className="relative overflow-hidden bg-plum-900 px-4 pb-20 pt-[max(env(safe-area-inset-top),1.5rem)] text-white">
        <div className="relative">
          <Link to={session ? '/start' : '/'} aria-label="Kollide home">
            <Logo tone="white" className="text-2xl" />
          </Link>
          <p className="mt-8 flex items-center gap-2 text-sm font-semibold text-marigold-300">
            <PartyPopper className="h-4 w-4" /> {who} invited you
          </p>
          <div className="mt-3 flex items-start gap-3">
            <DateChip date={invite.event_date} tone="glass" />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold leading-tight">{invite.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {invite.activity_name && <Tag tone="glass">{invite.activity_name}</Tag>}
                {eventDate(invite.event_date) && <span className="text-sm text-white/80">{eventDate(invite.event_date)}</span>}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <Capacity count={invite.member_count} max={invite.max_members} tone="glass" />
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-white/80">
              <UsersRound className="h-3.5 w-3.5" />
              {invite.member_count}/{invite.max_members} people · {spotsLeft(invite)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative -mt-12 px-4 pb-12">
        <div className="animate-rise rounded-3xl border border-neutral-200/80 bg-surface p-5 ">
          {action}
          {error && (
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </div>
        <p className="mt-5 flex items-start justify-center gap-2 px-4 text-center text-xs text-neutral-500">
          <ShieldCheck className="h-4 w-4 shrink-0 text-green-700" />
          Everyone in a Kollide group is verified. Venue and chat open once the admin lets you in.
        </p>
      </div>
    </main>
  )
}
