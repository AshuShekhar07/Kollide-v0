import { UserRound, UsersRound } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/discover', label: 'People', icon: UserRound },
  { to: '/groups', label: 'Groups', icon: UsersRound },
]

// The Discover screen's People / Groups switch (§6.1 "a toggle to the Groups tab").
export default function DiscoverTabs() {
  const { pathname } = useLocation()
  return (
    <nav className="mb-4 grid grid-cols-2 rounded-full bg-neutral-100 p-1 text-sm font-semibold lg:w-80" aria-label="Discover">
      {TABS.map((t) => {
        const active = t.to === '/discover' ? pathname === '/discover' : pathname.startsWith(t.to)
        const Icon = t.icon
        return (
          <NavLink key={t.to} to={t.to} end={t.to === '/discover'} className="relative rounded-full py-2 text-center">
            {active && (
              <motion.span
                layoutId="discover-pill"
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className={`relative inline-flex items-center gap-1.5 ${active ? 'text-on-ink' : 'text-neutral-500'}`}>
              <Icon className="h-4 w-4" strokeWidth={2.2} />
              {t.label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
