import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useShell } from '../../components/AppShell'
import { useSignedPhotos } from '../../components/ProfileCard'
import { BlockDialog, ReportDialog, Sheet } from '../../components/SafetyDialogs'
import { Button, ErrorText, Spinner } from '../../components/ui'
import { useAuth } from '../../lib/auth-context'
import { friendlyError } from '../../lib/errors'
import { eventDate, spotsLeft, type GroupDetail as Group, type GroupMember } from '../../lib/groups'
import { supabase } from '../../lib/supabase'

export function MemberAvatar({ path, name, size = 'h-11 w-11' }: { path: string | null; name: string; size?: string }) {
  const [url] = useSignedPhotos(path ? [path] : [])
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 font-semibold text-neutral-500`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1)}
    </span>
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
  const [dialog, setDialog] = useState<{ kind: 'leave' } | { kind: 'member' | 'report' | 'block'; member: GroupMember } | null>(null)

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
        <Link to="/groups" className="text-sm font-semibold text-brand-700">
          ← Groups
        </Link>
        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>
      </>
    )
  }
  if (!group) return <Spinner />

  const inGroup = group.my_status === 'approved'
  const isAdmin = group.my_role === 'admin'
  const when = [eventDate(group.event_date), group.venue].filter(Boolean).join(' · ')
  const closed = group.status === 'closed'

  let action
  if (inGroup) {
    action = (
      <div className="space-y-2">
        {group.conversation_id && (
          <Link
            to={`/chat/${group.conversation_id}`}
            className="flex w-full justify-center rounded-full bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Open group chat
          </Link>
        )}
        {isAdmin && (
          <Link
            to={`/groups/${group.id}/manage`}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Manage group
            {!!group.pending_requests && (
              <span className="rounded-full bg-brand-600 px-2 text-xs leading-5 text-white">{group.pending_requests}</span>
            )}
          </Link>
        )}
      </div>
    )
  } else if (group.my_status === 'requested') {
    action = (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Request sent</p>
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
      <div className="rounded-2xl bg-brand-50 p-4">
        <p className="font-semibold text-brand-900">You're invited to join</p>
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
    action = <p className="rounded-2xl bg-neutral-100 p-4 text-sm text-neutral-600">This group isn't open to you.</p>
  } else if (group.status === 'full') {
    action = <p className="rounded-2xl bg-neutral-100 p-4 text-sm text-neutral-600">This group is full.</p>
  } else {
    action = (
      <Button
        className="w-full"
        loading={busy === 'join'}
        onClick={() => act('join', supabase.rpc('request_join', { p_group_id: group.id }))}
      >
        Ask to join
      </Button>
    )
  }

  const selected = dialog && dialog.kind !== 'leave' ? dialog.member : null
  const target = selected && { userId: selected.user_id, name: selected.first_name }

  return (
    <>
      <Link to="/groups" className="text-sm font-semibold text-brand-700">
        ← Groups
      </Link>

      <h1 className="mt-3 text-xl font-bold text-neutral-900">{group.title}</h1>
      {when && <p className="mt-0.5 text-neutral-600">{when}</p>}
      <p className="mt-1 text-sm text-neutral-500">
        {group.member_count}/{group.max_members} people · {closed ? 'Closed' : spotsLeft(group)}
      </p>
      {group.description && <p className="mt-3 whitespace-pre-wrap text-[15px] text-neutral-800">{group.description}</p>}

      <div className="mt-5">{action}</div>
      {actionError && (
        <div className="mt-3">
          <ErrorText>{actionError}</ErrorText>
        </div>
      )}

      <h2 className="mt-6 text-sm font-semibold text-neutral-800">Who's going</h2>
      {!inGroup && (
        <p className="mt-0.5 text-xs text-neutral-500">Photos and socials are shared once you're in the group.</p>
      )}
      <ul className="mt-2 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
        {group.members.map((m) => {
          const me = m.user_id === profile?.id
          return (
            <li key={m.user_id} className="flex items-center gap-3 px-3 py-2.5">
              <MemberAvatar path={m.photo_path} name={m.first_name} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold text-neutral-900">{me ? 'You' : m.first_name}</span>
                  {m.role === 'admin' && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">Admin</span>
                  )}
                </span>
                <span className="block font-mono text-xs text-neutral-500">{m.public_code}</span>
              </span>
              {inGroup && !me && (
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'member', member: m })}
                  className="rounded-full px-3 py-1 text-xl leading-none text-neutral-500 hover:bg-neutral-100"
                  aria-label={`Options for ${m.first_name}`}
                >
                  ⋯
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
          className="mx-auto mt-6 block text-sm font-medium text-red-700 underline"
        >
          Leave group
        </button>
      )}

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
      {dialog?.kind === 'member' && (
        <Sheet label={dialog.member.first_name} onClose={() => setDialog(null)}>
          <h2 className="text-lg font-bold text-neutral-900">{dialog.member.first_name}</h2>
          <p className="text-sm text-neutral-500">
            Blocking hides their messages from you. They stay in the group, and won't be told.
          </p>
          <div className="mt-4 space-y-2">
            <Button variant="secondary" className="w-full text-red-700" onClick={() => setDialog({ kind: 'report', member: dialog.member })}>
              Report {dialog.member.first_name}
            </Button>
            <Button variant="secondary" className="w-full text-red-700" onClick={() => setDialog({ kind: 'block', member: dialog.member })}>
              Block {dialog.member.first_name}
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
