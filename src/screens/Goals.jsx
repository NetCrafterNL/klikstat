import { useState } from 'react'
import './Goals.css'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : r === '365d' ? 365 : 30 }

// ─── Create Goal Modal ─────────────────────────────────────────────────────
function GoalModal({ siteId, onClose, onSaved }) {
  const [name, setName]     = useState('')
  const [event, setEvent]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const createGoal = useMutation(api.goals.create)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || !event.trim()) { setError('Fill in both fields.'); return }
    setSaving(true)
    try {
      await createGoal({ siteId, name: name.trim(), value: event.trim().toLowerCase().replace(/\s+/g, '-') })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const cleanEvent = event.trim().toLowerCase().replace(/\s+/g,'-')

  return (
    <div className="goals-overlay" onClick={onClose}>
      <div className="goals-modal" onClick={e => e.stopPropagation()}>
        <div className="goals-modal-header">
          <span className="goals-modal-title">Create goal</span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave}>
          <div className="goals-field">
            <label className="goals-label">Goal name</label>
            <input className="goals-input" placeholder="e.g. Signup" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="goals-field">
            <label className="goals-label">Event name <span style={{ color:'var(--c-text-muted3)', fontWeight:500 }}>— fires when you call klikstat.track('…')</span></label>
            <input className="goals-input" placeholder="e.g. signup" value={event} onChange={e => setEvent(e.target.value)} />
          </div>

          {cleanEvent && (
            <div className="goals-snippet-wrap">
              <span className="goals-snippet-label">Add this to your site where the event happens:</span>
              <div className="goals-snippet">
                <code>klikstat.track('<span style={{ color:'#C9C1FF' }}>{cleanEvent}</span>')</code>
                <button type="button" className="goals-copy-btn" onClick={() => navigator.clipboard.writeText(`klikstat.track('${cleanEvent}')`)}>
                  Copy
                </button>
              </div>
            </div>
          )}

          {error && <div className="goals-error">{error}</div>}
          <div className="goals-modal-footer">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? 'Saving…' : 'Create goal'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────
export default function Goals({ siteId, range }) {
  const [showModal, setShowModal] = useState(false)
  const deleteGoal = useMutation(api.goals.remove)

  const days    = rangeToDays(range)
  const goals   = useQuery(api.goals.list,          siteId ? { siteId } : 'skip') ?? []
  const data    = useQuery(api.stats.getGoalsData,  siteId ? { siteId, days } : 'skip') ?? []
  const revenue = useQuery(api.stats.getRevenueStats, siteId ? { siteId, days } : 'skip')
  const loading = siteId ? goals === undefined : false

  async function handleDelete(goalId) {
    await deleteGoal({ goalId })
  }

  function afterSave() { setShowModal(false) }

  const statsMap = Object.fromEntries((data ?? []).map(d => [d.id, d]))
  const hasRevenue = revenue && Number(revenue.total) > 0

  return (
    <>
      {hasRevenue && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:18 }}>
          {[
            { label:'Revenue', val:`$${Number(revenue.total).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`, color:'var(--c-green-text)' },
            { label:'Transactions', val:Number(revenue.count).toLocaleString(), color:'var(--c-primary)' },
            { label:'Avg. order value', val:`$${Number(revenue.avg).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`, color:'var(--c-amber)' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--c-surface)', borderRadius:16, padding:'18px 20px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--c-text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>{s.label}</div>
              <div style={{ fontSize:24, fontWeight:800, color:s.color, letterSpacing:'-.01em' }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}
      <div className="goals-title-row">
        <h1 className="goals-title">Goals</h1>
        {siteId && (
          <button className="goals-create-btn" onClick={() => setShowModal(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New goal
          </button>
        )}
      </div>

      {!siteId ? (
        <div className="goals-empty">Sign in and select a site to track goals.</div>
      ) : loading ? (
        <div className="goals-empty">Loading…</div>
      ) : goals.length === 0 ? (
        <div className="goals-empty-state">
          <div className="goals-empty-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" stroke="var(--c-primary)" strokeWidth="2"/>
              <path d="M9 14l4 4 6-7" stroke="var(--c-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="goals-empty-title">No goals yet</div>
          <div className="goals-empty-sub">
            Track signups, purchases, button clicks — any event you fire with{' '}
            <code style={{ background:'var(--c-bg)', padding:'1px 5px', borderRadius:4, fontSize:12.5 }}>klikstat.track()</code>
          </div>
          <button className="goals-create-btn" onClick={() => setShowModal(true)}>Create your first goal</button>
        </div>
      ) : (
        <>
          <div className="goals-card">
            <div className="goals-header-row">
              <span className="goals-col-main">Goal</span>
              <span className="goals-col">Event</span>
              <span className="goals-col">Completions</span>
              <span className="goals-col">Unique</span>
              <span className="goals-col">Conv. rate</span>
              <span className="goals-col-action" />
            </div>
            {goals.map(g => {
              const s = statsMap[g.id]
              return (
                <div key={g._id} className="goals-row">
                  <span className="goals-col-main goals-goal-name">
                    <span className="goals-badge-dot" />
                    {g.name}
                  </span>
                  <span className="goals-col">
                    <code className="goals-event-tag">{g.event}</code>
                  </span>
                  <span className="goals-col goals-num">{Number(s?.completions ?? 0).toLocaleString()}</span>
                  <span className="goals-col goals-num">{Number(s?.unique_completions ?? 0).toLocaleString()}</span>
                  <span className="goals-col goals-pct">{s?.conversion_rate ? `${s.conversion_rate}%` : '—'}</span>
                  <span className="goals-col-action">
                    <button className="goals-delete-btn" onClick={() => handleDelete(g._id)} title="Delete goal">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 4h10M5 4V2.5h4V4M5.5 10V6M8.5 10V6M3 4l.7 8h6.6L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {showModal && <GoalModal siteId={siteId} onClose={() => setShowModal(false)} onSaved={afterSave} />}
    </>
  )
}
