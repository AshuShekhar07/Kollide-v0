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
      {bio && <p className={`whitespace-pre-wrap text-neutral-800 ${compact ? 'text-sm' : 'text-[15px]'}`}>{bio}</p>}
      {answers.map((a) => (
        <div key={a.prompt_key} className={`rounded-2xl bg-brand-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <p className="text-xs font-semibold text-brand-700">{a.question}</p>
          <p className={`mt-0.5 whitespace-pre-wrap text-neutral-900 ${compact ? 'text-sm' : 'text-[15px]'}`}>{a.answer}</p>
        </div>
      ))}
    </div>
  )
}
