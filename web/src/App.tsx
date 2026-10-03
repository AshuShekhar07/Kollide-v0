import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { RequireAdmin, RequireAuth, RequireOnboarded, StartRedirect } from './components/guards'
import { FullScreenSpinner } from './components/ui'
import AuthCallback from './pages/AuthCallback'
import JoinGroup from './pages/JoinGroup'
import Landing from './pages/Landing'
import { Privacy, Terms } from './pages/Legal'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

// Everything behind sign-in loads on demand, so the landing page, login and the
// legal pages don't download the whole app first.
const AppShell = lazy(() => import('./components/AppShell'))
const AdminBans = lazy(() => import('./pages/admin/AdminBans'))
const AdminMetrics = lazy(() => import('./pages/admin/AdminMetrics'))
const AdminPhotos = lazy(() => import('./pages/admin/AdminPhotos'))
const AdminProfiles = lazy(() => import('./pages/admin/AdminProfiles'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))
const AdminVerification = lazy(() => import('./pages/admin/AdminVerification'))
const Chat = lazy(() => import('./pages/Chat'))
const Discover = lazy(() => import('./pages/Discover'))
const GroupDetail = lazy(() => import('./pages/groups/GroupDetail'))
const Groups = lazy(() => import('./pages/groups/Groups'))
const ManageGroup = lazy(() => import('./pages/groups/ManageGroup'))
const NewGroup = lazy(() => import('./pages/groups/NewGroup'))
const Likes = lazy(() => import('./pages/Likes'))
const Matches = lazy(() => import('./pages/Matches'))
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/start" element={<StartRedirect />} />
        <Route path="/join/:token" element={<JoinGroup />} />

        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<RequireOnboarded />}>
            <Route element={<AppShell />}>
              <Route path="/discover" element={<Discover />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/new" element={<NewGroup />} />
              <Route path="/groups/:id" element={<GroupDetail />} />
              <Route path="/groups/:id/manage" element={<ManageGroup />} />
              <Route path="/likes" element={<Likes />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/chat/:id" element={<Chat />} />
            </Route>
          </Route>
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminVerification />} />
            <Route path="/admin/photos" element={<AdminPhotos />} />
            <Route path="/admin/profiles" element={<AdminProfiles />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/bans" element={<AdminBans />} />
            <Route path="/admin/metrics" element={<AdminMetrics />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
