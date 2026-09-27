import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sheet } from '../components/SafetyDialogs'
import { Button, ErrorText, Spinner, inputClass } from '../components/ui'
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
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-neutral-800">Blocked people</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Unblocking lets you see each other in Discover again. Chats that closed stay closed.
      </p>
      <div className="mt-2">
        <ErrorText>{error}</ErrorText>
      </div>
      {!people && !error && <Spinner />}
      {people?.length === 0 && <p className="mt-2 text-sm text-neutral-500">You haven't blocked anyone.</p>}
      {people && people.length > 0 && (
        <ul className="mt-2 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
          {people.map((p) => (
            <li key={p.user_id} className="flex items-center gap-3 px-3 py-2.5">
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
    </section>
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
      <Link to="/profile" className="text-sm font-semibold text-brand-700">
        ← Profile
      </Link>
      <h1 className="mt-3 text-lg font-bold text-neutral-900">Settings</h1>

      <BlockedList />

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-neutral-800">Your data</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Read what we collect and how long we keep it in our{' '}
          <Link to="/privacy" className="font-semibold text-brand-700 underline">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/terms" className="font-semibold text-brand-700 underline">
            Terms
          </Link>
          .
        </p>
      </section>

      <div className="mt-8 space-y-3">
        <Button variant="secondary" className="w-full" onClick={signOut}>
          Sign out
        </Button>
        <Button variant="ghost" className="w-full text-red-700 hover:bg-red-50" onClick={() => setDeleting(true)}>
          Delete account
        </Button>
      </div>

      {deleting && <DeleteAccount onClose={() => setDeleting(false)} />}
    </>
  )
}
