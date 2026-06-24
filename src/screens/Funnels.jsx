import { useState } from 'react'
import './Funnels.css'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : r === '365d' ? 365 : 30 }

// ─── Create / Edit Modal ───────────────────────────────────────────────────
function FunnelModal({ siteId, funnel, onClose, onSaved }) {
  const isEdit = !!funnel
  const [name, setName]     = useState(funnel?.name ?? '')
  const [steps, setSteps]   = useState(funnel?.steps ?? ['', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const createFunnel = useMutation(api.funnels.create)
  const updateFunnel = useMutation(api.funnels.update)

  function setStep(i, val) {
    setSteps(prev => prev.map((s, j) => j === i ? val : s))
  }
  function addStep()    { setSteps(prev => [...prev, '']) }
  function removeStep(i){ setSteps(prev => prev.filter((_, j) => j !== i)) }

  async function handleSave(e) {
    e.preventDefault()
    const clean = steps.map(s => s.trim()).filter(Boolean)
    if (clean.length < 2) { setError('Add at least 2 steps.'); return }
    if (!name.trim()) { setError('Give the funnel a name.'); return }
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await updateFunnel({ funnelId: funnel._id, name: name.trim(), steps: clean })
      } else {
        await createFunnel({ siteId, name: name.trim(), steps: clean })
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="funnel-overlay" onClick={onClose}>
      <div className="funnel-modal" onClick={e => e.stopPropagation()}>
        <div className="funnel-modal-header">
          <span className="funnel-modal-title">{isEdit ? 'Edit funnel' : 'Create funnel'}</span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="funnel-field">
            <label className="funnel-label">Funnel name</label>
            <input className="funnel-input" placeholder="e.g. Checkout flow" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>

          <div className="funnel-field">
            <label className="funnel-label">Steps <span style={{ color:'var(--c-text-muted3)', fontWeight:500 }}>— enter exact page paths</span></label>
            <div className="funnel-steps-list">
              {steps.map((s, i) => (
                <div key={i} className="funnel-step-row">
                  <span className="funnel-step-num">{i + 1}</span>
                  <input
                    className="funnel-input"
                    placeholder={i === 0 ? '/pricing' : i === 1 ? '/signup' : '/success'}
                    value={s}
                    onChange={e => setStep(i, e.target.value)}
                  />
                  {steps.length > 2 && (
                    <button type="button" className="funnel-remove-btn" onClick={() => removeStep(i)}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="funnel-add-step" onClick={addStep}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Add step
            </button>
          </div>

          {error && <div className="funnel-error">{error}</div>}

          <div className="funnel-modal-footer">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-sm" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create funnel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Single funnel visualisation ──────────────────────────────────────────
function FunnelCard({ funnel, siteId, range, onEdit, onDelete }) {
  const days    = rangeToDays(range)
  const funnelQ = useQuery(api.stats.getFunnelData, siteId ? { siteId, days, steps: funnel.steps ?? [] } : 'skip')
  const data    = siteId ? funnelQ : null
  const loading = siteId ? funnelQ === undefined : false

  const steps   = data ?? []
  const topCount = steps[0]?.count ?? 1

  return (
    <div className="funnel-card">
      <div className="funnel-card-header">
        <span className="funnel-card-title">{funnel.name}</span>
        <div className="funnel-card-actions">
          <button className="funnel-action-btn" onClick={() => onEdit(funnel)}>Edit</button>
          <button className="funnel-action-btn danger" onClick={() => onDelete(funnel._id)}>Delete</button>
        </div>
      </div>

      {loading ? (
        <div className="funnel-loading">
          {funnel.steps.map((s, i) => (
            <div key={i} className="funnel-step-skeleton">
              <div className="funnel-skel-label" />
              <div className="funnel-skel-bar" style={{ width: `${90 - i * 18}%` }} />
              <div className="funnel-skel-num" />
            </div>
          ))}
        </div>
      ) : steps.length === 0 ? (
        <div className="funnel-no-data">No events recorded for these pages yet.</div>
      ) : (
        <div className="funnel-steps-viz">
          {steps.map((s, i) => {
            const pctOfTop   = topCount > 0 ? (s.count / topCount * 100) : 0
            const pctOfPrev  = i > 0 && steps[i-1].count > 0
              ? (s.count / steps[i-1].count * 100) : null
            const dropoff    = pctOfPrev !== null ? 100 - pctOfPrev : null

            return (
              <div key={i} className="funnel-viz-row">
                <div className="funnel-viz-label">
                  <span className="funnel-viz-step-num">{i + 1}</span>
                  <span className="funnel-viz-path">{s.step}</span>
                </div>
                <div className="funnel-viz-bar-wrap">
                  <div className="funnel-viz-bar" style={{ width: `${Math.max(pctOfTop, 0.5)}%` }} />
                </div>
                <div className="funnel-viz-stats">
                  <span className="funnel-viz-count">{Number(s.count).toLocaleString()}</span>
                  <span className="funnel-viz-pct">{pctOfTop.toFixed(1)}%</span>
                  {dropoff !== null && (
                    <span className="funnel-viz-dropoff">↓ {dropoff.toFixed(1)}%</span>
                  )}
                </div>
              </div>
            )
          })}
          <div className="funnel-summary">
            Overall conversion:{' '}
            <strong>
              {topCount > 0
                ? `${((steps[steps.length-1]?.count ?? 0) / topCount * 100).toFixed(1)}%`
                : '—'}
            </strong>
            {' '}({Number(steps[steps.length-1]?.count ?? 0).toLocaleString()} of {Number(topCount).toLocaleString()})
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────
export default function Funnels({ siteId, range }) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const deleteFunnel = useMutation(api.funnels.remove)

  const funnels = useQuery(api.funnels.list, siteId ? { siteId } : 'skip') ?? []
  const loading = siteId ? funnels === undefined : false

  async function handleDelete(funnelId) {
    await deleteFunnel({ funnelId })
  }

  function handleEdit(funnel) { setEditing(funnel); setShowModal(true) }
  function closeModal()       { setShowModal(false); setEditing(null) }
  function afterSave()        { closeModal() }

  return (
    <>
      <div className="funnels-title-row">
        <h1 className="funnels-title">Funnels</h1>
        {siteId && (
          <button className="funnels-create-btn" onClick={() => setShowModal(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            New funnel
          </button>
        )}
      </div>

      {!siteId ? (
        <div className="funnels-empty">Sign in and select a site to create funnels.</div>
      ) : loading ? (
        <div className="funnels-empty">Loading…</div>
      ) : funnels.length === 0 ? (
        <div className="funnels-empty-state">
          <div className="funnels-empty-icon">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <path d="M4 6h22l-8 10v10l-6-3V16L4 6z" stroke="var(--c-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="funnels-empty-title">No funnels yet</div>
          <div className="funnels-empty-sub">
            Define a sequence of pages to see where visitors drop off on their way to a goal.
          </div>
          <button className="funnels-create-btn" onClick={() => setShowModal(true)}>
            Create your first funnel
          </button>
        </div>
      ) : (
        <div className="funnels-list">
          {funnels.map(f => (
            <FunnelCard
              key={f._id}
              funnel={f}
              siteId={siteId}
              range={range}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showModal && (
        <FunnelModal
          siteId={siteId}
          funnel={editing}
          onClose={closeModal}
          onSaved={afterSave}
        />
      )}
    </>
  )
}
