import { LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LinkButton, EmptyState, FullScreenSpinner } from '../components/ui'
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
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4">
        <EmptyState
          icon={LogIn}
          title="Sign-in didn't complete"
          action={
            <LinkButton to="/login">
              Try again
            </LinkButton>
          }
        >
          {oauthError ? 'Google sign-in was cancelled or failed.' : 'This is taking too long.'}
        </EmptyState>
      </main>
    )
  }

  return <FullScreenSpinner />
}
