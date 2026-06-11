import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LEVEL_CONFIG } from '../../lib/supabase'

const NAV_ITEMS = [
  { path: '/',              label: 'Dashboard',     icon: '⚡', permission: null },
  { path: '/leaderboard',   label: 'Leaderboard',   icon: '🏆', permission: 'view_leaderboard' },
  { path: '/scorecard',     label: 'My Scorecard',  icon: '📊', permission: null },
  { path: '/team',          label: 'Team Panel',    icon: '🎯', permission: 'view_team_panel' },
  { path: '/kra',           label: 'KRA Log',       icon: '✅', permission: null },
  { path: '/hall-of-fame',  label: 'Hall of Fame',  icon: '🌟', permission: null },
]

const ADMIN_NAV_ITEMS = [
  { path: '/admin/entry',   label: 'Data Entry',    icon: '📝', permission: 'enter_data' },
  { path: '/admin/targets', label: 'Target Manager',icon: '🎯', permission: 'set_targets' },
  { path: '/admin/users',   label: 'Manage Users',  icon: '👥', permission: 'manage_users' },
  { path: '/admin/audit',   label: 'Audit Log',     icon: '🔍', permission: 'view_audit_log' },
]

export default function AppLayout() {
  const { profile, signOut, can } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const levelConfig = profile ? LEVEL_CONFIG[profile.current_level || 'Trainee'] : LEVEL_CONFIG.Trainee

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const visibleNav = NAV_ITEMS.filter(item =>
    !item.permission || can(item.permission)
  )
  const visibleAdmin = ADMIN_NAV_ITEMS.filter(item =>
    !item.permission || can(item.permission)
  )

  // On mobile the sidebar is always full-width, so labels are always visible.
  // On desktop labels are visible only when sidebarOpen.
  const showLabels = isMobile || sidebarOpen

  return (
    <div style={styles.root}>
      {/* Mobile overlay — only rendered and visible on mobile when drawer is open */}
      {isMobile && mobileOpen && (
        <div style={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside style={{
        ...styles.sidebar,
        ...(isMobile
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              height: '100vh',
              width: '240px',
              transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
              zIndex: 50,
            }
          : {
              width: sidebarOpen ? '240px' : '64px',
            }
        ),
      }}>
        {/* Logo */}
        <div style={styles.sidebarLogo}>
          <div style={styles.logoMark}>M</div>
          {showLabels && (
            <div style={styles.logoText}>
              <div style={styles.logoTitle}>MEIL</div>
              <div style={styles.logoSub}>Scoreboard</div>
            </div>
          )}
          {isMobile ? (
            <button onClick={() => setMobileOpen(false)} style={styles.collapseBtn}>✕</button>
          ) : (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={styles.collapseBtn}>
              {sidebarOpen ? '◀' : '▶'}
            </button>
          )}
        </div>

        {/* Main nav */}
        <nav style={styles.nav}>
          {visibleNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
              onClick={() => setMobileOpen(false)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {showLabels && <span style={styles.navLabel}>{item.label}</span>}
            </NavLink>
          ))}

          {/* Admin section */}
          {visibleAdmin.length > 0 && (
            <>
              {showLabels && <div style={styles.navSection}>ADMIN</div>}
              {!showLabels && <div style={styles.navDivider} />}
              {visibleAdmin.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => ({
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                  })}
                  onClick={() => setMobileOpen(false)}
                >
                  <span style={styles.navIcon}>{item.icon}</span>
                  {showLabels && <span style={styles.navLabel}>{item.label}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User profile at bottom */}
        <div style={styles.userArea}>
          <div style={styles.userInfo}>
            <div style={{ ...styles.userAvatar, background: levelConfig.color }}>
              {profile?.full_name?.charAt(0) || '?'}
            </div>
            {showLabels && (
              <div style={styles.userDetails}>
                <div style={styles.userName}>{profile?.full_name}</div>
                <div style={styles.userRole}>
                  {levelConfig.icon} {profile?.role?.replace('_', ' ')}
                </div>
              </div>
            )}
          </div>
          {showLabels && (
            <button onClick={handleSignOut} style={styles.signOutBtn}>
              Sign out
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        {/* Mobile header — only rendered on mobile */}
        {isMobile && (
          <div style={styles.mobileHeader}>
            <button onClick={() => setMobileOpen(true)} style={styles.menuBtn}>☰</button>
            <div style={styles.mobileTitle}>MEIL Scoreboard</div>
            <div style={{ ...styles.userAvatar, background: levelConfig.color }}>
              {profile?.full_name?.charAt(0) || '?'}
            </div>
          </div>
        )}

        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    height: '100vh',
    background: '#F1F5F9',
    fontFamily: "'Montserrat', sans-serif",
    overflow: 'hidden',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 40,
  },
  sidebar: {
    background: '#012D4C',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    transition: 'width 0.25s ease, transform 0.25s ease',
    overflow: 'hidden',
    zIndex: 50,
    position: 'relative',
  },
  sidebarLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logoMark: {
    width: '32px',
    height: '32px',
    background: '#5AB947',
    color: '#012D4C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '900',
    flexShrink: 0,
  },
  logoText: { flex: 1, overflow: 'hidden' },
  logoTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: '0.05em',
  },
  logoSub: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  collapseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: '10px',
    padding: '4px',
    flexShrink: 0,
  },
  nav: {
    flex: 1,
    padding: '12px 8px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 10px',
    borderRadius: '8px',
    textDecoration: 'none',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  navItemActive: {
    background: 'rgba(90,185,71,0.15)',
    color: '#5AB947',
  },
  navIcon: {
    fontSize: '16px',
    flexShrink: 0,
    width: '20px',
    textAlign: 'center',
  },
  navLabel: { overflow: 'hidden' },
  navSection: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: '0.1em',
    padding: '12px 10px 4px',
  },
  navDivider: {
    height: '1px',
    background: 'rgba(255,255,255,0.1)',
    margin: '8px 0',
  },
  userArea: {
    padding: '12px 10px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    background: '#015998',
    color: '#FFFFFF',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
    flexShrink: 0,
  },
  userDetails: { overflow: 'hidden' },
  userName: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#FFFFFF',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'capitalize',
  },
  signOutBtn: {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    borderRadius: '6px',
    padding: '7px',
    fontSize: '11px',
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  mobileHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#012D4C',
    gap: '12px',
  },
  menuBtn: {
    background: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '20px',
    cursor: 'pointer',
  },
  mobileTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: '15px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
}
