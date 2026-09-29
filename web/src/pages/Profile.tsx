import { BadgeCheck, Check, ChevronRight, Eye, Hourglass, LogOut, Settings } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AboutEditor from '../components/AboutEditor'
import Avatar from '../components/Avatar'
import PhotoEditor from '../components/PhotoEditor'
import ProfileStack from '../components/ProfileStack'
import { Sheet } from '../components/SafetyDialogs'
import { Button, Card, Choice, ErrorText, Section, Spinner, Tag } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { friendlyError } from '../lib/errors'
import { GENDERS, PREFERENCE_LABELS, SEEKING_OPTIONS } from '../lib/profile-options'
import { supabase } from '../lib/supabase'
import type { Gender, Photo, Seeking } from '../lib/types'

function ageFrom(dob: string | null) {
  if (!dob) return 0
  const [y, m, d] = dob.split('-').map(Number)
  const now = new Date()
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0)
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  to,
  danger,
}: {
  icon: typeof Settings
  label: string
  onClick?: () => void
  to?: string
  danger?: boolean
}) {
  const cls = `flex w-full items-center gap-3 px-4 py-3.5 text-left font-semibold transition hover:bg-neutral-50 ${danger ? 'text-red-700' : 'text-neutral-800'}`
  const body = (
    <>
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-2xl ${danger ? 'bg-red-50' : 'bg-marigold-100 text-marigold-800'}`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="flex-1">{label}</span>
      {!danger && <ChevronRight className="h-4 w-4 text-neutral-400" />}
    </>
  )
  return (
    <li>
      {to ? (
        <Link to={to} className={cls}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {body}
        </button>
      )}
    </li>
  )
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [seeking, setSeeking] = useState<Seeking | null>(profile?.seeking ?? null)
  const [prefs, setPrefs] = useState<Gender[]>(profile?.gender_preference ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const uid = profile?.id

  const loadPhotos = useCallback(async () => {
    if (!uid) return
    const { data } = await supabase.from('photos').select('*').eq('user_id', uid).order('position')
    setPhotos(data ?? [])
  }, [uid])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  if (!profile) return null
  const verified = profile.verification_status === 'approved'
  const mainPath = photos?.[0]?.storage_path ?? null
  const dirty =
    seeking !== profile.seeking || [...prefs].sort().join() !== [...(profile.gender_preference ?? [])].sort().join()

  function togglePref(g: Gender) {
    setSaved(false)
    setPrefs((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!seeking) return setError("Please choose what you're looking for.")
    if (!prefs.length) return setError("Please choose who you'd like to meet.")
    setSaving(true)
    const { error } = await supabase.rpc('update_preferences', { p_seeking: seeking, p_gender_preference: prefs })
    if (!error) await refreshProfile()
    setSaving(false)
    if (error) return setError(friendlyError(error))
    setSaved(true)
  }

  const menu = (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-neutral-100">
        <MenuRow icon={Settings} label="Settings and privacy" to="/settings" />
        <MenuRow icon={LogOut} label="Sign out" onClick={signOut} danger />
      </ul>
    </Card>
  )

  return (
    <div className="lg:grid lg:grid-cols-[18rem_1fr] lg:items-start lg:gap-12">
      {/* Identity (and, on desktop, the menu) sits in a sticky left column. */}
      <div className="space-y-4 lg:sticky lg:top-10">
        <div className="bandhani-soft relative overflow-hidden rounded-[32px] bg-maroon-700 p-5 text-cream shadow-xl shadow-maroon-950/15">
          <div className="relative flex items-center gap-4 lg:flex-col lg:items-start">
            <Avatar
              path={mainPath}
              name={profile.first_name ?? ''}
              className="h-20 w-20 rotate-[-4deg] !rounded-[1.6rem] text-3xl ring-4 ring-marigold-400 lg:h-28 lg:w-28"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[2.2rem] font-extrabold leading-none tracking-[-0.04em]">{profile.first_name}</h1>
              <div className="mt-2">
                {verified ? (
                  <Tag tone="haldi">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </Tag>
                ) : (
                  <Tag tone="glass">
                    <Hourglass className="h-3.5 w-3.5" /> Verification pending
                  </Tag>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="marigold"
            className="relative mt-5 w-full py-2.5 text-sm"
            disabled={!photos?.length}
            onClick={() => setPreviewing(true)}
          >
            <Eye className="h-4 w-4" /> See how others see you
          </Button>
        </div>
        <div className="hidden lg:block">{menu}</div>
      </div>

      <div className="lg:[&>section:first-child]:mt-0">
        <Section
          title="Your photos"
          hint={
            <>
              2–6 photos of you; the first is your main one. Drag to reorder them.
              {verified && ' New photos are checked by our team against your verification video.'}
            </>
          }
        >
          {photos ? <PhotoEditor uid={profile.id} photos={photos} reload={loadPhotos} /> : <Spinner />}
        </Section>

        <Section title="About you" hint="Shown on your profile card.">
          <Card className="p-4">
            <AboutEditor uid={profile.id} bio={profile.bio} submitLabel="Save about you" onSaved={refreshProfile} />
          </Card>
        </Section>

        <Section title="Preferences">
          <Card className="p-4">
            <form onSubmit={save} className="space-y-6">
              <fieldset>
                <legend className="mb-1 text-sm font-semibold text-neutral-800">I'm looking for</legend>
                <p className="mb-2 text-xs text-neutral-500">You'll see people who picked the same option.</p>
                <div className="grid grid-cols-2 gap-2">
                  {SEEKING_OPTIONS.map((o) => (
                    <Choice
                      key={o.value}
                      name="seeking"
                      checked={seeking === o.value}
                      onChange={() => {
                        setSaved(false)
                        setSeeking(o.value)
                      }}
                    >
                      {o.label}
                    </Choice>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-neutral-800">I'd like to meet</legend>
                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map((g) => (
                    <Choice
                      key={g.value}
                      type="checkbox"
                      checked={prefs.includes(g.value)}
                      onChange={() => togglePref(g.value)}
                    >
                      {PREFERENCE_LABELS[g.value]}
                    </Choice>
                  ))}
                </div>
              </fieldset>

              <ErrorText>{error}</ErrorText>
              <Button type="submit" className="w-full" loading={saving} disabled={!dirty}>
                {saved && !dirty ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={3} /> Saved
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </form>
          </Card>
        </Section>

        <div className="mt-8 lg:hidden">{menu}</div>
      </div>

      {previewing && photos && (
        <Sheet label="Your profile preview" onClose={() => setPreviewing(false)}>
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-brand-500">
            How others see you
          </p>
          <ProfileStack
            profile={{
              first_name: profile.first_name ?? '',
              age: ageFrom(profile.dob),
              bio: profile.bio,
              photo_paths: photos.map((p) => p.storage_path),
            }}
            userId={profile.id}
          />
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setPreviewing(false)}>
            Close
          </Button>
        </Sheet>
      )}
    </div>
  )
}
