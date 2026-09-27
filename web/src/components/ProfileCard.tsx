import { BadgeCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { signedPhotoUrls } from '../lib/photos'

export type CardProfile = {
  first_name: string
  public_code: string
  age: number
  bio: string | null
  photo_paths: string[]
}

// Signed URLs for a list of photo paths; re-fetches only when the list changes.
export function useSignedPhotos(paths: string[]) {
  const [urls, setUrls] = useState<(string | null)[]>([])
  const key = paths.join('|')
  useEffect(() => {
    let cancelled = false
    signedPhotoUrls(key ? key.split('|') : []).then((u) => !cancelled && setUrls(u))
    return () => {
      cancelled = true
    }
  }, [key])
  return urls
}

// Photo-led profile card. The parent owns `photoIndex`, so it can step
// through photos on tap without fighting a drag gesture.
export default function ProfileCard({
  profile,
  photoIndex,
  className = '',
  hideBio = false,
  footer,
}: {
  profile: CardProfile
  photoIndex: number
  className?: string
  // When the full intro is shown below the card instead.
  hideBio?: boolean
  // Extra content under the name, e.g. a "More about" button.
  footer?: ReactNode
}) {
  const urls = useSignedPhotos(profile.photo_paths)
  const count = Math.max(profile.photo_paths.length, 1)
  const index = ((photoIndex % count) + count) % count
  const url = urls[index]
  const [loaded, setLoaded] = useState<string | null>(null)

  return (
    <div className={`relative select-none overflow-hidden rounded-[2rem] bg-neutral-200 shadow-xl shadow-plum-900/20 ${className}`}>
      {url ? (
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(url)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded === url ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : null}
      {(!url || loaded !== url) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-200 to-marigold-100">
          <span className="font-display text-6xl font-bold text-white/80">{profile.first_name.slice(0, 1)}</span>
        </div>
      )}

      {count > 1 && (
        <div className="absolute inset-x-4 top-3 flex gap-1" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full shadow-sm transition-colors ${i === index ? 'bg-white' : 'bg-white/35'}`}
            />
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-5 pt-20 text-white">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-[1.75rem] font-bold leading-tight">
            {profile.first_name}
            <span className="font-semibold text-white/85">, {profile.age}</span>
          </span>
          <BadgeCheck className="h-6 w-6 fill-sky-500 text-white" strokeWidth={2} aria-label="Verified" />
        </p>
        <p className="mt-0.5 font-mono text-[11px] tracking-wider text-white/65">{profile.public_code}</p>
        {profile.bio && !hideBio && <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/90">{profile.bio}</p>}
        {footer}
      </div>
    </div>
  )
}
