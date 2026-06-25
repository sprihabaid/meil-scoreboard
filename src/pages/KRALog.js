import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const C = { prussian: '#012D4C', electric: '#015998', green: '#5AB947', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', error: '#EF4444', amber: '#F59E0B', bg: '#F8FAFC' }

const FRONTEND_KRAS = [
  { key: 'meetings_done',       label: 'Meetings Done',          unit: 'count' },
  { key: 'inquiries_generated', label: 'Inquiries Generated',    unit: 'count' },
  { key: 'lost_client_visits',  label: 'Lost Client Visits',     unit: 'count' },
  { key: 'prospect_visits',     label: 'Prospect Visits',        unit: 'count' },
  { key: 'crm_updated',         label: 'CRM Updated',            unit: 'yes/no' },
  { key: 'tour_plan',           label: 'Tour Plan Submitted',    unit: 'yes/no' },
  { key: 'new_client_meetings', label: 'New Client Meetings',    unit: 'count' },
]

const BACKEND_KRAS = [
  { key: 'orders_in_crm',       label: 'Orders in CRM',          unit: 'count'  },
  { key: 'delivery_adherence',  label: 'Delivery Adherence',     unit: '%'      },
  { key: 'quality_complaints',  label: 'Quality Complaints',     unit: 'count'  },
  { key: 'post_delivery_calls', label: 'Post-Delivery Calls',    unit: 'count'  },
  { key: 'client_feedback',     label: 'Client Feedback Logged', unit: 'count'  },
  { key: 'whatsapp_group',      label: 'WhatsApp Group Active',  unit: 'yes/no' },
  { key: 'overdue_accounts',    label: 'Overdue Accounts Reviewed', unit: 'count' },
  { key: 'payment_followups',   label: 'Payment Follow-ups',     unit: 'count'  },
]

const STATUS_STYLE = {
  green:   { bg: '#DCFCE7', color: '#166534', label: 'On Track'  },
  amber:   { bg: '#FEF9C3', color: '#854D0E', label: 'At Risk'   },
  red:     { bg: '#FEE2E2', color: '#991B1B', label: 'Off Track' },
  pending: { bg: '#F3F4F6', color: '#6B7280', label: 'Pending'   },
}

function calcTargetStatus(actual, target, unit) {
  if (target == null || target === '') return null
  const a = parseFloat(actual) || 0
  const t = parseFloat(target)
  if (unit === 'yes/no') return a >= 1 ? 'green' : 'red'
  if (a >= t) return 'green'
  if (a >= t * 0.7) return 'amber'
  return 'red'
}

export default function KRALog() {
  const { user, profile, can } = useAuth()
  const [tab, setTab]       = useState('log')
  const [kras, setKras]     = useState([])
  const [pending, setPending] = useState([])
  const [form, setForm]     = useState({})
  const [logDate, setLogDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [myTargets, setMyTargets] = useState({}) // { kra_name: { target_value, target_unit } }

  const myTeam = profile?.team
  const isAdminRole = profile?.role === 'superadmin' || profile?.role === 'admin'
  const kraList = isAdminRole
    ? [...FRONTEND_KRAS, ...BACKEND_KRAS]
    : myTeam === 'backend' ? BACKEND_KRAS : FRONTEND_KRAS

  const loadMyKras = useCallback(() => {
    if (!user) return
    supabase.from('kra_logs').select('*')
      .eq('user_id', user.id)
      .gte('log_date', firstOfMonth())
      .order('log_date', { ascending: false })
      .then(({ data }) => setKras(data || []))
  }, [user])

  const loadPending = useCallback(() => {
    supabase.from('kra_logs')
      .select('*, submitter:profiles!kra_logs_submitted_by_fkey(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPending(data || []))
  }, [])

  const loadMyTargets = useCallback(() => {
    if (!user) return
    const month = firstOfMonth()
    supabase.from('kra_targets')
      .select('kra_name, target_value, target_unit')
      .eq('user_id', user.id)
      .eq('month', month)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(t => { map[t.kra_name] = { target_value: t.target_value, target_unit: t.target_unit } })
        setMyTargets(map)
      })
  }, [user])

  useEffect(() => {
    loadMyKras()
    loadMyTargets()
    if (can('approve_kra')) loadPending()
  }, [loadMyKras, loadMyTargets, loadPending, can])

  useEffect(() => {
    if (!user) return
    const existing = kras.filter(k => k.log_date === logDate)
    const filled = {}
    existing.forEach(k => { filled[k.kra_name] = k.actual_value ?? '' })
    setForm(filled)
  }, [logDate, kras, user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    const inserts = kraList.map(k => ({
      user_id: user.id,
      log_date: logDate,
      kra_name: k.key,
      actual_value: parseFloat(form[k.key]) || 0,
      status: 'pending',
      submitted_by: user.id,
    }))

    const { error } = await supabase.from('kra_logs').upsert(inserts, { onConflict: 'user_id,log_date,kra_name' })
    setSaving(false)
    if (error) return setStatus({ type: 'error', msg: error.message })
    setStatus({ type: 'success', msg: 'KRA log submitted for approval.' })
    loadMyKras()
  }

  const approve = async (log, newStatus) => {
    const { error } = await supabase.from('kra_logs')
      .update({ status: newStatus, approved_by: user.id, approved_at: new Date().toISOString() })
      .eq('id', log.id)
    if (!error) {
      setPending(p => p.filter(x => x.id !== log.id))
      await supabase.from('recognition_feed').insert({
        user_id: log.user_id, event_type: 'badge_earned', emoji: newStatus === 'green' ? '✅' : '⚠️',
        event_title: `KRA ${newStatus === 'green' ? 'approved' : 'flagged'}`,
        event_body: `${log.kra_name} on ${log.log_date} marked ${newStatus}.`,
      })
    }
  }

  // Build monthly MTD totals per KRA
  const mtdTotals = {}
  kras.forEach(k => {
    mtdTotals[k.kra_name] = (mtdTotals[k.kra_name] || 0) + (parseFloat(k.actual_value) || 0)
  })

  // Check if any targets are set this month
  const hasTargets = Object.keys(myTargets).length > 0

  const byDate = {}
  kras.forEach(k => { if (!byDate[k.log_date]) byDate[k.log_date] = []; byDate[k.log_date].push(k) })

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>KRA Log</h1>
        <p style={s.sub}>Daily key result area tracking — {myTeam || 'all'} team</p>
      </div>

      <div style={s.tabRow}>
        <button style={{ ...s.tabBtn, ...(tab === 'log' ? s.tabActive : {}) }} onClick={() => setTab('log')}>📝 My Log</button>
        {can('approve_kra') && (
          <button style={{ ...s.tabBtn, ...(tab === 'approve' ? s.tabActive : {}) }} onClick={() => setTab('approve')}>
            ✅ Approvals {pending.length > 0 && <span style={s.badge}>{pending.length}</span>}
          </button>
        )}
      </div>

      {tab === 'log' && (
        <>
          <form onSubmit={handleSubmit} style={s.card}>
            <div style={s.formHdr}>
              <div style={s.sectionLabel}>Log for</div>
              <input type="date" style={s.dateInput} value={logDate} max={today()} onChange={e => setLogDate(e.target.value)} />
            </div>
            <div style={s.kraGrid}>
              {kraList.map(k => {
                const target = myTargets[k.key]
                return (
                  <div key={k.key} style={s.kraField}>
                    <label style={s.label}>
                      {k.label}
                      <span style={s.unit}> ({k.unit})</span>
                      {target && (
                        <span style={s.targetHint}>Target: {target.target_value}/mo</span>
                      )}
                    </label>
                    {k.unit === 'yes/no' ? (
                      <select style={s.input} value={form[k.key] ?? ''} onChange={e => setForm(f => ({ ...f, [k.key]: e.target.value }))}>
                        <option value="">—</option>
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                      </select>
                    ) : (
                      <input type="number" style={s.input} min="0" step="0.1" placeholder="e.g. 3"
                        value={form[k.key] ?? ''} onChange={e => setForm(f => ({ ...f, [k.key]: e.target.value }))} />
                    )}
                  </div>
                )
              })}
            </div>
            {status && (
              <div style={{ ...s.alert, color: status.type === 'success' ? C.green : C.error, background: status.type === 'success' ? '#ECFDF5' : '#FEF2F2', borderColor: status.type === 'success' ? C.green : C.error }}>
                {status.type === 'success' ? '✅' : '❌'} {status.msg}
              </div>
            )}
            <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Submitting…' : 'Submit KRA Log'}</button>
          </form>

          {/* ── Monthly KRA Progress vs Targets ── */}
          {hasTargets && (
            <div style={s.card}>
              <div style={s.sectionLabel}>Monthly KRA Progress — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
              <div style={s.progressGrid}>
                {kraList.map(k => {
                  const target = myTargets[k.key]
                  if (!target) return null
                  const mtd = mtdTotals[k.key] || 0
                  const t = parseFloat(target.target_value)
                  const pct = t > 0 ? Math.min((mtd / t) * 100, 100) : 0
                  const statusKey = calcTargetStatus(mtd, t, k.unit)
                  const st = STATUS_STYLE[statusKey] || STATUS_STYLE.pending
                  return (
                    <div key={k.key} style={s.progressItem}>
                      <div style={s.progressHeader}>
                        <span style={s.progressLabel}>{k.label}</span>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                      </div>
                      <div style={s.progressBar}>
                        <div style={{ ...s.progressFill, width: `${pct}%`, background: statusKey === 'green' ? C.green : statusKey === 'amber' ? C.amber : C.error }} />
                      </div>
                      <div style={s.progressNumbers}>
                        <span style={{ fontWeight: 700, color: C.prussian }}>{k.unit === 'yes/no' ? (mtd >= 1 ? 'Yes' : 'No') : mtd}</span>
                        <span style={{ color: C.muted }}>/ {k.unit === 'yes/no' ? 'Yes' : `${t} ${target.target_unit}`}</span>
                      </div>
                    </div>
                  )
                }).filter(Boolean)}
              </div>
            </div>
          )}

          {/* History */}
          <div style={s.sectionLabel}>This Month's History</div>
          {Object.keys(byDate).length === 0 ? (
            <div style={s.empty}>No KRA logs this month yet.</div>
          ) : Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([date, logs]) => (
            <div key={date} style={s.histCard}>
              <div style={s.histDate}>{date}</div>
              <div style={s.histGrid}>
                {logs.map(l => {
                  const kra = kraList.find(k => k.key === l.kra_name)
                  const target = myTargets[l.kra_name]
                  // Use target-based status if target is set, otherwise use approval status
                  const displayStatus = target
                    ? (calcTargetStatus(l.actual_value, target.target_value, kra?.unit) || l.status)
                    : l.status
                  const st = STATUS_STYLE[displayStatus] || STATUS_STYLE.pending
                  return (
                    <div key={l.id} style={s.histItem}>
                      <span style={s.histKra}>{kra?.label || l.kra_name}</span>
                      <span style={s.histVal}>{l.actual_value ?? '—'}</span>
                      {target && (
                        <span style={{ fontSize: 11, color: C.muted, width: 60 }}>/ {target.target_value}</span>
                      )}
                      <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'approve' && can('approve_kra') && (
        <div style={s.card}>
          <div style={s.sectionLabel}>Pending Approvals ({pending.length})</div>
          {pending.length === 0 ? (
            <div style={s.empty}>All caught up! No pending KRA approvals.</div>
          ) : pending.map(log => (
            <div key={log.id} style={s.approvalRow}>
              <div style={s.approvalInfo}>
                <strong>{log.submitter?.full_name}</strong>
                <span style={{ color: C.muted, margin: '0 8px' }}>·</span>
                {kraList.find(k => k.key === log.kra_name)?.label || log.kra_name}
                <span style={{ color: C.muted, margin: '0 8px' }}>·</span>
                <span style={{ color: C.muted }}>{log.log_date}</span>
              </div>
              <div style={s.approvalValue}>Actual: <strong>{log.actual_value}</strong></div>
              <div style={s.approvalBtns}>
                <button style={s.approveBtn} onClick={() => approve(log, 'green')}>✅ On Track</button>
                <button style={s.amberBtn}   onClick={() => approve(log, 'amber')}>⚠️ At Risk</button>
                <button style={s.rejectBtn}  onClick={() => approve(log, 'red')}>❌ Off Track</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function today() { return new Date().toISOString().slice(0, 10) }
function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 900, margin: '0 auto' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub: { color: C.muted, marginTop: 4, fontSize: 14 },
  tabRow: { display: 'flex', gap: 8, marginBottom: 20 },
  tabBtn: { padding: '9px 20px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 14, fontFamily: 'Montserrat, sans-serif', fontWeight: 600, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 },
  tabActive: { background: C.prussian, color: C.white, borderColor: C.prussian },
  badge: { background: C.error, color: C.white, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 },
  card: { background: C.white, borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 20 },
  formHdr: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 },
  dateInput: { padding: '8px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none' },
  kraGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 },
  kraField: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 11, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.04em' },
  unit: { fontWeight: 400, color: C.muted, textTransform: 'none' },
  targetHint: { display: 'block', fontWeight: 500, color: C.electric, textTransform: 'none', letterSpacing: 0, fontSize: 10, marginTop: 1 },
  input: { padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none' },
  btn: { padding: '11px 28px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer' },
  alert: { padding: '10px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 14, marginBottom: 12 },
  // Monthly progress
  progressGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
  progressItem: { background: C.bg, borderRadius: 8, padding: '12px 14px' },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 12, fontWeight: 600, color: C.text },
  progressBar: { height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3, transition: 'width 0.4s ease' },
  progressNumbers: { display: 'flex', gap: 4, fontSize: 12 },
  // History
  empty: { color: C.muted, fontSize: 14, padding: '16px 0', textAlign: 'center' },
  histCard: { background: C.white, borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 10 },
  histDate: { fontWeight: 700, color: C.prussian, fontSize: 13, marginBottom: 10 },
  histGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
  histItem: { display: 'flex', alignItems: 'center', gap: 10 },
  histKra: { flex: 1, fontSize: 13, color: C.text },
  histVal: { fontWeight: 700, fontSize: 13, color: C.prussian, width: 50, textAlign: 'right' },
  approvalRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' },
  approvalInfo: { flex: 1, fontSize: 13, color: C.text },
  approvalValue: { fontSize: 13, color: C.muted },
  approvalBtns: { display: 'flex', gap: 6 },
  approveBtn: { padding: '5px 12px', borderRadius: 6, border: 'none', background: '#DCFCE7', color: '#166534', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat, sans-serif' },
  amberBtn:   { padding: '5px 12px', borderRadius: 6, border: 'none', background: '#FEF9C3', color: '#854D0E', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat, sans-serif' },
  rejectBtn:  { padding: '5px 12px', borderRadius: 6, border: 'none', background: '#FEE2E2', color: '#991B1B', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat, sans-serif' },
}
