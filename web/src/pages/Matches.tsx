import { ChevronRight, MessageCircle, UsersRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useShell } from '../components/AppShell'
import Avatar from '../components/Avatar'
import { LinkButton, EmptyState, ErrorText, PageHeader, Skeleton, Tag } from '../components/ui'
import { markNotificationsRead, type MatchItem } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { timeAgo } from '../lib/format'
import { eventDate, type MyGroup } from '../lib/groups'
import { supabase } from '../lib/supabase'

// Matches nobody has written to yet, as a row of avatars.
function NewMatches({ matches }: { matches: MatchItem[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-bold text-neutral-900">New matches</h2>
      <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {matches.map((m) => (
          <li key={m.match_id} className="animate-rise">
            <Link to={`/chat/${m.conversation_id}`} className="flex w-[4.5rem] flex-col items-center gap-1.5 active:scale-95">
              <Avatar path={m.photo_path} name={m.first_name} className="h-16 w-16 text-xl" ring />
              <span className="w-full truncate text-center text-xs font-semibold text-neutral-800">{m.first_name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Row({
  to,
  avatar,
  title,
  tag,
  subtitle,
  time,
  highlight,
}: {
  to: string
  avatar: ReactNode
  title: string
  tag?: ReactNode
  subtitle: string
  time: string
  highlight: boolean
}) {
  return (
    <li className="animate-rise">
      <Link to={to} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-neutral-100 active:scale-[0.99]">
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-neutral-900">{title}</span>
            {tag}
          </span>
          <span className={`block truncate text-sm ${highlight ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`}>{subtitle}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          {time && <span className="text-[11px] text-neutral-400">{time}</span>}
          {highlight ? (
            <span className="h-2.5 w-2.5 rounded-full bg-brand-500" aria-label="Needs attention" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-300" />
          )}
        </span>
      </Link>
    </li>
  )
}

function MatchRow({ match }: { match: MatchItem }) {
  return (
    <Row
      to={`/chat/${match.conversation_id}`}
      avatar={<Avatar path={match.photo_path} name={match.first_name} />}
      title={`${match.first_name}, ${match.age}`}
      tag={match.is_new && <Tag tone="marigold">New</Tag>}
      subtitle={match.unread ? 'New message' : 'Open chat'}
      time={timeAgo(match.last_message_at)}
      highlight={match.unread}
    />
  )
}

// Admins with requests waiting go to the manage screen; everyone else to the chat.
function GroupRow({ group }: { group: MyGroup }) {
  const review = group.role === 'admin' && group.pending_requests > 0
  const details = [`${group.member_count}/${group.max_members} people`, eventDate(group.event_date)].filter(Boolean).join(' · ')
  const subtitle = group.unread
    ? 'New message'
    : review
      ? `${group.pending_requests} request${group.pending_requests === 1 ? '' : 's'} to review`
      : group.last_message_at
        ? details
        : 'Say hi to the group 👋'

  return (
    <Row
      to={review ? `/groups/${group.group_id}/manage` : `/chat/${group.conversation_id}`}
      avatar={
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-plum-900 font-display text-xl font-bold text-white">
          {group.title.slice(0, 1).toUpperCase()}
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-canvas bg-brand-500 text-white">
            <UsersRound className="h-3 w-3" strokeWidth={2.6} />
          </span>
        </span>
      }
      title={group.title}
      tag={group.is_new && <Tag tone="marigold">New</Tag>}
      subtitle={subtitle}
      time={timeAgo(group.last_message_at)}
      highlight={group.unread || review}
    />
  )
}

export default function Matches() {
  const { refreshBadges } = useShell()
  const [matches, setMatches] = useState<MatchItem[] | null>(null)
  const [groups, setGroups] = useState<MyGroup[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([supabase.rpc('get_matches'), supabase.rpc('get_my_groups')]).then(async ([m, g]) => {
      if (m.error || g.error) return setError(friendlyError(m.error ?? g.error))
      setMatches(m.data)
      setGroups(g.data)
      // "New" badges are computed before this, so they still show on this visit.
      await Promise.all(['match', 'group_approved', 'group_admin'].map(markNotificationsRead))
      refreshBadges()
    })
  }, [refreshBadges])

  const fresh = matches?.filter((m) => !m.last_message_at) ?? []
  // People with messages and every group, most recent first.
  const threads = [
    ...(matches ?? []).filter((m) => m.last_message_at).map((m) => ({ at: m.last_message_at, el: <MatchRow key={m.match_id} match={m} /> })),
    ...(groups ?? []).map((g) => ({ at: g.last_message_at ?? '', el: <GroupRow key={g.group_id} group={g} /> })),
  ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))

  return (
    <>
      <PageHeader eyebrow="Chats" title="Your people" subtitle="Your socials are shared only with the people here." />

      <ErrorText>{error}</ErrorText>
      {(!matches || !groups) && !error && (
        <div className="space-y-3" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2">
              <Skeleton className="h-14 w-14 !rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      )}
      {matches?.length === 0 && groups?.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="No chats yet"
          action={
            <LinkButton to="/discover">
              Start discovering
            </LinkButton>
          }
        >
          When you and someone like each other, or you join a group, you can chat here.
        </EmptyState>
      )}
      {fresh.length > 0 && <NewMatches matches={fresh} />}
      {threads.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold text-neutral-900">Messages</h2>
          <ul className="-mx-2 lg:mx-0 lg:divide-y lg:divide-neutral-100 lg:rounded-[28px] lg:border lg:border-neutral-200 lg:p-2">
            {threads.map((t) => t.el)}
          </ul>
        </section>
      )}
    </>
  )
}
