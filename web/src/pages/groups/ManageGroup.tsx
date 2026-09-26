import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useShell } from '../../components/AppShell'
import { Sheet } from '../../components/SafetyDialogs'
import { Button, ErrorText, Spinner } from '../../components/ui'
import { useAuth } from '../../lib/auth-context'
import { markNotificationsRead } from '../../lib/discovery'
import { friendlyError } from '../../lib/errors'
import type { GroupDetail as Group, GroupMember, InterestedPerson } from '../../lib/groups'
import { supabase } from '../../lib/supabase'
import { MemberAvatar } from './GroupDetail'

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  )
}

function PersonRow({ person, children }: { person: InterestedPerson; children: ReactNode }) {
  return (
    <li className="px-3 py-3">
      <div className="flex items-start gap-3">
        <MemberAvatar path={person.photo_paths[0] ?? null} name={person.first_name} size="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-neutral-900">
            {person.first_name}, {person.age}
            {person.seeking === 'group' && (
              <span className="ml-2 rounded-full bg-marigold-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-800">
                Wants a group
              </span>
            )}
          </p>
          <p className="font-mono text-xs text-neutral-500">{person.public_code}</p>
          {person.bio && <p className="mt-1 line-clamp-3 text-sm text-neutral-600">{person.bio}</p>}
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">{children}</div>
    </li>
  )
}

const listClass = 'divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white'
const smallBtn = 'px-4 py-2 text-sm'

export default function ManageGroup() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const { refreshBadges } = useShell()
  const [group, setGroup] = useState<Group | null>(null)
  const [people, setPeople] = useState<InterestedPerson[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [removing, setRemoving] = useState<GroupMember | null>(null)

  const load = useCallback(async () => {
    const [g, p] = await Promise.all([
      supabase.rpc('get_group', { p_group_id: id }),
      supabase.rpc('get_group_interested', { p_group_id: id }),
    ])
    if (g.error || p.error) return setError(friendlyError(g.error ?? p.error))
    setGroup(g.data as unknown as Group)
    setPeople(p.data)
  }, [id])

  useEffect(() => {
    load().then(async () => {
      await Promise.all([markNotificationsRead('group_join_request'), markNotificationsRead('group_invite_accepted')])
      refreshBadges()
    })
  }, [load, refreshBadges])

  async function act(key: string, call: PromiseLike<{ error: unknown }>) {
    setBusy(key)
    setError('')
    const { error } = await call
    setBusy(null)
    if (error) setError(friendlyError(error))
    await load()
    refreshBadges()
  }

  if (!group || !people) {
    return error ? (
      <>
        <Link to={`/groups/${id}`} className="text-sm font-semibold text-brand-700">
          ← Group
        </Link>
        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>
      </>
    ) : (
      <Spinner />
    )
  }

  const full = group.member_count >= group.max_members
  const requests = people.filter((p) => p.status === 'requested')
  const invited = people.filter((p) => p.status === 'invited')
  const candidates = people.filter((p) => !p.status)
  const members = group.members.filter((m) => m.user_id !== profile?.id)

  return (
    <>
      <Link to={`/groups/${group.id}`} className="text-sm font-semibold text-brand-700">
        ← {group.title}
      </Link>
      <h1 className="mt-3 text-lg font-bold text-neutral-900">Manage group</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {group.member_count}/{group.max_members} people.{' '}
        {full ? 'The group is full. Remove someone to make room.' : 'Everyone here is verified.'}
      </p>
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <Section title={`Requests (${requests.length})`}>
        {requests.length === 0 ? (
          <p className="text-sm text-neutral-500">No one is waiting right now.</p>
        ) : (
          <ul className={listClass}>
            {requests.map((p) => (
              <PersonRow key={p.user_id} person={p}>
                <Button
                  variant="secondary"
                  className={smallBtn}
                  disabled={!!busy}
                  loading={busy === `decline:${p.user_id}`}
                  onClick={() =>
                    act(`decline:${p.user_id}`, supabase.rpc('respond_join_request', { p_group_id: group.id, p_user_id: p.user_id, p_approve: false }))
                  }
                >
                  Decline
                </Button>
                <Button
                  className={smallBtn}
                  disabled={!!busy || full}
                  loading={busy === `approve:${p.user_id}`}
                  onClick={() =>
                    act(`approve:${p.user_id}`, supabase.rpc('respond_join_request', { p_group_id: group.id, p_user_id: p.user_id, p_approve: true }))
                  }
                >
                  Approve
                </Button>
              </PersonRow>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Members (${group.member_count})`}>
        {members.length === 0 ? (
          <p className="text-sm text-neutral-500">Just you so far. Approve requests or invite people below.</p>
        ) : (
          <ul className={listClass}>
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 px-3 py-2.5">
                <MemberAvatar path={m.photo_path} name={m.first_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-neutral-900">{m.first_name}</span>
                  <span className="block font-mono text-xs text-neutral-500">{m.public_code}</span>
                </span>
                <Button variant="ghost" className={`${smallBtn} text-red-700`} disabled={!!busy} onClick={() => setRemoving(m)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {invited.length > 0 && (
        <Section title={`Invited (${invited.length})`} hint="Waiting for them to accept.">
          <ul className={listClass}>
            {invited.map((p) => (
              <PersonRow key={p.user_id} person={p}>
                <Button
                  variant="ghost"
                  className={smallBtn}
                  disabled={!!busy}
                  loading={busy === `withdraw:${p.user_id}`}
                  onClick={() => act(`withdraw:${p.user_id}`, supabase.rpc('remove_member', { p_group_id: group.id, p_user_id: p.user_id }))}
                >
                  Withdraw invite
                </Button>
              </PersonRow>
            ))}
          </ul>
        </Section>
      )}

      <Section title="People you can invite" hint="Verified people going to Garba. People looking for a group come first.">
        {candidates.length === 0 ? (
          <p className="text-sm text-neutral-500">No one else to invite right now. Check back later.</p>
        ) : (
          <ul className={listClass}>
            {candidates.map((p) => (
              <PersonRow key={p.user_id} person={p}>
                <Button
                  className={smallBtn}
                  disabled={!!busy || full}
                  loading={busy === `invite:${p.user_id}`}
                  onClick={() => act(`invite:${p.user_id}`, supabase.rpc('invite_to_group', { p_group_id: group.id, p_user_id: p.user_id }))}
                >
                  Invite
                </Button>
              </PersonRow>
            ))}
          </ul>
        )}
      </Section>

      {removing && (
        <Sheet label={`Remove ${removing.first_name}`} onClose={() => setRemoving(null)}>
          <h2 className="text-lg font-bold text-neutral-900">Remove {removing.first_name}?</h2>
          <p className="mt-2 text-sm text-neutral-600">
            They'll leave the group chat and can't ask to join again. The chat keeps its message allowance.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={busy === 'remove'}
              onClick={async () => {
                await act('remove', supabase.rpc('remove_member', { p_group_id: group.id, p_user_id: removing.user_id }))
                setRemoving(null)
              }}
            >
              Remove
            </Button>
          </div>
        </Sheet>
      )}
    </>
  )
}
