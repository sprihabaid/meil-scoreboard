import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const C = { prussian: '#012D4C', electric: '#015998', green: '#5AB947', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', error: '#EF4444', success: '#10B981', bg: '#F8FAFC' }

const PLANTS   = ['Reengus', 'Jaipur']
const UNITS    = { Reengus: ['Unit 1 (Rd. No. 1)', 'Unit 2 (Reengus)'], Jaipur: ['VKI Jaipur'] }
const CATS     = ['CRGO Steel', 'Amorphous']
const PRODUCTS = ['Slitting', 'Cutting', 'Assembly']

const EMPTY = { user_id: '', plant: 'Reengus', unit: 'Unit 1 (Rd. No. 1)', category: 'CRGO Steel', final_product: 'Slitting', target_mt: '', effective_from: today() }

export default function TargetManager() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [targets, setTargets] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [filterUser, setFilterUser] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').order('full_name')
      .then(({ data, error }) => {
        if (error) console.error('TargetManager profiles error:', error)
        setUsers(data || [])
      })
    loadTargets()
  }, [])

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

    // Close any active target for same user+plant+unit+category+product
    await supabase.from('targets')
      .update({ effective_to: form.effective_from })
      .eq('user_id', form.user_id)
      .eq('plant', form.plant)
      .eq('unit', form.unit)
      .eq('category', form.category)
      .eq('final_product', form.final_product)
      .is('effective_to', null)

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

  const visibleTargets = filterUser ? targets.filter(t => t.user_id === filterUser) : targets

  return (
    <div style={s.page}>
      <h1 style={s.title}>Target Manager</h1>
      <p style={s.sub}>Set MT targets per salesperson, plant, unit, category, and product.</p>

      {/* Form */}
      <form onSubmit={handleSubmit} style={s.card}>
        <div style={s.sectionLabel}>Set New Target</div>
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
        <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving…' : 'Set Target'}</button>
      </form>

      {/* Existing targets */}
      <div style={{ ...s.hdr2, marginTop: 28 }}>
        <div style={s.sectionLabel2}>Current Targets</div>
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

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 1040, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub: { color: C.muted, marginTop: 4, fontSize: 14, marginBottom: 24 },
  card: { background: C.white, borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 },
  sectionLabel2: { fontSize: 12, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em' },
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
