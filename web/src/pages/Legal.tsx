import { Link } from 'react-router-dom'

// Placeholders: the full Privacy Policy and Terms are a Phase 5 launch
// requirement (PLAN.md §8) and must be written before launch.
function LegalPage({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-lg font-extrabold tracking-tight text-brand-700">
        Kollide
      </Link>
      <h1 className="mt-6 text-2xl font-bold text-neutral-900">{title}</h1>
      <p className="mt-4 text-neutral-600">The full {title.toLowerCase()} will be published here before launch.</p>
    </main>
  )
}

export const Privacy = () => <LegalPage title="Privacy Policy" />
export const Terms = () => <LegalPage title="Terms of Service" />
