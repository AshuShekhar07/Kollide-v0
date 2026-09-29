import { useEffect, useState, type ReactNode } from 'react'
import { fetchAnswers, type ShownAnswer } from '../lib/about'
import { SOCIALS, type Contact } from '../lib/discovery'
import { friendlyError } from '../lib/errors'
import { PREFERENCE_LABELS, SEEKING_OPTIONS } from '../lib/profile-options'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useSignedPhotos } from './ProfileCard'
import { ErrorText, Spinner } from './ui'

type Loaded = {
  profile: Profile
  fullName: string | null
  email: string | null
  socials: Contact
  photoPaths: string[]
  nights: string[]
  answers: ShownAnswer[]
}

const STATUS_STYLES: Record<Profile['verification_status'], string> = {
  unsubmitted: 'bg-neutral-100 text-neutral-700',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

function ageFrom(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0)
}

// Everything about one user, read straight from the tables (admins pass RLS
// on profiles, profile_private, photos, user_activities and answers).
async function loadProfile(userId: string): Promise<Loaded> {
  const [profile, priv, photos, nights, answers] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('profile_private').select('full_name, email, socials').eq('user_id', userId).maybeSingle(),
    supabase.from('photos').select('storage_path').eq('user_id', userId).order('position'),
    supabase.from('user_activities').select('activities(name)').eq('user_id', userId),
    fetchAnswers(userId),
  ])
  if (profile.error) throw profile.error
  const error = priv.error ?? photos.error ?? nights.error
  if (error) throw error
  return {
    profile: profile.data,
    fullName: priv.data?.full_name ?? null,
    email: priv.data?.email ?? null,
    socials: (priv.data?.socials ?? {}) as Contact,
    photoPaths: (photos.data ?? []).map((p) => p.storage_path),
    nights: (nights.data ?? []).map((n) => n.activities.name),
    answers,
  }
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  )
}

function Missing({ children }: { children: ReactNode }) {
  return <p className="text-sm italic text-neutral-400">{children}</p>
}

/**
 * A user's whole profile for moderation: details, intro, answered questions
 * and social handles. `embedded` leaves out the name line and photos, for
 * a caller that already shows them.
 * Everything the user wrote is shown as plain text so nothing gets hidden
 * by styling.
 */
export default function AdminProfile({ userId, embedded = false }: { userId: string; embedded?: boolean }) {
  const [state, setState] = useState<{ userId: string; data?: Loaded; error?: string } | null>(null)
  const current = state?.userId === userId ? state : null

  useEffect(() => {
    let cancelled = false
    loadProfile(userId).then(
      (data) => !cancelled && setState({ userId, data }),
      (error) => !cancelled && setState({ userId, error: friendlyError(error) }),
    )
    return () => {
      cancelled = true
    }
  }, [userId])

  const photoUrls = useSignedPhotos(embedded ? [] : (current?.data?.photoPaths ?? []))

  if (current?.error) return <ErrorText>{current.error}</ErrorText>
  if (!current?.data) return <Spinner />

  const { profile: p, fullName, email, socials, nights, answers } = current.data
  const age = ageFrom(p.dob)
  const handles = SOCIALS.filter((s) => socials[s.key])
  const details: [string, ReactNode][] = [
    ['Full name', fullName],
    ['Email', email],
    ['Age', age],
    ['Gender', p.gender && p.gender.replace('_', '-')],
    ['Looking for', SEEKING_OPTIONS.find((o) => o.value === p.seeking)?.short],
    ['Interested in', p.gender_preference?.map((g) => PREFERENCE_LABELS[g]).join(', ')],
    ['Garba nights', nights.join(', ')],
    ['Joined', new Date(p.created_at).toLocaleDateString()],
  ]

  return (
    <div className="space-y-5">
      {!embedded && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-neutral-900">
              {p.first_name ?? 'No name yet'}
              {age !== null && `, ${age}`}
            </h2>
            <span className="font-mono text-sm text-neutral-500">{p.public_code}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[p.verification_status]}`}>
              {p.verification_status}
            </span>
            {p.is_banned && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Banned</span>}
            {!p.onboarding_complete && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">Onboarding not finished</span>
            )}
          </div>

          {photoUrls.length ? (
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {photoUrls.map((url, i) => (
                <li key={i} className="aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:w-36">
                  {url && <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />}
                </li>
              ))}
            </ul>
          ) : (
            <Missing>No photos</Missing>
          )}
        </>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="break-words text-neutral-900">{value || <span className="text-neutral-400">-</span>}</dd>
          </div>
        ))}
      </dl>

      <Block title="Intro">
        {p.bio ? (
          <p className="whitespace-pre-wrap break-words rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-900">{p.bio}</p>
        ) : (
          <Missing>No intro written</Missing>
        )}
      </Block>

      <Block title={`Answered questions (${answers.length})`}>
        {answers.length ? (
          <ul className="space-y-2">
            {answers.map((a) => (
              <li key={a.prompt_key} className="rounded-xl bg-neutral-50 px-4 py-3">
                <p className="text-xs font-semibold text-neutral-500">{a.question}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-900">{a.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Missing>No questions answered</Missing>
        )}
      </Block>

      <Block title="Socials">
        {handles.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {handles.map((s) => (
              <div key={s.key} className="contents">
                <dt className="text-neutral-500">{s.label}</dt>
                <dd className="break-all font-mono text-neutral-900">{socials[s.key]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Missing>No socials added</Missing>
        )}
      </Block>
    </div>
  )
}
