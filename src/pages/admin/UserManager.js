import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const C = { prussian: '#012D4C', electric: '#015998', green: '#5AB947', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', error: '#EF4444', success: '#10B981', bg: '#F8FAFC' }

const ROLES = ['salesperson', 'sales_manager', 'data_entry', 'admin', 'superadmin']

const PERMS = [
  { key: 'perm_view_leaderboard',    label: 'View Leaderboard'     },
  { key: 'perm_view_team_panel',     label: 'View Team Panel'      },
  { key: 'perm_view_all_scorecards', label: 'View All Scorecards'  },
  { key: 'perm_enter_data',          label: 'Enter Data'           },
  { key: 'perm_approve_kra',         label: 'Approve KRA'          },
  { key: 'perm_manage_users',        label: 'Manage Users'         },
  { key: 'perm_declare_badges',      label: 'Declare Badges'       },
  { key: 'perm_view_audit_log',      label: 'View Audit Log'       },
  { key: 'perm_export_reports',      label: 'Export Reports'       },
  { key: 'perm_set_targets',         label: 'Set Targets'          },
]

const EMPTY_FORM = { full_name: '', email: '', password: '', role: 'salesperson', team: '' }

export default function UserManager() {
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [globalMsg, setGlobalMsg]   = useState(null)
  const [showModal, setShowModal]   = useState(false)
  const [newUser, setNewUser]       = useState(EMPTY_FORM)
  const [addError, setAddError]     = useState('')
  const [adding, setAdding]         = useState(false)
  const [filterActive, setFilterActive] = useState('active')

  const load = useCallback(() => {
    setLoading(true)
    let q = supabase.from('profiles').select('*').order('full_name')
    if (filterActive === 'active') q = q.eq('is_active', true)
    q.then(({ data, error }) => {
      if (error) console.error('UserManager load error:', error)
      setUsers(data || [])
      setLoading(false)
    })
  }, [filterActive])

  useEffect(() => { load() }, [load])

  // ── Permission toggle — saves immediately ──
  const togglePerm = async (user, key) => {
    const newVal = !user[key]
    const { error } = await supabase.from('profiles').update({ [key]: newVal }).eq('id', user.id)
    if (!error) setUsers(us => us.map(u => u.id === user.id ? { ...u, [key]: newVal } : u))
    else setGlobalMsg({ type: 'error', msg: error.message })
  }

  // ── Role change — saves immediately ──
  const changeRole = async (user, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', user.id)
    if (!error) setUsers(us => us.map(u => u.id === user.id ? { ...u, role } : u))
    else setGlobalMsg({ type: 'error', msg: error.message })
  }

  // ── Activate / deactivate ──
  const toggleActive = async (user) => {
    const { error } = await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
    if (!error) setUsers(us => us.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u))
    else setGlobalMsg({ type: 'error', msg: error.message })
  }

  // ── Add user via Netlify function (service role, no confirmation email) ──
  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    setAdding(true)

    // Pass the session token so the function can verify the caller is an admin
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setAdding(false)
      return setAddError('Your session has expired. Please sign in again.')
    }

    let res, json
    try {
      res = await fetch('/.netlify/functions/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email:     newUser.email,
          password:  newUser.password,
          full_name: newUser.full_name,
          role:      newUser.role,
          team:      newUser.team || null,
        }),
      })
      json = await res.json()
    } catch (networkErr) {
      setAdding(false)
      return setAddError('Network error — could not reach the server. Please try again.')
    }

    setAdding(false)

    if (!res.ok || !json.success) {
      return setAddError(json?.error || 'An unexpected error occurred. Please try again.')
    }

    setShowModal(false)
    setNewUser(EMPTY_FORM)
    setGlobalMsg({ type: 'success', msg: `✅ ${json.full_name} added successfully. They can sign in immediately — no confirmation email will be sent.` })
    load()
  }

  if (loading) return <div style={s.center}>Loading users…</div>

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.hdr}>
        <div>
          <h1 style={s.title}>Manage Users</h1>
          <p style={s.sub}>
            {users.length} {filterActive === 'active' ? 'active' : 'total'} user{users.length !== 1 ? 's' : ''} — click a row to expand permissions
          </p>
        </div>
        <div style={s.hdrActions}>
          <div style={s.filterToggle}>
            {[
              { key: 'active', label: 'Active' },
              { key: 'all',    label: 'All users' },
            ].map(f => (
              <button
                key={f.key}
                style={{ ...s.filterBtn, ...(filterActive === f.key ? s.filterBtnActive : {}) }}
                onClick={() => setFilterActive(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button style={s.addBtn} onClick={() => { setShowModal(true); setAddError('') }}>+ Add User</button>
        </div>
      </div>

      {globalMsg && (
        <div style={{ ...s.alert, color: globalMsg.type === 'success' ? C.success : C.error, background: globalMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2', borderColor: globalMsg.type === 'success' ? C.success : C.error, marginBottom: 16 }}>
          {globalMsg.msg}
        </div>
      )}

      {/* User list */}
      <div style={s.card}>
        {users.map((user, i) => (
          <div key={user.id}>
            <div
              style={{ ...s.userRow, background: i % 2 === 0 ? C.white : C.bg, opacity: user.is_active ? 1 : 0.55 }}
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
                <div style={s.permTitle}>Permissions</div>
                <div style={s.permGrid}>
                  {PERMS.map(p => (
                    <label key={p.key} style={s.permRow} onClick={() => togglePerm(user, p.key)}>
                      <div style={{ ...s.toggle, background: user[p.key] ? C.green : '#CBD5E1' }}>
                        <div style={{ ...s.toggleKnob, transform: user[p.key] ? 'translateX(18px)' : 'translateX(2px)' }} />
                      </div>
                      <span style={{ ...s.permLabel, color: user[p.key] ? C.text : C.muted }}>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHdr}>
              <h2 style={s.modalTitle}>Add New User</h2>
              <button style={s.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div style={s.modalGrid}>
                <div style={s.field}>
                  <label style={s.label}>Full Name</label>
                  <input style={s.input} required placeholder="e.g. Rahul Sharma" value={newUser.full_name} onChange={e => setNewUser(n => ({ ...n, full_name: e.target.value }))} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Email</label>
                  <input type="email" style={s.input} required placeholder="user@meil.com" value={newUser.email} onChange={e => setNewUser(n => ({ ...n, email: e.target.value }))} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Temporary Password</label>
                  <input type="password" style={s.input} required minLength={6} placeholder="Min 6 characters" value={newUser.password} onChange={e => setNewUser(n => ({ ...n, password: e.target.value }))} />
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
                    <option value="">None</option>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                  </select>
                </div>
              </div>
              {addError && (
                <div style={{ background: '#FEF2F2', border: `1.5px solid ${C.error}`, color: '#991B1B', borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
                  ❌ {addError}
                </div>
              )}
              <button type="submit" style={s.btn} disabled={adding}>
                {adding ? 'Creating…' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page:       { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 960, margin: '0 auto' },
  center:     { textAlign: 'center', padding: 60, color: C.muted, fontFamily: 'Montserrat, sans-serif' },
  hdr:          { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:        { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub:          { color: C.muted, marginTop: 4, fontSize: 14 },
  hdrActions:   { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  filterToggle: { display: 'flex', borderRadius: 8, border: `1.5px solid ${C.border}`, overflow: 'hidden' },
  filterBtn:    { padding: '7px 14px', border: 'none', background: C.white, color: C.muted, fontSize: 13, fontWeight: 600, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer' },
  filterBtnActive: { background: C.prussian, color: C.white },
  addBtn:       { padding: '9px 20px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontFamily: 'Montserrat, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  card:       { background: C.white, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden' },
  alert:      { padding: '12px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 14 },
  userRow:    { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` },
  userAvatar: { width: 36, height: 36, borderRadius: '50%', background: C.electric + '22', color: C.electric, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 },
  userInfo:   { flex: 1, minWidth: 0 },
  userName:   { fontWeight: 700, fontSize: 14, color: C.text },
  userEmail:  { fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  roleSelect: { padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'Montserrat, sans-serif', background: C.white, cursor: 'pointer' },
  teamBadge:  { background: C.electric + '18', color: C.electric, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' },
  statusBtn:  { borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' },
  chevron:    { fontSize: 10, color: C.muted, flexShrink: 0 },
  permPanel:  { background: '#F8FAFC', padding: '16px 20px 20px', borderBottom: `1px solid ${C.border}` },
  permTitle:  { fontSize: 11, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 },
  permGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 },
  permRow:    { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' },
  toggle:     { width: 38, height: 22, borderRadius: 11, position: 'relative', flexShrink: 0, transition: 'background 0.2s' },
  toggleKnob: { position: 'absolute', top: 3, width: 16, height: 16, background: C.white, borderRadius: '50%', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  permLabel:  { fontSize: 13, fontWeight: 500 },
  // Modal
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:      { background: C.white, borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  modalHdr:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 800, color: C.prussian, margin: 0 },
  closeBtn:   { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.muted, padding: 4 },
  modalGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 },
  field:      { display: 'flex', flexDirection: 'column', gap: 5 },
  label:      { fontSize: 11, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:      { padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none' },
  select:     { padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none', background: C.white },
  btn:        { width: '100%', padding: '12px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer', marginTop: 4 },
}
