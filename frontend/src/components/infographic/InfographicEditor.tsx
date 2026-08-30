import type { InfographicData, InfographicStat } from './types'

interface Props {
  data: InfographicData
  onChange: (updated: InfographicData) => void
}

export function InfographicEditor({ data, onChange }: Props) {
  const handleTitleChange = (title: string) => onChange({ ...data, title })
  const handleSubtitleChange = (subtitle: string) => onChange({ ...data, subtitle })
  const handleSeverityChange = (severity: string) => onChange({ ...data, severity })
  const handleKeyMessageChange = (keyMessage: string) => onChange({ ...data, keyMessage })
  const handleFooterChange = (footer: string) => onChange({ ...data, footer })

  // Stat Handlers
  const handleStatChange = (index: number, field: keyof InfographicStat, value: string) => {
    const nextStats = [...data.statistics]
    nextStats[index] = { ...nextStats[index], [field]: value }
    onChange({ ...data, statistics: nextStats })
  }

  const addStat = () => {
    onChange({
      ...data,
      statistics: [...data.statistics, { value: '100%', label: 'New Metric' }],
    })
  }

  const removeStat = (index: number) => {
    onChange({
      ...data,
      statistics: data.statistics.filter((_, i) => i !== index),
    })
  }

  // Section Handlers
  const handleSectionTitleChange = (index: number, title: string) => {
    const nextSections = [...data.sections]
    nextSections[index] = { ...nextSections[index], title }
    onChange({ ...data, sections: nextSections })
  }

  const handleSectionPointChange = (sectionIndex: number, pointIndex: number, text: string) => {
    const nextSections = [...data.sections]
    const points = [...nextSections[sectionIndex].points]
    points[pointIndex] = text
    nextSections[sectionIndex] = { ...nextSections[sectionIndex], points }
    onChange({ ...data, sections: nextSections })
  }

  const addSectionPoint = (sectionIndex: number) => {
    const nextSections = [...data.sections]
    nextSections[sectionIndex] = {
      ...nextSections[sectionIndex],
      points: [...nextSections[sectionIndex].points, 'New bullet point details...'],
    }
    onChange({ ...data, sections: nextSections })
  }

  const removeSectionPoint = (sectionIndex: number, pointIndex: number) => {
    const nextSections = [...data.sections]
    nextSections[sectionIndex] = {
      ...nextSections[sectionIndex],
      points: nextSections[sectionIndex].points.filter((_, i) => i !== pointIndex),
    }
    onChange({ ...data, sections: nextSections })
  }

  const addSection = () => {
    const nextSections = [
      ...data.sections,
      { title: 'New Section', points: ['Add section detail point'] },
    ]
    onChange({ ...data, sections: nextSections })
  }

  const removeSection = (index: number) => {
    onChange({
      ...data,
      sections: data.sections.filter((_, i) => i !== index),
    })
  }

  // Recommendation Handlers
  const handleRecChange = (index: number, text: string) => {
    const next = [...data.recommendations]
    next[index] = text
    onChange({ ...data, recommendations: next })
  }

  const addRec = () => {
    onChange({
      ...data,
      recommendations: [...data.recommendations, 'New strategic recommendation'],
    })
  }

  const removeRec = (index: number) => {
    onChange({
      ...data,
      recommendations: data.recommendations.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="infographic-editor-panel">
      <div className="editor-head">
        <h3>Edit Infographic Content</h3>
        <small style={{ color: '#94a3b8' }}>Live preview updates automatically</small>
      </div>

      {/* Main Header Fields */}
      <div className="editor-field-group">
        <label>Infographic Title</label>
        <input
          type="text"
          className="editor-input"
          value={data.title}
          onChange={e => handleTitleChange(e.target.value)}
        />
      </div>

      <div className="editor-field-group">
        <label>Subtitle / Tagline</label>
        <input
          type="text"
          className="editor-input"
          value={data.subtitle || ''}
          onChange={e => handleSubtitleChange(e.target.value)}
        />
      </div>

      <div className="editor-field-group">
        <label>Severity Badge</label>
        <select
          className="editor-select"
          value={data.severity || 'HIGH'}
          onChange={e => handleSeverityChange(e.target.value)}
        >
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
      </div>

      <div className="editor-field-group">
        <label>Core Key Message</label>
        <textarea
          className="editor-textarea"
          rows={3}
          value={data.keyMessage}
          onChange={e => handleKeyMessageChange(e.target.value)}
        />
      </div>

      {/* Key Callout Statistics */}
      <div className="editor-field-group">
        <label>Key Callout Statistics ({data.statistics.length})</label>
        <div className="editor-stats-list">
          {data.statistics.map((stat, idx) => (
            <div className="editor-stat-row" key={idx}>
              <input
                type="text"
                className="editor-input"
                placeholder="Value (e.g. 500)"
                value={stat.value}
                onChange={e => handleStatChange(idx, 'value', e.target.value)}
              />
              <input
                type="text"
                className="editor-input"
                placeholder="Label (e.g. Accounts Isolated)"
                value={stat.label}
                onChange={e => handleStatChange(idx, 'label', e.target.value)}
              />
              <button
                type="button"
                className="remove-btn"
                onClick={() => removeStat(idx)}
                title="Remove Stat"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="add-btn" onClick={addStat}>
            + Add Statistic Callout
          </button>
        </div>
      </div>

      {/* Sections & Bullet Points */}
      <div className="editor-field-group">
        <label>Content Sections ({data.sections.length})</label>
        <div className="editor-sections-list">
          {data.sections.map((sec, sIdx) => (
            <div
              key={sIdx}
              style={{
                background: '#090d16',
                border: '1px solid #1e293b',
                padding: '14px',
                borderRadius: '10px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="editor-input"
                  style={{ fontWeight: 'bold', flex: 1 }}
                  value={sec.title}
                  onChange={e => handleSectionTitleChange(sIdx, e.target.value)}
                  placeholder="Section Title (e.g. What Happened?)"
                />
                <button
                  type="button"
                  className="remove-btn"
                  style={{ width: '36px' }}
                  onClick={() => removeSection(sIdx)}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gap: '6px', paddingLeft: '8px' }}>
                {sec.points.map((pt, pIdx) => (
                  <div key={pIdx} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="editor-input"
                      style={{ flex: 1, fontSize: '12px' }}
                      value={pt}
                      onChange={e => handleSectionPointChange(sIdx, pIdx, e.target.value)}
                    />
                    <button
                      type="button"
                      className="remove-btn"
                      style={{ width: '30px', height: '30px', fontSize: '12px' }}
                      onClick={() => removeSectionPoint(sIdx, pIdx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-btn"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  onClick={() => addSectionPoint(sIdx)}
                >
                  + Add Bullet Point
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="add-btn" onClick={addSection}>
            + Add New Section
          </button>
        </div>
      </div>

      {/* Actionable Recommendations */}
      <div className="editor-field-group">
        <label>Recommendations ({data.recommendations.length})</label>
        <div style={{ display: 'grid', gap: '8px' }}>
          {data.recommendations.map((rec, rIdx) => (
            <div key={rIdx} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="editor-input"
                style={{ flex: 1 }}
                value={rec}
                onChange={e => handleRecChange(rIdx, e.target.value)}
              />
              <button
                type="button"
                className="remove-btn"
                style={{ width: '36px' }}
                onClick={() => removeRec(rIdx)}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="add-btn" onClick={addRec}>
            + Add Recommendation
          </button>
        </div>
      </div>

      {/* Footer Text */}
      <div className="editor-field-group">
        <label>Footer Badge Text</label>
        <input
          type="text"
          className="editor-input"
          value={data.footer || ''}
          onChange={e => handleFooterChange(e.target.value)}
        />
      </div>
    </div>
  )
}
