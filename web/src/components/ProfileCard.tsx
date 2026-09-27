import { useEffect, useState } from 'react'
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
}: {
  profile: CardProfile
  photoIndex: number
  className?: string
  // When the full intro is shown below the card instead.
  hideBio?: boolean
}) {
  const urls = useSignedPhotos(profile.photo_paths)
  const count = Math.max(profile.photo_paths.length, 1)
  const index = ((photoIndex % count) + count) % count
  const url = urls[index]

  return (
    <div className={`relative select-none overflow-hidden rounded-3xl bg-neutral-200 shadow-xl shadow-black/10 ${className}`}>
      {url ? (
        <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-neutral-400">
          {profile.first_name.slice(0, 1)}
        </div>
      )}

      {count > 1 && (
        <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16 text-white">
        <p className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {profile.first_name}, {profile.age}
          </span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-xs">{profile.public_code}</span>
        </p>
        {profile.bio && !hideBio && <p className="mt-1 line-clamp-3 text-sm text-white/90">{profile.bio}</p>}
      </div>
    </div>
  )
}
