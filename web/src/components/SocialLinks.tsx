import { useEffect, useState } from 'react'
import { SOCIALS, type Contact } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { ErrorText, Spinner } from './ui'

// Someone's social handles as tappable links. get_contact enforces that the
// caller shares a match or group with them and neither has blocked the other.
export default function SocialLinks({ userId }: { userId: string }) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_contact', { p_user_id: userId }).then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(friendlyError(error))
      else setContact(data as Contact)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (error) return <ErrorText>{error}</ErrorText>
  if (!contact) return <Spinner />

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
