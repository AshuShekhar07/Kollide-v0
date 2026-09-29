import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminNav from '../../components/AdminNav'
import AdminProfile from '../../components/AdminProfile'
import { ErrorText, Spinner, inputClass } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

type Row = Pick<Profile, 'id' | 'first_name' | 'public_code' | 'verification_status' | 'is_banned'>

const LIMIT = 100
const CODE_RE = /^[a-hj-np-z]{3}[2-9]{3}$/i

// Newest first; the search matches a public code, an email, or part of a first name.
async function search(q: string): Promise<Row[]> {
  let query = supabase
    .from('profiles')
    .select('id, first_name, public_code, verification_status, is_banned')
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (CODE_RE.test(q)) query = query.eq('public_code', q.toUpperCase())
  else if (q.includes('@')) {
    const { data, error } = await supabase.from('profile_private').select('user_id').ilike('email', `%${escapeLike(q)}%`).limit(LIMIT)
    if (error) throw error
    query = query.in('id', data.map((d) => d.user_id))
  } else if (q) query = query.ilike('first_name', `%${escapeLike(q)}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

function escapeLike(s: string) {
  return s.replace(/[%_\\]/g, '\\$&')
}

// Look anyone up and read their whole profile, e.g. to check an intro or
// answer they changed after verification.
export default function AdminProfiles() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('id')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      search(q.trim()).then(
        (data) => {
          if (cancelled) return
          setError('')
          setRows(data)
        },
        (e) => !cancelled && setError(friendlyError(e)),
      )
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide admin</span>
          <h1 className="text-2xl font-bold text-neutral-900">Profiles</h1>
        </div>
        <AdminNav />
      </header>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code or email"
            aria-label="Search profiles"
            className={inputClass}
          />
          {!rows && !error && <Spinner />}
          {rows?.length === 0 && <p className="text-sm text-neutral-500">No one matches.</p>}
          {rows && rows.length > 0 && (
            <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setParams({ id: r.id })}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                      r.id === selected ? 'bg-brand-50 font-semibold text-brand-800' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <span className="truncate">
                      {r.first_name ?? 'No name yet'} <span className="font-mono text-xs text-neutral-500">{r.public_code}</span>
                    </span>
                    <span className="shrink-0 text-xs capitalize text-neutral-500">{r.is_banned ? 'banned' : r.verification_status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rows?.length === LIMIT && <p className="text-xs text-neutral-500">Showing the newest {LIMIT}. Search to narrow it down.</p>}
        </div>

        {selected ? (
          <AdminProfile key={selected} userId={selected} />
        ) : (
          <p className="mt-10 text-center text-neutral-500">Pick someone to see their full profile.</p>
        )}
      </div>
    </main>
  )
}
