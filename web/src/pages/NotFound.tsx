import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Page not found</h1>
      <p className="mt-2 text-neutral-600">This path didn't collide with anything.</p>
      <Link to="/" className="mt-6 font-semibold text-brand-600 underline underline-offset-4">
        Back to home
      </Link>
    </main>
  )
}
