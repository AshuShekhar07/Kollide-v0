import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './ui'

// Desktop layout for sign-in and onboarding: a garba photo panel on the left
// (with the wordmark and `aside` copy) and the page on the right. Phones get
// just the page.
export default function SplitScreen({ image, aside, children }: { image: string; aside: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="relative hidden h-dvh overflow-hidden bg-plum-900 p-12 text-white lg:sticky lg:top-0 lg:flex lg:flex-col lg:justify-between">
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-plum-900 via-plum-900/70 to-plum-900/20" aria-hidden />
        <Link to="/" aria-label="Kollide home" className="relative self-start">
          <Logo tone="white" className="text-4xl" />
        </Link>
        <div className="relative max-w-md">{aside}</div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
