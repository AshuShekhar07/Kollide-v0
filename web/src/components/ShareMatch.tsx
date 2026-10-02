import { Download, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { fabricFor } from '../lib/fabric'
import { useFestival } from '../lib/festival'
import { drawShareCard } from '../lib/shareCard'
import Ghagra from './Ghagra'
import Wordmark from './landing/Wordmark'
import { useSignedPhotos } from './ProfileCard'
import { Sheet } from './SafetyDialogs'
import { Button, ErrorText, inputClass } from './ui'

const MAX_VENUE = 40

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2 text-sm font-semibold text-neutral-800">
      {children}
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className="relative h-7 w-12 shrink-0 rounded-full bg-neutral-200 transition-colors peer-checked:bg-rani peer-focus-visible:ring-4 peer-focus-visible:ring-brand-200 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
        aria-hidden
      />
    </label>
  )
}

/**
 * Make a story card of a match to share on Instagram or WhatsApp. Only first
 * names go on it, with both photos; either of theirs can be switched off
 * (their fabric then stands in for the photo). The venue is whatever you
 * type, and "still deciding" until you do.
 */
export default function ShareMatch({
  them,
  myPhotoPath,
  onClose,
}: {
  them: { id?: string; name: string; photoPath: string | null }
  myPhotoPath: string | null
  onClose: () => void
}) {
  const { profile } = useAuth()
  const festival = useFestival()
  const [showName, setShowName] = useState(true)
  const [showPhoto, setShowPhoto] = useState(true)
  const [venue, setVenue] = useState('')
  // The venue as last drawn; typing redraws after a short pause.
  const [drawnVenue, setDrawnVenue] = useState('')
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null)
  const [error, setError] = useState('')
  const wordmarkRef = useRef<HTMLDivElement>(null)

  const [mine] = useSignedPhotos(myPhotoPath ? [myPhotoPath] : [], 'full')
  const [theirs] = useSignedPhotos(them.photoPath ? [them.photoPath] : [], 'full')

  useEffect(() => {
    const t = window.setTimeout(() => setDrawnVenue(venue), 350)
    return () => window.clearTimeout(t)
  }, [venue])

  useEffect(() => {
    let cancelled = false
    // The wordmark as a standalone SVG, sized from its viewBox so it keeps its shape.
    const svg = wordmarkRef.current?.querySelector('svg')?.cloneNode(true) as SVGSVGElement | undefined
    const box = svg?.viewBox.baseVal
    if (svg && box) {
      svg.setAttribute('width', String(box.width))
      svg.setAttribute('height', String(box.height))
    }
    const markup = svg ? new XMLSerializer().serializeToString(svg) : null
    drawShareCard({
      me: { name: profile?.first_name ?? 'Me', photoUrl: mine ?? null },
      them: { name: showName ? them.name : null, photoUrl: showPhoto ? (theirs ?? null) : null, fabric: fabricFor(them.id ?? them.name) },
      venue: drawnVenue,
      festival,
      wordmark: markup,
      site: window.location.host,
    })
      .then((blob) => {
        if (cancelled) return
        setCard({ blob, url: URL.createObjectURL(blob) })
      })
      .catch(() => !cancelled && setError('Couldn’t make the card on this device.'))
    return () => {
      cancelled = true
    }
  }, [profile?.first_name, mine, theirs, them.id, them.name, showName, showPhoto, drawnVenue, festival])

  // Free the last preview when the sheet closes.
  const lastUrl = card?.url
  useEffect(
    () => () => {
      if (lastUrl) URL.revokeObjectURL(lastUrl)
    },
    [lastUrl],
  )

  const file = card && new File([card.blob], 'kollide-match.jpg', { type: 'image/jpeg' })
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: `We kollided ✦ ${window.location.origin}` })
    } catch (e) {
      // Closing the share sheet isn't an error.
      if ((e as Error).name !== 'AbortError') setError('Sharing didn’t work. Try saving the image instead.')
    }
  }

  function save() {
    if (!card) return
    const a = document.createElement('a')
    a.href = card.url
    a.download = 'kollide-match.jpg'
    a.click()
  }

  return (
    <Sheet label="Share your match" onClose={onClose}>
      <div ref={wordmarkRef} className="hidden" aria-hidden>
        <Wordmark tone="dark" />
      </div>
      <h2 className="text-center text-2xl font-extrabold tracking-[-0.03em] text-neutral-900">Share the moment</h2>
      <p className="mt-1 text-center text-sm text-neutral-500">A card for your story. Only first names go on it.</p>

      <div className="relative mx-auto mt-4 aspect-[9/16] w-full max-w-[15rem] overflow-hidden rounded-[1.4rem] bg-maroon-700 shadow-xl shadow-maroon-950/25 ring-1 ring-black/5">
        {card ? (
          <img src={card.url} alt="Your match card" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-cream">
            <Ghagra className="h-12 w-12" />
          </div>
        )}
      </div>

      <div className="mt-5 space-y-1">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-neutral-800">Where are you going? (optional)</span>
          <input
            className={inputClass}
            value={venue}
            maxLength={MAX_VENUE}
            placeholder="Leave empty if you haven’t decided"
            onChange={(e) => setVenue(e.target.value)}
          />
          <span className="mt-1.5 block text-xs text-neutral-500">
            {venue.trim() ? `The card says “Garba at ${venue.trim()}”.` : 'Until you pick a place, the card says “Venue: still deciding”.'}
          </span>
        </label>
        <div className="pt-2">
          <Toggle checked={showName} onChange={setShowName}>{`Show ${them.name}’s name`}</Toggle>
          <Toggle checked={showPhoto} onChange={setShowPhoto}>{`Show ${them.name}’s photo`}</Toggle>
          {showPhoto && <p className="pb-1 text-xs text-neutral-500">Only share their photo if they’re happy with it.</p>}
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="mt-4 flex gap-2">
        {canShare && (
          <Button variant="rani" className="flex-1" onClick={share}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        )}
        <Button variant={canShare ? 'secondary' : 'rani'} className="flex-1" onClick={save} disabled={!card}>
          <Download className="h-4 w-4" /> Save image
        </Button>
      </div>
    </Sheet>
  )
}
