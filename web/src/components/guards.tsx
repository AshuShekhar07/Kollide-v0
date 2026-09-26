import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homePathFor, useAuth } from '../lib/auth-context'
import { FullScreenSpinner } from './ui'

export function RequireAuth() {
  const { loading, session } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// Main-app screens: onboarding done and a video submitted (pending or approved).
export function RequireOnboarded() {
  const { profile } = useAuth()
  const target = homePathFor(profile)
  if (target !== '/discover') return <Navigate to={target} replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

// Sends a signed-in user to wherever they belong (onboarding or the app).
export function StartRedirect() {
  const { loading, profile, session } = useAuth()
  if (loading) return <FullScreenSpinner />
  return <Navigate to={session ? homePathFor(profile) : '/login'} replace />
}
