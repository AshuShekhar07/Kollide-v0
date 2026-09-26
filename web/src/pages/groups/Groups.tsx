import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DiscoverTabs from '../../components/DiscoverTabs'
import { ErrorText, Spinner } from '../../components/ui'
import { useAuth } from '../../lib/auth-context'
import { fetchLiveActivity, type LiveActivity } from '../../lib/discovery'
import { friendlyError } from '../../lib/errors'
import { eventDate, spotsLeft, type GroupListItem, type MemberStatus } from '../../lib/groups'
import { supabase } from '../../lib/supabase'

const STATUS_CHIP: Partial<Record<MemberStatus, { label: string; className: string }>> = {
  approved: { label: "You're in", className: 'bg-green-100 text-green-800' },
  requested: { label: 'Requested', className: 'bg-amber-100 text-amber-800' },
  invited: { label: 'Invited', className: 'bg-brand-100 text-brand-700' },
}

function GroupCard({ group }: { group: GroupListItem }) {
  const chip = group.my_status ? STATUS_CHIP[group.my_status] : undefined
  const when = [eventDate(group.event_date), group.venue].filter(Boolean).join(' · ')
  return (
    <li>
      <Link to={`/groups/${group.id}`} className="block rounded-2xl border border-neutral-200 bg-white p-4 hover:border-brand-500">
        <span className="flex items-start justify-between gap-3">
          <span className="font-semibold text-neutral-900">{group.title}</span>
          {chip && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.className}`}>{chip.label}</span>
          )}
        </span>
        {when && <span className="mt-0.5 block text-sm text-neutral-600">{when}</span>}
        {group.description && <span className="mt-1 line-clamp-2 block text-sm text-neutral-500">{group.description}</span>}
        <span className="mt-2 flex items-center justify-between text-xs text-neutral-500">
          <span>
            {group.member_count}/{group.max_members} people · {spotsLeft(group)}
          </span>
          {group.admin_name && <span>by {group.admin_name}</span>}
        </span>
      </Link>
    </li>
  )
}

export default function Groups() {
  const { profile } = useAuth()
  const uid = profile?.id
  const verified = profile?.verification_status === 'approved'
  const [activity, setActivity] = useState<LiveActivity | null | undefined>(undefined)
  const [groups, setGroups] = useState<GroupListItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid || !verified) return
    fetchLiveActivity(uid)
      .then(async (a) => {
        setActivity(a)
        if (!a) return
        const { data, error } = await supabase.rpc('get_groups', { p_activity_id: a.id })
        if (error) return setError(friendlyError(error))
        setGroups(data)
      })
      .catch((e) => setError(friendlyError(e)))
  }, [uid, verified])

  return (
    <>
      <DiscoverTabs />

      {!verified ? (
        <div className="mt-12 text-center">
          <p className="font-semibold text-neutral-900">Groups open once you're verified</p>
          <p className="mt-1 text-sm text-neutral-600">
            Everyone in a group is verified, so you'll be able to join and start groups as soon as your video is
            approved, usually within 24 hours.
          </p>
        </div>
      ) : activity === null ? (
        <div className="mt-12 text-center">
          <p className="font-semibold text-neutral-900">Add Garba &amp; Dandiya first</p>
          <p className="mt-1 text-sm text-neutral-600">Groups are for live activities. Add Garba on the People tab.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-neutral-900">{activity?.name ?? 'Groups'} groups</h1>
              <p className="text-xs text-neutral-500">Go with a group. Everyone in it is verified.</p>
            </div>
            <Link
              to="/groups/new"
              className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Start a group
            </Link>
          </div>

          <div className="mt-4">
            <ErrorText>{error}</ErrorText>
          </div>
          {!groups && !error && <Spinner />}
          {groups?.length === 0 && (
            <div className="mt-12 text-center">
              <p className="font-semibold text-neutral-700">No open groups yet</p>
              <p className="mt-1 text-sm text-neutral-500">Start one and invite people who are going.</p>
            </div>
          )}
          {groups && groups.length > 0 && (
            <ul className="mt-4 space-y-3">
              {groups.map((g) => (
                <GroupCard key={g.id} group={g} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
