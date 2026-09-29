import { Ban, Crown, Flag, Hourglass, LogOut, MapPin, MessageCircle, MoreHorizontal, PartyPopper, Settings2, UserPlus, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useShell } from '../../components/AppShell'
import Avatar from '../../components/Avatar'
import Celebrate from '../../components/Celebrate'
import Toran from '../../components/landing/Toran'
import { useSignedPhotos } from '../../components/ProfileCard'
import ProfileStack from '../../components/ProfileStack'
import { BlockDialog, ReportDialog, Sheet } from '../../components/SafetyDialogs'
import { BackLink } from '../../components/BackLink'
import { Capacity, DateChip } from '../../components/GroupBits'
import InviteLinkCard from '../../components/InviteLinkCard'
import { Button, LinkButton, ErrorText, Skeleton } from '../../components/ui'
import { useAuth } from '../../lib/auth-context'
import { friendlyError } from '../../lib/errors'
import { eventDate, fetchMemberProfile, spotsLeft, type GroupDetail as Group, type GroupMember, type MemberProfile } from '../../lib/groups'
import { supabase } from '../../lib/supabase'

export function MemberAvatar({ path, name, size = 'h-11 w-11' }: { path: string | null; name: string; size?: string }) {
  return <Avatar path={path} name={name} className={size} />
}

function MemberProfileSheet({ groupId, member, onClose }: { groupId: string; member: GroupMember; onClose: () => void }) {
  const [person, setPerson] = useState<MemberProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchMemberProfile(groupId, member.user_id)
      .then((d) => !cancelled && setPerson(d))
      .catch((e) => !cancelled && setError(friendlyError(e)))
    return () => {
      cancelled = true
    }
  }, [groupId, member.user_id])

  return (
    <Sheet label={member.first_name} onClose={onClose}>
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : !person ? (
        <Skeleton className="aspect-[3/4] w-full !rounded-[2rem]" />
      ) : (
        <ProfileStack profile={person} userId={person.user_id} answers={person.answers} />
      )}
      <Button variant="secondary" className="mt-3 w-full" onClick={onClose}>
        Close
      </Button>
    </Sheet>
  )
}

