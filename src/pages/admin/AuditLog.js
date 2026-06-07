import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const C = { prussian: '#012D4C', electric: '#015998', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', bg: '#F8FAFC' }

const ACTION_COLORS = { INSERT: { bg: '#ECFDF5', color: '#065F46' }, UPDATE: { bg: '#EFF6FF', color: '#1E40AF' }, DELETE: { bg: '#FEF2F2', color: '#991B1B' }, LOGIN: { bg: '#F5F3FF', color: '#5B21B6' }, PERMISSION_CHANGE: { bg: '#FFFBEB', color: '#92400E' } }

function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').order('full_name')
      .then(({ data }) => setUsers(data || []))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    let q = supabase.from('audit_log')
      .select('id, action, table_name, user_id, user_name, user_role, changed_fields, notes, created_at, old_values, new_values, actor:profiles(full_name)')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterUser) q = q.eq('user_id', filterUser)
    if (filterFrom) q = q.gte('created_at', filterFrom)
    if (filterTo)   q = q.lte('created_at', filterTo + 'T23:59:59')

    q.then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [filterUser, filterFrom, filterTo, page])

  useEffect(() => { load() }, [load])

  return (
    <div style={s.page}>
      <h1 style={s.title}>Audit Log</h1>
      <p style={s.sub}>Every insert, update, delete, and login tracked.</p>

      {/* Filters */}
      <div style={s.filters}>
        <select style={s.select} value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0) }}>
          <option value="">All users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <div style={s.dateRange}>
          <input type="date" style={s.input} value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(0) }} placeholder="From" />
          <span style={{ color: C.muted, fontSize: 13 }}>to</span>
          <input type="date" style={s.input} value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(0) }} placeholder="To" />
        </div>
        <button style={s.clearBtn} onClick={() => { setFilterUser(''); setFilterFrom(''); setFilterTo(''); setPage(0) }}>Clear</button>
      </div>

      <div style={s.tableCard}>
        {loading ? (
          <div style={s.center}>Loading…</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['When', 'User', 'Action', 'Table', 'Fields Changed', 'Notes'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: C.muted }}>No records found.</td></tr>
              ) : logs.map(log => {
                const ac = ACTION_COLORS[log.action] || { bg: '#F3F4F6', color: C.muted }
                const isExp = expandedId === log.id
                return (
                  <React.Fragment key={log.id}>
                    <tr style={{ cursor: 'pointer', background: isExp ? '#F0F4FF' : undefined }} onClick={() => setExpandedId(isExp ? null : log.id)}>
                      <td style={{ ...s.td, whiteSpace: 'nowrap', color: C.muted, fontSize: 12 }}>{fmtDate(log.created_at)}</td>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{log.actor?.full_name || log.user_name || '—'}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{log.user_role}</div>
                      </td>
                      <td style={s.td}>
                        <span style={{ background: ac.bg, color: ac.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{log.action}</span>
                      </td>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12 }}>{log.table_name || '—'}</td>
                      <td style={{ ...s.td, fontSize: 12, color: C.muted }}>
                        {log.changed_fields?.slice(0, 4).join(', ')}{log.changed_fields?.length > 4 ? ` +${log.changed_fields.length - 4}` : ''}
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: C.muted }}>{log.notes || '—'}</td>
                    </tr>
                    {isExp && (
                      <tr>
                        <td colSpan={6} style={{ padding: '0 16px 16px', background: '#F8FAFF' }}>
                          <div style={s.diffRow}>
                            {log.old_values && (
                              <div style={s.diffBox}>
                                <div style={s.diffLabel}>Before</div>
                                <pre style={s.pre}>{JSON.stringify(log.old_values, null, 2)}</pre>
                              </div>
                            )}
                            {log.new_values && (
                              <div style={{ ...s.diffBox, borderColor: '#93C5FD' }}>
                                <div style={{ ...s.diffLabel, color: '#1D4ED8' }}>After</div>
                                <pre style={s.pre}>{JSON.stringify(log.new_values, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={s.pagination}>
        <button style={s.pageBtn} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
        <span style={{ color: C.muted, fontSize: 13 }}>Page {page + 1}</span>
        <button style={s.pageBtn} onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE}>Next →</button>
      </div>
    </div>
  )
}

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 1100, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 700, color: C.prussian, margin: 0 },
  sub: { color: C.muted, marginTop: 4, fontSize: 14, marginBottom: 20 },
  filters: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 },
  dateRange: { display: 'flex', alignItems: 'center', gap: 8 },
  select: { padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none', background: C.white, minWidth: 180 },
  input: { padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none' },
  clearBtn: { padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 13, fontFamily: 'Montserrat, sans-serif', color: C.muted },
  tableCard: { background: C.white, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'auto' },
  center: { padding: 40, textAlign: 'center', color: C.muted },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 800 },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `2px solid ${C.border}`, background: C.bg, whiteSpace: 'nowrap' },
  td: { padding: '11px 14px', fontSize: 13, color: C.text, borderBottom: `1px solid #F1F5F9`, verticalAlign: 'top' },
  diffRow: { display: 'flex', gap: 16, marginTop: 8 },
  diffBox: { flex: 1, border: '1.5px solid #D1D5DB', borderRadius: 8, padding: 12, minWidth: 0 },
  diffLabel: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 },
  pre: { margin: 0, fontSize: 11, color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', maxHeight: 200, overflowY: 'auto' },
  pagination: { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  pageBtn: { padding: '8px 18px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 13, fontFamily: 'Montserrat, sans-serif', fontWeight: 600 },
}
