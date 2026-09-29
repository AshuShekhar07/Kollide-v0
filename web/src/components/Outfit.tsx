// Pieces of a garba outfit for profiles: the fabric frame (see lib/fabric),
// a running stitch, toran flags hung over the top photo, mirrors in the
// corners and a diya for the verified badge.

// A running stitch, as if the photo or patch were sewn onto the fabric.
export function Stitch({ className = 'inset-1.5 rounded-[1.4rem]', color = 'rgb(255 255 255 / 0.55)' }: { className?: string; color?: string }) {
  return (
    <span
      className={`pointer-events-none absolute border-2 border-dashed ${className}`}
      style={{ borderColor: color }}
      aria-hidden
    />
  )
}

const TORAN = ['#f6c33b', '#d4246b', '#0b7a7a', '#e0661a', '#26306b', '#3e7c2b']

// A short string of toran flags to hang over the top of a photo.
export function MiniToran({ count = 11, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-6 ${className}`} aria-hidden>
      <span className="absolute inset-x-0 top-[3px] h-px bg-white/70 shadow-[0_1px_1px_rgb(0_0_0/0.3)]" />
      <div className="flex justify-between px-2">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="relative mt-[3px] block h-4 w-3.5 origin-top animate-sway drop-shadow"
            style={{
              backgroundColor: TORAN[i % TORAN.length],
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              animationDelay: `${-(i % 5) * 0.6}s`,
            }}
          >
            <span className="absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-white/85" />
          </span>
        ))}
      </div>
    </div>
  )
}

// Round mirrors sewn into the corners of the frame.
export function CornerMirrors({ inset = '0.4rem' }: { inset?: string }) {
  const spots = [
    { top: inset, left: inset },
    { top: inset, right: inset },
    { bottom: inset, left: inset },
    { bottom: inset, right: inset },
  ]
  return (
    <>
      {spots.map((s, i) => (
        <span
          key={i}
          className="mirror-glint pointer-events-none absolute z-20 h-3 w-3 rounded-full ring-2 ring-marigold-400"
          style={{ ...s, animationDelay: `${i * 0.7}s` }}
          aria-hidden
        />
      ))}
    </>
  )
}

/**
 * The verified badge: a clay diya. Lit (with a flickering flame) once a
 * person on the team has approved the verification video; unlit before.
 */
export function Diya({ lit = true, className = 'h-6 w-6', label }: { lit?: boolean; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 overflow-visible ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {lit && (
        <>
          <circle cx="12" cy="7.5" r="6" fill="#f6c33b" opacity="0.35" className="diya-glow" />
          <path
            className="diya-flame"
            d="M12 1.6c1.9 2.3 2.9 4 2.9 5.6a2.9 2.9 0 0 1-5.8 0c0-1.6 1-3.3 2.9-5.6Z"
            fill="#f29f05"
          />
          <path d="M12 4.6c.8 1 1.3 1.8 1.3 2.6a1.3 1.3 0 0 1-2.6 0c0-.8.5-1.6 1.3-2.6Z" fill="#fff6dd" />
        </>
      )}
      {!lit && <path d="M12 9.2v1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />}
      {/* The lamp: a shallow clay bowl with a spout for the wick. */}
      <path d="M2.2 12.2h16.4l3.4-2.2-.9 3.3c-1.2 4.3-4.8 7.2-9.1 7.2S4.2 17.6 3 13.3Z" fill={lit ? '#c2410c' : 'currentColor'} opacity={lit ? 1 : 0.55} />
      <path d="M2.2 12.2h16.4" stroke={lit ? '#fbbf24' : 'currentColor'} strokeWidth="1.4" strokeLinecap="round" opacity={lit ? 1 : 0.7} />
      <circle cx="8" cy="15.6" r="0.9" fill={lit ? '#fde68a' : 'transparent'} />
      <circle cx="12" cy="16.4" r="0.9" fill={lit ? '#fde68a' : 'transparent'} />
      <circle cx="16" cy="15.6" r="0.9" fill={lit ? '#fde68a' : 'transparent'} />
    </svg>
  )
}
