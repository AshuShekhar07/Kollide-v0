import { ChevronsDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { ShownAnswer } from '../lib/about'
import type { PhotoSize } from '../lib/photos'
import { useAnswers } from '../lib/useAnswers'
import { AnswerTile } from './AboutView'
import { fabricFor, fabricStyle } from '../lib/fabric'
import { Diya, MiniToran, Stitch } from './Outfit'
import { useSignedPhotos, type CardProfile } from './ProfileCard'

// `className` must position and size it (e.g. `relative aspect-[4/5]`).
// Stitched onto the fabric around it.
function StackPhoto({ url, name, className, children }: { url: string | null; name: string; className: string; children?: ReactNode }) {
  const [loaded, setLoaded] = useState<string | null>(null)
  return (
    <div className={`overflow-hidden rounded-[1.75rem] bg-brand-100 ${className}`}>
      {(!url || loaded !== url) && (
        <span className="absolute inset-0 flex items-center justify-center font-display text-6xl font-bold text-white/80">
          {name.slice(0, 1)}
        </span>
      )}
      {url && (
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(url)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded === url ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {children}
      <Stitch className="inset-1.5 rounded-[1.4rem]" />
    </div>
  )
}

/**
 * A whole profile in one scroll: the main photo with their name, then their
 * intro, then answers and the rest of their photos taking turns. Nothing is
 * behind a button, so a glance down shows everything they've shared.
 *
 * It's laid out on the person's fabric, like an outfit: photos stitched on,
 * toran flags over the main photo, the intro as an embroidered patch and
 * answers as slips tied to a dandiya.
 *
 * `className` styles the outer element; give it a fixed height and
 * `overflow-y-auto` to make it a scrolling card. `heroClassName` sizes the
 * main photo (e.g. a little short of the card, so the next tile peeks in).
 */
export default function ProfileStack({
  profile,
  userId,
  answers: given,
  className = '',
  heroClassName = 'aspect-[3/4]',
  size = 'full',
  peek = false,
  end,
}: {
  profile: CardProfile
  userId: string
  answers?: ShownAnswer[]
  className?: string
  heroClassName?: string
  size?: PhotoSize
  // Show a "more below" nudge on the main photo.
  peek?: boolean
  // Closing line or actions after everything else.
  end?: ReactNode
}) {
  const answers = useAnswers(userId, given)
  const urls = useSignedPhotos(profile.photo_paths, size)
  const [heroUrl, ...restUrls] = urls.length ? urls : [null]

  // Answers and photos alternate after the intro; whichever runs longer
  // finishes the stack.
  const rest: ReactNode[] = []
  for (let i = 0; i < Math.max(answers.length, restUrls.length); i++) {
    if (answers[i]) rest.push(<AnswerTile key={`a${i}`} answer={answers[i]} index={i} />)
    if (i < restUrls.length) {
      rest.push(<StackPhoto key={`p${i}`} url={restUrls[i]} name={profile.first_name} className="relative aspect-[4/5] w-full" />)
    }
  }

  return (
    <div className={`space-y-2.5 rounded-[2rem] p-2.5 ${className}`} style={fabricStyle(fabricFor(userId))}>
      <div className={`relative w-full ${heroClassName}`}>
        <StackPhoto url={heroUrl} name={profile.first_name} className="absolute inset-0">
          <MiniToran />
        </StackPhoto>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[1.75rem] bg-gradient-to-t from-black/80 via-black/35 to-transparent px-5 pb-5 pt-24 text-white">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[2rem] font-extrabold leading-none tracking-[-0.03em]">
              {profile.first_name}
              <span className="font-bold text-white/85">, {profile.age}</span>
            </span>
            <Diya className="h-7 w-7" label="Verified" />
          </p>
          {peek && (answers.length > 0 || profile.bio || restUrls.length > 0) && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white/80">
              <ChevronsDown className="h-4 w-4 animate-bounce" /> Scroll for more
            </p>
          )}
        </div>
      </div>

      {profile.bio && (
        <div className="relative rounded-[1.75rem] bg-surface px-6 py-5 shadow-md shadow-black/10">
          <Stitch className="inset-2 rounded-[1.35rem]" color="color-mix(in srgb, var(--color-rani) 45%, transparent)" />
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">About {profile.first_name}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">{profile.bio}</p>
        </div>
      )}

      {rest}
      {end}
    </div>
  )
}
