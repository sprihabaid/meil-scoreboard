import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/shared/AppLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Leaderboard from './pages/Leaderboard'
import MyScorecard from './pages/MyScorecard'
import KRALog from './pages/KRALog'
import TeamPanel from './pages/TeamPanel'
import HallOfFame from './pages/HallOfFame'
import DataEntry from './pages/admin/DataEntry'
import TargetManager from './pages/admin/TargetManager'
import UserManager from './pages/admin/UserManager'
import AuditLog from './pages/admin/AuditLog'
import Reports from './pages/Reports'

function ProtectedRoute({ children, permission }) {
  const { user, loading, can } = useAuth()
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
            <Leaderboard />
          </ProtectedRoute>
        } />

        <Route path="scorecard" element={
          <ProtectedRoute>
            <MyScorecard />
          </ProtectedRoute>
        } />

        <Route path="team" element={
          <ProtectedRoute permission="view_team_panel">
            <TeamPanel />
          </ProtectedRoute>
        } />

        <Route path="kra" element={
          <ProtectedRoute>
            <KRALog />
          </ProtectedRoute>
        } />

        <Route path="hall-of-fame" element={
          <ProtectedRoute>
            <HallOfFame />
          </ProtectedRoute>
        } />

        <Route path="admin/entry" element={
          <ProtectedRoute permission="enter_data">
            <DataEntry />
          </ProtectedRoute>
        } />

        <Route path="admin/targets" element={
          <ProtectedRoute permission="set_targets">
            <TargetManager />
          </ProtectedRoute>
        } />

        <Route path="admin/users" element={
          <ProtectedRoute permission="manage_users">
            <UserManager />
          </ProtectedRoute>
        } />

        <Route path="admin/audit" element={
          <ProtectedRoute permission="view_audit_log">
            <AuditLog />
          </ProtectedRoute>
        } />

        <Route path="reports" element={
          <ProtectedRoute permission="export_reports">
            <Reports />
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
