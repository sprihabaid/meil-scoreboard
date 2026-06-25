import React, { useCallback, useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const C = { prussian: '#012D4C', electric: '#015998', green: '#5AB947', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', error: '#EF4444', amber: '#F59E0B', bg: '#F8FAFC' }

const METRICS = [
  { key: 'total_mt',            label: 'MT',           fmt: v => `${(+v).toFixed(1)}` },
  { key: 'total_new_clients',   label: 'New Clients',  fmt: v => `${v}` },
  { key: 'total_winback_clients', label: 'Win-Back',   fmt: v => `${v}` },
  { key: 'total_revenue',       label: 'Revenue (Cr)', fmt: v => `₹${(+v).toFixed(2)}` },
  { key: 'avg_closing_price',   label: 'Avg Price',    fmt: v => `₹${Math.round(+v).toLocaleString()}` },
  { key: 'avg_tat',             label: 'TAT (hrs)',    fmt: v => `${(+v).toFixed(1)}` },
  { key: 'total_inquiries',     label: 'Inquiries',    fmt: v => `${(+v).toFixed(1)} MT` },
]

const CHART_COLORS = ['#015998', '#5AB947', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316']

export default function Reports() {
  const { profile } = useAuth()
  const reportRef = useRef(null)

  const [reportType, setReportType]   = useState('individual')
  const [users, setUsers]             = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading]         = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Individual report data
  const [dailyEntries, setDailyEntries]   = useState([])
  const [leaderboard, setLeaderboard]     = useState([])
  const [kraCompliance, setKraCompliance] = useState([])
  const [badges, setBadges]               = useState([])

  // Team report data
  const [teamDailyMt, setTeamDailyMt]     = useState([])
  const [productMix, setProductMix]       = useState([])

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, team')
      .eq('is_active', true).neq('role', 'superadmin').order('full_name')
      .then(({ data }) => setUsers(data || []))
    supabase.from('v_current_month_leaderboard').select('*')
      .then(({ data }) => setLeaderboard(data || []))
  }, [])

  const loadIndividual = useCallback(async (userId) => {
    if (!userId) return
    setLoading(true)
    const monthStart = firstOfMonth()

    const [entriesRes, kraRes, badgesRes] = await Promise.all([
      supabase.from('daily_entries').select('entry_date, mt_brought, revenue_rs_cr')
        .eq('user_id', userId).gte('entry_date', monthStart).order('entry_date'),
      supabase.from('kra_logs').select('log_date, kra_name, status')
        .eq('user_id', userId).gte('log_date', fourWeeksAgo()).order('log_date'),
      supabase.from('earned_badges').select('badge_category, earned_date')
        .eq('user_id', userId).order('earned_date', { ascending: false }).limit(10),
    ])

    setDailyEntries((entriesRes.data || []).map(e => ({
      date: e.entry_date.slice(5),  // MM-DD
      mt: parseFloat(e.mt_brought || 0),
      revenue: parseFloat(e.revenue_rs_cr || 0),
    })))

    // KRA compliance: group by week
    const weekMap = {}
    ;(kraRes.data || []).forEach(k => {
      const week = getWeekLabel(k.log_date)
      if (!weekMap[week]) weekMap[week] = { total: 0, green: 0, amber: 0 }
      weekMap[week].total++
      if (k.status === 'green') weekMap[week].green++
      if (k.status === 'amber') weekMap[week].amber++
    })
    setKraCompliance(Object.entries(weekMap).map(([week, v]) => ({
      week,
      compliance: v.total > 0 ? Math.round(((v.green + v.amber) / v.total) * 100) : 0,
      onTrack: v.total > 0 ? Math.round((v.green / v.total) * 100) : 0,
    })))

    setBadges(badgesRes.data || [])
    setLoading(false)
  }, [])

  const loadTeam = useCallback(async () => {
    setLoading(true)
    const monthStart = firstOfMonth()

    const [dailyRes, targetsRes] = await Promise.all([
      supabase.from('daily_entries').select('entry_date, mt_brought, user_id')
        .gte('entry_date', monthStart).order('entry_date'),
      supabase.from('targets').select('final_product, target_mt').is('effective_to', null),
    ])

    // Aggregate MT by date
    const byDate = {}
    ;(dailyRes.data || []).forEach(e => {
      const d = e.entry_date.slice(5)
      byDate[d] = (byDate[d] || 0) + parseFloat(e.mt_brought || 0)
    })
    setTeamDailyMt(Object.entries(byDate).map(([date, mt]) => ({ date, mt: +mt.toFixed(2) })))

    // Product mix from targets (planned breakdown)
    const prodMap = {}
    ;(targetsRes.data || []).forEach(t => {
      prodMap[t.final_product] = (prodMap[t.final_product] || 0) + parseFloat(t.target_mt || 0)
    })
    const total = Object.values(prodMap).reduce((s, v) => s + v, 0)
    setProductMix(Object.entries(prodMap).map(([product, mt]) => ({
      product, mt: +mt.toFixed(1),
      pct: total > 0 ? Math.round((mt / total) * 100) : 0,
    })))

    setLoading(false)
  }, [])

  useEffect(() => {
    if (reportType === 'individual' && selectedUserId) loadIndividual(selectedUserId)
    if (reportType === 'team') loadTeam()
  }, [reportType, selectedUserId, loadIndividual, loadTeam])

  const handleDownload = async () => {
    if (!reportRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#F8FAFC' })
      const link = document.createElement('a')
      const name = reportType === 'individual'
        ? users.find(u => u.id === selectedUserId)?.full_name?.replace(/\s+/g, '_') || 'report'
        : 'team_report'
      link.download = `MEIL_${name}_${new Date().toISOString().slice(0,10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloading(false)
    }
  }

  const selectedUser = users.find(u => u.id === selectedUserId)
  const myStats = leaderboard.find(p => p.id === selectedUserId)
  const teamAvg = METRICS.reduce((acc, m) => {
    const vals = leaderboard.map(p => parseFloat(p[m.key] || 0))
    acc[m.key] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    return acc
  }, {})

  const comparisonData = METRICS.map(m => ({
    metric: m.label,
    me: myStats ? parseFloat(myStats[m.key] || 0) : 0,
    teamAvg: +teamAvg[m.key].toFixed(2),
  }))

  return (
    <div style={s.page}>
      {/* Controls */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Reports</h1>
          <p style={s.sub}>Analytics and performance summaries for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
        </div>
        {(reportType === 'team' || (reportType === 'individual' && selectedUserId)) && (
          <button style={s.downloadBtn} onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Capturing…' : '⬇ Download Report'}
          </button>
        )}
      </div>

      {/* Report type selector */}
      <div style={s.typeRow}>
        {[{ key: 'individual', label: '👤 Individual Report' }, { key: 'team', label: '👥 Team Report' }].map(t => (
          <button key={t.key} style={{ ...s.typeBtn, ...(reportType === t.key ? s.typeBtnActive : {}) }}
            onClick={() => { setReportType(t.key); setSelectedUserId('') }}>
            {t.label}
          </button>
        ))}
        {reportType === 'individual' && (
          <select style={s.personSelect} value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
            <option value="">— Select person —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        )}
      </div>

      {loading && <div style={s.loadingState}>Loading report data…</div>}

      {/* ── Individual Report ── */}
      {reportType === 'individual' && selectedUserId && !loading && (
        <div ref={reportRef}>
          <div style={s.reportHeader}>
            <div style={s.reportAvatar}>{selectedUser?.full_name?.[0]}</div>
            <div>
              <div style={s.reportName}>{selectedUser?.full_name}</div>
              <div style={s.reportMeta}>{selectedUser?.team || ''} · {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
            </div>
            {myStats && (
              <div style={s.rankBadge}>Rank #{myStats.rank_mt} MT</div>
            )}
          </div>

          {/* Key metrics row */}
          {myStats && (
            <div style={s.metricsRow}>
              {METRICS.slice(0, 4).map(m => (
                <div key={m.key} style={s.metricCard}>
                  <div style={s.metricValue}>{m.fmt(myStats[m.key] || 0)}</div>
                  <div style={s.metricLabel}>{m.label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={s.chartsGrid}>
            {/* MT Daily Trend */}
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Daily MT This Month</div>
              {dailyEntries.length === 0 ? (
                <div style={s.noData}>No entries this month yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dailyEntries} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="mt" stroke={C.electric} strokeWidth={2.5} dot={{ r: 3 }} name="MT" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* KRA Compliance Trend */}
            <div style={s.chartCard}>
              <div style={s.chartTitle}>KRA Compliance — Last 4 Weeks</div>
              {kraCompliance.length === 0 ? (
                <div style={s.noData}>No KRA data in the last 4 weeks.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={kraCompliance} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: C.muted }} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: C.muted }} />
                    <Tooltip formatter={v => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="compliance" stroke={C.green} strokeWidth={2.5} dot={{ r: 3 }} name="Compliance %" />
                    <Line type="monotone" dataKey="onTrack" stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="On Track %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Comparison vs team avg */}
          <div style={s.chartCard}>
            <div style={s.chartTitle}>vs Team Average — All Metrics</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparisonData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="metric" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="me" name={selectedUser?.full_name || 'Me'} fill={C.electric} radius={[4, 4, 0, 0]} />
                <Bar dataKey="teamAvg" name="Team Avg" fill={C.green} radius={[4, 4, 0, 0]} opacity={0.65} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Recent Badges</div>
              <div style={s.badgeGrid}>
                {badges.map((b, i) => (
                  <div key={i} style={s.badgeItem}>
                    <span style={s.badgeIcon}>🏅</span>
                    <div>
                      <div style={s.badgeName}>{b.badge_category.replace(/_/g, ' ')}</div>
                      <div style={s.badgeDate}>{b.earned_date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Team Report ── */}
      {reportType === 'team' && !loading && (
        <div ref={reportRef}>
          <div style={{ ...s.reportHeader, marginBottom: 20 }}>
            <div style={{ ...s.reportAvatar, background: C.green }}>T</div>
            <div>
              <div style={s.reportName}>Team Report</div>
              <div style={s.reportMeta}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} · {leaderboard.length} active salespeople</div>
            </div>
          </div>

          <div style={s.chartsGrid}>
            {/* Team MT daily trend */}
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Team MT Trend This Month</div>
              {teamDailyMt.length === 0 ? (
                <div style={s.noData}>No entries this month yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={teamDailyMt} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="mtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.electric} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.electric} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: C.muted }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="mt" stroke={C.electric} fill="url(#mtGrad)" strokeWidth={2.5} name="MT" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Product mix */}
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Target Product Mix</div>
              {productMix.length === 0 ? (
                <div style={s.noData}>No active targets set.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={productMix} layout="vertical" margin={{ top: 5, right: 40, left: 70, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: C.muted }} />
                    <YAxis dataKey="product" type="category" tick={{ fontSize: 11, fill: C.muted }} />
                    <Tooltip formatter={(v) => `${v} MT`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="mt" name="Target MT" radius={[0, 4, 4, 0]}>
                      {productMix.map((_, i) => (
                        <rect key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Comparison table */}
          <div style={s.chartCard}>
            <div style={s.chartTitle}>All Salespeople — Side by Side</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Name</th>
                    {METRICS.map(m => <th key={m.key} style={s.th}>{m.label}</th>)}
                    <th style={s.th}>Rank MT</th>
                  </tr>
                </thead>
                <tbody>
                  {[...leaderboard].sort((a, b) => parseFloat(b.total_mt || 0) - parseFloat(a.total_mt || 0)).map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? C.white : C.bg }}>
                      <td style={{ ...s.td, fontWeight: 700 }}>{p.full_name}</td>
                      {METRICS.map(m => (
                        <td key={m.key} style={s.td}>{m.fmt(p[m.key] || 0)}</td>
                      ))}
                      <td style={{ ...s.td, fontWeight: 700, color: i === 0 ? '#D97706' : C.text }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${p.rank_mt}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty states */}
      {reportType === 'individual' && !selectedUserId && !loading && (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>📊</div>
          <div style={s.emptyText}>Select a person to view their individual report</div>
        </div>
      )}
    </div>
  )
}

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

function fourWeeksAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 28)
  return d.toISOString().slice(0, 10)
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr)
  const weekNum = Math.ceil(d.getDate() / 7)
  return `Wk ${weekNum} ${d.toLocaleString('default', { month: 'short' })}`
}

const s = {
  page:      { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 1100, margin: '0 auto' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:     { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub:       { color: C.muted, marginTop: 4, fontSize: 14 },
  downloadBtn: { padding: '10px 22px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer' },
  typeRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  typeBtn:   { padding: '9px 20px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 14, fontFamily: 'Montserrat, sans-serif', fontWeight: 600, color: C.muted },
  typeBtnActive: { background: C.prussian, color: C.white, borderColor: C.prussian },
  personSelect: { padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', background: C.white, minWidth: 200 },
  loadingState: { textAlign: 'center', padding: 60, color: C.muted },
  // Report header
  reportHeader:  { display: 'flex', alignItems: 'center', gap: 16, background: C.white, borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 20 },
  reportAvatar:  { width: 52, height: 52, borderRadius: '50%', background: C.electric, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 },
  reportName:    { fontSize: 20, fontWeight: 800, color: C.prussian },
  reportMeta:    { fontSize: 13, color: C.muted, marginTop: 2 },
  rankBadge:     { marginLeft: 'auto', background: C.prussian, color: C.white, borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700 },
  // Metrics row
  metricsRow:    { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 },
  metricCard:    { background: C.white, borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', textAlign: 'center' },
  metricValue:   { fontSize: 22, fontWeight: 800, color: C.prussian },
  metricLabel:   { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 },
  // Charts
  chartsGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  chartCard:     { background: C.white, borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 20 },
  chartTitle:    { fontSize: 13, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 },
  noData:        { color: C.muted, fontSize: 14, textAlign: 'center', padding: '40px 0' },
  // Badges
  badgeGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 },
  badgeItem:     { display: 'flex', alignItems: 'center', gap: 10, background: C.bg, borderRadius: 8, padding: '10px 12px' },
  badgeIcon:     { fontSize: 20 },
  badgeName:     { fontSize: 12, fontWeight: 700, color: C.text, textTransform: 'capitalize' },
  badgeDate:     { fontSize: 11, color: C.muted },
  // Table
  table:         { width: '100%', borderCollapse: 'collapse', minWidth: 800 },
  th:            { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `2px solid ${C.border}`, background: C.bg, whiteSpace: 'nowrap' },
  td:            { padding: '10px 12px', fontSize: 13, color: C.text, borderBottom: `1px solid #F1F5F9` },
  // Empty state
  emptyState:    { textAlign: 'center', padding: '80px 0' },
  emptyIcon:     { fontSize: 48, marginBottom: 16 },
  emptyText:     { color: C.muted, fontSize: 15 },
}
