import { useEffect, useState } from 'react'
import { fetchAnswers, type ShownAnswer } from '../lib/about'

// Someone's intro and answered questions, read-only.
export default function AboutView({ userId, bio, compact = false }: { userId: string; bio: string | null; compact?: boolean }) {
  const [answers, setAnswers] = useState<ShownAnswer[]>([])

  useEffect(() => {
    let cancelled = false
    fetchAnswers(userId)
      .then((a) => !cancelled && setAnswers(a))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!bio && !answers.length) return null
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {bio && <p className={`whitespace-pre-wrap leading-relaxed text-neutral-700 ${compact ? 'text-sm' : 'text-[15px]'}`}>{bio}</p>}
      {answers.map((a) => (
        <div
          key={a.prompt_key}
          className={`relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 ${compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}`}
        >
          <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-brand-500" aria-hidden />
          <p className="text-xs font-bold text-brand-600">{a.question}</p>
          <p
            className={`mt-1 whitespace-pre-wrap font-display font-semibold leading-snug text-neutral-900 ${compact ? 'text-[15px]' : 'text-lg'}`}
          >
            {a.answer}
          </p>
        </div>
      ))}
    </div>
  )
}
