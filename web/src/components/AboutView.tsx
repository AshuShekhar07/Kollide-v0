import type { ShownAnswer } from '../lib/about'
import { useAnswers } from '../lib/useAnswers'

// Answers take the brand colours in turn: haldi, rani, and the wordmark's navy.
const ANSWER_TILES = ['bg-marigold-400 text-maroon-950', 'bg-rani text-cream', 'bg-navy text-cream'] as const

// Stick colours, cycling like the slips.
const STICKS = ['#d4246b', '#0b7a7a', '#f29f05'] as const

// A dandiya lying across the top of a slip: striped bands and a mirror dot.
function SlipStick({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute inset-x-3 top-0 h-3.5 w-[calc(100%-1.5rem)]" aria-hidden>
      <rect x="0.5" y="2.5" width="199" height="9" rx="4.5" fill={color} stroke="rgb(0 0 0 / 0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <rect x="0" y="3" width="200" height="3" rx="1.5" fill="#fff" opacity="0.25" />
      {[14, 22, 178, 186].map((x) => (
        <rect key={x} x={x} y="3" width="4" height="8" fill="#f6c33b" />
      ))}
    </svg>
  )
}

/**
 * One answered question as a slip of paper tied to a dandiya with two
 * threads: the question small, the answer big. Slips tilt a little, each
 * its own way, and sway when you hover them.
 */
export function AnswerTile({ answer, index, compact = false }: { answer: ShownAnswer; index: number; compact?: boolean }) {
  const tilt = index % 2 ? 'rotate-[0.8deg]' : '-rotate-[0.8deg]'
  return (
    <figure className={`group relative pt-2 ${compact ? '' : 'pt-3'}`}>
      <SlipStick color={STICKS[index % STICKS.length]} />
      <div
        className={`relative origin-top transition-transform duration-500 ease-out group-hover:rotate-0 ${tilt} ${compact ? 'mt-1' : 'mt-1.5'}`}
      >
        {/* The two threads tying the slip to the stick. */}
        <span className="absolute -top-2.5 left-8 h-4 w-px bg-neutral-500/60" aria-hidden />
        <span className="absolute -top-2.5 right-8 h-4 w-px bg-neutral-500/60" aria-hidden />
        <div
          className={`bandhani-soft relative overflow-hidden rounded-[1.4rem] shadow-md shadow-black/10 ${ANSWER_TILES[index % ANSWER_TILES.length]} ${
            compact ? 'px-4 py-3.5' : 'px-5 pb-6 pt-5'
          }`}
        >
          {/* Punched holes where the threads go through. */}
          <span className="absolute left-[1.85rem] top-1.5 h-1.5 w-1.5 rounded-full bg-black/25" aria-hidden />
          <span className="absolute right-[1.85rem] top-1.5 h-1.5 w-1.5 rounded-full bg-black/25" aria-hidden />
          <figcaption className="relative text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">{answer.question}</figcaption>
          <p
            className={`relative mt-2 whitespace-pre-wrap font-display font-extrabold leading-[1.1] tracking-[-0.03em] ${
              compact ? 'text-lg' : 'text-[1.6rem]'
            }`}
          >
            {answer.answer}
          </p>
        </div>
      </div>
    </figure>
  )
}

// Someone's intro and answered questions, read-only.
export default function AboutView({
  userId,
  bio,
  compact = false,
  answers: given,
}: {
  userId: string
  bio: string | null
  compact?: boolean
  answers?: ShownAnswer[]
}) {
  const answers = useAnswers(userId, given)

  if (!bio && !answers.length) return null
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {bio && (
        <p className={`whitespace-pre-wrap leading-relaxed text-neutral-700 ${compact ? 'text-sm' : 'text-[15px] lg:text-base'}`}>{bio}</p>
      )}
      {answers.map((a, i) => (
        <AnswerTile key={a.prompt_key} answer={a} index={i} compact={compact} />
      ))}
    </div>
  )
}
