import { MapPin, Plus, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DiscoverTabs from '../../components/DiscoverTabs'
import { Capacity, DateChip } from '../../components/GroupBits'
import { LinkButton, EmptyState, ErrorText, Skeleton, Tag } from '../../components/ui'
import { useAuth } from '../../lib/auth-context'
import { fetchLiveActivity, type LiveActivity } from '../../lib/discovery'
import { friendlyError } from '../../lib/errors'
import { spotsLeft, type GroupListItem, type MemberStatus } from '../../lib/groups'
import { supabase } from '../../lib/supabase'

const STATUS_TAG: Partial<Record<MemberStatus, { label: string; tone: 'green' | 'amber' | 'brand' }>> = {
  approved: { label: "You're in", tone: 'green' },
  requested: { label: 'Requested', tone: 'amber' },
  invited: { label: 'Invited', tone: 'brand' },
}

function GroupCard({ group }: { group: GroupListItem }) {
  const status = group.my_status ? STATUS_TAG[group.my_status] : undefined
  return (
    <li className="animate-rise">
      <Link
        to={`/groups/${group.id}`}
        className="block rounded-3xl border border-neutral-200/80 bg-surface p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md active:scale-[0.99]"
      >
        <span className="flex items-start gap-3">
          <DateChip date={group.event_date} />
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="font-display text-[17px] font-bold leading-tight text-neutral-900">{group.title}</span>
              {status && (
                <Tag tone={status.tone} className="shrink-0">
                  {status.label}
                </Tag>
              )}
            </span>
            {group.venue && (
              <span className="mt-1 flex items-center gap-1 text-sm text-neutral-600">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{group.venue}</span>
              </span>
            )}
          </span>
        </span>
        {group.description && <span className="mt-3 line-clamp-2 block text-sm text-neutral-500">{group.description}</span>}
        <span className="mt-3 block">
          <Capacity count={group.member_count} max={group.max_members} />
          <span className="mt-1.5 flex items-center justify-between text-xs text-neutral-500">
            <span className="flex items-center gap-1 font-medium">
              <UsersRound className="h-3.5 w-3.5" />
              {group.member_count}/{group.max_members} · {spotsLeft(group)}
            </span>
            {group.admin_name && <span>by {group.admin_name}</span>}
          </span>
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
        <EmptyState icon={ShieldCheck} title="Groups open once you're verified">
          Everyone in a group is verified, so you can join and start groups as soon as your video is approved, usually
          within 24 hours.
        </EmptyState>
      ) : activity === null ? (
        <EmptyState
          icon={Sparkles}
          title="Add Garba & Dandiya first"
          action={
            <LinkButton to="/discover">
              Go to People
            </LinkButton>
          }
        >
          Groups are for live activities. Add Garba on the People tab.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-neutral-900">Groups</h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                {activity?.name ?? 'Garba'} · everyone in a group is verified.
              </p>
            </div>
            <LinkButton to="/groups/new" className="shrink-0 px-4 py-2.5 text-sm">
              <Plus className="h-4 w-4" strokeWidth={2.6} /> Start a group
            </LinkButton>
          </div>

          <ErrorText>{error}</ErrorText>
          {!groups && !error && (
            <div className="space-y-3" aria-label="Loading">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-36 !rounded-3xl" />
              ))}
            </div>
          )}
          {groups?.length === 0 && (
            <EmptyState
              icon={UsersRound}
              title="No open groups yet"
              action={
                <LinkButton to="/groups/new">
                  <Plus className="h-4 w-4" strokeWidth={2.6} /> Start a group
                </LinkButton>
              }
            >
              Be the first. Start a group for your Garba night and invite people who are going.
            </EmptyState>
          )}
          {groups && groups.length > 0 && (
            <ul className="space-y-3">
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
