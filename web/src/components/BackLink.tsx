import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-ml-2 inline-flex max-w-full items-center gap-0.5 rounded-full py-1 pl-1 pr-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
    >
      <ChevronLeft className="h-5 w-5 shrink-0" />
      <span className="truncate">{children}</span>
    </Link>
  )
}
