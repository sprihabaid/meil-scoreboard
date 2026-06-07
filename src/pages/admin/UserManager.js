import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const C = { prussian: '#012D4C', electric: '#015998', green: '#5AB947', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', error: '#EF4444', success: '#10B981', bg: '#F8FAFC' }

const ROLES = ['salesperson', 'sales_manager', 'data_entry', 'admin', 'superadmin']

const PERMS = [
  { key: 'perm_view_leaderboard',      label: 'View Leaderboard' },
  { key: 'perm_view_team_panel',       label: 'View Team Panel' },
  { key: 'perm_view_all_scorecards',   label: 'View All Scorecards' },
  { key: 'perm_enter_data',            label: 'Enter Data' },
  { key: 'perm_approve_kra',           label: 'Approve KRA' },
  { key: 'perm_manage_users',          label: 'Manage Users' },
  { key: 'perm_declare_badges',        label: 'Declare Badges' },
  { key: 'perm_view_audit_log',        label: 'View Audit Log' },
  { key: 'perm_export_reports',        label: 'Export Reports' },
  { key: 'perm_set_targets',           label: 'Set Targets' },
]

export default function UserManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [status, setStatus] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', email: '', role: 'salesperson', team: '' })
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const load = () => {
    supabase.from('profiles').select('*').order('full_name')
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const togglePerm = async (user, key) => {
    const newVal = !user[key]
    const { error } = await supabase.from('profiles').update({ [key]: newVal }).eq('id', user.id)
    if (!error) setUsers(us => us.map(u => u.id === user.id ? { ...u, [key]: newVal } : u))
    else setStatus({ type: 'error', msg: error.message })
  }

  const changeRole = async (user, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', user.id)
    if (!error) setUsers(us => us.map(u => u.id === user.id ? { ...u, role } : u))
    else setStatus({ type: 'error', msg: error.message })
  }

  const toggleActive = async (user) => {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    if (!error) setUsers(us => us.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u))
    else setStatus({ type: 'error', msg: error.message })
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    // Create auth user via Supabase admin is not available client-side;
    // insert profile row — user must be invited separately via Supabase Dashboard.
    const { error } = await supabase.from('profiles').insert({
      id: crypto.randomUUID(), // temp UUID; real id comes from auth
      full_name: newUser.full_name,
      email: newUser.email,
      role: newUser.role,
      team: newUser.team || null,
    })
    setAdding(false)
    if (error) {
      setAddError('To create a user, invite them via Supabase Auth first, then their profile row will be created automatically. Error: ' + error.message)
    } else {
      setShowAdd(false)
      setNewUser({ full_name: '', email: '', role: 'salesperson', team: '' })
      load()
    }
  }

  if (loading) return <div style={s.center}>Loading users…</div>

  return (
    <div style={s.page}>
      <div style={s.hdr}>
        <div>
          <h1 style={s.title}>Manage Users</h1>
          <p style={s.sub}>{users.length} users · click a row to expand permissions</p>
        </div>
        <button style={s.addBtn} onClick={() => setShowAdd(v => !v)}>
          {showAdd ? '✕ Cancel' : '+ Add User'}
        </button>
      </div>

      {status && (
        <div style={{ ...s.alert, color: C.error, borderColor: C.error, background: '#FEF2F2', marginBottom: 16 }}>
          ❌ {status.msg}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} style={{ ...s.card, marginBottom: 20 }}>
          <div style={s.addGrid}>
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              <input style={s.input} required value={newUser.full_name} onChange={e => setNewUser(n => ({ ...n, full_name: e.target.value }))} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input type="email" style={s.input} required value={newUser.email} onChange={e => setNewUser(n => ({ ...n, email: e.target.value }))} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Role</label>
              <select style={s.select} value={newUser.role} onChange={e => setNewUser(n => ({ ...n, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Team</label>
              <select style={s.select} value={newUser.team} onChange={e => setNewUser(n => ({ ...n, team: e.target.value }))}>
                <option value="">— None —</option>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
              </select>
            </div>
          </div>
          {addError && <div style={{ color: C.error, fontSize: 13, marginBottom: 10 }}>{addError}</div>}
          <div style={s.addNote}>⚠️ Users must first be invited via <strong>Supabase Auth → Users → Invite</strong>. Their profile row is then linked to that auth user.</div>
          <button type="submit" style={s.btn} disabled={adding}>{adding ? 'Adding…' : 'Add Profile Row'}</button>
        </form>
      )}

      <div style={s.card}>
        {users.map((user, i) => (
          <div key={user.id}>
            <div
              style={{ ...s.userRow, background: i % 2 === 0 ? C.white : C.bg, opacity: user.is_active ? 1 : 0.5 }}
              onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
            >
              <div style={s.userAvatar}>{(user.full_name || '?')[0]}</div>
              <div style={s.userInfo}>
                <div style={s.userName}>{user.full_name}</div>
                <div style={s.userEmail}>{user.email}</div>
              </div>
              <select
                style={s.roleSelect}
                value={user.role}
                onClick={e => e.stopPropagation()}
                onChange={e => changeRole(user, e.target.value)}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {user.team && <span style={s.teamBadge}>{user.team}</span>}
              <button
                style={{ ...s.statusBtn, background: user.is_active ? '#DCFCE7' : '#FEE2E2', color: user.is_active ? '#166534' : '#991B1B' }}
                onClick={e => { e.stopPropagation(); toggleActive(user) }}
              >
                {user.is_active ? 'Active' : 'Inactive'}
              </button>
              <span style={s.chevron}>{expandedId === user.id ? '▲' : '▼'}</span>
            </div>

            {expandedId === user.id && (
              <div style={s.permPanel}>
                <div style={s.permGrid}>
                  {PERMS.map(p => (
                    <label key={p.key} style={s.permRow} onClick={() => togglePerm(user, p.key)}>
                      <div style={{ ...s.toggle, background: user[p.key] ? C.green : C.border }}>
                        <div style={{ ...s.toggleKnob, transform: user[p.key] ? 'translateX(18px)' : 'translateX(2px)' }} />
                      </div>
                      <span style={s.permLabel}>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 960, margin: '0 auto' },
  center: { textAlign: 'center', padding: 60, color: C.muted, fontFamily: 'Montserrat, sans-serif' },
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub: { color: C.muted, marginTop: 4, fontSize: 14 },
  addBtn: { padding: '9px 20px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontFamily: 'Montserrat, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  card: { background: C.white, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' },
  addGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none' },
  select: { padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none', background: C.white },
  btn: { padding: '11px 24px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer' },
  alert: { padding: '12px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 14 },
  addNote: { background: '#FFFBEB', border: '1px solid #F59E0B', color: '#92400E', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 },
  userRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` },
  userAvatar: { width: 36, height: 36, borderRadius: '50%', background: C.electric + '22', color: C.electric, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontWeight: 700, fontSize: 14, color: C.text },
  userEmail: { fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  roleSelect: { padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat, sans-serif', background: C.white, cursor: 'pointer' },
  teamBadge: { background: C.electric + '18', color: C.electric, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' },
  statusBtn: { borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' },
  chevron: { fontSize: 10, color: C.muted, flexShrink: 0 },
  permPanel: { background: '#F8FAFC', padding: '16px 20px', borderBottom: `1px solid ${C.border}` },
  permGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  permRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  toggle: { width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0, transition: 'background 0.2s' },
  toggleKnob: { position: 'absolute', top: 2, width: 16, height: 16, background: C.white, borderRadius: '50%', transition: 'transform 0.2s' },
  permLabel: { fontSize: 13, color: C.text, fontWeight: 500 },
}
