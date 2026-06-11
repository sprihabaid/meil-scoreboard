import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  prussian: '#012D4C',
  electric: '#015998',
  green: '#5AB947',
  white: '#FFFFFF',
  bg: '#F0F4F8',
  border: '#CBD5E1',
  text: '#1E293B',
  muted: '#64748B',
  gold: '#F59E0B',
  silver: '#94A3B8',
  bronze: '#CD7F32',
  error: '#EF4444',
}

const MEDAL = { 1: { icon: '🥇', color: C.gold }, 2: { icon: '🥈', color: C.silver }, 3: { icon: '🥉', color: C.bronze } }

const IMPROVED_MODES = [
  { key: 'mom',   label: 'Month on Month'          },
  { key: 'wow',   label: 'Week on Week'             },
  { key: 'w1',    label: 'Week 1 vs Week 1 (prev)'  },
  { key: 'w2',    label: 'Week 2 vs Week 2 (prev)'  },
  { key: 'w3',    label: 'Week 3 vs Week 3 (prev)'  },
  { key: 'w4',    label: 'Week 4 vs Week 4 (prev)'  },
]

export default function Leaderboard() {
  const [rows, setRows] = useState([])
  const [improved, setImproved] = useState([])
  const [loading, setLoading] = useState(true)
  const [improvedMode, setImprovedMode] = useState('mom')
  const [activeTab, setActiveTab] = useState('mt')

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('v_current_month_leaderboard').select('*')
    if (!error && data) setRows(data)
    setLoading(false)
  }, [])

  const fetchImproved = useCallback(async (mode) => {
    // Compute improvement by comparing periods from daily_entries
    const now = new Date()
    let curStart, curEnd, prevStart, prevEnd

    if (mode === 'wow') {
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
      curStart = new Date(now); curStart.setDate(now.getDate() - dayOfWeek)
      curEnd = now
      prevStart = new Date(curStart); prevStart.setDate(curStart.getDate() - 7)
      prevEnd = new Date(curStart); prevEnd.setDate(curStart.getDate() - 1)
    } else if (mode === 'mom') {
      curStart = new Date(now.getFullYear(), now.getMonth(), 1)
      curEnd = now
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    } else {
      // w1 = days 1-7, w2 = 8-14, w3 = 15-21, w4 = 22-end
      const weekNum = { w1: 1, w2: 2, w3: 3, w4: 4 }[mode] || 1
      const wStart = (weekNum - 1) * 7 + 1
      const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
      const wEnd = weekNum === 4 ? lastDayThisMonth : weekNum * 7
      const wEndPrev = weekNum === 4 ? lastDayPrevMonth : weekNum * 7
      curStart = new Date(now.getFullYear(), now.getMonth(), wStart)
      curEnd = new Date(now.getFullYear(), now.getMonth(), wEnd)
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, wStart)
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, wEndPrev)
    }

    const fmt = d => d.toISOString().slice(0, 10)

    const [cur, prev] = await Promise.all([
      supabase.from('daily_entries').select('user_id, mt_brought, profiles!inner(full_name, role)').gte('entry_date', fmt(curStart)).lte('entry_date', fmt(curEnd)),
      supabase.from('daily_entries').select('user_id, mt_brought').gte('entry_date', fmt(prevStart)).lte('entry_date', fmt(prevEnd)),
    ])

    if (cur.error || prev.error) return

    const sumBy = (arr) => {
      const m = {}
      arr.forEach(r => { m[r.user_id] = (m[r.user_id] || 0) + (r.mt_brought || 0) })
      return m
    }

    const curMap = sumBy(cur.data)
    const prevMap = sumBy(prev.data)
    const names = {}
    const roles = {}
    cur.data.forEach(r => {
      if (r.profiles) {
        names[r.user_id] = r.profiles.full_name
        roles[r.user_id] = r.profiles.role
      }
    })

    const result = Object.keys({ ...curMap, ...prevMap })
      .filter(uid => roles[uid] !== 'superadmin')
      .map(uid => ({
        id: uid,
        full_name: names[uid] || uid,
        cur_mt: curMap[uid] || 0,
        prev_mt: prevMap[uid] || 0,
        delta: (curMap[uid] || 0) - (prevMap[uid] || 0),
      })).sort((a, b) => b.delta - a.delta)

    setImproved(result)
  }, [])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])
  useEffect(() => { fetchImproved(improvedMode) }, [improvedMode, fetchImproved])

  const TABS = [
    { key: 'mt',        label: 'Max Orders (MT)',         icon: '⚡', rankKey: 'rank_mt',            valKey: 'total_mt',        fmt: v => `${(+v).toFixed(2)} MT` },
    { key: 'price',     label: 'Avg Closing Price',       icon: '💰', rankKey: 'rank_closing_price', valKey: 'avg_closing_price',fmt: v => `₹${(+v).toFixed(0)}/MT` },
    { key: 'clients',   label: 'Most New Clients',        icon: '🚀', rankKey: 'rank_new_clients',   valKey: 'total_new_clients',fmt: v => `${v} clients` },
    { key: 'retention', label: 'Best Retention Rate',     icon: '🤝', rankKey: 'rank_retention',     valKey: 'retention_rate',   fmt: v => `${(+v).toFixed(1)}%` },
    { key: 'improved',  label: 'Most Improved',           icon: '📈', rankKey: null,                 valKey: null,               fmt: null },
    { key: 'inquiries', label: 'Highest Inquiries',       icon: '🔮', rankKey: 'rank_inquiries',     valKey: 'total_inquiries',  fmt: v => `${(+v).toFixed(2)} MT` },
    { key: 'tat',       label: 'Fastest TAT',             icon: '💨', rankKey: 'rank_tat',           valKey: 'avg_tat',          fmt: v => `${(+v).toFixed(1)} hrs` },
  ]

  const tab = TABS.find(t => t.key === activeTab)

  const sortedRows = tab.rankKey
    ? [...rows].sort((a, b) => a[tab.rankKey] - b[tab.rankKey])
    : improved

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Leaderboard</h1>
        <p style={s.sub}>Month-to-date standings across all 7 competitions.</p>
      </div>

      {/* Tab strip */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{ ...s.tab, ...(activeTab === t.key ? s.tabActive : {}) }}
          >
            <span>{t.icon}</span>
            <span style={s.tabLabel}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Most Improved toggle */}
      {activeTab === 'improved' && (
        <div style={s.toggleRow}>
          {IMPROVED_MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setImprovedMode(m.key)}
              style={{ ...s.toggleBtn, ...(improvedMode === m.key ? s.toggleActive : {}) }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={s.card}>
        {loading ? (
          <div style={s.loading}>Loading leaderboard…</div>
        ) : sortedRows.length === 0 ? (
          <div style={s.empty}>No data yet for this period.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: 60 }}>Rank</th>
                <th style={s.th}>Name</th>
                {activeTab === 'improved' ? (
                  <>
                    <th style={{ ...s.th, textAlign: 'right' }}>Previous MT</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Current MT</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Δ Improvement</th>
                  </>
                ) : (
                  <th style={{ ...s.th, textAlign: 'right' }}>{tab.label}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => {
                const rank = tab.rankKey ? row[tab.rankKey] : i + 1
                const medal = MEDAL[rank]
                return (
                  <tr key={row.id || row.user_id} style={i % 2 === 0 ? {} : { background: '#F8FAFC' }}>
                    <td style={s.td}>
                      {medal
                        ? <span style={{ fontSize: 20 }}>{medal.icon}</span>
                        : <span style={{ ...s.rankNum, color: rank <= 3 ? medal?.color : C.muted }}>{rank}</span>
                      }
                    </td>
                    <td style={s.td}>
                      <div style={s.nameCell}>
                        <div style={s.avatar}>{(row.full_name || '?')[0]}</div>
                        <span style={s.name}>{row.full_name}</span>
                        {row.current_level && <LevelBadge level={row.current_level} />}
                        {row.streak_at_risk && <span title="Streak at risk">⚠️</span>}
                      </div>
                    </td>
                    {activeTab === 'improved' ? (
                      <>
                        <td style={{ ...s.td, textAlign: 'right', color: C.muted }}>{(+row.prev_mt).toFixed(2)} MT</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{(+row.cur_mt).toFixed(2)} MT</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          <span style={{ color: row.delta >= 0 ? C.green : C.error, fontWeight: 700 }}>
                            {row.delta >= 0 ? '+' : ''}{(+row.delta).toFixed(2)} MT
                          </span>
                        </td>
                      </>
                    ) : (
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: C.prussian }}>
                        {tab.fmt(row[tab.valKey] ?? 0)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function LevelBadge({ level }) {
  const colors = { Trainee: '#6B7280', Hustler: '#3B82F6', Closer: '#8B5CF6', Elite: '#F59E0B', Legend: '#EF4444' }
  const icons  = { Trainee: '🌱', Hustler: '⚡', Closer: '🔥', Elite: '💎', Legend: '👑' }
  return (
    <span style={{ background: colors[level] + '18', color: colors[level], border: `1px solid ${colors[level]}44`, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {icons[level]} {level}
    </span>
  )
}

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 960, margin: '0 auto' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub: { color: C.muted, marginTop: 4, fontSize: 14 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  tab: { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 12, fontFamily: 'Montserrat, sans-serif', fontWeight: 500, color: C.muted, transition: 'all .15s', whiteSpace: 'nowrap' },
  tabActive: { background: C.prussian, color: C.white, borderColor: C.prussian, fontWeight: 700 },
  tabLabel: { fontSize: 12, fontWeight: 600 },
  toggleRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  toggleBtn: { padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 13, fontFamily: 'Montserrat, sans-serif', fontWeight: 500, color: C.muted },
  toggleActive: { background: C.electric, color: C.white, borderColor: C.electric, fontWeight: 700 },
  card: { background: C.white, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `2px solid ${C.border}`, background: '#F8FAFC' },
  td: { padding: '13px 16px', fontSize: 14, color: C.text, borderBottom: `1px solid #F1F5F9` },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: C.electric + '22', color: C.electric, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  name: { fontWeight: 600, color: C.prussian, flexShrink: 0 },
  rankNum: { fontWeight: 700, fontSize: 15 },
  loading: { padding: 40, textAlign: 'center', color: C.muted },
  empty: { padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 },
}
