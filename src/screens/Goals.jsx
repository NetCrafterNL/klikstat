import { useState, useEffect } from 'react'
import './Goals.css'
import { supabase } from '../lib/supabase'

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : 30 }

// ─── Create Goal Modal ─────────────────────────────────────────────────────
function GoalModal({ siteId, onClose, onSaved }) {
  const [name, setName]     = useState('')
  const [event, setEvent]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || !event.trim()) { setError('Fill in both fields.'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('goals').insert({
      site_id: siteId, name: name.trim(), event: event.trim().toLowerCase().replace(/\s+/g,'-'),
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
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
  const [goals, setGoals]         = useState([])
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function load() {
    if (!siteId) { setLoading(false); return }
    const [{ data: goalsData }, { data: statsData }] = await Promise.all([
      supabase.from('goals').select('*').eq('site_id', siteId).order('created_at'),
      supabase.rpc('get_goals_data', { p_site_id: siteId, p_days: rangeToDays(range) }),
    ])
    if (goalsData) setGoals(goalsData)
    if (statsData) setData(statsData)
    setLoading(false)
  }

  useEffect(() => { load() }, [siteId, range])

  async function handleDelete(id) {
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
    setData(prev => prev ? prev.filter(g => g.id !== id) : prev)
  }

  function afterSave() { setShowModal(false); setLoading(true); load() }

  const statsMap = Object.fromEntries((data ?? []).map(d => [d.id, d]))

  return (
    <>
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
          {/* Tracker instructions banner */}
          <div className="goals-instructions">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="var(--c-primary)" strokeWidth="1.4"/>
              <path d="M8 7v5M8 5v.5" stroke="var(--c-primary)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            The Klikstat tracker exposes <code>window.klikstat.track('event')</code> — call it anywhere on your site to record a conversion.
          </div>

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
                <div key={g.id} className="goals-row">
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
                    <button className="goals-delete-btn" onClick={() => handleDelete(g.id)} title="Delete goal">
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
