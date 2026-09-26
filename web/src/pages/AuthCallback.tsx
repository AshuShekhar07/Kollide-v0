import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FullScreenSpinner } from '../components/ui'
import { homePathFor, useAuth } from '../lib/auth-context'

// Google redirects here with ?code=…; supabase-js exchanges it automatically
// (detectSessionInUrl + PKCE), then the auth listener delivers the session.
export default function AuthCallback() {
  const { loading, session, profile } = useAuth()
  const [timedOut, setTimedOut] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const oauthError = params.get('error_description') ?? params.get('error')

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000)
    return () => clearTimeout(t)
  }, [])

  if (session && !loading) return <Navigate to={homePathFor(profile)} replace />

  if (oauthError || timedOut) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 text-center">
        <h1 className="text-xl font-bold text-neutral-900">Sign-in didn't complete</h1>
        <p className="mt-2 text-neutral-600">{oauthError ? 'Google sign-in was cancelled or failed.' : 'This is taking too long.'}</p>
        <Link to="/login" className="mt-6 font-semibold text-brand-600 underline underline-offset-4">
          Try again
        </Link>
      </main>
    )
  }

  return <FullScreenSpinner />
}
