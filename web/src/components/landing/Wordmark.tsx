import { useId, type CSSProperties } from 'react'
import { STICK_REST } from './motion'

// The Kollide wordmark: one colour per letter, and the two L's drawn as
// dandiya sticks leaning into each other with a small spark where they meet.
// Every piece is its own element (tagged with data-wm) so LogoIntro can
// animate them; the sticks rotate around their bottom centre.

type Tone = 'light' | 'dark'

const PALETTES = {
  // For white / light backgrounds.
  light: {
    k: '#E0661A',
    o: '#C98A00',
    i: '#E88A10',
    d: '#26306B',
    e: '#8E1B2A',
    stickL: '#D98E76',
    stickR: '#C62A24',
    gold: '#F4C51C',
    navy: '#26306B',
    spark: '#E0661A',
  },
  // For dark backgrounds.
  dark: {
    k: '#F07A1E',
    o: '#F4C51C',
    i: '#F7A12A',
    d: '#6173D6',
    e: '#FFF1D6',
    stickL: '#EDB8A3',
    stickR: '#D2332C',
    gold: '#F4C51C',
    navy: '#26306B',
    spark: '#FFE9B0',
  },
} satisfies Record<Tone, Record<string, string>>

// Where the stick tops meet, in viewBox units: the spark and glow sit here.
const MEET = { x: 409, y: 50 }

const STICK = { w: 52, h: 232, bottom: 281, r: 11 }
const STICK_L_CX = 368
const STICK_R_CX = 450

function Stick({ cx, fill, gold, navy }: { cx: number; fill: string; gold: string; navy: string }) {
  const x = cx - STICK.w / 2
  const top = STICK.bottom - STICK.h
  return (
    <>
      <rect x={x} y={top} width={STICK.w} height={STICK.h} rx={STICK.r} fill={fill} />
      <rect x={x} y={188} width={STICK.w} height={14} fill={gold} />
      <rect x={x} y={207} width={STICK.w} height={9} fill={navy} />
    </>
  )
}

const pivot: CSSProperties = { transformBox: 'fill-box', transformOrigin: '50% 100%' }

export default function Wordmark({
  tone = 'light',
  intro = false,
  className,
  title = 'Kollide',
}: {
  tone?: Tone
  /** Render every piece in its pre-intro (hidden) state for LogoIntro to animate. */
  intro?: boolean
  className?: string
  title?: string
}) {
  const c = PALETTES[tone]
  const glowId = `wm-glow-${useId().replace(/:/g, '')}`
  const hidden: CSSProperties | undefined = intro ? { opacity: 0 } : undefined

  return (
    <svg viewBox="0 0 924 290" className={className} role="img" aria-label={title}>
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor={c.gold} stopOpacity="0.9" />
          <stop offset="55%" stopColor={c.gold} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c.gold} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow behind the meeting point; only the intro shows it. */}
      <circle
        data-wm="glow"
        cx={MEET.x}
        cy={MEET.y + 6}
        r={70}
        fill={`url(#${glowId})`}
        style={{ opacity: 0 }}
      />

      {/* k */}
      <g data-wm="letter" style={hidden}>
        <rect x={7} y={51} width={56} height={229} fill={c.k} />
        <path d="M62 186 L108 122 H167 L104 200 L169 280 H109 L62 219 Z" fill={c.k} />
      </g>

      {/* o */}
      <path
        data-wm="letter"
        style={hidden}
        fillRule="evenodd"
        fill={c.o}
        d="M168 201 a83 80 0 1 0 166 0 a83 80 0 1 0 -166 0 Z M221 201 a30 31 0 1 0 60 0 a30 31 0 1 0 -60 0 Z"
      />

      {/* The two L's: dandiya sticks. The right one sits in front. */}
      <g
        data-wm="stick-left"
        style={{ ...pivot, transform: `rotate(${STICK_REST.left}deg)`, ...hidden }}
      >
        <Stick cx={STICK_L_CX} fill={c.stickL} gold={c.gold} navy={c.navy} />
      </g>
      <g
        data-wm="stick-right"
        style={{ ...pivot, transform: `rotate(${STICK_REST.right}deg)`, ...hidden }}
      >
        <Stick cx={STICK_R_CX} fill={c.stickR} gold={c.gold} navy={c.navy} />
      </g>

      {/* Spark above the meeting point. Hidden in intro mode until the hit. */}
      <g
        data-wm="spark"
        stroke={c.spark}
        strokeWidth={7}
        strokeLinecap="round"
        style={{ ...pivot, ...(intro ? { opacity: 0, transform: 'scale(0.2)' } : null) }}
      >
        <line x1={MEET.x} y1={6} x2={MEET.x} y2={26} />
        <line x1={MEET.x - 25} y1={16} x2={MEET.x - 12} y2={29} />
        <line x1={MEET.x + 25} y1={16} x2={MEET.x + 12} y2={29} />
      </g>

      {/* i */}
      <g data-wm="letter" style={hidden}>
        <circle cx={546} cy={78} r={28} fill={c.i} />
        <rect x={518} y={122} width={56} height={158} fill={c.i} />
      </g>

      {/* d */}
      <path
        data-wm="letter"
        style={hidden}
        fillRule="evenodd"
        fill={c.d}
        d="M693 51 H748 V280 H693 V276.5 A85 80 0 1 1 693 125.5 Z M633 201 a29 31 0 1 0 58 0 a29 31 0 1 0 -58 0 Z"
      />

      {/* e */}
      <path
        data-wm="letter"
        style={hidden}
        fillRule="evenodd"
        fill={c.e}
        d="M916 214 A81 80 0 1 0 888.1 262.3 L858.5 226.3 A35 33 0 0 1 803.8 214 Z M803 190 A35 33 0 0 1 869 190 Z"
      />
    </svg>
  )
}
