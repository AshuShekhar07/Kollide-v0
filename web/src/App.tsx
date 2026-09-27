import { Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { RequireAdmin, RequireAuth, RequireOnboarded, StartRedirect } from './components/guards'
import AdminBans from './pages/admin/AdminBans'
import AdminMetrics from './pages/admin/AdminMetrics'
import AdminPhotos from './pages/admin/AdminPhotos'
import AdminReports from './pages/admin/AdminReports'
import AdminVerification from './pages/admin/AdminVerification'
import AuthCallback from './pages/AuthCallback'
import Chat from './pages/Chat'
import Discover from './pages/Discover'
import GroupDetail from './pages/groups/GroupDetail'
import Groups from './pages/groups/Groups'
import ManageGroup from './pages/groups/ManageGroup'
import NewGroup from './pages/groups/NewGroup'
import Landing from './pages/Landing'
import Likes from './pages/Likes'
import { Privacy, Terms } from './pages/Legal'
import Login from './pages/Login'
import Matches from './pages/Matches'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
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
          </Route>
          <Route path="/chat/:id" element={<Chat />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminVerification />} />
          <Route path="/admin/photos" element={<AdminPhotos />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/bans" element={<AdminBans />} />
          <Route path="/admin/metrics" element={<AdminMetrics />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
