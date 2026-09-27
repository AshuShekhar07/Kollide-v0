import { Minus, Plus, Sparkles } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackLink } from '../../components/BackLink'
import { Button, EmptyState, ErrorText, Field, PageHeader, Spinner, inputClass } from '../../components/ui'
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
      <BackLink to="/groups">Groups</BackLink>
      <div className="mt-3">
        <PageHeader
          title="Start a group"
          subtitle="You'll be the admin and choose who joins. Everyone in the group shares one chat."
        />
      </div>

      {activity === null ? (
        <EmptyState icon={Sparkles} title="Add Garba & Dandiya first">
          Add Garba &amp; Dandiya on the People tab to start a group.
        </EmptyState>
      ) : (
        <form onSubmit={submit} className="space-y-4">
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
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-neutral-800" id="size-label">
              Group size, including you
            </span>
            <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-surface p-2 shadow-sm">
              <button
                type="button"
                onClick={() => setSize((n) => Math.max(2, n - 1))}
                disabled={size <= 2}
                aria-label="Fewer people"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 transition active:scale-90 disabled:opacity-30"
              >
                <Minus className="h-5 w-5" />
              </button>
              <p className="text-center" aria-live="polite" aria-labelledby="size-label">
                <span className="font-display text-2xl font-bold text-neutral-900">{size}</span>
                <span className="ml-1 text-sm text-neutral-500">people</span>
              </p>
              <button
                type="button"
                onClick={() => setSize((n) => Math.min(MAX_GROUP_SIZE, n + 1))}
                disabled={size >= MAX_GROUP_SIZE}
                aria-label="More people"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 transition active:scale-90 disabled:opacity-30"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <span className="mt-1.5 flex gap-1" aria-hidden>
              {Array.from({ length: MAX_GROUP_SIZE }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full transition ${i < size ? 'bg-brand-500' : 'bg-neutral-200'}`} />
              ))}
            </span>
          </div>

          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" loading={busy}>
            Create group
          </Button>
        </form>
      )}
    </>
  )
}
