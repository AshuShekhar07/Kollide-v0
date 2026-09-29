import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Toran from './landing/Toran'
import { Logo } from './ui'

// Desktop layout for sign-in and onboarding: a garba photo panel on the left
// (with the wordmark and `aside` copy) and the page on the right. Phones get
// just the page.
export default function SplitScreen({ image, aside, children }: { image: string; aside: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="relative hidden h-dvh overflow-hidden bg-maroon-700 px-12 pb-12 text-cream lg:sticky lg:top-0 lg:flex lg:flex-col">
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-t from-maroon-800 via-maroon-700/75 to-maroon-700/30" aria-hidden />
        <div className="relative -mx-12">
          <Toran className="text-cream" />
        </div>
        <Link to="/" aria-label="Kollide home" className="relative mt-2 self-start">
          <Logo tone="white" className="text-4xl" />
        </Link>
        <div className="relative mt-auto max-w-md">{aside}</div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
