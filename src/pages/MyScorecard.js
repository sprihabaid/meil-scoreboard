import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LEVEL_CONFIG } from '../lib/supabase'

const C = {
  prussian: '#012D4C',
  electric: '#015998',
  green: '#5AB947',
  white: '#FFFFFF',
  bg: '#F0F4F8',
  border: '#CBD5E1',
  text: '#1E293B',
  muted: '#64748B',
}

const BADGE_META = {
  king_of_mt:        { name: 'King of MT',         icon: '👑', color: '#F59E0B' },
  premium_closer:    { name: 'Premium Closer',      icon: '💰', color: '#10B981' },
  market_opener:     { name: 'Market Opener',       icon: '🚀', color: '#3B82F6' },
  loyalty_builder:   { name: 'Loyalty Builder',     icon: '🤝', color: '#8B5CF6' },
  comeback_champion: { name: 'Comeback Champion',   icon: '⚡', color: '#EF4444' },
  pipeline_king:     { name: 'Pipeline King',       icon: '🔮', color: '#06B6D4' },
  speed_award:       { name: 'Speed Award',         icon: '💨', color: '#F97316' },
  first_order:       { name: 'First Order',         icon: '🥇', color: '#F59E0B' },
  century_club:      { name: 'Century Club',        icon: '💯', color: '#10B981' },
  hat_trick:         { name: 'Hat Trick',           icon: '🎯', color: '#8B5CF6' },
  streak_shield:     { name: 'Streak Shield',       icon: '🛡️', color: '#3B82F6' },
  comeback_kid:      { name: 'Comeback Kid',        icon: '📈', color: '#EF4444' },
  zero_to_hero:      { name: 'Zero to Hero',        icon: '🦸', color: '#F97316' },
  speed_demon:       { name: 'Speed Demon',         icon: '💨', color: '#06B6D4' },
  iron_consistency:  { name: 'Iron Consistency',    icon: '🔩', color: '#6B7280' },
  weekly_mvp:        { name: 'Weekly MVP',          icon: '⭐', color: '#F59E0B' },
  personal_best:     { name: 'Personal Best',       icon: '🏆', color: '#10B981' },
}

const RANKS = [
  { key: 'rank_mt',            label: 'Max Orders (MT)',       icon: '⚡' },
  { key: 'rank_closing_price', label: 'Avg Closing Price',     icon: '💰' },
  { key: 'rank_new_clients',   label: 'Most New Clients',      icon: '🚀' },
  { key: 'rank_retention',     label: 'Best Retention Rate',   icon: '🤝' },
  { key: 'rank_inquiries',     label: 'Highest Inquiries',     icon: '🔮' },
  { key: 'rank_tat',           label: 'Fastest TAT',           icon: '💨' },
]

