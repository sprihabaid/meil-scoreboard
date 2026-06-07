import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const C = { prussian: '#012D4C', electric: '#015998', green: '#5AB947', white: '#FFFFFF', border: '#CBD5E1', text: '#1E293B', muted: '#64748B', error: '#EF4444', bg: '#F8FAFC' }

const MONTHLY_BADGES = [
  { key: 'king_of_mt',        label: 'King of MT',         icon: '👑', color: '#F59E0B', desc: 'Highest orders in MT'               },
  { key: 'premium_closer',    label: 'Premium Closer',     icon: '💰', color: '#10B981', desc: 'Highest avg closing price per MT'    },
  { key: 'market_opener',     label: 'Market Opener',      icon: '🚀', color: '#3B82F6', desc: 'Most new clients unlocked'           },
  { key: 'loyalty_builder',   label: 'Loyalty Builder',    icon: '🤝', color: '#8B5CF6', desc: 'Best client retention rate'          },
  { key: 'comeback_champion', label: 'Comeback Champion',  icon: '⚡', color: '#EF4444', desc: 'Biggest MT improvement'              },
  { key: 'pipeline_king',     label: 'Pipeline King',      icon: '🔮', color: '#06B6D4', desc: 'Highest inquiries in MT'             },
  { key: 'speed_award',       label: 'Speed Award',        icon: '💨', color: '#F97316', desc: 'Fastest inquiry-to-quote TAT'        },
]

const REWARD_TYPES = ['cash', 'voucher', 'recognition', 'trophy']

const EMPTY_FORM = Object.fromEntries(MONTHLY_BADGES.map(b => [b.key, { winner_id: '', reward_type: 'recognition', reward_description: '', shoutout_text: '' }]))

