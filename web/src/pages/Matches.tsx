import { useEffect, useState } from 'react'
import { useShell } from '../components/AppShell'
import { useSignedPhotos } from '../components/ProfileCard'
import { Button, ErrorText, Spinner } from '../components/ui'
import { markNotificationsRead, SOCIALS, type Contact, type MatchItem } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

function ContactReveal({ userId, name }: { userId: string; name: string }) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reveal() {
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('get_contact', { p_user_id: userId })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setContact(data as Contact)
  }

  if (!contact) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" className="w-full py-2 text-sm" onClick={reveal} loading={busy}>
          Show {name}'s socials
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    )
  }

  const entries = SOCIALS.filter((s) => contact[s.key])
  return (
    <ul className="space-y-2">
      {entries.map((s) => (
        <li key={s.key}>
          <a
            href={s.href(contact[s.key]!)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5 text-sm"
          >
            <span className="font-semibold text-brand-700">{s.label}</span>
            <span className="font-mono text-neutral-700">{contact[s.key]}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function MatchRow({ match }: { match: MatchItem }) {
  const [url] = useSignedPhotos(match.photo_path ? [match.photo_path] : [])
  const [open, setOpen] = useState(false)

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left" aria-expanded={open}>
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
        </span>
        <span className="text-neutral-400" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="mt-3">
          <ContactReveal userId={match.user_id} name={match.first_name} />
        </div>
      )}
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
      <p className="mt-1 text-sm text-neutral-600">Your socials are shared only with the people here.</p>

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