export default function MyScorecard() {
  const { profile, user } = useAuth()
  const [myRow, setMyRow] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [badges, setBadges] = useState([])
  const [kraLogs, setKraLogs] = useState([])
  const [streakData, setStreakData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const uid = user.id
    Promise.all([
      supabase.from('v_current_month_leaderboard').select('*'),
      supabase.from('earned_badges').select('*, badge_definitions(display_name, description, icon, color)').eq('user_id', uid).order('earned_date', { ascending: false }),
      supabase.from('kra_logs').select('kra_name, status, log_date').eq('user_id', uid).gte('log_date', firstOfMonth()),
      supabase.from('streaks').select('*').eq('user_id', uid).maybeSingle(),
    ]).then(([lb, b, kra, streak]) => {
      if (!lb.error && lb.data) {
        const all = lb.data
        setTotalCount(all.length)
        setMyRow(all.find(r => r.id === uid) || null)
      }
      if (!b.error) setBadges(b.data || [])
      if (!kra.error) setKraLogs(kra.data || [])
      if (!streak.error) setStreakData(streak.data)
      setLoading(false)
    })
  }, [user])

  if (loading) return <div style={s.center}>⚡ Loading your scorecard…</div>
  if (!profile) return <div style={s.center}>No profile found.</div>

  const streak = streakData?.current_streak || 0
  const level = myRow?.current_level || 'Trainee'
  const levelCfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.Trainee
  const nextCfg = levelCfg.next ? LEVEL_CONFIG[levelCfg.next] : null
  const totalMt = myRow?.total_mt || 0
  const levelPct = nextCfg ? Math.min(100, ((totalMt - levelCfg.min) / (levelCfg.nextMin - levelCfg.min)) * 100) : 100

  // KRA health
  const kraHealth = computeKraHealth(kraLogs)

  return (
    <div style={s.page}>
      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroAvatar}>{(profile.full_name || '?')[0]}</div>
        <div>
          <h1 style={s.heroName}>{profile.full_name}</h1>
          <div style={s.heroMeta}>
            <LevelPill level={level} />
            <span style={s.streakPill}>
              🔥 {streak} day{streak !== 1 ? 's' : ''} streak
              {streakData?.streak_at_risk && <span style={{ color: '#F59E0B', marginLeft: 6 }}>⚠️ at risk</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Level progress */}
      <div style={s.card}>
        <div style={s.cardTitle}>Level Progress</div>
        <div style={s.levelRow}>
          <span style={{ fontWeight: 700, color: levelCfg.color, fontSize: 15 }}>{levelCfg.icon} {level}</span>
          <span style={s.levelMt}>{totalMt.toFixed(2)} MT total</span>
          {nextCfg && <span style={{ color: C.muted, fontSize: 13 }}>Next: {levelCfg.next} at {levelCfg.nextMin} MT</span>}
        </div>
        <div style={s.bar}>
          <div style={{ ...s.barFill, width: `${levelPct}%`, background: levelCfg.color }} />
        </div>
      </div>

      {/* Ranks grid */}
      <div style={s.cardTitle2}>My Rankings</div>
      <div style={s.ranksGrid}>
        {RANKS.map(r => {
          const rank = myRow?.[r.key]
          return (
            <div key={r.key} style={s.rankCard}>
              <div style={s.rankIcon}>{r.icon}</div>
              <div style={s.rankLabel}>{r.label}</div>
              <div style={s.rankNum}>
                {rank ? (
                  <><span style={{ fontSize: 28, fontWeight: 800, color: rank <= 3 ? ['#F59E0B','#94A3B8','#CD7F32'][rank-1] : C.prussian }}>#{rank}</span><span style={{ fontSize: 13, color: C.muted }}> / {totalCount}</span></>
                ) : '—'}
              </div>
            </div>
          )
        })}
      </div>

      {/* KRA Health */}
      <div style={s.card}>
        <div style={s.cardTitle}>KRA Health This Month</div>
        {kraHealth.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 14 }}>No KRA logs this month yet.</p>
        ) : (
          <div style={s.kraList}>
            {kraHealth.map(kra => (
              <div key={kra.name} style={s.kraRow}>
                <span style={s.kraName}>{kra.name}</span>
                <div style={s.kraStrip}>
                  {kra.days.map((status, i) => (
                    <div key={i} style={{ ...s.kraDay, background: statusColor(status) }} title={status || 'no log'} />
                  ))}
                </div>
                <StatusDot status={kra.latest} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Badges */}
      <div style={s.card}>
        <div style={s.cardTitle}>Badges Earned ({badges.length})</div>
        {badges.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 14 }}>No badges yet — keep going! 🚀</p>
        ) : (
          <div style={s.badgeGrid}>
            {badges.map(b => {
              const meta = BADGE_META[b.badge_category] || { name: b.badge_category, icon: '🏅', color: C.muted }
              return (
                <div key={b.id} style={{ ...s.badgeCard, borderColor: meta.color + '44' }} title={b.badge_definitions?.description}>
                  <div style={{ fontSize: 28 }}>{meta.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, textAlign: 'center', lineHeight: 1.3 }}>{meta.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{b.earned_date}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function LevelPill({ level }) {
  const colors = { Trainee: '#6B7280', Hustler: '#3B82F6', Closer: '#8B5CF6', Elite: '#F59E0B', Legend: '#EF4444' }
  const icons  = { Trainee: '🌱', Hustler: '⚡', Closer: '🔥', Elite: '💎', Legend: '👑' }
  const c = colors[level] || C.muted
  return <span style={{ background: c + '22', color: c, border: `1px solid ${c}55`, borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>{icons[level]} {level}</span>
}

function StatusDot({ status }) {
  return <div style={{ width: 12, height: 12, borderRadius: '50%', background: statusColor(status), flexShrink: 0 }} />
}

function statusColor(s) {
  return s === 'green' ? '#5AB947' : s === 'amber' ? '#F59E0B' : s === 'red' ? '#EF4444' : '#CBD5E1'
}

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

function computeKraHealth(logs) {
  const map = {}
  logs.forEach(l => {
    if (!map[l.kra_name]) map[l.kra_name] = []
    map[l.kra_name].push({ date: l.log_date, status: l.status })
  })
  return Object.entries(map).map(([name, entries]) => {
    const sorted = entries.sort((a, b) => a.date.localeCompare(b.date))
    return {
      name,
      days: sorted.map(e => e.status),
      latest: sorted[sorted.length - 1]?.status,
    }
  })
}

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 900, margin: '0 auto' },
  center: { textAlign: 'center', padding: 60, color: C.muted, fontFamily: 'Montserrat, sans-serif' },
  hero: { display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, background: `linear-gradient(135deg, ${C.prussian}, ${C.electric})`, borderRadius: 16, padding: '24px 28px', color: C.white },
  heroAvatar: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, flexShrink: 0 },
  heroName: { fontSize: 24, fontWeight: 800, margin: 0, marginBottom: 8 },
  heroMeta: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  streakPill: { background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 600 },
  card: { background: C.white, borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 },
  cardTitle2: { fontSize: 13, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 },
  levelRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' },
  levelMt: { fontWeight: 600, fontSize: 14, color: C.text },
  bar: { height: 10, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99, transition: 'width 0.4s ease' },
  ranksGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14, marginBottom: 20 },
  rankCard: { background: C.white, borderRadius: 12, padding: '18px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' },
  rankIcon: { fontSize: 22 },
  rankLabel: { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 },
  rankNum: { display: 'flex', alignItems: 'baseline', gap: 2 },
  kraList: { display: 'flex', flexDirection: 'column', gap: 12 },
  kraRow: { display: 'flex', alignItems: 'center', gap: 12 },
  kraName: { fontSize: 13, fontWeight: 600, color: C.text, width: 160, flexShrink: 0 },
  kraStrip: { display: 'flex', gap: 3, flex: 1 },
  kraDay: { width: 14, height: 14, borderRadius: 3 },
  badgeGrid: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  badgeCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 12px', borderRadius: 10, border: '1.5px solid', background: '#FAFAFA', width: 90, cursor: 'default' },
}
