import { useState } from 'react'
import AdminNav from '../../components/AdminNav'
import { Button, ErrorText, Spinner } from '../../components/ui'
import { REASON_LABELS } from '../../lib/chat'
import type { Database } from '../../lib/database.types'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

type Ban = Database['public']['Functions']['admin_bans']['Returns'][number]

// Banned identifiers are personal data: loading them is logged, so it only
// happens on a click.
export default function AdminBans() {
  const [bans, setBans] = useState<Ban[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.rpc('admin_bans')
    setLoading(false)
    if (error) return setError(friendlyError(error))
    setBans(data)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide admin</span>
          <h1 className="text-2xl font-bold text-neutral-900">Bans</h1>
        </div>
        <AdminNav />
      </header>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>
      {!bans && (
        <div className="mt-10 text-center">
          <p className="text-sm text-neutral-600">The ban list contains emails, phone numbers and handles. Viewing it is logged.</p>
          <Button className="mt-4" onClick={load} loading={loading}>
            Show ban list
          </Button>
        </div>
      )}
      {loading && bans && <Spinner />}
      {bans?.length === 0 && <p className="mt-16 text-center text-neutral-500">No bans.</p>}
      {bans && bans.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Value</th>
                <th className="px-4 py-2">Person</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Banned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bans.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 capitalize">{b.kind}</td>
                  <td className="px-4 py-2 font-mono">{b.value}</td>
                  <td className="px-4 py-2">{b.banned_name ? `${b.banned_name} ${b.banned_code ?? ''}` : '—'}</td>
                  <td className="px-4 py-2">{b.report_reason ? REASON_LABELS[b.report_reason] : '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
