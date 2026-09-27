import { useCallback, useEffect, useState } from 'react'
import AdminNav from '../../components/AdminNav'
import { useSignedPhotos } from '../../components/ProfileCard'
import { Button, ErrorText, Spinner } from '../../components/ui'
import type { Database } from '../../lib/database.types'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

type NewPhoto = Database['public']['Functions']['admin_new_photos']['Returns'][number]

function Thumb({ url, label, highlight }: { url: string | null; label: string; highlight?: boolean }) {
  return (
    <figure className={`overflow-hidden rounded-xl ${highlight ? 'ring-4 ring-amber-400' : ''}`}>
      <div className="aspect-[3/4] w-28 bg-neutral-100 sm:w-36">
        {url && <img src={url} alt={label} className="h-full w-full object-cover" />}
      </div>
      <figcaption className={`px-2 py-1 text-center text-[11px] font-semibold ${highlight ? 'bg-amber-400 text-amber-950' : 'bg-neutral-100 text-neutral-500'}`}>
        {label}
      </figcaption>
    </figure>
  )
}

function Row({ item, onDone }: { item: NewPhoto; onDone: () => void }) {
  const [newUrl] = useSignedPhotos([item.storage_path])
  const verified = useSignedPhotos(item.verified_paths)
  const [busy, setBusy] = useState<'keep' | 'remove' | null>(null)
  const [error, setError] = useState('')

  async function review(keep: boolean) {
    setBusy(keep ? 'keep' : 'remove')
    setError('')
    const { data: path, error } = await supabase.rpc('admin_review_photo', { p_photo_id: item.photo_id, p_keep: keep })
    if (!error && path) await supabase.storage.from('photos').remove([path])
    setBusy(null)
    if (error) return setError(friendlyError(error))
    onDone()
  }

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="font-semibold text-neutral-900">
        {item.first_name} <span className="font-mono text-xs font-normal text-neutral-500">{item.public_code}</span>
      </p>
      <p className="text-xs text-neutral-500">
        Added {new Date(item.added_at).toLocaleString()} · verified {new Date(item.verified_at).toLocaleDateString()}
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Thumb url={newUrl ?? null} label="New" highlight />
        {verified.map((u, i) => (
          <Thumb key={i} url={u} label="Verified" />
        ))}
      </div>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="mt-3 flex gap-3">
        <Button variant="danger" className="px-4 py-2 text-sm" onClick={() => review(false)} loading={busy === 'remove'} disabled={!!busy}>
          Remove photo
        </Button>
        <Button variant="secondary" className="px-4 py-2 text-sm" onClick={() => review(true)} loading={busy === 'keep'} disabled={!!busy}>
          Looks fine
        </Button>
      </div>
    </li>
  )
}

// Photos verified users added after verification: same person as the
// verified photos? Remove anything that isn't them.
export default function AdminPhotos() {
  const [items, setItems] = useState<NewPhoto[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_new_photos')
    if (error) return setError(friendlyError(error))
    setItems(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide admin</span>
          <h1 className="text-2xl font-bold text-neutral-900">New photos</h1>
        </div>
        <div className="flex items-center gap-3">
          <AdminNav />
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={load}>
            Refresh
          </Button>
        </div>
      </header>
      <p className="mt-2 text-sm text-neutral-600">
        Photos added after verification are live already. Check each one shows the same person as their verified photos.
      </p>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>
      {!items && !error && <Spinner />}
      {items?.length === 0 && <p className="mt-16 text-center text-neutral-500">No new photos to check.</p>}
      {items && items.length > 0 && (
        <ul className="mt-4 space-y-4">
          {items.map((it) => (
            <Row key={it.photo_id} item={it} onDone={() => setItems((cur) => cur?.filter((x) => x.photo_id !== it.photo_id) ?? null)} />
          ))}
        </ul>
      )}
    </main>
  )
}
