import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Funnel, FunnelChart, LabelList } from 'recharts'

const C = { prussian: '#012D4C', electric: '#015998', green: '#5AB947', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', bg: '#F8FAFC' }

const PLANTS = [
  { id: 'reengus_u1', label: 'Reengus — Unit 1', plant: 'Reengus', unit: 'Unit 1 (Rd. No. 1)' },
  { id: 'reengus_u2', label: 'Reengus — Unit 2', plant: 'Reengus', unit: 'Unit 2 (Reengus)'    },
  { id: 'jaipur_vki', label: 'Jaipur — VKI',     plant: 'Jaipur',  unit: 'VKI Jaipur'          },
]
const CATS     = ['CRGO Steel', 'Amorphous']
const PRODUCTS = ['Slitting', 'Cutting', 'Assembly']

const SOURCE_COLORS = ['#015998', '#5AB947', '#F59E0B', '#8B5CF6', '#EF4444']
const SOURCE_KEYS   = ['source_referrals', 'source_website', 'source_expo', 'source_cold_outreach', 'source_international']
const SOURCE_LABELS = ['Referrals', 'Website', 'Expo', 'Cold Outreach', 'International']

export default function TeamPanel() {
  const [summary, setSummary] = useState(null)
  const [plantData, setPlantData] = useState([])
  const [teamMetrics, setTeamMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('v_team_summary').select('*').single(),
      supabase.from('plant_mt_entries')
        .select('plant, unit, category, final_product, actual_mt, target_mt, entry_date')
        .gte('entry_date', firstOfMonth()),
      supabase.from('team_metrics')
        .select('*').order('metric_date', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([s, p, tm]) => {
      if (!s.error) setSummary(s.data)
      if (!p.error) setPlantData(p.data || [])
      if (!tm.error) setTeamMetrics(tm.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={s.center}>Loading team data…</div>

  // Aggregate plant MT
  const plantBreakdown = PLANTS.map(pl => {
    const rows = plantData.filter(r => r.plant === pl.plant && r.unit === pl.unit)
    const byKey = {}
    CATS.forEach(cat => PRODUCTS.forEach(prod => {
      const key = `${cat}|${prod}`
      const match = rows.find(r => r.category === cat && r.final_product === prod)
      byKey[key] = { actual: match?.actual_mt || 0, target: match?.target_mt || 0 }
    }))
    return { ...pl, byKey, total: rows.reduce((s, r) => s + (r.actual_mt || 0), 0) }
  })

  // Inquiry source donut — fall back to illustrative dummy data if no entries yet
  const rawSourceData = SOURCE_KEYS.map((key, i) => ({
    name: SOURCE_LABELS[i],
    value: parseFloat(teamMetrics?.[key] || 0),
  }))
  const hasSourceData = rawSourceData.some(d => d.value > 0)
  const sourceData = hasSourceData ? rawSourceData.filter(d => d.value > 0) : [
    { name: 'Referrals',      value: 40 },
    { name: 'Website',        value: 20 },
    { name: 'Expo',           value: 25 },
    { name: 'Cold Outreach',  value: 10 },
    { name: 'International',  value: 5  },
  ]

  // Conversion funnel — fall back to dummy if no entries yet
  const rawFunnel = [
    { name: 'Inquiries', value: teamMetrics?.inquiries_received || 0, fill: C.prussian },
    { name: 'Quotes',    value: teamMetrics?.quotes_sent || 0,        fill: C.electric },
    { name: 'Orders',    value: teamMetrics?.orders_won || 0,         fill: C.green    },
  ]
  const hasFunnelData = rawFunnel.some(d => d.value > 0)
  const funnelData = hasFunnelData ? rawFunnel : [
    { name: 'Inquiries', value: 100, fill: C.prussian },
    { name: 'Quotes',    value: 60,  fill: C.electric },
    { name: 'Orders',    value: 25,  fill: C.green    },
  ]
  const funnelIsDummy = !hasFunnelData

  const mtd = parseFloat(summary?.mtd_mt || 0)
  const qtd = parseFloat(summary?.qtd_mt || 0)
  const ytd = parseFloat(summary?.ytd_mt || 0)
  const mtdRev = parseFloat(summary?.mtd_revenue || 0)

  return (
    <div style={s.page}>
      <h1 style={s.title}>Team Panel</h1>
      <p style={s.sub}>Aggregated team performance — MTD / QTD / YTD</p>

      {/* KPI row */}
      <div style={s.kpiRow}>
        {[
          { label: 'MTD MT',      value: `${mtd.toFixed(1)} MT`,          color: C.green   },
          { label: 'QTD MT',      value: `${qtd.toFixed(1)} MT`,          color: C.electric},
          { label: 'YTD MT',      value: `${ytd.toFixed(1)} MT`,          color: C.electric},
          { label: 'MTD Revenue', value: `₹${mtdRev.toFixed(2)} Cr`,      color: C.electric},
          { label: 'MTD Orders',  value: summary?.mtd_orders || 0,         color: C.electric},
        ].map(k => (
          <div key={k.label} style={s.kpiCard}>
            <div style={s.kpiLabel}>{k.label}</div>
            <div style={{ ...s.kpiValue, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Plant breakdown */}
      <div style={s.sectionTitle}>Plant-wise MT Breakdown (MTD)</div>
      {plantBreakdown.map(pl => (
        <div key={pl.id} style={s.plantCard}>
          <div style={s.plantHdr}>
            <span style={s.plantName}>{pl.label}</span>
            <span style={s.plantTotal}>{pl.total.toFixed(2)} MT total</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Category</th>
                  {PRODUCTS.map(p => (
                    <React.Fragment key={p}>
                      <th style={s.th}>{p} — Actual</th>
                      <th style={s.th}>{p} — Target</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATS.map((cat, ci) => (
                  <tr key={cat} style={{ background: ci % 2 === 0 ? C.white : C.bg }}>
                    <td style={s.td}><strong>{cat}</strong></td>
                    {PRODUCTS.map(prod => {
                      const d = pl.byKey[`${cat}|${prod}`] || { actual: 0, target: 0 }
                      const pct = d.target > 0 ? Math.min((d.actual / d.target) * 100, 100) : null
                      return (
                        <React.Fragment key={prod}>
                          <td style={{ ...s.td, textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: C.prussian }}>{d.actual.toFixed(2)}</span>
                            {pct !== null && <span style={{ fontSize: 11, color: pct >= 80 ? C.green : pct >= 50 ? C.amber : C.error, marginLeft: 4 }}>({pct.toFixed(0)}%)</span>}
                          </td>
                          <td style={{ ...s.td, textAlign: 'right', color: C.muted }}>{d.target.toFixed(2)}</td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Charts row */}
      <div style={s.chartsRow}>
        {/* Donut */}
        <div style={s.chartCard}>
          <div style={s.sectionTitle}>
            Inquiry Sources {!hasSourceData && <span style={s.dummyTag}>sample data</span>}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, name) => [`${v}${hasSourceData ? ' MT' : '%'}`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={s.legend}>
            {sourceData.map((d, i) => (
              <div key={d.name} style={s.legendItem}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: SOURCE_COLORS[i], flexShrink: 0 }} />
                <span style={{ fontSize: 12 }}>{d.name}: <strong>{hasSourceData ? d.value.toFixed(1) : `${d.value}%`}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Funnel */}
        <div style={s.chartCard}>
          <div style={s.sectionTitle}>
            Conversion Funnel {funnelIsDummy && <span style={s.dummyTag}>sample data</span>}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <FunnelChart>
              <Tooltip formatter={(v) => [funnelIsDummy ? `${v} (sample)` : v, '']} />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="center" fill="#fff" stroke="none" style={{ fontWeight: 700, fontSize: 13, fontFamily: 'Montserrat, sans-serif' }} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
          <div style={s.legend}>
            {funnelData.map((d, i) => (
              <div key={d.name} style={s.legendItem}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: d.fill, flexShrink: 0 }} />
                <span style={{ fontSize: 12 }}>{d.name}: <strong>{d.value}</strong></span>
                {i === 1 && funnelData[0].value > 0 && (
                  <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>({((d.value / funnelData[0].value) * 100).toFixed(0)}%)</span>
                )}
                {i === 2 && funnelData[1].value > 0 && (
                  <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>({((d.value / funnelData[1].value) * 100).toFixed(0)}%)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

const C_amber = '#F59E0B'
const C_error = '#EF4444'

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 1100, margin: '0 auto' },
  center: { textAlign: 'center', padding: 60, color: C.muted, fontFamily: 'Montserrat, sans-serif' },
  title: { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub: { color: C.muted, marginTop: 4, fontSize: 14, marginBottom: 24 },
  kpiRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 },
  kpiCard: { flex: '1 1 150px', background: C.white, borderRadius: 12, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', minWidth: 130 },
  kpiLabel: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  kpiValue: { fontSize: 22, fontWeight: 800 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 },
  plantCard: { background: C.white, borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', marginBottom: 16 },
  plantHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  plantName: { fontWeight: 700, fontSize: 15, color: C.prussian },
  plantTotal: { fontWeight: 700, color: C.green, fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 600 },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `2px solid ${C.border}`, background: C.bg, whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', fontSize: 13, color: C.text, borderBottom: `1px solid #F1F5F9` },
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 },
  chartCard: { background: C.white, borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
  legend: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  empty: { color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' },
  dummyTag: { fontSize: 10, fontWeight: 600, color: C.muted, background: '#F1F5F9', borderRadius: 4, padding: '1px 6px', marginLeft: 6, textTransform: 'none', letterSpacing: 0 },
}
