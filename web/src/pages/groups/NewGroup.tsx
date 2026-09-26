import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ErrorText, Field, Spinner, inputClass } from '../../components/ui'
import { useAuth } from '../../lib/auth-context'
import { fetchLiveActivity, type LiveActivity } from '../../lib/discovery'
import { friendlyError } from '../../lib/errors'
import { MAX_GROUP_SIZE } from '../../lib/groups'
import { supabase } from '../../lib/supabase'

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function NewGroup() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const uid = profile?.id
  const [activity, setActivity] = useState<LiveActivity | null | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [size, setSize] = useState(6)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (uid) fetchLiveActivity(uid).then(setActivity).catch((e) => setError(friendlyError(e)))
  }, [uid])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!activity) return
    if (!title.trim()) return setError('Give your group a name.')
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('create_group', {
      p_activity_id: activity.id,
      p_title: title,
      p_description: description,
      // Optional; the generated type doesn't know it can be null.
      p_event_date: (date || null) as string,
      p_venue: venue,
      p_max_members: size,
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    navigate(`/groups/${(data as { group_id: string }).group_id}`, { replace: true })
  }

  if (activity === undefined && !error) return <Spinner />

  return (
    <>
      <Link to="/groups" className="text-sm font-semibold text-brand-700">
        ← Groups
      </Link>
      <h1 className="mt-3 text-lg font-bold text-neutral-900">Start a group</h1>
      <p className="mt-1 text-sm text-neutral-600">
        You'll be the group admin: you choose who joins. Everyone in the group gets one shared chat.
      </p>

      {activity === null ? (
        <p className="mt-6 text-sm text-neutral-600">Add Garba &amp; Dandiya on the People tab to start a group.</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Group name">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Saturday night at Palace Grounds"
              className={inputClass}
            />
          </Field>
          <Field label="Date (optional)">
            <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Venue (optional)" hint="A public place is best for meeting new people.">
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              maxLength={200}
              placeholder="Palace Grounds, gate 2"
              className={inputClass}
            />
          </Field>
          <Field label="About the group (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Beginners welcome! We'll meet at 7 and go in together."
              className={inputClass}
            />
          </Field>
          <Field label="Group size, including you">
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className={inputClass}>
              {Array.from({ length: MAX_GROUP_SIZE - 1 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} people
                </option>
              ))}
            </select>
          </Field>

          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" loading={busy}>
            Create group
          </Button>
        </form>
      )}
    </>
  )
}
