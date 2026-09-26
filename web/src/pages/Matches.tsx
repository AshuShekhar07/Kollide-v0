import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShell } from '../components/AppShell'
import { useSignedPhotos } from '../components/ProfileCard'
import { ErrorText, Spinner } from '../components/ui'
import { markNotificationsRead, type MatchItem } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
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

export default function Matches() {
  const { refreshBadges } = useShell()
  const [matches, setMatches] = useState<MatchItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('get_matches').then(async ({ data, error }) => {
      if (error) return setError(friendlyError(error))
      setMatches(data)
      // "New" badges are computed before this, so they still show on this visit.
      await markNotificationsRead('match')
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
      {!matches && !error && <Spinner />}
      {matches?.length === 0 && (
        <div className="mt-12 text-center">
          <p className="font-semibold text-neutral-700">No matches yet</p>
          <p className="mt-1 text-sm text-neutral-500">When you and someone like each other, they show up here.</p>
        </div>
      )}
      {matches && matches.length > 0 && (
        <ul className="mt-4 space-y-3">
          {matches.map((m) => (
            <MatchRow key={m.match_id} match={m} />
          ))}
        </ul>
      )}
    </>
  )
}
