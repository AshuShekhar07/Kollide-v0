import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { friendlyError } from '../lib/errors'
import { processPhoto } from '../lib/image'
import { signedPhotoUrls, thumbPath } from '../lib/photos'
import { supabase } from '../lib/supabase'
import type { Photo } from '../lib/types'
import { ErrorText } from './ui'

export const MIN_PHOTOS = 2
export const MAX_PHOTOS = 6

// Best-effort removal of files from a failed upload. It isn't awaited, and is
// tried again a few seconds later: right after a rejected upload the first
// Storage request can stall on a dead connection (seen against local Kong),
// and a stray thumbnail would count against the 12-object folder cap. Removing
// twice is harmless, and the hourly orphan sweep catches anything still left.
function discard(paths: string[]) {
  const remove = () => void supabase.storage.from('photos').remove(paths).catch(() => {})
  remove()
  window.setTimeout(remove, 3000)
}

// A drag in flight. The tile itself stays in the grid as a gap; what follows
// the pointer is a fixed-position copy, so nothing depends on the grid's
// layout while the order changes underneath.
type Drag = { id: string; w: number; h: number; grabX: number; grabY: number; x: number; y: number }

// A press that may still become a drag. A mouse starts dragging as soon as it
// moves; a finger has to hold still first, otherwise the touch is a page
// scroll and we let it through.
type Pending = { id: string; pointerId: number; x: number; y: number; touch: boolean; timer?: number }

