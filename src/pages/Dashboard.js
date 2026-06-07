import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, getDayOfYear, getDaysInMonth } from 'date-fns'

export default function Dashboard() {
  const { profile } = useAuth()
  const [leaderboard, setLeaderboard] = useState([])
  const [teamSummary, setTeamSummary] = useState(null)
  const [feed, setFeed] = useState([])
  const [shoutouts, setShoutouts] = useState([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = getDaysInMonth(today)
  const daysRemaining = daysInMonth - dayOfMonth

  useEffect(() => {
    fetchAll()
    // Refresh every 5 minutes
    const interval = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchAll = async () => {
    try {
      const [lbRes, teamRes, feedRes, shoutRes] = await Promise.all([
        supabase.from('v_current_month_leaderboard').select('*'),
        supabase.from('v_team_summary').select('*').single(),
        supabase.from('recognition_feed')
          .select('*, profiles!recognition_feed_user_id_fkey(full_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('shoutouts')
          .select('*, author:profiles!shoutouts_author_id_fkey(full_name), recipient:profiles!shoutouts_recipient_id_fkey(full_name)')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (lbRes.data) setLeaderboard(lbRes.data)
      if (teamRes.data) setTeamSummary(teamRes.data)
      if (feedRes.data) setFeed(feedRes.data)
      if (shoutRes.data) setShoutouts(shoutRes.data)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingState />

  // Get top 3 for each category
  const top3 = {
    mt: [...leaderboard].sort((a, b) => a.rank_mt - b.rank_mt).slice(0, 3),
    price: [...leaderboard].sort((a, b) => a.rank_closing_price - b.rank_closing_price).slice(0, 3),
    clients: [...leaderboard].sort((a, b) => a.rank_new_clients - b.rank_new_clients).slice(0, 3),
    inquiries: [...leaderboard].sort((a, b) => a.rank_inquiries - b.rank_inquiries).slice(0, 3),
    tat: [...leaderboard].sort((a, b) => a.rank_tat - b.rank_tat).slice(0, 3),
  }

  // Team MT progress
  const teamMtTarget = 260 // ~3100/12 placeholder — set from targets in prod
  const teamMtAchieved = parseFloat(teamSummary?.mtd_mt || 0)
  const teamMtPct = Math.min((teamMtAchieved / teamMtTarget) * 100, 100)

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Good {getGreeting()}, {profile?.full_name?.split(' ')[0]} 👋</h1>
          <p style={styles.pageSubtitle}>
            {format(today, 'EEEE, d MMMM yyyy')} &nbsp;·&nbsp;
            Day {dayOfMonth} of {daysInMonth} &nbsp;·&nbsp;
            <span style={{ color: daysRemaining <= 5 ? '#EF4444' : '#5AB947', fontWeight: 700 }}>
              {daysRemaining} days remaining
            </span>
          </p>
        </div>
        <LiveIndicator />
      </div>

      {/* Team MT Hero Bar */}
      <div style={styles.heroCard}>
        <div style={styles.heroHeader}>
          <div>
            <div style={styles.heroLabel}>TEAM MT — THIS MONTH</div>
            <div style={styles.heroNumbers}>
              <span style={styles.heroAchieved}>{teamMtAchieved.toFixed(1)} MT</span>
              <span style={styles.heroOf}> of </span>
              <span style={styles.heroTarget}>{teamMtTarget} MT target</span>
            </div>
          </div>
          <div style={styles.heroPct}>{teamMtPct.toFixed(0)}%</div>
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${teamMtPct}%` }}>
            {teamMtPct >= 15 && (
              <span style={styles.progressLabel}>{teamMtAchieved.toFixed(1)} MT</span>
            )}
          </div>
          {/* Milestone markers */}
          {[25, 50, 75].map(pct => (
            <div key={pct} style={{ ...styles.milestone, left: `${pct}%` }}>
              <div style={styles.milestoneLine} />
              <span style={styles.milestoneLabel}>{pct}%</span>
            </div>
          ))}
        </div>
        <div style={styles.heroFooter}>
          <span>{(teamMtTarget - teamMtAchieved).toFixed(1)} MT remaining</span>
          <span>Revenue: ₹{parseFloat(teamSummary?.mtd_revenue || 0).toFixed(2)} Cr MTD</span>
        </div>
      </div>

      {/* Main grid */}
      <div style={styles.mainGrid}>
        {/* Left: Leaderboard top 3s */}
        <div style={styles.leaderSection}>
          <h2 style={styles.sectionTitle}>🏆 Live Rankings</h2>
          <div style={styles.leaderGrid}>
            <MiniLeaderboard title="King of MT" icon="👑" color="#F59E0B" data={top3.mt} valueKey="total_mt" unit="MT" />
            <MiniLeaderboard title="Pipeline King" icon="🔮" color="#06B6D4" data={top3.inquiries} valueKey="total_inquiries" unit="MT" />
            <MiniLeaderboard title="Market Opener" icon="🚀" color="#3B82F6" data={top3.clients} valueKey="total_new_clients" unit="clients" />
            <MiniLeaderboard title="Premium Closer" icon="💰" color="#10B981" data={top3.price} valueKey="avg_closing_price" unit="₹/MT" prefix="₹" />
            <MiniLeaderboard title="Speed Award" icon="⚡" color="#F97316" data={top3.tat} valueKey="avg_tat" unit="hrs avg" lowerIsBetter />
          </div>
        </div>

        {/* Right: Recognition feed + Shoutouts */}
        <div style={styles.feedSection}>
          {/* Shoutouts */}
          {shoutouts.length > 0 && (
            <div style={styles.shoutoutCard}>
              <h2 style={styles.sectionTitle}>📣 Shoutouts</h2>
              {shoutouts.map(s => (
                <div key={s.id} style={styles.shoutoutItem}>
                  <div style={styles.shoutoutName}>{s.recipient?.full_name}</div>
                  <div style={styles.shoutoutText}>{s.action_text}</div>
                  <div style={styles.shoutoutImpact}>Impact: {s.impact_text}</div>
                </div>
              ))}
            </div>
          )}

          {/* Auto recognition feed */}
          <h2 style={styles.sectionTitle}>🔥 Recognition Feed</h2>
          <div style={styles.feedList}>
            {feed.length === 0 ? (
              <div style={styles.emptyFeed}>
                No activity yet today. First entry wins! 🚀
              </div>
            ) : (
              feed.map(item => (
                <FeedItem key={item.id} item={item} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Streak board */}
      <div style={styles.streakSection}>
        <h2 style={styles.sectionTitle}>🔥 KRA Streaks</h2>
        <div style={styles.streakGrid}>
          {leaderboard.map(person => (
            <StreakCard key={person.id} person={person} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ——— Sub-components ———

function MiniLeaderboard({ title, icon, color, data, valueKey, unit, prefix = '', lowerIsBetter }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div style={styles.miniBoard}>
      <div style={{ ...styles.miniBoardHeader, borderLeft: `3px solid ${color}` }}>
        <span style={styles.miniBoardIcon}>{icon}</span>
        <span style={styles.miniBoardTitle}>{title}</span>
      </div>
      {data.map((person, i) => (
        <div key={person.id} style={styles.miniBoardRow}>
          <span style={styles.miniBoardMedal}>{medals[i]}</span>
          <span style={styles.miniBoardName}>{person.full_name?.split(' ')[0]}</span>
          <span style={{ ...styles.miniBoardValue, color }}>
            {prefix}{parseFloat(person[valueKey] || 0).toFixed(1)} {unit}
          </span>
        </div>
      ))}
      {data.length === 0 && (
        <div style={styles.noData}>No data yet</div>
      )}
    </div>
  )
}

function FeedItem({ item }) {
  const timeAgo = getTimeAgo(item.created_at)
  return (
    <div style={styles.feedItem}>
      <div style={styles.feedEmoji}>{item.emoji}</div>
      <div style={styles.feedContent}>
        <div style={styles.feedTitle}>
          <strong>{item.profiles?.full_name}</strong> {item.event_title}
        </div>
        <div style={styles.feedBody}>{item.event_body}</div>
        <div style={styles.feedTime}>{timeAgo}</div>
      </div>
    </div>
  )
}

function StreakCard({ person }) {
  const isAtRisk = person.streak_at_risk
  const streak = person.current_streak || 0
  return (
    <div style={{
      ...styles.streakCard,
      borderColor: isAtRisk ? '#FCA5A5' : streak >= 4 ? '#5AB947' : 'transparent',
      background: isAtRisk ? '#FEF2F2' : '#FFFFFF',
    }}>
      <div style={styles.streakAvatar}>{person.full_name?.charAt(0)}</div>
      <div style={styles.streakName}>{person.full_name?.split(' ')[0]}</div>
      <div style={{ ...styles.streakCount, color: streak >= 4 ? '#5AB947' : streak >= 2 ? '#F59E0B' : '#9CA3AF' }}>
        {streak > 0 ? `🔥 ${streak}` : '—'}
      </div>
      {isAtRisk && <div style={styles.atRiskBadge}>⚠️ At Risk</div>}
    </div>
  )
}

function LiveIndicator() {
  return (
    <div style={styles.liveIndicator}>
      <div style={styles.liveDot} />
      LIVE
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
      Loading scoreboard...
    </div>
  )
}

// ——— Helpers ———
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ——— Styles ———
const styles = {
  container: { maxWidth: '1400px', margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#012D4C',
    margin: '0 0 4px',
  },
  pageSubtitle: {
    fontSize: '13px',
    color: '#6B7280',
    margin: 0,
    fontWeight: '500',
  },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#012D4C',
    color: '#5AB947',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.1em',
  },
  liveDot: {
    width: '6px',
    height: '6px',
    background: '#5AB947',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite',
  },
  // Hero card
  heroCard: {
    background: '#012D4C',
    borderRadius: '16px',
    padding: '24px 28px',
    marginBottom: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  heroHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  heroLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.1em',
    marginBottom: '6px',
  },
  heroNumbers: { display: 'flex', alignItems: 'baseline', gap: '6px' },
  heroAchieved: { fontSize: '32px', fontWeight: '800', color: '#5AB947' },
  heroOf: { fontSize: '16px', color: 'rgba(255,255,255,0.4)' },
  heroTarget: { fontSize: '16px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroPct: {
    fontSize: '42px',
    fontWeight: '900',
    color: 'rgba(255,255,255,0.15)',
  },
  progressTrack: {
    height: '12px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '6px',
    position: 'relative',
    overflow: 'visible',
    marginBottom: '12px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #5AB947, #7DD44A)',
    borderRadius: '6px',
    transition: 'width 1s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '8px',
    minWidth: '4px',
  },
  progressLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#012D4C',
    whiteSpace: 'nowrap',
  },
  milestone: {
    position: 'absolute',
    top: '-4px',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  milestoneLine: {
    width: '1px',
    height: '20px',
    background: 'rgba(255,255,255,0.3)',
  },
  milestoneLabel: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    marginTop: '2px',
  },
  heroFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  // Main grid
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: '20px',
    marginBottom: '24px',
  },
  leaderSection: {},
  feedSection: {},
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#012D4C',
    margin: '0 0 12px',
    letterSpacing: '0.02em',
  },
  leaderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  miniBoard: {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  miniBoardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
    paddingLeft: '8px',
  },
  miniBoardIcon: { fontSize: '14px' },
  miniBoardTitle: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  miniBoardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 0',
    borderBottom: '1px solid #F3F4F6',
  },
  miniBoardMedal: { fontSize: '14px', width: '18px' },
  miniBoardName: {
    flex: 1,
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  miniBoardValue: {
    fontSize: '11px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  noData: {
    fontSize: '12px',
    color: '#9CA3AF',
    textAlign: 'center',
    padding: '8px',
  },
  // Feed
  shoutoutCard: {
    background: 'linear-gradient(135deg, #012D4C, #015998)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  shoutoutItem: {
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    paddingBottom: '10px',
    marginBottom: '10px',
  },
  shoutoutName: {
    fontSize: '13px',
    fontWeight: '800',
    color: '#5AB947',
    marginBottom: '2px',
  },
  shoutoutText: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '2px',
  },
  shoutoutImpact: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '500px',
    overflowY: 'auto',
  },
  feedItem: {
    display: 'flex',
    gap: '10px',
    background: '#FFFFFF',
    borderRadius: '10px',
    padding: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    alignItems: 'flex-start',
  },
  feedEmoji: {
    fontSize: '20px',
    flexShrink: 0,
    lineHeight: 1,
    marginTop: '1px',
  },
  feedContent: { flex: 1 },
  feedTitle: {
    fontSize: '12px',
    color: '#111827',
    marginBottom: '2px',
    lineHeight: 1.4,
  },
  feedBody: {
    fontSize: '11px',
    color: '#6B7280',
    marginBottom: '4px',
    lineHeight: 1.4,
  },
  feedTime: {
    fontSize: '10px',
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyFeed: {
    background: '#F9FAFB',
    borderRadius: '10px',
    padding: '20px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#9CA3AF',
    fontWeight: '600',
  },
  // Streaks
  streakSection: { marginBottom: '8px' },
  streakGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  streakCard: {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    minWidth: '90px',
    border: '2px solid transparent',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    transition: 'all 0.2s',
  },
  streakAvatar: {
    width: '36px',
    height: '36px',
    background: '#012D4C',
    color: '#FFFFFF',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '700',
  },
  streakName: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#374151',
  },
  streakCount: {
    fontSize: '16px',
    fontWeight: '800',
  },
  atRiskBadge: {
    fontSize: '9px',
    background: '#FEE2E2',
    color: '#DC2626',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '700',
  },
}
