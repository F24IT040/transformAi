import { forwardRef } from 'react'
import type { InfographicData } from './types'
import './infographic.css'

interface Props {
  data: InfographicData
}

function getSectionIcon(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('threat') || t.includes('happened') || t.includes('warning') || t.includes('vector')) return '⚠️'
  if (t.includes('impact') || t.includes('affected') || t.includes('scope')) return '⚡'
  if (t.includes('action') || t.includes('taken') || t.includes('response') || t.includes('containment')) return '🛡️'
  if (t.includes('system') || t.includes('server') || t.includes('network')) return '💻'
  if (t.includes('analysis') || t.includes('statistic') || t.includes('metric')) return '📊'
  return '📌'
}

export const InfographicPreview = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  const { title, subtitle, severity, keyMessage, statistics, sections, recommendations, footer } = data

  const severityClass =
    severity?.toUpperCase() === 'CRITICAL' || severity?.toUpperCase() === 'HIGH'
      ? 'high'
      : severity?.toUpperCase() === 'MEDIUM'
      ? 'medium'
      : 'low'

  return (
    <div className="infographic-container-wrapper">
      <div className="infographic-poster" ref={ref} id="infographic-poster-capture">
        {/* HEADER SECTION */}
        <header className="infographic-header">
          <div className="infographic-top-meta">
            <div className="infographic-badge-gov">
              🏛️ GOVERNMENT &amp; ENTERPRISE BRIEFING
            </div>
            {severity && (
              <div className={`infographic-severity ${severityClass}`}>
                {severity} SEVERITY
              </div>
            )}
          </div>
          <h1 className="infographic-title">{title}</h1>
          {subtitle && <p className="infographic-subtitle">{subtitle}</p>}
        </header>

        {/* KEY MESSAGE SECTION */}
        {keyMessage && (
          <section className="infographic-key-message">
            <small>CORE KEY MESSAGE</small>
            <p>"{keyMessage}"</p>
          </section>
        )}

        {/* KEY STATISTICS SECTION */}
        {statistics && statistics.length > 0 && (
          <section className="infographic-stats-grid">
            {statistics.map((stat, idx) => (
              <div className="infographic-stat-card" key={idx}>
                <div className="infographic-stat-value">{stat.value}</div>
                <div className="infographic-stat-label">{stat.label}</div>
              </div>
            ))}
          </section>
        )}

        {/* DYNAMIC SECTIONS */}
        {sections && sections.length > 0 && (
          <section className="infographic-sections-container">
            {sections.map((sec, idx) => (
              <div className="infographic-section-card" key={idx}>
                <div className="infographic-section-header">
                  <div className="infographic-section-icon">{getSectionIcon(sec.title)}</div>
                  <h3>{sec.title}</h3>
                </div>
                {sec.points && sec.points.length > 0 && (
                  <ul className="infographic-points-list">
                    {sec.points.map((pt, pIdx) => (
                      <li key={pIdx}>{pt}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {/* RECOMMENDATIONS SECTION */}
        {recommendations && recommendations.length > 0 && (
          <section className="infographic-recommendations-card">
            <div className="infographic-rec-head">
              <div className="infographic-rec-icon">🛡️</div>
              <h3>Actionable Recommendations</h3>
            </div>
            <ul className="infographic-rec-list">
              {recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </section>
        )}

        {/* FOOTER SECTION */}
        <footer className="infographic-footer">
          <div className="infographic-footer-left">
            <span>🛡️</span> {footer || 'TransformAI Security Intelligence Briefing · Official Advisory'}
          </div>
          <div className="infographic-footer-right">
            Verified Source Grounded ✓
          </div>
        </footer>
      </div>
    </div>
  )
})

InfographicPreview.displayName = 'InfographicPreview'
