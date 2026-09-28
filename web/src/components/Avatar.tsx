import { useSignedPhotos } from './ProfileCard'

// Round photo with the first letter of the name as a fallback.
export default function Avatar({
  path,
  name,
  className = 'h-14 w-14',
  ring = false,
}: {
  path: string | null
  name: string
  className?: string
  ring?: boolean
}) {
  const [url] = useSignedPhotos(path ? [path] : [], 'thumb')
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-display font-bold text-brand-700 ${
        ring ? 'ring-[3px] ring-marigold-400 ring-offset-2 ring-offset-canvas' : ''
      } ${className}`}
    >
      {name.slice(0, 1).toUpperCase()}
      {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
    </span>
  )
}