const HOLD_MS = 220
const MOUSE_SLOP = 5
const TOUCH_SLOP = 10

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

  // The order shown while a drag is in flight, so tiles rearrange under the
  // pointer before the save round-trips. It is tagged with the `photos` array
  // it was derived from, so a reload silently supersedes it.
  const [order, setOrder] = useState<{ base: Photo[]; list: Photo[] } | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const tiles = useRef(new Map<string, HTMLLIElement>())
  const pending = useRef<Pending | null>(null)
  const dragId = useRef<string | null>(null)
  const unblockScroll = useRef<(() => void) | null>(null)

  const list = order?.base === photos ? order.list : photos
  // Read by pointer handlers, which must see the order as it is mid-drag.
  const listRef = useRef(list)

  function setBusy(b: string | null) {
    setBusyState(b)
    onBusyChange?.(!!b)
  }

  useEffect(() => {
    listRef.current = list
  }, [list])

  useEffect(() => {
    const missing = photos.filter((p) => !(p.storage_path in urls))
    if (!missing.length) return
    signedPhotoUrls(missing.map((p) => p.storage_path)).then((signed) =>
      setUrls((cur) => ({ ...cur, ...Object.fromEntries(missing.map((p, i) => [p.storage_path, signed[i]])) })),
    )
  }, [photos, urls])

  useEffect(() => () => unblockScroll.current?.(), [])

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
        const { full, thumb } = await processPhoto(file)
        const path = `${uid}/${crypto.randomUUID()}.jpg`
        const thumbFile = thumbPath(path)
        const options = { contentType: 'image/jpeg', cacheControl: '3600' }
        const bucket = supabase.storage.from('photos')
        // Thumbnail first, then the full image, then the row; if any step
        // fails, remove whatever was uploaded.
        try {
          const upThumb = await bucket.upload(thumbFile, thumb, options)
          if (upThumb.error) throw upThumb.error
          const upFull = await bucket.upload(path, full, options)
          if (upFull.error) throw upFull.error
          const ins = await supabase.from('photos').insert({ user_id: uid, storage_path: path, position })
          if (ins.error) throw ins.error
        } catch (e) {
          discard([path, thumbFile])
          throw e
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
      await supabase.storage.from('photos').remove([path, thumbPath(path)])
      const rest = photos.filter((p) => p.id !== id).map((p) => p.id)
      if (rest.length) await supabase.rpc('reorder_photos', { p_ids: rest })
    }
    await reload()
    setBusy(null)
  }

  // Saves whatever order is on screen. Shared by the arrows and by drop.
  async function commit(next: Photo[]) {
    if (next.every((p, i) => p.id === photos[i]?.id)) return setOrder(null)
    setBusy('reorder')
    const { error } = await supabase.rpc('reorder_photos', { p_ids: next.map((p) => p.id) })
    if (error) {
      setError(friendlyError(error))
      setOrder(null)
    }
    await reload()
    setBusy(null)
  }

  async function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= list.length) return
    const next = list.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    setError('')
    setOrder({ base: photos, list: next })
    await commit(next)
  }

  function clearPending() {
    if (pending.current?.timer) window.clearTimeout(pending.current.timer)
    pending.current = null
  }

  function startDrag(clientX: number, clientY: number) {
    const p = pending.current
    const el = p && tiles.current.get(p.id)
    if (!p || !el) return
    const r = el.getBoundingClientRect()
    dragId.current = p.id
    setError('')
    setDrag({ id: p.id, w: r.width, h: r.height, grabX: clientX - r.left, grabY: clientY - r.top, x: clientX, y: clientY })
    try {
      el.setPointerCapture(p.pointerId)
    } catch {
      // Capture is a nicety; the handlers still work without it.
    }
    if (p.touch) {
      // The hold already stopped the page from scrolling, so cancelling
      // touchmove now keeps the finger on the tile instead of the page.
      const stop = (ev: TouchEvent) => ev.preventDefault()
      document.addEventListener('touchmove', stop, { passive: false })
      unblockScroll.current = () => document.removeEventListener('touchmove', stop)
    }
  }

  // Puts the dragged tile in the slot whose centre the pointer is nearest.
  function reorderUnder(x: number, y: number) {
    const id = dragId.current
    if (!id) return
    const cur = listRef.current
    const from = cur.findIndex((p) => p.id === id)
    if (from < 0) return
    let to = from
    let best = Infinity
    cur.forEach((p, i) => {
      const el = tiles.current.get(p.id)
      if (!el) return
      const r = el.getBoundingClientRect()
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2))
      if (d < best) {
        best = d
        to = i
      }
    })
    if (to === from) return
    const next = cur.slice()
    next.splice(to, 0, ...next.splice(from, 1))
    setOrder({ base: photos, list: next })
  }

  function onPointerDown(e: React.PointerEvent<HTMLLIElement>, id: string) {
    // Let the remove/move buttons have their click.
    if (busy || list.length < 2 || (e.target as HTMLElement).closest('button')) return
    const touch = e.pointerType !== 'mouse'
    const p: Pending = { id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, touch }
    pending.current = p
    if (touch) {
      const { clientX, clientY } = e
      p.timer = window.setTimeout(() => startDrag(clientX, clientY), HOLD_MS)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLLIElement>) {
    if (dragId.current) {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
      reorderUnder(e.clientX, e.clientY)
      return
    }
    const p = pending.current
    if (!p || p.pointerId !== e.pointerId) return
    const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y)
    // A finger that moves before the hold elapses is scrolling, not dragging.
    if (p.touch) {
      if (moved > TOUCH_SLOP) clearPending()
    } else if (moved > MOUSE_SLOP) {
      startDrag(e.clientX, e.clientY)
    }
  }

  async function endDrag() {
    const id = dragId.current
    clearPending()
    unblockScroll.current?.()
    unblockScroll.current = null
    if (!id) return
    dragId.current = null
    setDrag(null)
    await commit(listRef.current)
  }

  // Safety net for a drop that lands outside the grid, in case the tile never
  // got pointer capture and so never sees the pointerup itself. endDrag only
  // acts once, so the tile's own handler firing too is harmless.
  useEffect(() => {
    if (!drag) return
    const end = () => void endDrag()
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  })

  const dragging = !!drag
  const ghost = drag && list.find((p) => p.id === drag.id)
  const ghostUrl = ghost ? urls[ghost.storage_path] : null

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2">
        {list.map((p, i) => (
          <li
            key={p.id}
            ref={(el) => {
              if (el) tiles.current.set(p.id, el)
              else tiles.current.delete(p.id)
            }}
            onPointerDown={(e) => onPointerDown(e, p.id)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onContextMenu={(e) => dragging && e.preventDefault()}
            style={{ touchAction: dragging ? 'none' : undefined }}
            className={`relative aspect-[3/4] select-none overflow-hidden rounded-2xl bg-neutral-100 shadow-sm transition-[opacity,transform] ${
              list.length > 1 && !busy ? 'cursor-grab' : ''
            } ${drag?.id === p.id ? 'opacity-25' : 'animate-rise'} ${
              i === 0 ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-canvas' : ''
            }`}
          >
            {urls[p.storage_path] ? (
              <img
                src={urls[p.storage_path]!}
                alt={`Photo ${i + 1}`}
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
              />
            ) : (
              <span className="skeleton block h-full w-full" />
            )}
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-maroon-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                <Star className="h-2.5 w-2.5 fill-current" /> Main
              </span>
            )}
            {!dragging && (
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/50 to-transparent p-1.5 pt-6">
                <button
                  type="button"
                  aria-label="Move earlier"
                  disabled={!!busy || i === 0}
                  onClick={() => move(i, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-maroon-950 shadow transition active:scale-90 disabled:opacity-0"
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
                  disabled={!!busy || i === list.length - 1}
                  onClick={() => move(i, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-maroon-950 shadow transition active:scale-90 disabled:opacity-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
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
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-on-ink shadow-md shadow-black/10">
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

      {drag &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 overflow-hidden rounded-2xl shadow-2xl shadow-black/40 ring-2 ring-brand-500"
            style={{
              left: drag.x - drag.grabX,
              top: drag.y - drag.grabY,
              width: drag.w,
              height: drag.h,
              transform: 'scale(1.06) rotate(-2deg)',
            }}
          >
            {ghostUrl ? <img src={ghostUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>,
          document.body,
        )}
    </div>
  )
}
