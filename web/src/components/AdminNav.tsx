import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/admin', label: 'Verification' },
  { to: '/admin/reports', label: 'Reports' },
]

export default function AdminNav() {
  return (
    <nav className="flex gap-1 text-sm">
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end
          className={({ isActive }) =>
            `rounded-full px-3 py-1.5 font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}
