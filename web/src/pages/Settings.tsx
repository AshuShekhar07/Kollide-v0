import { ChevronRight, FileText, Lock, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { BackLink } from '../components/BackLink'
import { Sheet } from '../components/SafetyDialogs'
import { Button, ErrorText, Section, Spinner, inputClass } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import type { Database } from '../lib/database.types'
import { friendlyError, functionError } from '../lib/errors'
import { supabase } from '../lib/supabase'

type Blocked = Database['public']['Functions']['get_blocked_users']['Returns'][number]

function BlockedList() {
  const [people, setPeople] = useState<Blocked[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_blocked_users')
    if (error) return setError(friendlyError(error))
    setPeople(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function unblock(id: string) {
    setBusy(id)
    setError('')
    const { error } = await supabase.rpc('unblock_user', { p_target_id: id })
    setBusy(null)
    if (error) return setError(friendlyError(error))
    setPeople((p) => p?.filter((x) => x.user_id !== id) ?? null)
  }

  return (
    <Section title="Blocked people" hint="Unblocking lets you see each other in Discover again. Chats that closed stay closed.">
      <ErrorText>{error}</ErrorText>
      {!people && !error && <Spinner />}
      {people?.length === 0 && (
        <p className="flex items-center gap-2 rounded-3xl border border-dashed border-neutral-200 px-4 py-4 text-sm text-neutral-500">
          <ShieldCheck className="h-4 w-4" /> You haven't blocked anyone.
        </p>
      )}
      {people && people.length > 0 && (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-3xl border border-neutral-200/80 bg-surface shadow-sm">
          {people.map((p) => (
            <li key={p.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar path={null} name={p.first_name ?? 'K'} className="h-10 w-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-neutral-900">{p.first_name ?? 'Kollide user'}</span>
                <span className="block font-mono text-xs text-neutral-500">{p.public_code}</span>
              </span>
              <Button
                variant="secondary"
                className="px-4 py-2 text-sm"
                loading={busy === p.user_id}
                disabled={!!busy}
                onClick={() => unblock(p.user_id)}
              >
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function DeleteAccount({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    setBusy(true)
    setError('')
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirm } })
    if (error) {
      setBusy(false)
      return setError(await functionError(error))
    }
    // The session belongs to a user that no longer exists; just drop it locally.
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/', { replace: true })
  }

  return (
    <Sheet label="Delete account" onClose={onClose}>
      <h2 className="text-lg font-bold text-neutral-900">Delete your account?</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
        <li>Your profile, photos, likes, matches and chats are deleted. This can't be undone.</li>
        <li>If you run a group, the longest-standing member takes over.</li>
        <li>
          Reports you made or that were made about you are kept for safety, as our{' '}
          <Link to="/privacy" className="font-semibold text-brand-700 underline">
            Privacy Policy
          </Link>{' '}
          explains.
        </li>
      </ul>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-neutral-800">Type DELETE to confirm</span>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" className={inputClass} />
      </label>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" className="flex-1" onClick={remove} loading={busy} disabled={confirm !== 'DELETE'}>
          Delete account
        </Button>
      </div>
    </Sheet>
  )
}

export default function Settings() {
  const { signOut } = useAuth()
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <BackLink to="/profile">Profile</BackLink>
      <h1 className="mt-3 text-2xl font-bold text-neutral-900">Settings</h1>

      <BlockedList />

      <Section title="Your data" hint="What we collect and how long we keep it.">
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-3xl border border-neutral-200/80 bg-surface shadow-sm">
          {[
            { to: '/privacy', label: 'Privacy Policy', icon: Lock },
            { to: '/terms', label: 'Terms of Service', icon: FileText },
          ].map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="flex items-center gap-3 px-4 py-3.5 font-semibold text-neutral-800 hover:bg-neutral-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100">
                  <l.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1">{l.label}</span>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-8 space-y-2">
        <Button variant="secondary" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
        <Button variant="ghost" className="w-full !text-red-700 hover:!bg-red-50" onClick={() => setDeleting(true)}>
          <Trash2 className="h-4 w-4" /> Delete account
        </Button>
      </div>

      {deleting && <DeleteAccount onClose={() => setDeleting(false)} />}
    </>
  )
}
