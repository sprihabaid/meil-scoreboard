import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user, signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Background pattern */}
      <div style={styles.bgPattern} />

      <div style={styles.card}>
        {/* Logo area */}
        <div style={styles.logoArea}>
          <div style={styles.logoMark}>M</div>
          <div>
            <div style={styles.companyName}>MANGAL ELECTRICAL</div>
            <div style={styles.companySubtitle}>INDUSTRIES LIMITED</div>
          </div>
        </div>

        <div style={styles.divider} />

        <h1 style={styles.title}>Sales Scoreboard</h1>
        <p style={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@meil.co.in"
              style={styles.input}
              required
              autoFocus
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              required
            />
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{ ...styles.button, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <p style={styles.footer}>
          Contact your admin if you need access
        </p>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center' }}>
      <div style={styles.spinner} />
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#012D4C',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Montserrat', sans-serif",
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(circle at 20% 50%, rgba(1,89,152,0.4) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(90,185,71,0.15) 0%, transparent 40%)`,
    pointerEvents: 'none',
  },
  card: {
    background: 'rgba(255,255,255,0.97)',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
    position: 'relative',
    zIndex: 1,
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '24px',
  },
  logoMark: {
    width: '48px',
    height: '48px',
    background: '#012D4C',
    color: '#5AB947',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    fontSize: '24px',
    fontWeight: '800',
    flexShrink: 0,
  },
  companyName: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#012D4C',
    letterSpacing: '0.08em',
    lineHeight: 1.2,
  },
  companySubtitle: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#015998',
    letterSpacing: '0.1em',
  },
  divider: {
    height: '1px',
    background: '#E5E7EB',
    marginBottom: '28px',
  },
  title: {
    fontSize: '26px',
    fontWeight: '800',
    color: '#012D4C',
    margin: '0 0 6px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 28px',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#374151',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  input: {
    padding: '12px 14px',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: "'Montserrat', sans-serif",
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  errorBox: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
  },
  button: {
    background: '#012D4C',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '700',
    fontFamily: "'Montserrat', sans-serif",
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'background 0.2s',
    marginTop: '4px',
  },
  footer: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#9CA3AF',
    marginTop: '20px',
    marginBottom: 0,
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(255,255,255,0.2)',
    borderTop: '4px solid #5AB947',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  }
}
