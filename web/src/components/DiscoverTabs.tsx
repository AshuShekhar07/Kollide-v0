import { NavLink } from 'react-router-dom'

// The Discover screen's People / Groups switch (§6.1 "a toggle to the Groups tab").
export default function DiscoverTabs() {
  return (
    <nav className="mb-3 grid grid-cols-2 rounded-full bg-neutral-100 p-1 text-sm font-semibold" aria-label="Discover">
      {[
        { to: '/discover', label: 'People' },
        { to: '/groups', label: 'Groups' },
      ].map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/discover'}
          className={({ isActive }) =>
            `rounded-full py-1.5 text-center ${isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500'}`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
