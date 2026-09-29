import { useId } from 'react'

const PLEATS = ['#d4246b', '#f6c33b', '#0b7a7a', '#e0661a', '#7a0f2e']

/**
 * The loader: a ghagra mid-twirl. Its pleats run round and round while the
 * hem flares out and back, like a skirt spinning on the garba ground.
 */
export default function Ghagra({ className = 'h-8 w-8' }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  // One pleat per colour, 8 units wide; the pattern slides one full set.
  const set = PLEATS.length * 8
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <pattern id={`pleats-${id}`} width={set} height="48" patternUnits="userSpaceOnUse">
          {PLEATS.map((c, i) => (
            <rect key={c} x={i * 8} y="0" width="8" height="48" fill={c} />
          ))}
          <animateTransform attributeName="patternTransform" type="translate" from="0 0" to={`${set} 0`} dur="1.1s" repeatCount="indefinite" />
        </pattern>
      </defs>
      {/* Choli and head, just enough to read as a dancer. */}
      <circle cx="24" cy="5.5" r="3.6" fill="currentColor" />
      <path d="M19.5 10.5h9l-1 5.5h-7Z" fill="#7a0f2e" />
      <g className="ghagra-twirl">
        {/* Skirt with a scalloped hem. */}
        <path
          d="M20.5 16h7L42 40q-2.2 2.6-4.5 0-2.2 2.6-4.5 0-2.2 2.6-4.5 0-2.2 2.6-4.5 0-2.2 2.6-4.5 0-2.2 2.6-4.5 0-2.2 2.6-4.5 0-2.2 2.6-4.5 0Z"
          fill={`url(#pleats-${id})`}
        />
        {/* Gota border along the hem, with mirrors. */}
        <path d="M7.5 38.2h33" stroke="#f6c33b" strokeWidth="1.6" strokeLinecap="round" />
        {[12, 18, 24, 30, 36].map((x) => (
          <circle key={x} cx={x} cy="38.2" r="0.9" fill="#fff" />
        ))}
        <path d="M20.5 16h7" stroke="#f6c33b" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
