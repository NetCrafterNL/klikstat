import { useState } from 'react'
import './AddSite.css'

const ANALYZE_STEPS = [
  'Fetching your website…',
  'Identifying site type…',
  'Recommending goals…',
  'Building funnels…',
]

export default function AddSite({ user, onClose, onSiteAdded }) {
  const [step, setStep]           = useState('choose')
  const [url, setUrl]             = useState('')
  const [urlError, setUrlError]   = useState('')
  const [aiData, setAiData]       = useState(null)
  const [analyzeStep, setAnalyzeStep] = useState(0)
  const [name, setName]           = useState('')
  const [domain, setDomain]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [site, setSite]           = useState(null)
  const [copied, setCopied]       = useState(false)
  const [demoDone, setDemoDone]   = useState(false)

  async function handleAnalyze(e) {
    e.preventDefault()
    setUrlError('')
    if (!url.trim()) { setUrlError('Enter a URL to continue.'); return }
    setStep('analyzing')
    setAnalyzeStep(0)

    let i = 0
    const interval = setInterval(() => {
      i++
      if (i < ANALYZE_STEPS.length) setAnalyzeStep(i)
      else clearInterval(interval)
    }, 850)

    try {
      const r = await fetch('/ai/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      clearInterval(interval)
      setAnalyzeStep(ANALYZE_STEPS.length - 1)
      if (!r.ok) {
        const err = await r.json()
        setUrlError(err.error ?? 'AI analysis failed. Try again.')
        setStep('url')
        return
      }
      const data = await r.json()
      setAiData(data)
      setTimeout(() => setStep('review'), 350)
    } catch {
      clearInterval(interval)
      setUrlError('Network error. Check your connection and try again.')
      setStep('url')
    }
  }

  async function handleAiCreate() {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, name: aiData.siteName, domain: aiData.domain }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const created = await res.json()

      if (aiData.goals?.length) {
        await Promise.all(aiData.goals.map(g =>
          fetch(`/api/goals/${created.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: g.name, value: g.event }),
          })
        ))
      }
      if (aiData.funnels?.length) {
        await Promise.all(aiData.funnels.map(f =>
          fetch(`/api/funnels/${created.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: f.name, steps: f.steps }),
          })
        ))
      }

      setSite(created)
      setStep('snippet')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleManualCreate(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (!user?.id) { setError('Not logged in.'); setLoading(false); return }
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, name: name.trim(), domain: cleanDomain }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const created = await res.json()
      setSite(created)
      setStep('snippet')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippetCode(site))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const title = {
    choose:    'Add a website',
    url:       'Set up with AI',
    analyzing: 'Analyzing your site…',
    review:    'AI Setup Preview',
    form:      'Add a website',
    snippet:   'Install tracking snippet',
  }[step]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {step === 'choose' && (
          <div className="ai-choose">
            <button className="ai-choose-card ai-primary-card" onClick={() => setStep('url')}>
              <div className="ai-choose-icon ai-choose-icon-primary">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3a7 7 0 1 1 0 14A7 7 0 0 1 10 3z" stroke="white" strokeWidth="1.5"/>
                  <path d="M7.5 10h5M10 7.5v5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="1.5" fill="white"/>
                </svg>
              </div>
              <div className="ai-choose-text">
                <div className="ai-choose-title">Set up with AI</div>
                <div className="ai-choose-sub">Paste your URL — AI reads your site and automatically creates goals and funnels for you.</div>
              </div>
              <svg className="ai-choose-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button className="ai-choose-card ai-manual-card" onClick={() => setStep('form')}>
              <div className="ai-choose-icon ai-choose-icon-muted">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2.5" y="2.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5.5 9h7M5.5 6.5h7M5.5 11.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="ai-choose-text">
                <div className="ai-choose-title ai-choose-title-muted">Set up manually</div>
                <div className="ai-choose-sub">Enter your site name and domain yourself.</div>
              </div>
              <svg className="ai-choose-arrow ai-choose-arrow-muted" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}

        {step === 'url' && (
          <form onSubmit={handleAnalyze}>
            <div className="ai-url-hint">
              AI will visit your site, understand what it does, and create the right goals and funnels automatically.
            </div>
            <div className="modal-field">
              <label className="modal-label">Your website URL</label>
              <input
                className="modal-input"
                placeholder="https://yoursite.com"
                value={url}
                onChange={e => { setUrl(e.target.value); setUrlError('') }}
                autoFocus
              />
            </div>
            {urlError && <div className="ai-error">{urlError}</div>}
            <button type="submit" className="modal-submit">Analyze with AI →</button>
            <button type="button" className="ai-back-btn" onClick={() => setStep('choose')}>← Back</button>
          </form>
        )}

        {step === 'analyzing' && (
          <div className="ai-analyzing">
            {ANALYZE_STEPS.map((label, i) => (
              <div
                key={i}
                className={`ai-analyze-row${i <= analyzeStep ? ' active' : ''}${i < analyzeStep ? ' done' : ''}`}
              >
                <div className="ai-analyze-dot">
                  {i < analyzeStep && (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2 5.5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {i === analyzeStep && <div className="ai-dot-spinner" />}
                </div>
                <span className="ai-analyze-label">{label}</span>
              </div>
            ))}
          </div>
        )}

        {step === 'review' && aiData && (
          <div className="ai-review">
            <div className="ai-review-site">
              <div className="ai-review-site-name">{aiData.siteName}</div>
              <div className="ai-review-site-meta">
                <span className="ai-type-badge">{aiData.siteType}</span>
                <span className="ai-review-domain">{aiData.domain}</span>
              </div>
              {aiData.description && (
                <div className="ai-review-desc">{aiData.description}</div>
              )}
            </div>

            {aiData.goals?.length > 0 && (
              <div className="ai-review-section">
                <div className="ai-review-section-title">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5" stroke="var(--c-green-text)" strokeWidth="1.4"/>
                    <path d="M4 6.5l2 2 3.5-3.5" stroke="var(--c-green-text)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Goals ({aiData.goals.length} will be created)
                </div>
                {aiData.goals.map((g, i) => (
                  <div key={i} className="ai-review-item">
                    <span className="ai-review-item-name">{g.name}</span>
                    <code className="ai-review-code">{g.event}</code>
                  </div>
                ))}
              </div>
            )}

            {aiData.funnels?.length > 0 && (
              <div className="ai-review-section">
                <div className="ai-review-section-title">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M1.5 2.5h10l-3.5 4.5V12l-3-1.5V7L1.5 2.5z" stroke="var(--c-primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Funnels ({aiData.funnels.length} will be created)
                </div>
                {aiData.funnels.map((f, i) => (
                  <div key={i} className="ai-review-item ai-review-funnel-item">
                    <span className="ai-review-item-name">{f.name}</span>
                    <span className="ai-review-funnel-steps">{f.steps.join(' → ')}</span>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="ai-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="ai-review-actions">
              <button className="btn-outline" onClick={() => { setStep('url'); setAiData(null) }}>
                ← Re-analyze
              </button>
              <button
                className="modal-submit"
                style={{ flex: 1, marginTop: 0 }}
                onClick={handleAiCreate}
                disabled={loading}
              >
                {loading ? 'Setting up…' : 'Set everything up →'}
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleManualCreate}>
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
            {error && <div className="ai-error">{error}</div>}
            <button type="submit" className="modal-submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create site'}
            </button>
            <button type="button" className="ai-back-btn" onClick={() => setStep('choose')}>← Back</button>
          </form>
        )}

        {step === 'snippet' && site && (
          <>
            {aiData && (
              <div className="snippet-success">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" fill="var(--c-green-text)" opacity=".15"/>
                  <path d="M4 7l2.5 2.5 4-4.5" stroke="var(--c-green-text)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                AI created {aiData.goals?.length ?? 0} goals and {aiData.funnels?.length ?? 0} funnels for you
              </div>
            )}
            <p className="snippet-label">
              Paste this snippet into the{' '}
              <code style={{ background: 'var(--c-bg)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>&lt;head&gt;</code>
              {' '}of every page you want to track:
            </p>
            <div className="snippet-box">
              <pre className="snippet-code">{snippetCode(site)}</pre>
              <button className="snippet-copy-btn" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="snippet-note">
              The snippet is ~1 KB, loads async, and sets no cookies. Works on any website or SPA.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="done-btn" style={{ width: '100%' }} onClick={() => onSiteAdded(site)}>
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