// A member as a portrait tile, so you can see who you'd be going with.
function MemberTile({ member, me, onOpen }: { member: GroupMember; me: boolean; onOpen?: () => void }) {
  const [url] = useSignedPhotos(member.photo_path ? [member.photo_path] : [], 'thumb')
  const body = (
    <>
      <span className="absolute inset-0 flex items-center justify-center font-display text-4xl font-bold text-white/80">
        {member.first_name.slice(0, 1)}
      </span>
      {url && (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      )}
      {member.role === 'admin' && (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-marigold-400 px-2 py-0.5 text-[10px] font-bold text-maroon-950 shadow">
          <Crown className="h-3 w-3" /> Admin
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-8 text-left font-display text-[15px] font-extrabold leading-tight text-white">
        <span className="block truncate">{me ? 'You' : member.first_name}</span>
      </span>
    </>
  )
  const cls = 'group relative block aspect-[3/4] w-full overflow-hidden rounded-[1.4rem] bg-brand-100'
  return me ? (
    <span className={cls}>{body}</span>
  ) : (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See ${member.first_name}'s profile`}
      className={`${cls} shadow-md shadow-maroon-950/10 transition hover:-translate-y-0.5 active:scale-[0.97]`}
    >
      {body}
    </button>
  )
}

function LeaveDialog({ group, onClose, onLeft }: { group: Group; onClose: () => void; onLeft: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isAdmin = group.my_role === 'admin'
  const alone = group.member_count <= 1

  async function leave() {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('leave_group', { p_group_id: group.id })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    onLeft()
  }

  return (
    <Sheet label="Leave group" onClose={onClose}>
      <h2 className="text-lg font-bold text-neutral-900">Leave {group.title}?</h2>
      <p className="mt-2 text-sm text-neutral-600">
        You'll leave the group chat.{' '}
        {isAdmin && (alone ? "You're the only one here, so the group will close." : 'The longest-standing member becomes the admin.')}
      </p>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Stay
        </Button>
        <Button variant="danger" className="flex-1" onClick={leave} loading={busy}>
          Leave group
        </Button>
      </div>
    </Sheet>
  )
}

export default function GroupDetail() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const { refreshBadges } = useShell()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [dialog, setDialog] = useState<
    { kind: 'leave' } | { kind: 'member' | 'report' | 'block' | 'profile'; member: GroupMember } | null
  >(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_group', { p_group_id: id })
    if (error) return setError(friendlyError(error))
    setGroup(data as unknown as Group)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function act(name: string, call: PromiseLike<{ error: unknown }>) {
    setBusy(name)
    setActionError('')
    const { error } = await call
    setBusy(null)
    if (error) setActionError(friendlyError(error))
    await load()
    refreshBadges()
  }

  if (error && !group) {
    return (
      <>
        <BackLink to="/groups">Groups</BackLink>
        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>
      </>
    )
  }
  if (!group) return <Skeleton className="h-56 !rounded-3xl" />

  const inGroup = group.my_status === 'approved'
  const isAdmin = group.my_role === 'admin'
  const closed = group.status === 'closed'

  let action
  if (inGroup) {
    action = (
      <div className="space-y-2">
        {group.conversation_id && (
          <LinkButton to={`/chat/${group.conversation_id}`} className="w-full">
            <MessageCircle className="h-5 w-5" /> Open group chat
          </LinkButton>
        )}
        {isAdmin && (
          <LinkButton to={`/groups/${group.id}/manage`} variant="secondary" className="w-full">
            <Settings2 className="h-5 w-5" /> Manage group
            {!!group.pending_requests && (
              <span className="rounded-full bg-marigold-500 px-2 text-xs leading-5 text-white">{group.pending_requests}</span>
            )}
          </LinkButton>
        )}
        {isAdmin && group.status === 'open' && (
          <div className="pt-2">
            <InviteLinkCard groupId={group.id} title={group.title} />
          </div>
        )}
      </div>
    )
  } else if (group.my_status === 'requested') {
    action = (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-semibold">
          <Hourglass className="h-4 w-4" /> Request sent
        </p>
        <p className="mt-1">The group admin will get back to you. You'll see the chat here once you're in.</p>
        <Button
          variant="secondary"
          className="mt-3 px-4 py-2 text-sm"
          loading={busy === 'cancel'}
          onClick={() => act('cancel', supabase.rpc('cancel_join_request', { p_group_id: group.id }))}
        >
          Cancel request
        </Button>
      </div>
    )
  } else if (group.my_status === 'invited') {
    action = (
      <div className="rounded-3xl border border-brand-200 bg-brand-50 p-4">
        <p className="flex items-center gap-2 font-semibold text-brand-800">
          <PartyPopper className="h-4 w-4" /> You're invited to join
        </p>
        <div className="mt-3 flex gap-3">
          <Button
            variant="secondary"
            disabled={!!busy}
            loading={busy === 'decline'}
            onClick={() => act('decline', supabase.rpc('respond_invite', { p_group_id: group.id, p_accept: false }))}
          >
            Decline
          </Button>
          <Button
            className="flex-1"
            disabled={!!busy}
            loading={busy === 'accept'}
            onClick={() => act('accept', supabase.rpc('respond_invite', { p_group_id: group.id, p_accept: true }))}
          >
            Join group
          </Button>
        </div>
      </div>
    )
  } else if (group.my_status === 'rejected' || group.my_status === 'removed' || closed) {
    action = <p className="rounded-3xl bg-neutral-100 p-4 text-center text-sm text-neutral-600">This group isn't open to you.</p>
  } else if (group.status === 'full') {
    action = <p className="rounded-3xl bg-neutral-100 p-4 text-center text-sm text-neutral-600">This group is full.</p>
  } else {
    action = (
      <Button
        variant="marigold"
        className="w-full py-4 text-base"
        loading={busy === 'join'}
        onClick={() => act('join', supabase.rpc('request_join', { p_group_id: group.id }))}
      >
        <UserPlus className="h-5 w-5" /> Ask to join
      </Button>
    )
  }

  const selected = dialog && dialog.kind !== 'leave' ? dialog.member : null
  const target = selected && { userId: selected.user_id, name: selected.first_name }

  return (
    <>
      <BackLink to="/groups">Groups</BackLink>
      <Celebrate
        id={`group-full:${group.id}`}
        when={inGroup && group.member_count >= group.max_members}
        message="Your group is full. Everyone’s in, see you on the ground!"
      />

      <div className="lg:mt-4 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-10">
        <div>
          <div className="bandhani-soft relative mt-3 overflow-hidden rounded-[32px] bg-maroon-700 px-5 pb-6 text-cream shadow-xl shadow-maroon-950/15 lg:mt-0 lg:px-8 lg:pb-8">
            <Toran count={18} className="-mx-5 mb-3 text-cream lg:-mx-8" />
            <div className="relative">
              <div className="flex items-start gap-3">
                <DateChip date={group.event_date} tone="glass" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-[1.9rem] font-extrabold leading-[1] tracking-[-0.04em] lg:text-5xl">{group.title}</h1>
                  {group.venue && (
                    <p className="mt-2 flex items-center gap-1 text-sm text-cream/80">
                      <MapPin className="h-4 w-4 shrink-0" /> {group.venue}
                    </p>
                  )}
                  {eventDate(group.event_date) && <p className="mt-0.5 text-sm text-cream/70">{eventDate(group.event_date)}</p>}
                </div>
              </div>
              {group.description && <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-cream/90">{group.description}</p>}
              <div className="mt-5">
                <Capacity count={group.member_count} max={group.max_members} tone="glass" />
                <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-cream/80">
                  <UsersRound className="h-3.5 w-3.5" />
                  {group.member_count}/{group.max_members} people · {closed ? 'Closed' : spotsLeft(group)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">{action}</div>
          {actionError && (
            <div className="mt-3">
              <ErrorText>{actionError}</ErrorText>
            </div>
          )}
        </div>
        <div>
          <h2 className="mt-8 text-xl font-extrabold text-neutral-900 lg:mt-0">Who's going</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {inGroup
              ? 'Tap anyone to see their profile.'
              : "Tap anyone to see their profile. Socials are shared once you're in the group."}
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-2 lg:gap-3">
            {group.members.map((m) => {
              const me = m.user_id === profile?.id
              return (
                <li key={m.user_id} className="relative animate-rise">
                  <MemberTile member={m} me={me} onOpen={() => setDialog({ kind: 'profile', member: m })} />
                  {inGroup && !me && (
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: 'member', member: m })}
                      className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/50"
                      aria-label={`Options for ${m.first_name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          {inGroup && (
            <button
              type="button"
              onClick={() => setDialog({ kind: 'leave' })}
              className="mx-auto mt-6 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Leave group
            </button>
          )}
        </div>
      </div>

      {dialog?.kind === 'leave' && (
        <LeaveDialog
          group={group}
          onClose={() => setDialog(null)}
          onLeft={() => {
            refreshBadges()
            navigate('/groups', { replace: true })
          }}
        />
      )}
      {dialog?.kind === 'profile' && (
        <MemberProfileSheet groupId={group.id} member={dialog.member} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'member' && (
        <Sheet label={dialog.member.first_name} onClose={() => setDialog(null)}>
          <h2 className="text-lg font-bold text-neutral-900">{dialog.member.first_name}</h2>
          <p className="text-sm text-neutral-500">
            Blocking hides their messages from you. They stay in the group, and won't be told.
          </p>
          <div className="mt-4 space-y-2">
            <Button variant="secondary" className="w-full !text-red-700" onClick={() => setDialog({ kind: 'report', member: dialog.member })}>
              <Flag className="h-4 w-4" /> Report {dialog.member.first_name}
            </Button>
            <Button variant="secondary" className="w-full !text-red-700" onClick={() => setDialog({ kind: 'block', member: dialog.member })}>
              <Ban className="h-4 w-4" /> Block {dialog.member.first_name}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </div>
        </Sheet>
      )}
      {dialog?.kind === 'report' && target && (
        <ReportDialog
          target={target}
          conversationId={group.conversation_id}
          onClose={() => setDialog(null)}
          onReported={() => {
            setDialog(null)
            load()
          }}
        />
      )}
      {dialog?.kind === 'block' && target && (
        <BlockDialog
          target={target}
          onClose={() => setDialog(null)}
          onBlocked={() => {
            setDialog(null)
            load()
          }}
          onReportInstead={() => selected && setDialog({ kind: 'report', member: selected })}
          inGroup
        />
      )}
    </>
  )
}
