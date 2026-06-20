import { useState } from 'react'
import './AddSite.css'
import { supabase } from '../lib/supabase'

export default function AddSite({ onClose, onSiteAdded }) {
  const [step, setStep]       = useState('form')  // 'form' | 'snippet'
  const [name, setName]       = useState('')
  const [domain, setDomain]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [site, setSite]       = useState(null)
  const [copied, setCopied]   = useState(false)
  const [demoDone, setDemoDone] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('sites')
        .insert({ name: name.trim(), domain: cleanDomain, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      setSite(data)
      setStep('snippet')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDemo() {
    if (!site) return
    setDemoLoading(true)
    const { error } = await supabase.rpc('generate_demo_data', { p_site_id: site.id })
    if (!error) setDemoDone(true)
    setDemoLoading(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippetCode(site))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {step === 'form' ? 'Add a website' : 'Install tracking snippet'}
          </span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={handleCreate}>
            <div className="modal-field">
              <label className="modal-label">Site name</label>
              <input
                className="modal-input"
                placeholder="My Awesome App"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Domain</label>
              <input
                className="modal-input"
                placeholder="myapp.com"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                required
              />
            </div>
            {error && (
              <div style={{ marginBottom: 12, padding: '9px 13px', background: 'var(--c-danger-tint)', border: '1px solid var(--c-danger-border)', borderRadius: 9, fontSize: 13, color: 'var(--c-danger)', fontWeight: 600 }}>
                {error}
              </div>
            )}
            <button type="submit" className="modal-submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create site'}
            </button>
          </form>
        )}

        {step === 'snippet' && site && (
          <>
            <p className="snippet-label">Paste this snippet into the <code style={{ background: 'var(--c-bg)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>&lt;head&gt;</code> of every page you want to track:</p>

            <div className="snippet-box">
              <pre className="snippet-code">{snippetCode(site)}</pre>
              <button className="snippet-copy-btn" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <p className="snippet-note">
              The snippet is ~1 KB, loads async, and sets no cookies. Works on any website or SPA.
              {' '}Point the <code style={{ background: 'var(--c-bg)', padding: '1px 4px', borderRadius: 3, fontSize: 11.5 }}>src</code> URL to your deployed Klikstat domain in production.
            </p>

            <div className="snippet-actions">
              <button className="done-btn" onClick={() => onSiteAdded(site)} style={{ flex: 'none', width: '100%' }}>
                Go to dashboard →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function snippetCode(site) {
  const base = window.location.origin
  return `<script defer data-token="${site.token}"\n  src="${base}/tracker.js"></script>`
}
