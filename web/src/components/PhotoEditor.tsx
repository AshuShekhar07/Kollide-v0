import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { friendlyError } from '../lib/errors'
import { compressImage } from '../lib/image'
import { signedPhotoUrls } from '../lib/photos'
import { supabase } from '../lib/supabase'
import type { Photo } from '../lib/types'
import { ErrorText } from './ui'

export const MIN_PHOTOS = 2
export const MAX_PHOTOS = 6

// Add, remove and reorder your own photos (onboarding and Profile). RLS
// limits writes to your own folder and rows; the database keeps you at 2+
// photos once onboarded.
export default function PhotoEditor({
  uid,
  photos,
  reload,
  onBusyChange,
}: {
  uid: string
  photos: Photo[]
  reload: () => Promise<void>
  onBusyChange?: (busy: boolean) => void
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const [busy, setBusyState] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  function setBusy(b: string | null) {
    setBusyState(b)
    onBusyChange?.(!!b)
  }

  useEffect(() => {
    const missing = photos.filter((p) => !(p.storage_path in urls))
    if (!missing.length) return
    signedPhotoUrls(missing.map((p) => p.storage_path)).then((signed) =>
      setUrls((cur) => ({ ...cur, ...Object.fromEntries(missing.map((p, i) => [p.storage_path, signed[i]])) })),
    )
  }, [photos, urls])

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    const slots = MAX_PHOTOS - photos.length
    const picked = Array.from(files).slice(0, slots)
    if (files.length > slots) setError(`You can have up to ${MAX_PHOTOS} photos.`)

    const used = new Set(photos.map((p) => p.position))
    setBusy('upload')
    try {
      for (const file of picked) {
        const position = [0, 1, 2, 3, 4, 5].find((n) => !used.has(n))
        if (position === undefined) break
        const blob = await compressImage(file)
        const path = `${uid}/${crypto.randomUUID()}.jpg`
        const up = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
        if (up.error) throw up.error
        const ins = await supabase.from('photos').insert({ user_id: uid, storage_path: path, position })
        if (ins.error) {
          await supabase.storage.from('photos').remove([path])
          throw ins.error
        }
        used.add(position)
      }
    } catch (e) {
      setError(e instanceof Error && !('code' in e) ? e.message : friendlyError(e, 'Upload failed. Please try again.'))
    } finally {
      await reload()
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function remove(id: string, path: string) {
    setError('')
    setBusy(id)
    const { error } = await supabase.from('photos').delete().eq('id', id)
    if (error) {
      setError(friendlyError(error))
    } else {
      await supabase.storage.from('photos').remove([path])
      const rest = photos.filter((p) => p.id !== id).map((p) => p.id)
      if (rest.length) await supabase.rpc('reorder_photos', { p_ids: rest })
    }
    await reload()
    setBusy(null)
  }

  async function move(index: number, delta: number) {
    const order = photos.map((p) => p.id)
    const target = index + delta
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    setBusy('reorder')
    const { error } = await supabase.rpc('reorder_photos', { p_ids: order })
    if (error) setError(friendlyError(error))
    await reload()
    setBusy(null)
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <li
            key={p.id}
            className={`relative aspect-[3/4] animate-rise overflow-hidden rounded-2xl bg-neutral-100 shadow-sm ${
              i === 0 ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas' : ''
            }`}
          >
            {urls[p.storage_path] ? (
              <img src={urls[p.storage_path]!} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            ) : (
              <span className="skeleton block h-full w-full" />
            )}
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-plum-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                <Star className="h-2.5 w-2.5 fill-current" /> Main
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/50 to-transparent p-1.5 pt-6">
              <button
                type="button"
                aria-label="Move earlier"
                disabled={!!busy || i === 0}
                onClick={() => move(i, -1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-plum-950 shadow transition active:scale-90 disabled:opacity-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Remove photo"
                disabled={!!busy}
                onClick={() => remove(p.id, p.storage_path)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow transition active:scale-90"
              >
                <X className="h-4 w-4" strokeWidth={2.6} />
              </button>
              <button
                type="button"
                aria-label="Move later"
                disabled={!!busy || i === photos.length - 1}
                onClick={() => move(i, 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-plum-950 shadow transition active:scale-90 disabled:opacity-0"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!!busy}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 text-brand-700 transition hover:border-brand-500 active:scale-[0.97] disabled:opacity-50"
            >
              {busy === 'upload' ? (
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-600/30">
                  <ImagePlus className="h-5 w-5" />
                </span>
              )}
              <span className="text-xs font-semibold">{busy === 'upload' ? 'Uploading…' : 'Add photo'}</span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
