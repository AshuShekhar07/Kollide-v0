import type { ShownAnswer } from '../lib/about'
import { useAnswers } from '../lib/useAnswers'

// Answers take the brand colours in turn: haldi, rani, and the wordmark's navy.
const ANSWER_TILES = ['bg-marigold-400 text-maroon-950', 'bg-rani text-cream', 'bg-navy text-cream'] as const

// One answered question as a festive tile: the question small, the answer big.
export function AnswerTile({ answer, index, compact = false }: { answer: ShownAnswer; index: number; compact?: boolean }) {
  return (
    <figure
      className={`bandhani-soft relative overflow-hidden rounded-[1.75rem] ${ANSWER_TILES[index % ANSWER_TILES.length]} ${
        compact ? 'px-4 py-3.5' : 'px-5 pb-6 pt-5'
      }`}
    >
      <figcaption className="relative text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">{answer.question}</figcaption>
      <p
        className={`relative mt-2 whitespace-pre-wrap font-display font-extrabold leading-[1.1] tracking-[-0.03em] ${
          compact ? 'text-lg' : 'text-[1.6rem]'
        }`}
      >
        {answer.answer}
      </p>
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