export default function HallOfFame() {
  const { user, can } = useAuth()
  const [history, setHistory] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [declareMonth, setDeclareMonth] = useState(currentMonth())
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filterMonth, setFilterMonth] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('monthly_badges')
        .select('*, winner:profiles(full_name, avatar_url), declarer:profiles!monthly_badges_declared_by_fkey(full_name)')
        .order('month', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    ]).then(([b, u]) => {
      if (!b.error) setHistory(b.data || [])
      if (!u.error) setUsers(u.data || [])
      setLoading(false)
    })
  }, [])

  const setField = (badge, field, val) =>
    setForm(f => ({ ...f, [badge]: { ...f[badge], [field]: val } }))

  const handleDeclare = async (e) => {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    const inserts = MONTHLY_BADGES
      .filter(b => form[b.key].winner_id)
      .map(b => ({
        month: declareMonth + '-01',
        badge_category: b.key,
        winner_id: form[b.key].winner_id,
        reward_type: form[b.key].reward_type,
        reward_description: form[b.key].reward_description,
        shoutout_text: form[b.key].shoutout_text,
        declared_by: user.id,
      }))

    if (inserts.length === 0) {
      setSaving(false)
      return setStatus({ type: 'error', msg: 'Please select at least one winner.' })
    }

    const { error } = await supabase.from('monthly_badges').upsert(inserts, { onConflict: 'month,badge_category' })
    setSaving(false)
    if (error) return setStatus({ type: 'error', msg: error.message })

    // Fire recognition events for each winner
    for (const ins of inserts) {
      const badge = MONTHLY_BADGES.find(b => b.key === ins.badge_category)
      await supabase.from('recognition_feed').insert({
        user_id: ins.winner_id, event_type: 'badge_earned', emoji: badge.icon,
        event_title: `won ${badge.label} for ${declareMonth}!`,
        event_body: ins.shoutout_text || badge.desc,
      })
      await supabase.from('earned_badges').insert({
        user_id: ins.winner_id, badge_category: ins.badge_category,
        month: ins.month, earned_date: new Date().toISOString().slice(0, 10), awarded_by: user.id,
        notes: ins.shoutout_text,
      }).throwOnError().catch(() => {})
    }

    setStatus({ type: 'success', msg: `${inserts.length} badge(s) declared for ${declareMonth}.` })
    setShowForm(false)
    setForm(EMPTY_FORM)
    // Refresh history
    supabase.from('monthly_badges')
      .select('*, winner:profiles(full_name, avatar_url), declarer:profiles!monthly_badges_declared_by_fkey(full_name)')
      .order('month', { ascending: false })
      .then(({ data }) => data && setHistory(data))
  }

  // Group by month
  const months = [...new Set(history.map(h => h.month?.slice(0, 7)))].filter(Boolean).sort().reverse()
  const filtered = filterMonth ? history.filter(h => h.month?.startsWith(filterMonth)) : history

  if (loading) return <div style={s.center}>Loading Hall of Fame…</div>

  return (
    <div style={s.page}>
      {/* Hero banner */}
      <div style={s.hero}>
        <div style={s.heroInner}>
          <div style={s.heroIcon}>🏆</div>
          <div>
            <h1 style={s.heroTitle}>Hall of Fame</h1>
            <p style={s.heroSub}>Monthly badge winners — permanently archived</p>
          </div>
        </div>
        {can('declare_badges') && (
          <button style={s.declareBtn} onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cancel' : '🎖️ Declare Winners'}
          </button>
        )}
      </div>

      {/* Declare form */}
      {showForm && can('declare_badges') && (
        <form onSubmit={handleDeclare} style={s.formCard}>
          <div style={s.formHdr}>
            <div style={s.sectionLabel}>Declare Winners for</div>
            <input type="month" style={s.monthInput} value={declareMonth} onChange={e => setDeclareMonth(e.target.value)} />
          </div>
          {MONTHLY_BADGES.map(b => (
            <div key={b.key} style={s.badgeFormRow}>
              <div style={{ ...s.badgeFormIcon, background: b.color + '18', color: b.color }}>{b.icon}</div>
              <div style={s.badgeFormInfo}>
                <div style={s.badgeFormName}>{b.label}</div>
                <div style={s.badgeFormDesc}>{b.desc}</div>
              </div>
              <div style={s.badgeFormFields}>
                <select style={s.select} value={form[b.key].winner_id} onChange={e => setField(b.key, 'winner_id', e.target.value)}>
                  <option value="">— No winner —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
                <select style={s.select} value={form[b.key].reward_type} onChange={e => setField(b.key, 'reward_type', e.target.value)}>
                  {REWARD_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input style={s.input} placeholder="Reward description (optional)" value={form[b.key].reward_description} onChange={e => setField(b.key, 'reward_description', e.target.value)} />
                <input style={s.input} placeholder="Shoutout text (optional)" value={form[b.key].shoutout_text} onChange={e => setField(b.key, 'shoutout_text', e.target.value)} />
              </div>
            </div>
          ))}
          {status && (
            <div style={{ ...s.alert, color: status.type === 'success' ? C.green : C.error, background: status.type === 'success' ? '#ECFDF5' : '#FEF2F2', borderColor: status.type === 'success' ? C.green : C.error }}>
              {status.type === 'success' ? '✅' : '❌'} {status.msg}
            </div>
          )}
          <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving…' : 'Declare Winners'}</button>
        </form>
      )}

      {status && !showForm && (
        <div style={{ ...s.alert, color: C.green, background: '#ECFDF5', borderColor: C.green, marginBottom: 16 }}>✅ {status.msg}</div>
      )}

      {/* Filter */}
      <div style={s.filterRow}>
        <div style={s.sectionLabel}>Archive</div>
        <select style={s.select} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">All months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Group by month */}
      {months.filter(m => !filterMonth || m === filterMonth).map(month => {
        const monthBadges = filtered.filter(h => h.month?.startsWith(month))
        return (
          <div key={month} style={s.monthBlock}>
            <div style={s.monthHdr}>{formatMonth(month)}</div>
            <div style={s.badgeGrid}>
              {MONTHLY_BADGES.map(b => {
                const winner = monthBadges.find(h => h.badge_category === b.key)
                return (
                  <div key={b.key} style={{ ...s.badgeCard, borderTop: `3px solid ${b.color}`, opacity: winner ? 1 : 0.4 }}>
                    <div style={s.badgeTop}>
                      <span style={{ fontSize: 26 }}>{b.icon}</span>
                      <div style={{ ...s.badgeLabel, color: b.color }}>{b.label}</div>
                    </div>
                    {winner ? (
                      <>
                        <div style={s.winnerName}>{winner.winner?.full_name}</div>
                        {winner.shoutout_text && <div style={s.shoutout}>"{winner.shoutout_text}"</div>}
                        {winner.reward_type && (
                          <div style={s.rewardBadge}>
                            {winner.reward_type === 'cash' ? '💵' : winner.reward_type === 'voucher' ? '🎁' : winner.reward_type === 'trophy' ? '🏆' : '⭐'} {winner.reward_description || winner.reward_type}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={s.noWinner}>Not declared</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {months.length === 0 && (
        <div style={s.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <p style={{ color: C.muted, fontSize: 15 }}>No winners declared yet. Superadmins can declare monthly badge winners above.</p>
        </div>
      )}
    </div>
  )
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function formatMonth(m) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const s = {
  page: { padding: '32px 24px', fontFamily: 'Montserrat, sans-serif', maxWidth: 1100, margin: '0 auto' },
  center: { textAlign: 'center', padding: 60, color: C.muted, fontFamily: 'Montserrat, sans-serif' },
  hero: { background: `linear-gradient(135deg, ${C.prussian}, ${C.electric})`, borderRadius: 16, padding: '24px 28px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  heroInner: { display: 'flex', alignItems: 'center', gap: 16 },
  heroIcon: { fontSize: 40 },
  heroTitle: { fontSize: 26, fontWeight: 800, color: C.white, margin: 0 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0 },
  declareBtn: { padding: '10px 22px', background: '#F59E0B', color: C.prussian, border: 'none', borderRadius: 8, fontFamily: 'Montserrat, sans-serif', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
  formCard: { background: C.white, borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', marginBottom: 24 },
  formHdr: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: C.prussian, textTransform: 'uppercase', letterSpacing: '0.06em' },
  monthInput: { padding: '8px 12px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Montserrat, sans-serif', outline: 'none' },
  badgeFormRow: { display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 0', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' },
  badgeFormIcon: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  badgeFormInfo: { width: 180, flexShrink: 0 },
  badgeFormName: { fontWeight: 700, fontSize: 14, color: C.text },
  badgeFormDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  badgeFormFields: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, minWidth: 0 },
  select: { padding: '8px 10px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'Montserrat, sans-serif', outline: 'none', background: C.white },
  input: { padding: '8px 10px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'Montserrat, sans-serif', outline: 'none' },
  btn: { display: 'block', marginTop: 16, padding: '12px 28px', background: C.prussian, color: C.white, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', cursor: 'pointer' },
  alert: { padding: '11px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 14, marginBottom: 12 },
  filterRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 },
  monthBlock: { marginBottom: 32 },
  monthHdr: { fontSize: 18, fontWeight: 800, color: C.prussian, marginBottom: 14, paddingBottom: 8, borderBottom: `2px solid ${C.border}` },
  badgeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  badgeCard: { background: C.white, borderRadius: 12, padding: '18px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
  badgeTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  badgeLabel: { fontSize: 13, fontWeight: 700, lineHeight: 1.3 },
  winnerName: { fontWeight: 800, fontSize: 16, color: C.prussian, marginBottom: 6 },
  shoutout: { fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 6, lineHeight: 1.4 },
  rewardBadge: { display: 'inline-block', background: '#FFFBEB', color: '#92400E', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #F59E0B' },
  noWinner: { fontSize: 12, color: C.muted, fontStyle: 'italic' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
}
