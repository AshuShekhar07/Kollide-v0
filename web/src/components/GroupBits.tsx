import { CalendarDays } from 'lucide-react'
import { dateParts } from '../lib/groups'

// Calendar-page chip with the event date, or a generic icon when there's none.
export function DateChip({ date, tone = 'light' }: { date: string | null; tone?: 'light' | 'glass' }) {
  const parts = dateParts(date)
  const box =
    tone === 'glass'
      ? 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm'
      : 'bg-surface text-neutral-900 ring-1 ring-neutral-200'
  return (
    <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl ${box}`}>
      {parts ? (
        <>
          <span className={`text-[10px] font-bold tracking-wider ${tone === 'glass' ? 'text-marigold-300' : 'text-brand-500'}`}>
            {parts.month}
          </span>
          <span className="font-display text-xl font-bold leading-none">{parts.day}</span>
        </>
      ) : (
        <CalendarDays className="h-6 w-6 opacity-70" />
      )}
    </span>
  )
}

// How full a group is, as a bar.
export function Capacity({ count, max, tone = 'light' }: { count: number; max: number; tone?: 'light' | 'glass' }) {
  const full = count >= max
  return (
    <span className={`block h-1.5 w-full overflow-hidden rounded-full ${tone === 'glass' ? 'bg-white/20' : 'bg-neutral-100'}`} aria-hidden>
      <span
        className={`block h-full rounded-full ${full ? 'bg-neutral-400' : tone === 'glass' ? 'bg-marigold-400' : 'bg-brand-500'}`}
        style={{ width: `${Math.min(count / max, 1) * 100}%` }}
      />
    </span>
  )
}
