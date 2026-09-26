import { Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireOnboarded, StartRedirect } from './components/guards'
import AdminVerification from './pages/admin/AdminVerification'
import AuthCallback from './pages/AuthCallback'
import Discover from './pages/Discover'
import Landing from './pages/Landing'
import { Privacy, Terms } from './pages/Legal'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Onboarding from './pages/onboarding/Onboarding'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/start" element={<StartRedirect />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<RequireOnboarded />}>
          <Route path="/discover" element={<Discover />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminVerification />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
