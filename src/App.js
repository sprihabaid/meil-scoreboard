import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/shared/AppLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'


function ProtectedRoute({ children, permission }) {
  const { user, profile, loading, can } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (permission && !can(permission)) return <AccessDenied />
  return children
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Montserrat, sans-serif', color: '#9CA3AF' }}>
      <div>⚡ Loading...</div>
    </div>
  )
}

function AccessDenied() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
      <h2 style={{ color: '#012D4C', marginBottom: '8px' }}>Access Denied</h2>
      <p style={{ color: '#6B7280' }}>You don't have permission to view this page.</p>
    </div>
  )
}

function ComingSoon({ title }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
      <h2 style={{ color: '#012D4C', marginBottom: '8px' }}>{title}</h2>
      <p style={{ color: '#6B7280' }}>Being built in the next session.</p>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />

        <Route path="leaderboard" element={
          <ProtectedRoute permission="view_leaderboard">
            <React.Suspense fallback={<PageLoader />}>
              <ComingSoon title="Full Leaderboard" />
            </React.Suspense>
          </ProtectedRoute>
        } />

        <Route path="scorecard" element={
          <ProtectedRoute>
            <React.Suspense fallback={<PageLoader />}>
              <ComingSoon title="My Scorecard" />
            </React.Suspense>
          </ProtectedRoute>
        } />

        <Route path="team" element={
          <ProtectedRoute permission="view_team_panel">
            <React.Suspense fallback={<PageLoader />}>
              <ComingSoon title="Team Panel" />
            </React.Suspense>
          </ProtectedRoute>
        } />

        <Route path="kra" element={
          <ProtectedRoute>
            <ComingSoon title="KRA Log" />
          </ProtectedRoute>
        } />

        <Route path="hall-of-fame" element={
          <ProtectedRoute>
            <ComingSoon title="Hall of Fame" />
          </ProtectedRoute>
        } />

        {/* Admin routes */}
        <Route path="admin/entry" element={
          <ProtectedRoute permission="enter_data">
            <ComingSoon title="Data Entry" />
          </ProtectedRoute>
        } />

        <Route path="admin/targets" element={
          <ProtectedRoute permission="set_targets">
            <ComingSoon title="Target Manager" />
          </ProtectedRoute>
        } />

        <Route path="admin/users" element={
          <ProtectedRoute permission="manage_users">
            <ComingSoon title="User Manager" />
          </ProtectedRoute>
        } />

        <Route path="admin/audit" element={
          <ProtectedRoute permission="view_audit_log">
            <ComingSoon title="Audit Log" />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
