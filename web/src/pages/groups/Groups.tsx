import { CalendarDays, MapPin, Plus, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DiscoverTabs from '../../components/DiscoverTabs'
import { Capacity } from '../../components/GroupBits'
import { RingScene } from '../../components/Scenes'
import { LinkButton, EmptyState, ErrorText, Skeleton, Tag } from '../../components/ui'
import { festiveTile } from '../../lib/festive'
import { useAuth } from '../../lib/auth-context'
import { fetchLiveActivity, type LiveActivity } from '../../lib/discovery'
import { friendlyError } from '../../lib/errors'
import { dateParts, spotsLeft, type GroupListItem, type MemberStatus } from '../../lib/groups'
import { supabase } from '../../lib/supabase'

const STATUS_TAG: Partial<Record<MemberStatus, { label: string; tone: 'green' | 'amber' | 'brand' }>> = {
  approved: { label: "You're in", tone: 'green' },
  requested: { label: 'Requested', tone: 'amber' },
  invited: { label: 'Invited', tone: 'brand' },
}

function GroupCard({ group }: { group: GroupListItem }) {
  const status = group.my_status ? STATUS_TAG[group.my_status] : undefined
  const date = dateParts(group.event_date)
  return (
    <li className="h-full animate-rise">
      <Link
        to={`/groups/${group.id}`}
        className="group flex h-full gap-4 rounded-[28px] border border-neutral-200/80 bg-surface p-2.5 pr-4 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-maroon-950/10 active:scale-[0.99]"
      >
        {/* The night, as a big festive tile. */}
        <span
          className={`bandhani-soft flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-[22px] transition duration-500 group-hover:-rotate-3 sm:w-20 ${festiveTile(group.id)}`}
        >
          {date ? (
            <>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-80">{date.month}</span>
              <span className="font-display text-[2rem] font-extrabold leading-none tracking-[-0.04em]">{date.day}</span>
            </>
          ) : (
            <CalendarDays className="h-7 w-7" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col py-1.5">
          <span className="flex items-start justify-between gap-2">
            <span className="font-display text-lg font-extrabold leading-tight tracking-[-0.02em] text-neutral-900">{group.title}</span>
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
          {group.description && <span className="mt-2 line-clamp-2 block text-sm text-neutral-500">{group.description}</span>}
          <span className="mt-auto block pt-3">
            <Capacity count={group.member_count} max={group.max_members} />
            <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-neutral-500">
              <span className="flex items-center gap-1 font-semibold">
                <UsersRound className="h-3.5 w-3.5" />
                {group.member_count}/{group.max_members} · {spotsLeft(group)}
              </span>
              {group.admin_name && <span className="truncate">by {group.admin_name}</span>}
            </span>
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
          <div className="mb-4 flex items-end justify-between gap-3 lg:mb-8">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-500">{activity?.name ?? 'Garba'}</p>
              <h1 className="mt-1 text-[1.9rem] font-extrabold leading-none tracking-[-0.04em] text-neutral-900 lg:text-6xl">Groups</h1>
              <p className="mt-2 text-xs text-neutral-500 lg:text-sm">Go as a crowd. Everyone in a group is verified.</p>
            </div>
            <LinkButton to="/groups/new" className="shrink-0 px-4 py-2.5 text-sm">
              <Plus className="h-4 w-4" strokeWidth={2.6} /> Start a group
            </LinkButton>
          </div>

          <ErrorText>{error}</ErrorText>
          {!groups && !error && (
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-5" aria-label="Loading">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-36 !rounded-[28px]" />
              ))}
            </div>
          )}
          {groups?.length === 0 && (
            <EmptyState
              icon={UsersRound}
              scene={<RingScene />}
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
            <ul className="grid gap-3 lg:grid-cols-2 lg:gap-5">
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
