import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// Title block at the top of each onboarding step.
export default function StepHeader({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-plum-500 to-plum-700 text-white shadow-lg shadow-plum-600/25">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="text-[1.7rem] font-bold leading-tight text-neutral-900">{title}</h1>
      {children && <div className="mt-2 leading-relaxed text-neutral-600">{children}</div>}
    </div>
  )
}
