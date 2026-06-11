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
  const [teamMtTarget, setTeamMtTarget] = useState(null)
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
      const [lbRes, teamRes, feedRes, shoutRes, targetRes] = await Promise.all([
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
        supabase.from('targets').select('target_mt').is('effective_to', null),
      ])

      if (lbRes.data) setLeaderboard(lbRes.data)
      if (teamRes.data) setTeamSummary(teamRes.data)
      if (feedRes.data) setFeed(feedRes.data)
      if (shoutRes.data) setShoutouts(shoutRes.data)
      if (!targetRes.error && targetRes.data?.length > 0) {
        setTeamMtTarget(targetRes.data.reduce((sum, t) => sum + parseFloat(t.target_mt || 0), 0))
      } else {
        setTeamMtTarget(null)
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingState />

  // Team MT progress
  const teamMtAchieved = parseFloat(teamSummary?.mtd_mt || 0)
  const teamMtPct = teamMtTarget ? Math.min((teamMtAchieved / teamMtTarget) * 100, 100) : 0

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
              {teamMtTarget ? (
                <>
                  <span style={styles.heroOf}> of </span>
                  <span style={styles.heroTarget}>{teamMtTarget.toFixed(0)} MT target</span>
                </>
              ) : (
                <span style={{ ...styles.heroTarget, color: 'rgba(255,255,255,0.35)', fontSize: 13 }}> — No target set</span>
              )}
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
          <span>{teamMtTarget ? `${(teamMtTarget - teamMtAchieved).toFixed(1)} MT remaining` : 'Set targets to track progress'}</span>
          <span>Revenue: ₹{parseFloat(teamSummary?.mtd_revenue || 0).toFixed(2)} Cr MTD</span>
        </div>
      </div>

      {/* Main grid */}
      <div style={styles.mainGrid}>
        {/* Left: Monthly Award Showcase */}
        <div style={styles.leaderSection}>
          <h2 style={styles.sectionTitle}>🏆 Monthly Awards</h2>
          <AwardShowcase leaderboard={leaderboard} />
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

const AWARDS = [
  {
    id: 'top_closer',
    title: 'Top Closer',
    icon: '👑',
    accent: '#F59E0B',
    valueKey: 'total_mt',
    fmt: v => `${(+v).toFixed(1)} MT dispatched`,
    desc: 'Highest MT brought in this month',
  },
  {
    id: 'pipeline_builder',
    title: 'Pipeline Builder',
    icon: '🔥',
    accent: '#EF4444',
    valueKey: 'total_inquiries',
    fmt: v => `${(+v).toFixed(1)} MT in pipeline`,
    desc: 'Most MT worth of active inquiries',
  },
  {
    id: 'new_account',
    title: 'New Account Winner',
    icon: '🌟',
    accent: '#5AB947',
    valueKey: 'total_new_clients',
    fmt: v => `${v} new account${+v !== 1 ? 's' : ''} opened`,
    desc: 'Most new customers added this month',
  },
  {
    id: 'winback',
    title: 'Win-Back Champion',
    icon: '⚡',
    accent: '#7DD4FC',
    valueKey: 'total_winback_clients',
    fmt: v => `${v} lost client${+v !== 1 ? 's' : ''} recovered`,
    desc: 'Most previously lost customers brought back',
  },
  {
    id: 'client_keeper',
    title: 'Client Keeper',
    icon: '🛡️',
    accent: '#A78BFA',
    valueKey: 'retention_rate',
    fmt: v => `${(+v).toFixed(1)}% retention rate`,
    desc: 'Best at keeping existing clients coming back',
  },
]

function AwardShowcase({ leaderboard }) {
  const getWinner = (award) => {
    const sorted = [...leaderboard].sort(
      (a, b) => parseFloat(b[award.valueKey] || 0) - parseFloat(a[award.valueKey] || 0)
    )
    const topVal = parseFloat(sorted[0]?.[award.valueKey] || 0)
    if (!sorted.length || topVal === 0) return null
    return {
      names: sorted
        .filter(r => parseFloat(r[award.valueKey] || 0) === topVal)
        .map(r => r.full_name?.split(' ')[0] || '?')
        .join(' & '),
      value: topVal,
    }
  }

  return (
    <div style={aw.grid}>
      {AWARDS.map(award => (
        <AwardCard key={award.id} award={award} result={getWinner(award)} />
      ))}
    </div>
  )
}

function AwardCard({ award, result }) {
  return (
    <div style={{ ...aw.card, boxShadow: `0 4px 24px ${award.accent}22` }}>
      <div style={aw.topRow}>
        <span style={{ ...aw.icon, filter: `drop-shadow(0 0 6px ${award.accent}88)` }}>{award.icon}</span>
        <span style={{ ...aw.badge, background: award.accent + '20', color: award.accent }}>AWARD</span>
      </div>
      <div style={{ ...aw.awardTitle, color: 'rgba(255,255,255,0.45)' }}>{award.title.toUpperCase()}</div>
      {result ? (
        <>
          <div style={aw.winnerName}>{result.names}</div>
          <div style={{ ...aw.stat, color: award.accent }}>{award.fmt(result.value)}</div>
          <div style={aw.desc}>{award.desc}</div>
        </>
      ) : (
        <>
          <div style={aw.noWinner}>No winner yet</div>
          <div style={aw.desc}>{award.desc}</div>
        </>
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
  leaderGrid: {},
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

// ——— Award card styles ———
const aw = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: '12px',
  },
  card: {
    background: 'linear-gradient(145deg, #012D4C 0%, #01243f 100%)',
    borderRadius: '14px',
    padding: '18px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    border: '1px solid rgba(255,255,255,0.06)',
    position: 'relative',
    overflow: 'hidden',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '4px',
  },
  icon: {
    fontSize: '28px',
    lineHeight: 1,
  },
  badge: {
    fontSize: '9px',
    fontWeight: '800',
    letterSpacing: '0.1em',
    padding: '3px 7px',
    borderRadius: '4px',
  },
  awardTitle: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    fontFamily: "'Montserrat', sans-serif",
  },
  winnerName: {
    fontSize: '22px',
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 1.1,
    fontFamily: "'Montserrat', sans-serif",
    marginTop: '2px',
  },
  stat: {
    fontSize: '13px',
    fontWeight: '700',
    fontFamily: "'Montserrat', sans-serif",
  },
  desc: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
    lineHeight: 1.4,
    marginTop: '2px',
  },
  noWinner: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    marginTop: '6px',
    fontFamily: "'Montserrat', sans-serif",
  },
}
