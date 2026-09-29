import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// Title block at the top of each onboarding step.
export default function StepHeader({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <span className="bandhani-soft mb-5 flex h-14 w-14 -rotate-6 items-center justify-center rounded-[1.1rem] bg-maroon-700 text-cream shadow-lg shadow-maroon-950/20">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="text-[2.2rem] font-extrabold leading-[1] tracking-[-0.04em] text-neutral-900">{title}</h1>
      {children && <div className="mt-2 leading-relaxed text-neutral-600">{children}</div>}
    </div>
  )
}
