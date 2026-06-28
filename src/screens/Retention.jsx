import { useState, useEffect } from 'react'
import './Retention.css'

function cellColor(pct) {
  if (pct == null) return 'transparent'
  if (pct >= 80) return '#1F9D55'
  if (pct >= 60) return '#36C28E'
  if (pct >= 40) return '#7CE4AD'
  if (pct >= 20) return '#EEEBFD'
  return '#F4F3FB'
}
function cellText(pct) {
  if (pct >= 40) return 'white'
  return 'var(--c-text-body2)'
}

export default function Retention({ siteId, range }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    fetch(`/api/retention/${siteId}?range=${range}`)
      .then(r => r.json())
      .then(rows => {
        // Normalize from API format to display format
        const normalized = (rows || []).map(row => {
          const weeks = {}
          ;(row.retention || []).forEach(r => { weeks[String(r.week)] = Math.round(r.pct) })
          return { cohort_week: `Week ${row.cohortWeek + 1}`, cohort_size: row.size, weeks }
        })
        setData(normalized)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [siteId, range])

  const maxWeek = data ? Math.max(...data.map(r => Object.keys(r.weeks).map(Number).reduce((a,b) => Math.max(a,b), 0)), 0) : 0

  return (
    <>
      <div className="ret-title-row">
        <h1 className="ret-title">Retention</h1>
        <div className="ret-legend">
          {[0,20,40,60,80].map(p => (
            <span key={p} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, color:'var(--c-text-muted)', fontWeight:600 }}>
              <span style={{ width:14, height:14, borderRadius:3, background:cellColor(p), display:'inline-block', border:'1px solid var(--c-border)' }}/>
              {p}%{p === 80 ? '+' : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="ret-explainer">
        Each row is a cohort of visitors who first visited during that week.
        Columns show what % returned in subsequent weeks.
      </div>

      {!siteId ? (
        <div className="ret-empty">Sign in and select a site to view retention.</div>
      ) : loading ? (
        <div className="ret-empty">Calculating retention…</div>
      ) : !data?.length ? (
        <div className="ret-empty">Not enough data yet — retention requires at least 2 weeks of visitors.</div>
      ) : (
        <div className="ret-scroll">
          <table className="ret-table">
            <thead>
              <tr>
                <th className="ret-th ret-th-cohort">Cohort week</th>
                <th className="ret-th">Users</th>
                {Array.from({ length: maxWeek + 1 }, (_, i) => (
                  <th key={i} className="ret-th">{i === 0 ? 'Week 0' : `+${i}w`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.cohort_week}>
                  <td className="ret-td ret-td-cohort">{row.cohort_week}</td>
                  <td className="ret-td ret-td-size">{Number(row.cohort_size).toLocaleString()}</td>
                  {Array.from({ length: maxWeek + 1 }, (_, i) => {
                    const pct = row.weeks?.[String(i)]
                    return (
                      <td key={i} className="ret-td"
                        style={{
                          background: cellColor(pct),
                          color: cellText(pct ?? 0),
                        }}
                      >
                        {pct != null ? `${pct}%` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
