import { Button } from '../components/ui'
import { useAuth } from '../lib/auth-context'

// Placeholder until the swipe deck lands (Phase 2).
export default function Discover() {
  const { profile, signOut } = useAuth()
  const pending = profile?.verification_status === 'pending'

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <span className="text-lg font-extrabold tracking-tight text-brand-700">Kollide</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs text-neutral-600">
          {profile?.first_name} · {profile?.public_code}
        </span>
      </header>

      {pending && (
        <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <p className="font-semibold">Pending verification</p>
          <p className="mt-1">Your likes will be delivered once you're verified — usually within 24 hours.</p>
        </div>
      )}

      <section className="mt-10 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">
          {pending ? "You're all set for now" : "You're verified!"}
        </h1>
        <p className="mt-2 text-neutral-600">
          Discovery for Garba opens here soon. We'll email you when it's ready.
        </p>
      </section>

      <Button variant="ghost" className="mx-auto mt-10 flex" onClick={signOut}>
        Sign out
      </Button>
    </main>
  )
}
