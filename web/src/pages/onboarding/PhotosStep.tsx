import { useEffect, useRef, useState } from 'react'
import { Button, ErrorText } from '../../components/ui'
import { friendlyError } from '../../lib/errors'
import { compressImage } from '../../lib/image'
import { signedPhotoUrls } from '../../lib/photos'
import { supabase } from '../../lib/supabase'
import type { StepProps } from './Onboarding'

const MIN = 2
const MAX = 6

export default function PhotosStep({ data, reload, onNext, onBack }: StepProps) {
  const photos = data.photos
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const uid = data.profile.id

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
    const slots = MAX - photos.length
    const picked = Array.from(files).slice(0, slots)
    if (files.length > slots) setError(`You can have up to ${MAX} photos.`)

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Add your photos</h1>
        <p className="mt-1 text-neutral-600">
          Add {MIN}–{MAX} clear photos of yourself. The first one is your main photo. Our team compares them with your
          verification video.
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <li key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-100">
            {urls[p.storage_path] ? (
              <img src={urls[p.storage_path]!} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-xs text-neutral-400">Loading…</span>
            )}
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                Main
              </span>
            )}
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button
                type="button"
                aria-label="Move earlier"
                disabled={!!busy || i === 0}
                onClick={() => move(i, -1)}
                className="h-7 w-7 rounded-full bg-white/90 text-sm shadow disabled:opacity-0"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Remove photo"
                disabled={!!busy}
                onClick={() => remove(p.id, p.storage_path)}
                className="h-7 w-7 rounded-full bg-white/90 text-sm shadow"
              >
                ✕
              </button>
              <button
                type="button"
                aria-label="Move later"
                disabled={!!busy || i === photos.length - 1}
                onClick={() => move(i, 1)}
                className="h-7 w-7 rounded-full bg-white/90 text-sm shadow disabled:opacity-0"
              >
                →
              </button>
            </div>
          </li>
        ))}
        {photos.length < MAX && (
          <li>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!!busy}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
            >
              <span className="text-3xl leading-none">+</span>
              <span className="mt-1 text-xs">{busy === 'upload' ? 'Uploading…' : 'Add photo'}</span>
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
      <div className="flex gap-3">
        {onBack && (
          <Button variant="secondary" onClick={onBack} disabled={!!busy}>
            Back
          </Button>
        )}
        <Button className="flex-1" onClick={onNext} disabled={photos.length < MIN || !!busy}>
          {photos.length < MIN ? `Add ${MIN - photos.length} more` : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
