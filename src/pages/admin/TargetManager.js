import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const C = { prussian: '#012D4C', electric: '#015998', green: '#5AB947', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', error: '#EF4444', success: '#10B981', bg: '#F8FAFC' }

const PLANTS   = ['Reengus', 'Jaipur']
const UNITS    = { Reengus: ['Unit 1 (Rd. No. 1)', 'Unit 2 (Reengus)'], Jaipur: ['VKI Jaipur'] }
const CATS     = ['CRGO Steel', 'Amorphous']
const PRODUCTS = ['Slitting', 'Cutting', 'Assembly']

const EMPTY = { user_id: '', plant: 'Reengus', unit: 'Unit 1 (Rd. No. 1)', category: 'CRGO Steel', final_product: 'Slitting', target_mt: '', effective_from: today() }

const ALL_KRAS = [
  { key: 'meetings_done',       label: 'Meetings Done',             unit: 'count',  team: 'frontend' },
  { key: 'inquiries_generated', label: 'Inquiries Generated',       unit: 'count',  team: 'frontend' },
  { key: 'lost_client_visits',  label: 'Lost Client Visits',        unit: 'count',  team: 'frontend' },
  { key: 'prospect_visits',     label: 'Prospect Visits',           unit: 'count',  team: 'frontend' },
  { key: 'crm_updated',         label: 'CRM Updated',               unit: 'yes/no', team: 'frontend' },
  { key: 'tour_plan',           label: 'Tour Plan Submitted',       unit: 'yes/no', team: 'frontend' },
  { key: 'new_client_meetings', label: 'New Client Meetings',       unit: 'count',  team: 'frontend' },
  { key: 'orders_in_crm',       label: 'Orders in CRM',             unit: 'count',  team: 'backend' },
  { key: 'delivery_adherence',  label: 'Delivery Adherence',        unit: '%',      team: 'backend' },
  { key: 'quality_complaints',  label: 'Quality Complaints',        unit: 'count',  team: 'backend' },
  { key: 'post_delivery_calls', label: 'Post-Delivery Calls',       unit: 'count',  team: 'backend' },
  { key: 'client_feedback',     label: 'Client Feedback Logged',    unit: 'count',  team: 'backend' },
  { key: 'whatsapp_group',      label: 'WhatsApp Group Active',     unit: 'yes/no', team: 'backend' },
  { key: 'overdue_accounts',    label: 'Overdue Accounts Reviewed', unit: 'count',  team: 'backend' },
  { key: 'payment_followups',   label: 'Payment Follow-ups',        unit: 'count',  team: 'backend' },
]

export default function TargetManager() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [targets, setTargets] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [filterUser, setFilterUser] = useState('')

  // KRA targets state
  const [kraForm, setKraForm]         = useState({ user_id: '', month: firstOfMonth() })
  const [kraValues, setKraValues]     = useState({})
  const [kraStatus, setKraStatus]     = useState(null)
  const [savingKra, setSavingKra]     = useState(false)
  const [kraTargets, setKraTargets]   = useState([])

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, team').eq('role', 'salesperson').eq('is_active', true).order('full_name')
      .then(({ data }) => setUsers(data || []))
    loadTargets()
  }, [])

  // Load existing KRA targets whenever user or month changes
  useEffect(() => {
    if (!kraForm.user_id || !kraForm.month) { setKraValues({}); setKraTargets([]); return }
    supabase.from('kra_targets')
      .select('*')
      .eq('user_id', kraForm.user_id)
      .eq('month', kraForm.month)
      .then(({ data }) => {
        const existing = data || []
        setKraTargets(existing)
        const vals = {}
        existing.forEach(t => { vals[t.kra_name] = t.target_value })
        setKraValues(vals)
      })
  }, [kraForm.user_id, kraForm.month])

  const loadTargets = () => {
    supabase.from('targets')
      .select('*, user:profiles(full_name), setter:profiles!targets_set_by_fkey(full_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setTargets(data || []))
  }

  const set = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val }
      if (key === 'plant') next.unit = UNITS[val][0]
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.user_id || !form.target_mt) return setStatus({ type: 'error', msg: 'User and target MT are required.' })
    setSaving(true)
    setStatus(null)

    await supabase.from('targets')
      .update({ effective_to: form.effective_from })
      .eq('user_id', form.user_id).eq('plant', form.plant).eq('unit', form.unit)
      .eq('category', form.category).eq('final_product', form.final_product).is('effective_to', null)

    const { error } = await supabase.from('targets').insert({
      user_id: form.user_id, plant: form.plant, unit: form.unit,
      category: form.category, final_product: form.final_product,
      target_mt: parseFloat(form.target_mt),
      effective_from: form.effective_from,
      effective_to: null,
      set_by: profile.id,
    })

    setSaving(false)
    if (error) return setStatus({ type: 'error', msg: error.message })
    setStatus({ type: 'success', msg: 'Target set successfully.' })
    setForm(EMPTY)
    loadTargets()
  }

  // Save all KRA targets for selected user + month (upsert)
  const handleKraSave = async (e) => {
    e.preventDefault()
    if (!kraForm.user_id || !kraForm.month) return setKraStatus({ type: 'error', msg: 'Select a salesperson and month.' })
    setSavingKra(true)
    setKraStatus(null)

    const upserts = ALL_KRAS
      .filter(k => kraValues[k.key] !== undefined && kraValues[k.key] !== '')
      .map(k => ({
        user_id: kraForm.user_id,
        kra_name: k.key,
        target_value: parseFloat(kraValues[k.key]) || 0,
        target_unit: k.unit,
        month: kraForm.month,
        set_by: profile.id,
      }))

    if (upserts.length === 0) {
      setSavingKra(false)
      return setKraStatus({ type: 'error', msg: 'Enter at least one target value.' })
    }

    const { error } = await supabase.from('kra_targets').upsert(upserts, { onConflict: 'user_id,kra_name,month' })
    setSavingKra(false)
    if (error) return setKraStatus({ type: 'error', msg: error.message })
    setKraStatus({ type: 'success', msg: `Saved ${upserts.length} KRA target${upserts.length !== 1 ? 's' : ''} for ${users.find(u => u.id === kraForm.user_id)?.full_name}.` })
  }

  const visibleTargets = filterUser ? targets.filter(t => t.user_id === filterUser) : targets
  const selectedUserProfile = users.find(u => u.id === kraForm.user_id)

  return (
    <div style={s.page}>
      <h1 style={s.title}>Target Manager</h1>
      <p style={s.sub}>Set MT targets and individual KRA targets per salesperson.</p>

      {/* ── MT Targets Form ── */}
      <form onSubmit={handleSubmit} style={s.card}>
        <div style={s.sectionLabel}>Set New MT Target</div>
        <div style={s.grid}>
          <div style={s.field}>
            <label style={s.label}>Salesperson</label>
            <select style={s.select} value={form.user_id} onChange={e => set('user_id', e.target.value)} required>
              <option value="">— Select —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Plant</label>
            <select style={s.select} value={form.plant} onChange={e => set('plant', e.target.value)}>
              {PLANTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Unit</label>
            <select style={s.select} value={form.unit} onChange={e => set('unit', e.target.value)}>
              {(UNITS[form.plant] || []).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Category</label>
            <select style={s.select} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Final Product</label>
            <select style={s.select} value={form.final_product} onChange={e => set('final_product', e.target.value)}>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Target MT</label>
            <input type="number" style={s.input} value={form.target_mt} step="0.01" min="0" placeholder="e.g. 250" onChange={e => set('target_mt', e.target.value)} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Effective From</label>
            <input type="date" style={s.input} value={form.effective_from} onChange={e => set('effective_from', e.target.value)} required />
          </div>
        </div>
        {status && (
          <div style={{ ...s.alert, color: status.type === 'success' ? C.success : C.error, background: status.type === 'success' ? '#ECFDF5' : '#FEF2F2', borderColor: status.type === 'success' ? C.success : C.error }}>
            {status.type === 'success' ? '✅' : '❌'} {status.msg}
          </div>
        )}
        <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving…' : 'Set MT Target'}</button>
      </form>

      {/* ── KRA Targets Form ── */}
      <form onSubmit={handleKraSave} style={{ ...s.card, marginTop: 24 }}>
        <div style={s.sectionLabel}>KRA Targets</div>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 16, marginTop: -8 }}>
          Set monthly KRA targets per individual. Leave a field blank to keep the existing target unchanged.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div style={s.field}>
            <label style={s.label}>Salesperson</label>
            <select style={s.select} value={kraForm.user_id} onChange={e => setKraForm(f => ({ ...f, user_id: e.target.value }))} required>
              <option value="">— Select —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Month</label>
            <input type="month" style={s.input} value={kraForm.month.slice(0, 7)}
              onChange={e => setKraForm(f => ({ ...f, month: e.target.value + '-01' }))} required />
          </div>
        </div>

        {kraForm.user_id && (
          <>
            {/* Frontend KRAs */}
            <div style={s.kraSection}>
              <div style={s.kraSectionLabel}>
                Frontend KRAs
                {selectedUserProfile?.team && <span style={s.teamTag}>{selectedUserProfile.team}</span>}
              </div>
              <div style={s.kraGrid}>
                {ALL_KRAS.filter(k => k.team === 'frontend').map(k => (
                  <div key={k.key} style={s.field}>
                    <label style={s.label}>
                      {k.label}
                      <span style={{ fontWeight: 400, color: C.muted, textTransform: 'none' }}> ({k.unit})</span>
                    </label>
                    <input
                      type="number"
                      style={{ ...s.input, borderColor: kraValues[k.key] !== undefined && kraValues[k.key] !== '' ? C.electric : C.border }}
                      value={kraValues[k.key] ?? ''}
                      min="0" step="1"
                      placeholder="Monthly target"
                      onChange={e => setKraValues(v => ({ ...v, [k.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Backend KRAs */}
            <div style={{ ...s.kraSection, marginTop: 16 }}>
              <div style={s.kraSectionLabel}>Backend KRAs</div>
              <div style={s.kraGrid}>
                {ALL_KRAS.filter(k => k.team === 'backend').map(k => (
                  <div key={k.key} style={s.field}>
                    <label style={s.label}>
                      {k.label}
                      <span style={{ fontWeight: 400, color: C.muted, textTransform: 'none' }}> ({k.unit})</span>
                    </label>
                    <input
                      type="number"
                      style={{ ...s.input, borderColor: kraValues[k.key] !== undefined && kraValues[k.key] !== '' ? C.electric : C.border }}
                      value={kraValues[k.key] ?? ''}
                      min="0" step="1"
                      placeholder="Monthly target"
                      onChange={e => setKraValues(v => ({ ...v, [k.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {kraStatus && (
          <div style={{ ...s.alert, color: kraStatus.type === 'success' ? C.success : C.error, background: kraStatus.type === 'success' ? '#ECFDF5' : '#FEF2F2', borderColor: kraStatus.type === 'success' ? C.success : C.error, marginTop: 16 }}>
            {kraStatus.type === 'success' ? '✅' : '❌'} {kraStatus.msg}
          </div>
        )}
        <button type="submit" style={{ ...s.btn, marginTop: 16 }} disabled={savingKra || !kraForm.user_id}>
          {savingKra ? 'Saving…' : 'Save KRA Targets'}
        </button>
      </form>

      {/* ── Existing MT Targets ── */}
      <div style={{ ...s.hdr2, marginTop: 28 }}>
        <div style={s.sectionLabel2}>Current MT Targets</div>
        <select style={{ ...s.select, width: 200 }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="">All users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </div>
      <div style={s.tableCard}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Person', 'Plant', 'Unit', 'Category', 'Product', 'Target MT', 'From', 'To', 'Set By'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleTargets.length === 0 ? (
              <tr><td colSpan={9} style={{ ...s.td, textAlign: 'center', color: C.muted }}>No targets set yet.</td></tr>
            ) : visibleTargets.map(t => (
              <tr key={t.id}>
                <td style={s.td}><strong>{t.user?.full_name}</strong></td>
                <td style={s.td}>{t.plant}</td>
                <td style={s.td}>{t.unit}</td>
                <td style={s.td}>{t.category}</td>
                <td style={s.td}>{t.final_product}</td>
                <td style={{ ...s.td, fontWeight: 700, color: C.prussian }}>{t.target_mt} MT</td>
                <td style={s.td}>{t.effective_from}</td>
                <td style={s.td}>{t.effective_to || <span style={{ color: C.green, fontWeight: 600 }}>Active</span>}</td>
                <td style={{ ...s.td, color: C.muted }}>{t.setter?.full_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 1040, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub: { color: C.muted, marginTop: 4, fontSize: 14, marginBottom: 24 },
  card: { background: C.white, borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 },
  sectionLabel2: { fontSize: 12, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em' },
  kraSection: { background: C.bg, borderRadius: 8, padding: '14px 16px' },
  kraSectionLabel: { fontSize: 11, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
  teamTag: { background: C.electric + '18', color: C.electric, borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, textTransform: 'capitalize', letterSpacing: 0 },
  kraGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none' },
  select: { padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none', background: C.white },
  btn: { padding: '11px 28px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer' },
  alert: { padding: '11px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 14, marginBottom: 12 },
  hdr2: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tableCard: { background: C.white, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 800 },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `2px solid ${C.border}`, background: C.bg, whiteSpace: 'nowrap' },
  td: { padding: '11px 14px', fontSize: 13, color: C.text, borderBottom: `1px solid #F1F5F9` },
}
