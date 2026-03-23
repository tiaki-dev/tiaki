import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router'
import AppLayout from './components/layout/AppLayout'
import LoginScreen from './components/LoginScreen'
import DashboardPage from './pages/Dashboard'
import HostsPage from './pages/Hosts'
import ContainersPage from './pages/Containers'
import UpdatesPage from './pages/Updates'
import AuditLogPage from './pages/AuditLog'
import PoliciesPage from './pages/Policies'
import SettingsPage from './pages/Settings'
import { auth } from './lib/trpc'

export default function App() {
  const [authed, setAuthed] = useState(() => !!auth.getToken())

  if (!authed) {
    return <LoginScreen onAuth={() => setAuthed(true)} />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="hosts" element={<HostsPage />} />
        <Route path="containers" element={<ContainersPage />} />
        <Route path="updates" element={<UpdatesPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
