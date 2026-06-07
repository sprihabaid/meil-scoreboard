import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const C = {
  prussian: '#012D4C',
  electric: '#015998',
  green: '#5AB947',
  white: '#FFFFFF',
  bg: '#F0F4F8',
  border: '#CBD5E1',
  text: '#1E293B',
  muted: '#64748B',
  error: '#EF4444',
  success: '#10B981',
}

const FIELDS = [
  { key: 'mt_brought',             label: 'MT Brought',                  unit: 'MT',  step: '0.01' },
  { key: 'inquiries_in_mt',        label: 'Inquiries in MT',             unit: 'MT',  step: '0.01' },
  { key: 'new_clients',            label: 'New Clients',                 unit: '',    step: '1'    },
  { key: 'avg_closing_price',      label: 'Avg Closing Price',           unit: '₹/MT',step: '0.01' },
  { key: 'inquiry_to_quote_hours', label: 'Inquiry-to-Quote TAT',        unit: 'hrs', step: '0.1'  },
  { key: 'revenue_rs_cr',          label: 'Revenue',                     unit: '₹ Cr',step: '0.0001'},
  { key: 'orders_count',           label: 'Orders Count',                unit: '',    step: '1'    },
]

const EMPTY = Object.fromEntries(FIELDS.map(f => [f.key, '']))

export default function DataEntry() {
  const { profile } = useAuth()
  const [salespersons, setSalespersons] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [date, setDate] = useState(today())
  const [form, setForm] = useState(EMPTY)
  const [existing, setExisting] = useState(null)
  const [status, setStatus] = useState(null) // { type: 'success'|'error', msg }
  const [saving, setSaving] = useState(false)
  const [loadingEntry, setLoadingEntry] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .in('role', ['salesperson', 'sales_manager'])
      .order('full_name')
      .then(({ data }) => setSalespersons(data || []))
  }, [])

  useEffect(() => {
    if (!selectedUser || !date) return
    setLoadingEntry(true)
    setExisting(null)
    setForm(EMPTY)
    supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', selectedUser)
      .eq('entry_date', date)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExisting(data)
          setForm(Object.fromEntries(FIELDS.map(f => [f.key, data[f.key] ?? ''])))
        }
        setLoadingEntry(false)
      })
  }, [selectedUser, date])

  const handleChange = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) return setStatus({ type: 'error', msg: 'Please select a salesperson.' })
    setSaving(true)
    setStatus(null)

    const payload = {
      user_id: selectedUser,
      entry_date: date,
      entered_by: profile.id,
      ...Object.fromEntries(FIELDS.map(f => [f.key, parseFloat(form[f.key]) || 0])),
    }

    const { error } = existing
      ? await supabase.from('daily_entries').update(payload).eq('id', existing.id)
      : await supabase.from('daily_entries').insert(payload)

    setSaving(false)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      setStatus({ type: 'success', msg: existing ? 'Entry updated successfully.' : 'Entry saved successfully.' })
      setExisting({ ...existing, ...payload })
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Data Entry</h1>
        <p style={s.sub}>Enter daily sales numbers for each salesperson.</p>
      </div>

      <form onSubmit={handleSubmit} style={s.card}>
        {/* Row: salesperson + date */}
        <div style={s.topRow}>
          <div style={s.field}>
            <label style={s.label}>Salesperson</label>
            <select
              style={s.select}
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              required
            >
              <option value="">— Select —</option>
              {salespersons.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div style={s.field}>
            <label style={s.label}>Date</label>
            <input
              type="date"
              style={s.input}
              value={date}
              max={today()}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        {existing && !loadingEntry && (
          <div style={s.existingBanner}>
            ✏️ An entry already exists for this person on {date}. Submitting will overwrite it.
          </div>
        )}

        {loadingEntry && <div style={s.loading}>Checking existing entry…</div>}

        {/* Metrics grid */}
        <div style={s.grid}>
          {FIELDS.map(f => (
            <div key={f.key} style={s.field}>
              <label style={s.label}>
                {f.label}
                {f.unit && <span style={s.unit}> ({f.unit})</span>}
              </label>
              <input
                type="number"
                style={s.input}
                value={form[f.key]}
                step={f.step}
                min="0"
                placeholder="0"
                onChange={e => handleChange(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>

        {status && (
          <div style={{ ...s.alert, background: status.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: status.type === 'success' ? C.success : C.error, borderColor: status.type === 'success' ? C.success : C.error }}>
            {status.type === 'success' ? '✅' : '❌'} {status.msg}
          </div>
        )}

        <button type="submit" style={s.btn} disabled={saving || !selectedUser}>
          {saving ? 'Saving…' : existing ? 'Update Entry' : 'Save Entry'}
        </button>
      </form>
    </div>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 840, margin: '0 auto' },
  header: { marginBottom: 28 },
  title: { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub: { color: C.muted, marginTop: 4, fontSize: 14 },
  card: { background: C.white, borderRadius: 12, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  topRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20, marginBottom: 24 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.05em' },
  unit: { fontWeight: 400, color: C.muted, textTransform: 'none' },
  input: { padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: 'Montserrat, sans-serif', outline: 'none', color: C.text },
  select: { padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 15, fontFamily: 'Montserrat, sans-serif', outline: 'none', color: C.text, background: C.white },
  btn: { display: 'block', width: '100%', padding: '13px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer', letterSpacing: '0.03em' },
  alert: { padding: '12px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 14, marginBottom: 16 },
  existingBanner: { background: '#FFF9E6', border: '1.5px solid #F59E0B', color: '#92400E', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 20 },
  loading: { color: C.muted, fontSize: 13, marginBottom: 12 },
}
