import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// Title block at the top of each onboarding step.
export default function StepHeader({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-plum-900 text-white">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="text-3xl font-extrabold leading-tight text-neutral-900">{title}</h1>
      {children && <div className="mt-2 leading-relaxed text-neutral-600">{children}</div>}
    </div>
  )
}
