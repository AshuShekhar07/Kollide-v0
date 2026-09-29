import { useEffect, useState } from 'react'
import { useFestival, type Festival } from '../lib/festival'
import { supabase } from '../lib/supabase'

const BULBS = ['#f6c33b', '#d4246b', '#f29f05', '#0b7a7a', '#fff4e4', '#e0661a']

/**
 * A string of fairy lights sagging between hooks, hung under the header
 * after dark. During Navratri every third bulb is in the night's colour.
 */
export function FairyLights({ festival }: { festival: Festival }) {
  const night = festival.phase === 'during' ? festival.info.hex : null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-full h-9 overflow-hidden" aria-hidden>
      <div className="flex w-max">
        {Array.from({ length: 48 }, (_, i) => {
          const color = night && i % 3 === 1 ? night : BULBS[i % BULBS.length]
          return (
            <svg key={i} viewBox="0 0 64 36" className="h-9 w-16 shrink-0 overflow-visible">
              <path d="M0 2 Q32 18 64 2" fill="none" stroke="rgb(170 139 136 / 0.8)" strokeWidth="1.4" />
              <rect x="29.5" y="8.5" width="5" height="5" rx="1" fill="#8c6a77" />
              <ellipse
                cx="32"
                cy="19.5"
                rx="4.6"
                ry="6.2"
                fill={color}
                className="fairy-bulb"
                style={{ ['--d' as string]: `${-((i * 7) % 11) * 0.27}s`, filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 10px ${color})` }}
              />
            </svg>
          )
        })}
      </div>
    </div>
  )
}

// The thread under the desktop header: festival colours, with the night's
// colour woven into the middle during Navratri.
export function HeaderThread({ festival }: { festival: Festival }) {
  const mid = festival.phase === 'during' ? festival.info.hex : 'var(--color-marigold-400)'
  return (
    <div
      className="h-[3px]"
      style={{ backgroundImage: `linear-gradient(90deg, var(--color-rani), ${mid}, var(--color-peacock))` }}
      aria-hidden
    />
  )
}

// Days to go, or which night it is, as a small chip in the header.
export function FestivalChip({ festival, long = false }: { festival: Festival; long?: boolean }) {
  if (festival.phase === 'after') {
    if (!festival.dussehra) return null
    return <span className="rounded-full bg-maroon-700 px-3 py-1.5 text-xs font-bold text-cream">Happy Dussehra</span>
  }
  const dot = festival.phase === 'during' ? festival.info.hex : 'var(--color-marigold-400)'
  return (
    <span
      className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-maroon-700 px-3 py-1.5 text-xs font-bold text-cream"
      title={festival.phase === 'during' ? `Tonight's colour is ${festival.info.colour.toLowerCase()}` : undefined}
    >
      {/* Beats like a dhol during the festival. */}
      <span className="relative flex h-2 w-2" aria-hidden>
        {festival.phase === 'during' && (
          <span className="absolute inset-0 animate-ping rounded-full opacity-70" style={{ backgroundColor: dot }} />
        )}
        <span className="relative h-2 w-2 rounded-full ring-1 ring-cream/40" style={{ backgroundColor: dot }} />
      </span>
      {festival.phase === 'before'
        ? `${festival.days}d to Navratri`
        : `Night ${festival.night} of 9${long ? ` · ${festival.info.colour}` : ''}`}
    </span>
  )
}

type Upcoming = { id: string; name: string }

// What's next once Navratri is over: the activities marked "coming soon".
function useUpcoming(enabled: boolean) {
  const [list, setList] = useState<Upcoming[]>([])
  useEffect(() => {
    if (!enabled) return
    supabase
      .from('activities')
      .select('id, name')
      .eq('status', 'coming_soon')
      .order('sort_order')
      .then(({ data }) => setList(data ?? []))
  }, [enabled])
  return list
}

/**
 * The line at the top of Discover that moves with the festival: tonight's
 * night, colour and goddess during Navratri; a thank-you and what's coming
 * next once it's over. Nothing before it starts (the header counts down).
 */
export function FestivalBanner() {
  const festival = useFestival()
  const upcoming = useUpcoming(festival.phase === 'after')

  if (festival.phase === 'during') {
    const { night, info, isNight } = festival
    return (
      <div className="mb-3 flex items-center gap-2.5 overflow-hidden rounded-[1.2rem] border border-neutral-200/80 bg-surface p-1.5 pr-3 lg:mx-auto lg:mb-4 lg:w-full lg:max-w-5xl lg:gap-3 lg:rounded-[1.4rem] lg:p-2 lg:pr-4">
        <span
          className="bandhani-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-base font-extrabold shadow-md lg:h-11 lg:w-11 lg:rounded-2xl lg:text-lg"
          style={{ backgroundColor: info.hex, color: info.on }}
        >
          {night}
        </span>
        {/* Phones: one short line, so the card keeps its room. */}
        <p className="min-w-0 truncate text-[13px] text-neutral-600 lg:hidden">
          <span className="font-bold text-neutral-900">{isNight ? `Night ${night} is on` : `Tonight: night ${night}`}</span> · wear{' '}
          <span className="font-bold text-neutral-900">{info.colour.toLowerCase()}</span> for {info.devi}
        </p>
        <p className="hidden min-w-0 text-sm leading-snug text-neutral-600 lg:block">
          <span className="font-bold text-neutral-900">
            {isNight ? `Night ${night} is on.` : `Tonight is night ${night}.`}
          </span>{' '}
          The colour is <span className="font-bold text-neutral-900">{info.colour.toLowerCase()}</span>, for {info.devi}.
          {' '}Wear it if you have it.
        </p>
      </div>
    )
  }

  if (festival.phase === 'after') {
    return (
      <div className="bandhani-soft relative mb-5 overflow-hidden rounded-[1.75rem] bg-maroon-700 px-5 py-5 text-cream shadow-lg shadow-maroon-950/15 sm:px-7 lg:mx-auto lg:w-full lg:max-w-5xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-marigold-400">
          {festival.dussehra ? 'Happy Dussehra' : 'Navratri 2026 is done'}
        </p>
        <p className="mt-1.5 font-display text-2xl font-extrabold leading-tight tracking-[-0.03em] sm:text-3xl">
          Thank you for dancing. See you next Navratri.
        </p>
        <p className="mt-2 max-w-xl text-sm text-cream/80">
          Your matches and chats stay right here. Keep planning with the people you met.
          {upcoming.length > 0 && ' And there’s more coming:'}
        </p>
        {upcoming.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {upcoming.map((a) => (
              <li key={a.id} className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold ring-1 ring-cream/25">
                {a.name} · soon
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return null
}
