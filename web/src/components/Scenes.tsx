// Small illustrated scenes for empty screens, instead of an icon on a tile.

const DANCERS = ['#d4246b', '#f29f05', '#0b7a7a', '#e0661a', '#26306b', '#3e7c2b', '#7a0f2e']

/**
 * A garba ring seen from above, turning slowly around the garbo (the lamp
 * in a clay pot at the centre), with one place left open for you.
 */
export function RingScene({ className = 'h-52 w-52' }: { className?: string }) {
  const places = 8
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      {/* Hands joined all the way round. */}
      <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
      <g className="origin-center animate-spin-slow">
        {Array.from({ length: places }, (_, i) => {
          const a = (i / places) * Math.PI * 2
          const x = 60 + Math.cos(a) * 44
          const y = 60 + Math.sin(a) * 44
          const deg = (a * 180) / Math.PI + 90
          if (i === places - 1) {
            // The open place.
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${deg})`}>
                <circle r="8" fill="none" stroke="var(--color-rani)" strokeWidth="1.6" strokeDasharray="3 3" />
                <text y="3.2" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--color-rani)">
                  ?
                </text>
              </g>
            )
          }
          const c = DANCERS[i % DANCERS.length]
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${deg})`}>
              {/* A twirling skirt from above, with the dancer's head. */}
              <circle r="8.5" fill={c} />
              <circle r="8.5" fill="none" stroke="#f6c33b" strokeWidth="1.2" strokeDasharray="1.5 2.2" />
              <circle r="3.4" fill="#2a0e1b" />
            </g>
          )
        })}
      </g>
      {/* The garbo: a clay pot with holes, and a diya glowing inside. */}
      <circle cx="60" cy="58" r="12" fill="#f6c33b" opacity="0.25" className="diya-glow" />
      <path d="M50 62c0-6.5 4.5-10 10-10s10 3.5 10 10-4.5 9-10 9-10-2.5-10-9Z" fill="#c2410c" />
      <path d="M54 52.5h12" stroke="#7a0f2e" strokeWidth="2" strokeLinecap="round" />
      {[55, 60, 65].map((x) => (
        <circle key={x} cx={x} cy="62" r="1.2" fill="#fde68a" />
      ))}
      <path className="diya-flame" d="M60 43.5c1.6 2 2.4 3.4 2.4 4.7a2.4 2.4 0 0 1-4.8 0c0-1.3.8-2.7 2.4-4.7Z" fill="#f29f05" />
    </svg>
  )
}

/** Two dandiyas held up, waiting for someone to clack with. */
export function SticksScene({ className = 'h-44 w-44' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <circle cx="60" cy="34" r="16" fill="#f6c33b" opacity="0.2" className="diya-glow" />
      <g className="origin-bottom animate-sway [transform-box:fill-box]" style={{ animationDuration: '3.6s' }}>
        <path d="M30 104 52 34" stroke="#d4246b" strokeWidth="7" strokeLinecap="round" />
        <path d="M33.5 93 36 85" stroke="#f6c33b" strokeWidth="7" />
        <path d="M49.5 43 51 38" stroke="#f6c33b" strokeWidth="7" />
      </g>
      <g className="origin-bottom animate-sway [transform-box:fill-box]" style={{ animationDuration: '3.6s', animationDelay: '-1.8s' }}>
        <path d="M90 104 68 34" stroke="#0b7a7a" strokeWidth="7" strokeLinecap="round" />
        <path d="M86.5 93 84 85" stroke="#f6c33b" strokeWidth="7" />
        <path d="M70.5 43 69 38" stroke="#f6c33b" strokeWidth="7" />
      </g>
      {/* Where they'd meet: a spark that hasn't happened yet. */}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={54 + i * 6} cy="22" r="1.8" fill="var(--color-rani)" className="animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
    </svg>
  )
}

/** A kandil lantern hanging on a string, swaying a little and glowing. */
export function LanternScene({ className = 'h-48 w-40' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 120" className={className} aria-hidden>
      <g className="origin-top animate-sway [transform-box:fill-box]" style={{ animationDuration: '4s' }}>
        <path d="M48 0v26" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <circle cx="48" cy="60" r="30" fill="#f6c33b" opacity="0.22" className="diya-glow" />
        {/* The star-shaped kandil. */}
        <path d="M48 26 66 44 72 62 58 80H38L24 62l6-18Z" fill="#d4246b" />
        <path d="M48 26 58 44 60 62 52 80h-8l-8-18 2-18Z" fill="#f29f05" />
        <path d="M30 44h36M24 62h48" stroke="#fff4e4" strokeWidth="1.4" opacity="0.8" />
        <circle cx="48" cy="53" r="2.2" fill="#fff" />
        {/* Tassels. */}
        {[40, 48, 56].map((x, i) => (
          <path key={x} d={`M${x} 80v${16 + (i % 2) * 8}`} stroke={i % 2 ? '#0b7a7a' : '#d4246b'} strokeWidth="2.4" strokeLinecap="round" />
        ))}
      </g>
    </svg>
  )
}
