import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShell } from '../components/AppShell'
import { useSignedPhotos } from '../components/ProfileCard'
import { ErrorText, Spinner } from '../components/ui'
import { markNotificationsRead, type MatchItem } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { eventDate, type MyGroup } from '../lib/groups'
import { supabase } from '../lib/supabase'

function MatchRow({ match }: { match: MatchItem }) {
  const [url] = useSignedPhotos(match.photo_path ? [match.photo_path] : [])
  const subtitle = match.unread ? 'New message' : match.last_message_at ? 'Open chat' : 'Say hi 👋'

  return (
    <li>
      <Link
        to={`/chat/${match.conversation_id}`}
        className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 hover:border-brand-500"
      >
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-neutral-200">
          {url && <img src={url} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900">
              {match.first_name}, {match.age}
            </span>
            {match.is_new && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">New</span>
            )}
          </span>
          <span className="block font-mono text-xs text-neutral-500">{match.public_code}</span>
          <span className={`block text-sm ${match.unread ? 'font-semibold text-brand-700' : 'text-neutral-500'}`}>
            {subtitle}
          </span>
        </span>
        {match.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread messages" />}
      </Link>
    </li>
  )
}

// Admins with requests waiting go to the manage screen; everyone else to the chat.
function GroupRow({ group }: { group: MyGroup }) {
  const review = group.role === 'admin' && group.pending_requests > 0
  const subtitle = group.unread
    ? 'New message'
    : review
      ? `${group.pending_requests} request${group.pending_requests === 1 ? '' : 's'} to review`
      : group.last_message_at
        ? 'Open group chat'
        : 'Say hi to the group 👋'
  const details = [`${group.member_count}/${group.max_members} people`, eventDate(group.event_date)].filter(Boolean).join(' · ')

  return (
    <li>
      <Link
        to={review ? `/groups/${group.group_id}/manage` : `/chat/${group.conversation_id}`}
        className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 hover:border-brand-500"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
          {group.title.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-neutral-900">{group.title}</span>
            {group.is_new && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">New</span>
            )}
          </span>
          <span className="block text-xs text-neutral-500">{details}</span>
          <span className={`block text-sm ${group.unread || review ? 'font-semibold text-brand-700' : 'text-neutral-500'}`}>
            {subtitle}
          </span>
        </span>
        {(group.unread || review) && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Needs attention" />}
      </Link>
    </li>
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

  return (
    <>
      <h1 className="text-lg font-bold text-neutral-900">Matches</h1>
      <p className="mt-1 text-sm text-neutral-600">Chat here, then continue on socials. Your socials are shared only with the people here.</p>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>
      {(!matches || !groups) && !error && <Spinner />}
      {matches?.length === 0 && groups?.length === 0 && (
        <div className="mt-12 text-center">
          <p className="font-semibold text-neutral-700">No matches yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            When you and someone like each other, or you join a group, they show up here.
          </p>
        </div>
      )}
      {groups && groups.length > 0 && (
        <>
          <h2 className="mt-5 text-sm font-semibold text-neutral-800">Groups</h2>
          <ul className="mt-2 space-y-3">
            {groups.map((g) => (
              <GroupRow key={g.group_id} group={g} />
            ))}
          </ul>
        </>
      )}
      {matches && matches.length > 0 && (
        <>
          {groups && groups.length > 0 && <h2 className="mt-5 text-sm font-semibold text-neutral-800">People</h2>}
          <ul className="mt-2 space-y-3">
            {matches.map((m) => (
              <MatchRow key={m.match_id} match={m} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}
