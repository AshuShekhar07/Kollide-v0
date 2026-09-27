import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import BangaloreCheck from '../../components/BangaloreCheck'
import { ErrorText, FullScreenSpinner } from '../../components/ui'
import { homePathFor, useAuth } from '../../lib/auth-context'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { Activity, Photo, Profile, ProfilePrivate } from '../../lib/types'
import AboutStep from './AboutStep'
import ActivitiesStep from './ActivitiesStep'
import BasicsStep from './BasicsStep'
import ContactStep from './ContactStep'
import PhotosStep from './PhotosStep'
import VideoStep from './VideoStep'

export type VideoSummary = { status: string; reject_reason: string | null; created_at: string }

export type OnboardingData = {
  profile: Profile
  contact: Pick<ProfilePrivate, 'phone' | 'socials'> | null
  photos: Photo[]
  activities: Activity[]
  selectedActivityIds: string[]
  videos: VideoSummary[]
}

export type StepProps = {
  data: OnboardingData
  reload: () => Promise<void>
  onNext: () => void
  onBack?: () => void
}

const STEPS = ['Basics', 'Photos', 'About', 'Contact', 'Activities', 'Verify'] as const
const VERIFY = STEPS.length - 1

function firstIncompleteStep(d: OnboardingData): number {
  const p = d.profile
  if (!p.first_name || !p.dob || !p.gender || !p.seeking || !p.gender_preference?.length || !p.consent_at) return 0
  if (d.photos.length < 2) return 1
  if ((p.bio ?? '').trim().length < 10) return 2
  if (!d.contact?.phone || !Object.keys((d.contact.socials as object) ?? {}).length) return 3
  if (!p.onboarding_complete) return 4
  return VERIFY
}

export default function Onboarding() {
  const { profile, refreshProfile } = useAuth()
  const [data, setData] = useState<OnboardingData | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [error, setError] = useState('')

  const uid = profile?.id

  const load = useCallback(async () => {
    if (!uid) return
    const [own, contact, photos, activities, selected, videos] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('profile_private').select('phone, socials').eq('user_id', uid).maybeSingle(),
      supabase.from('photos').select('*').eq('user_id', uid).order('position'),
      supabase.from('activities').select('*').order('sort_order'),
      supabase.from('user_activities').select('activity_id').eq('user_id', uid),
      supabase
        .from('verification_videos')
        .select('status, reject_reason, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false }),
    ])
    const failed = [own, contact, photos, activities, selected, videos].find((r) => r.error)
    if (failed?.error || !own.data) {
      setError(friendlyError(failed?.error))
      return
    }
    setData({
      profile: own.data,
      contact: contact.data,
      photos: photos.data ?? [],
      activities: activities.data ?? [],
      selectedActivityIds: (selected.data ?? []).map((r) => r.activity_id),
      videos: (videos.data ?? []) as VideoSummary[],
    })
  }, [uid])

  useEffect(() => {
    load()
  }, [load])

  // Jump to the first unfinished step on first load only.
  useEffect(() => {
    if (data && step === null) setStep(firstIncompleteStep(data))
  }, [data, step])

  // Refresh step data, and the shared auth profile so route guards see changes.
  const reload = useCallback(async () => {
    await Promise.all([load(), refreshProfile()])
  }, [load, refreshProfile])

  if (profile && homePathFor(profile) === '/discover') return <Navigate to="/discover" replace />
  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <ErrorText>{error}</ErrorText>
      </main>
    )
  }
  if (!data || step === null) return <FullScreenSpinner />

  // Steps before "Verify" are locked once onboarding is complete.
  const locked = data.profile.onboarding_complete
  const current = locked ? VERIFY : step
  const props: StepProps = {
    data,
    reload,
    onNext: () => setStep((s) => Math.min((s ?? 0) + 1, VERIFY)),
    onBack: current > 0 && !locked ? () => setStep((s) => Math.max((s ?? 0) - 1, 0)) : undefined,
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-16 pt-6">
      <header>
        <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide</span>
        <ol className="mt-4 flex gap-1.5" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <span className={`block h-1.5 rounded-full ${i <= current ? 'bg-brand-600' : 'bg-neutral-200'}`} />
              <span className={`mt-1 block text-[11px] ${i === current ? 'font-semibold text-brand-700' : 'text-neutral-400'}`}>
                {label}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <div className="mt-6">
        <BangaloreCheck />
      </div>
      <div className="mt-2">
        {current === 0 && <BasicsStep {...props} />}
        {current === 1 && <PhotosStep {...props} />}
        {current === 2 && <AboutStep {...props} />}
        {current === 3 && <ContactStep {...props} />}
        {current === 4 && <ActivitiesStep {...props} />}
        {current === VERIFY && <VideoStep {...props} />}
      </div>
    </main>
  )
}
