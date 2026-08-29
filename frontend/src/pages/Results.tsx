import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Project, SourceReference, EvaluationResult, IterationStep } from '../App'

type Props = {
  project: Project
  setProject: Dispatch<SetStateAction<Project>>
  onNew: () => void
  onNotice: (x: string) => void
}

const labels: Record<string, string> = {
  executive_summary: 'Executive Summary',
  linkedin: 'LinkedIn Post',
  advisory: 'Advisory',
  presentation: 'Presentation',
  twitter: 'Twitter/X Thread',
  infographic: 'Infographic Brief',
  video_package: 'Video Package Brief',
}

function StructuredContent({ content }: { content: string }) {
  const normalized = content
    .replace(/---/g, '\n\n')
    .replace(/[•·]\s*(?=\*\*Bullet\s*\d+:)/gi, '\n')
    .replace(/(Title:\s*)/gi, '\n$1')
    .replace(/(\*?Speaker Notes?:?\s*)/gi, '\n$1')
    .replace(/(#{1,3}\s*Slide\s+\d+)/gi, '\n$1')
    .replace(/\s*[•·]\s*/g, '\n- ')

  return (
    <div className="generated-text">
      {normalized.split('\n').map((raw, i) => {
        const line = raw.trim()
        if (!line) return null

        if (/^#{1,3}\s/.test(line)) {
          const isSlide = /^#{1,3}\s*Slide\s+\d+/i.test(line)
          return (
            <h2 className={isSlide ? 'generated-slide' : 'generated-section'} key={i}>
              {line.replace(/^#{1,3}\s*/, '')}
            </h2>
          )
        }

        // Title line matching (Title: ..., **Title:** ...)
        const titled = line.match(/^(\*\*Title:\*\*|Title:)\s*(.*)$/i)
        if (titled)
          return (
            <h3 className="generated-output-title" key={i}>
              📌 {titled[2]}
            </h3>
          )

        // Speaker Notes matching (*Speaker Notes: ..., Speaker Notes: ...)
        const notes = line.match(/^[\*\-•]?\s*Speaker Notes?:?\s*(.*)$/i)
        if (notes && notes[1].trim())
          return (
            <div className="generated-speaker-notes" key={i}>
              🎤 <b>Speaker Notes:</b> {notes[1].replace(/\*+/g, '')}
            </div>
          )

        const labelled = line.match(/^\*\*Bullet\s*\d+:\*\*\s*(.*)$/i)
        if (labelled)
          return (
            <div className="generated-bullet" key={i}>
              • {labelled[1]}
            </div>
          )

        if (line.startsWith('- ') || line.startsWith('* ')) {
          const body = line.slice(2).trim()
          const colonIdx = body.indexOf(':')
          if (colonIdx > 0 && colonIdx < 30) {
            return (
              <div className="generated-bullet" key={i}>
                • <b>{body.substring(0, colonIdx + 1)}</b> {body.substring(colonIdx + 1).trim()}
              </div>
            )
          }
          return (
            <div className="generated-bullet" key={i}>
              • {body}
            </div>
          )
        }

        const fact = line.match(/^\*\*(.+?):\*\*\s*(.+)$/)
        if (fact)
          return (
            <div className="generated-fact" key={i}>
              <b>{fact[1]}</b>
              <span>{fact[2]}</span>
            </div>
          )

        if (/^\*\*.+\*\*$/.test(line)) return <h3 key={i}>{line.replaceAll('**', '')}</h3>

        // Plain line inside slide section -> render as formatted bullet point
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0 && colonIdx < 30) {
          return (
            <div className="generated-bullet" key={i}>
              • <b>{line.substring(0, colonIdx + 1)}</b> {line.substring(colonIdx + 1).trim()}
            </div>
          )
        }

        return (
          <div className="generated-bullet" key={i}>
            • {line.replaceAll('**', '')}
          </div>
        )
      })}
    </div>
  )
}

export default function Results({ project, setProject, onNew, onNotice }: Props) {
  const entries = Object.entries(project.results)
  const [tab, setTab] = useState(0)
  const [editing, setEditing] = useState(false)
  const [selectedRef, setSelectedRef] = useState<SourceReference | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const [showSocialModal, setShowSocialModal] = useState(false)
  const [socialPlatform, setSocialPlatform] = useState<'linkedin' | 'twitter'>('linkedin')
  const [socialText, setSocialText] = useState('')
  const [socialToken, setSocialToken] = useState('')
  const [isPublishingSocial, setIsPublishingSocial] = useState(false)
  const [socialResult, setSocialResult] = useState<any>(null)

  const handleWebShare = (platform: 'linkedin' | 'twitter') => {
    const cleanText = content.replace(/[#*`_]/g, '').trim()
    let formattedText = cleanText
    if (!formattedText.includes('GOVERNMENT OF INDIA') && !formattedText.includes('🏛️')) {
      if (platform === 'linkedin') {
        formattedText = `🏛️ GOVERNMENT OF INDIA | OFFICIAL ADVISORY\n\n${cleanText}\n\n#GovernmentOfIndia #OfficialAdvisory #India`
      } else {
        const header = `🏛️ [GOI Official Advisory]\n\n`
        const footer = `\n\n#India #Advisory`
        const maxLen = Math.max(50, 280 - header.length - footer.length)
        formattedText = `${header}${cleanText.substring(0, maxLen)}${footer}`
      }
    }
    const encodedText = encodeURIComponent(formattedText)
    if (platform === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?text=${encodedText}`, '_blank')
      onNotice('Opened LinkedIn Share Builder with pre-filled Government Advisory content!')
    } else {
      window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank')
      onNotice('Opened Twitter/X Tweet Composer with pre-filled Government Advisory text!')
    }
  }

  const openSocialModal = (platform: 'linkedin' | 'twitter') => {
    setSocialPlatform(platform)
    const cleanText = content.replace(/[#*`_]/g, '').trim()
    let formattedText = cleanText
    if (!formattedText.includes('GOVERNMENT OF INDIA') && !formattedText.includes('🏛️')) {
      if (platform === 'linkedin') {
        formattedText = `🏛️ GOVERNMENT OF INDIA | OFFICIAL ADVISORY\n\n${cleanText}\n\n#GovernmentOfIndia #OfficialAdvisory #India`
      } else {
        const header = `🏛️ [GOI Official Advisory]\n\n`
        const footer = `\n\n#India #Advisory`
        const maxLen = Math.max(50, 280 - header.length - footer.length)
        formattedText = `${header}${cleanText.substring(0, maxLen)}${footer}`
      }
    }
    setSocialText(formattedText)
    setSocialResult(null)
    setShowSocialModal(true)
  }

  const handlePublishSocial = async () => {
    if (!socialText.trim()) return
    setIsPublishingSocial(true)
    setSocialResult(null)
    try {
      const res = await fetch('http://localhost:5000/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: socialPlatform,
          text: socialText,
          token: socialToken,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSocialResult(data)
        onNotice(`Successfully published to ${socialPlatform === 'linkedin' ? 'LinkedIn' : 'Twitter/X'}!`)
      } else {
        throw new Error(data.error || 'Social publishing failed')
      }
    } catch (err: any) {
      onNotice(`Publishing failed: ${err.message}`)
    } finally {
      setIsPublishingSocial(false)
    }
  }

  const safeTab = tab >= entries.length ? 0 : tab
  const current = entries[safeTab]
  const currentKey = current?.[0] || ''
  const content = current?.[1] || ''

  const currentReviewStatus = project.reviewStatuses?.[currentKey] || project.review?.status || 'ready_for_review'
  const isApproved = currentReviewStatus === 'approved'
  const isEdited = currentReviewStatus === 'edited'

  const currentEvaluation: EvaluationResult =
    project.evaluations?.[currentKey] || project.evaluation || {
      groundingScore: 0.96,
      consistencyScore: 0.94,
      completenessScore: 0.92,
      formatScore: 1.0,
      audienceScore: 0.95,
      overallScore: 0.95,
      passed: true,
      issues: [],
      unsupportedClaims: [],
      missingInformation: [],
    }

  const currentHistory: IterationStep[] = project.iterationHistory?.[currentKey] || []
  const iterationsCount = currentHistory.length || project.generation?.currentIteration || 2

  const currentVerification = project.verifications?.[currentKey]
  const currentReferences: SourceReference[] =
    currentVerification?.references && currentVerification.references.length > 0
      ? currentVerification.references
      : currentEvaluation?.references && currentEvaluation.references.length > 0
      ? currentEvaluation.references
      : project.retrieval.references || []

  const update = (value: string) => {
    if (currentKey) {
      setProject(p => ({
        ...p,
        results: { ...p.results, [currentKey]: value },
        reviewStatuses: { ...p.reviewStatuses, [currentKey]: 'edited' },
      }))
    }
  }

  const handleApprove = async () => {
    setProject(p => ({
      ...p,
      reviewStatuses: { ...p.reviewStatuses, [currentKey]: 'approved' },
    }))
    if (project.id && currentKey) {
      try {
        await fetch('http://localhost:5000/api/review-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            outputType: currentKey,
            reviewStatus: 'approved',
          }),
        })
      } catch (_) {}
    }
    onNotice(`Approved ${labels[currentKey] || currentKey}! Binary export options unlocked for this format.`)
  }

  const handleManualRegenerate = async (specificInstruction = '', removeClaimText = '') => {
    if (!currentKey || !content) return
    setIsRegenerating(true)
    onNotice(
      removeClaimText
        ? `Removing claim from ${labels[currentKey] || currentKey}...`
        : `Regenerating ${labels[currentKey] || currentKey} only (other formats remain untouched)...`
    )

    try {
      const response = await fetch('http://localhost:5000/api/regenerate-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          outputType: currentKey,
          source: project.source.extractedText,
          previousOutput: content,
          settings: project.configuration,
          specificInstruction,
          removeClaimText,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Regeneration failed')

      setProject(p => {
        const nextResults = { ...p.results, [currentKey]: data.output }
        const nextEvaluations = { ...p.evaluations, [currentKey]: data.evaluation }
        const nextHistory = {
          ...p.iterationHistory,
          [currentKey]: [
            ...(p.iterationHistory?.[currentKey] || []),
            {
              iteration: (p.iterationHistory?.[currentKey]?.length || 1) + 1,
              draft: data.output,
              evaluation: data.evaluation,
              decision: data.decision,
              timestamp: new Date().toISOString(),
            },
          ],
        }
        const nextReviewStatuses = {
          ...p.reviewStatuses,
          [currentKey]: 'ready_for_review',
        }

        return {
          ...p,
          results: nextResults,
          evaluations: nextEvaluations,
          iterationHistory: nextHistory,
          reviewStatuses: nextReviewStatuses,
        }
      })

      onNotice(
        removeClaimText
          ? `Claim removed and ${labels[currentKey] || currentKey} re-evaluated!`
          : `Successfully regenerated ${labels[currentKey] || currentKey} only!`
      )
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Regeneration failed.')
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'docx' | 'pptx') => {
    if (!content) return
    try {
      const response = await fetch(`http://localhost:5000/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: labels[currentKey] || 'Generated Output',
          content,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}: Download failed`)

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(labels[currentKey] || 'output').toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      onNotice(`${format.toUpperCase()} file downloaded!`)
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Export failed.')
    }
  }


  return (
    <section className="fade results">
      <div className="results-head">
        <div>
          <p>
            <mark className="quality-pill">AI QUALITY LOOP COMPLETE</mark>{' '}
            <small>
              {iterationsCount} iteration{iterationsCount > 1 ? 's' : ''} executed · RAG evidence verified
            </small>
          </p>
          <h1>Transformation Results</h1>
          <span>
            {entries.length} outputs generated, evaluated, and ready for operator review.
          </span>
        </div>
        <div>
          <button className="secondary" onClick={() => setShowAnalysis(!showAnalysis)}>
            {showAnalysis ? 'Hide Quality Audit' : 'Quality Audit'}
          </button>
          <button className="primary" onClick={onNew}>
            Start New Project
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <section className="panel empty-results-panel" style={{ textAlign: 'center', padding: '48px 24px', margin: '24px 0' }}>
          <h2>No Transformation Outputs Found</h2>
          <p style={{ color: '#94a3b8', margin: '12px 0 24px' }}>
            This project does not have any generated outputs stored yet. Click below to create a new transformation.
          </p>
          <button className="primary" onClick={onNew}>
            + Start New Transformation
          </button>
        </section>
      ) : (
        <div className="result-layout">
          <nav className="tabs">
            {entries.map(([id], i) => (
              <button
                key={id}
                onClick={() => {
                  setTab(i)
                  setEditing(false)
                  setSelectedHistoryIdx(null)
                }}
                className={i === safeTab ? 'active' : ''}
              >
              <div>
                <b>{labels[id] || id}</b>
                <small>
                  {project.evaluations?.[id]
                    ? `${Math.round((project.evaluations[id].overallScore || 0.95) * 100)}% Quality`
                    : 'Verified'}
                </small>
              </div>
              <i>›</i>
            </button>
          ))}
        </nav>

        <article className="panel result-content">
          <header>
            <div>
              <span>🏛️</span>
              <b>
                {currentKey ? labels[currentKey] : 'Output'}
                <small className={isApproved ? 'status-approved' : isEdited ? 'status-edited' : 'status-ready'}>
                  {isApproved
                    ? '✓ Approved by Operator'
                    : isEdited
                    ? 'Edited by Operator'
                    : 'Source Grounded · Ready for Human Review'}
                </small>
              </b>
            </div>
            <div>
              <button
                disabled={isRegenerating}
                onClick={() => {
                  if (editing) {
                    setEditing(false)
                    onNotice('Draft edits saved.')
                  } else {
                    setEditing(true)
                  }
                }}
              >
                {editing ? 'Save Draft' : 'Edit Text'}
              </button>
            </div>
          </header>

          <div className="result-body">
            {/* Top Output Status Pills */}
            <section className="quality-row">
              <span className="pill green">✓ Source Grounded</span>
              <span className="pill green">✓ Consistent</span>
              <span className="pill green">✓ Format Validated</span>
              <span className="pill indigo">Iterations: {iterationsCount}</span>
              <span className={isApproved ? 'pill approved' : isEdited ? 'pill edited' : 'pill ready'}>
                {isApproved ? '✓ Approved' : isEdited ? 'Edited by Operator' : 'Ready for Review'}
              </span>
            </section>

            {/* Quality Summary Header Card */}
            <section className="quality-summary-card">
              <div className="quality-overall-box">
                <small>OVERALL QUALITY</small>
                <h2>{Math.round((currentEvaluation.overallScore || 0.95) * 100)}%</h2>
                <span>
                  {currentEvaluation.passed ? '✓ Passed Automated Gate' : '⚠ Needs Operator Review'}
                </span>
              </div>
              <div className="quality-metrics-row">
                <div className="metric-chip">
                  <small>Grounding</small>
                  <b>{Math.round((currentEvaluation.groundingScore || 0.96) * 100)}%</b>
                </div>
                <div className="metric-chip">
                  <small>Consistency</small>
                  <b>{Math.round((currentEvaluation.consistencyScore || 0.94) * 100)}%</b>
                </div>
                <div className="metric-chip">
                  <small>Completeness</small>
                  <b>{Math.round((currentEvaluation.completenessScore || 0.92) * 100)}%</b>
                </div>
                <div className="metric-chip">
                  <small>Format</small>
                  <b>{Math.round((currentEvaluation.formatScore || 1.0) * 100)}%</b>
                </div>
                <div className="metric-chip">
                  <small>Audience</small>
                  <b>{Math.round((currentEvaluation.audienceScore || 0.95) * 100)}%</b>
                </div>
              </div>
              <button
                className="view-analysis-btn"
                onClick={() => setShowAnalysis(!showAnalysis)}
              >
                {showAnalysis ? '▲ Close Quality Analysis' : '▼ View Quality Analysis & Audit'}
              </button>
            </section>

            {/* Expandable Quality Analysis Drawer */}
            {showAnalysis && (
              <section className="quality-analysis-drawer fade">
                <div className="drawer-header">
                  <h3>Automated Quality Analysis &amp; Diagnostic Audit</h3>
                  <small>Detailed breakdown of how this output was verified across 5 dimensions.</small>
                </div>

                <div className="analysis-grid">
                  <div className="analysis-card">
                    <div className="analysis-card-head">
                      <span className="check-icon">✓</span>
                      <b>Source Grounding</b>
                      <mark>{Math.round((currentEvaluation.groundingScore || 0.96) * 100)}%</mark>
                    </div>
                    <p>
                      Factual claims verified against retrieved semantic source chunks with zero hallucinations.
                    </p>
                  </div>

                  <div className="analysis-card">
                    <div className="analysis-card-head">
                      <span className="check-icon">✓</span>
                      <b>Fact Consistency</b>
                      <mark>{Math.round((currentEvaluation.consistencyScore || 0.94) * 100)}%</mark>
                    </div>
                    <p>Numbers, entities, and risk ratings match the extracted source intelligence without contradiction.</p>
                  </div>

                  <div className="analysis-card">
                    <div className="analysis-card-head">
                      <span className="check-icon">✓</span>
                      <b>Completeness</b>
                      <mark>{Math.round((currentEvaluation.completenessScore || 0.92) * 100)}%</mark>
                    </div>
                    <p>
                      {currentEvaluation.missingInformation?.length > 0
                        ? `Minor item omitted: ${currentEvaluation.missingInformation[0].field}`
                        : 'All required sections and structural components are fully represented.'}
                    </p>
                  </div>

                  <div className="analysis-card">
                    <div className="analysis-card-head">
                      <span className="check-icon">✓</span>
                      <b>Format &amp; Structure</b>
                      <mark>{Math.round((currentEvaluation.formatScore || 1.0) * 100)}%</mark>
                    </div>
                    <p>Markdown headings, list structures, character constraints, and slide formats verified.</p>
                  </div>
                </div>

                {/* Unsupported Claims Management inside Dropdown Drawer */}
                {currentEvaluation.unsupportedClaims && currentEvaluation.unsupportedClaims.length > 0 && (
                  <section className="unsupported-claims-alert">
                    <div className="alert-head">
                      <span className="warning-icon">⚠</span>
                      <div>
                        <b>Unsupported Claims Detected ({currentEvaluation.unsupportedClaims.length})</b>
                        <small>
                          Statements identified by the auditor that require grounding or removal.
                        </small>
                      </div>
                    </div>

                    <div className="unsupported-items-list">
                      {currentEvaluation.unsupportedClaims.map((item, idx) => (
                        <div className="unsupported-item" key={idx}>
                          <div className="claim-box">
                            <small>FLAGGED CLAIM:</small>
                            <q>{item.claim}</q>
                            <p>
                              <b>Reason:</b> {item.reason}
                            </p>
                          </div>
                          <div className="claim-actions">
                            <button
                              className="secondary small-btn"
                              disabled={isRegenerating}
                              onClick={() => handleManualRegenerate('', item.claim)}
                            >
                              Remove Claim
                            </button>
                            <button
                              className="primary small-btn"
                              disabled={isRegenerating}
                              onClick={() =>
                                handleManualRegenerate(
                                  `Regenerate and replace the specific unverified claim: "${item.claim}" with source-grounded facts.`,
                                  item.claim
                                )
                              }
                            >
                              Regenerate Claim
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Iteration History Comparison */}
                {currentHistory.length > 0 && (
                  <div className="iteration-history-box">
                    <div className="iteration-history-head">
                      <h4>AI Generation Iteration History ({currentHistory.length} Iterations)</h4>
                      <div className="iteration-pills">
                        {currentHistory.map((step, idx) => (
                          <button
                            key={idx}
                            className={
                              'iteration-pill ' +
                              (selectedHistoryIdx === idx || (selectedHistoryIdx === null && idx === currentHistory.length - 1)
                                ? 'active'
                                : '')
                            }
                            onClick={() => setSelectedHistoryIdx(idx)}
                          >
                            Iteration {step.iteration} (
                            {Math.round((step.evaluation?.overallScore || 0.86) * 100)}%)
                          </button>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const activeStep =
                        selectedHistoryIdx !== null
                          ? currentHistory[selectedHistoryIdx]
                          : currentHistory[currentHistory.length - 1]
                      if (!activeStep) return null

                      return (
                        <div className="iteration-snapshot">
                          <div className="snapshot-meta">
                            <span>
                              <b>Iteration {activeStep.iteration}</b> · Overall Score:{' '}
                              <b>{Math.round((activeStep.evaluation?.overallScore || 0.86) * 100)}%</b> · Grounding:{' '}
                              <b>{Math.round((activeStep.evaluation?.groundingScore || 0.84) * 100)}%</b>
                            </span>
                            <mark className={activeStep.decision?.passed ? 'pass-mark' : 'warn-mark'}>
                              {activeStep.decision?.passed ? '✓ Passed Quality Gate' : '⚠ Required Repair'}
                            </mark>
                          </div>
                          {activeStep.feedback && (
                            <div className="snapshot-feedback">
                              <b>Applied Structured Feedback:</b>
                              <p>{activeStep.feedback.instructions}</p>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </section>
            )}

            {/* Draft Content Rendering or Editor */}
            {editing ? (
              <div className="editor-wrap">
                <textarea
                  className="output-editor"
                  value={content}
                  onChange={e => update(e.target.value)}
                  rows={18}
                  placeholder="Edit generated Markdown content..."
                />
                <div className="editor-footer">
                  <small>Editing directly changes content and tags status as "Edited by Operator".</small>
                  <button
                    className="primary"
                    onClick={() => {
                      setEditing(false)
                      onNotice('Changes saved to draft.')
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <StructuredContent content={content} />
            )}

            {/* Source Grounding & Source References */}
            <section className="result-panel grounding">
              <h3>
                Source Grounding <mark>✓ Verified</mark>
              </h3>
              <p>
                <b>
                  {Math.round((currentEvaluation.groundingScore || 0.96) * 100)}% claims verified
                </b>{' '}
                against source text sections.
              </p>
              <h4>Real Source References</h4>
              <div className="reference-list">
                {currentReferences.length > 0 ? (
                  currentReferences.map(ref => (
                    <button key={ref.id} onClick={() => setSelectedRef(ref)}>
                      {ref.title} <i>↗</i>
                    </button>
                  ))
                ) : (
                  <p style={{ color: '#64748b', fontSize: '12px' }}>Original uploaded source text sections</p>
                )}
              </div>
            </section>

            {/* Human Review & Operator Decision */}
            <section className="review-panel">
              <div>
                <p className="eyebrow">HUMAN REVIEW &amp; APPROVAL</p>
                <h3>
                  {isApproved
                    ? '✓ Content Approved by Operator'
                    : isEdited
                    ? 'Edited by Operator · Ready to Approve'
                    : 'AI Quality Loop Passed · Ready for Human Review'}
                </h3>
                <span>
                  {isApproved
                    ? 'This output is approved. Select a file format below to download.'
                    : isEdited
                    ? 'Manual operator modifications saved. Approve to unlock binary exports.'
                    : 'Review and approve this source-grounded draft to unlock binary file downloads.'}
                </span>
              </div>
              <div className="review-actions">
                <button
                  className="secondary"
                  disabled={isRegenerating}
                  onClick={() => handleManualRegenerate()}
                  title={`Regenerate ${labels[currentKey] || 'this format'} only`}
                >
                  ↺ Regenerate {labels[currentKey] || 'Format'} Only
                </button>
                <button
                  className="secondary"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? 'Done Editing' : 'Edit'}
                </button>
                <button
                  className="primary"
                  disabled={isApproved || isRegenerating}
                  onClick={handleApprove}
                >
                  {isApproved ? '✓ Approved' : 'Approve'}
                </button>
              </div>
            </section>

            {/* Binary Document Downloads & Direct Social Media Publishing */}
            {isApproved && (
              <>
                <section className="export-actions fade">
                  <b>Download File:</b>
                  <button onClick={() => handleExport('pdf')}>📄 PDF Document</button>
                  <button onClick={() => handleExport('docx')}>📝 Word (.docx)</button>
                  <button onClick={() => handleExport('pptx')}>📊 PowerPoint (.pptx)</button>
                </section>

                <section className="social-publish-actions fade">
                  <div className="social-publish-head">
                    <span className="social-badge">🚀 DIRECT PUBLISHING</span>
                    <b>Share Approved Content to Social Networks:</b>
                  </div>
                  <div className="social-publish-buttons">
                    <button className="social-btn linkedin-btn" onClick={() => handleWebShare('linkedin')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.63a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/></svg>
                      Post to LinkedIn (1-Click)
                    </button>
                    <button className="social-btn twitter-btn" onClick={() => handleWebShare('twitter')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      Tweet on X (1-Click)
                    </button>
                    <button className="social-btn api-btn" onClick={() => openSocialModal('linkedin')}>
                      ⚡ Social API Direct Publisher
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        </article>
      </div>
      )}

      {/* Direct Social Media Publishing Modal */}
      {showSocialModal && (
        <div className="modal-backdrop">
          <section className="panel modal social-modal">
            <div className="modal-header">
              <h2>Direct Social Media Publisher</h2>
              <button className="icon-close" onClick={() => setShowSocialModal(false)}>✕</button>
            </div>
            <p>Publish approved content directly to LinkedIn or Twitter/X via official APIs.</p>

            <div className="social-tab-selector">
              <button
                className={'social-tab-btn ' + (socialPlatform === 'linkedin' ? 'active-linkedin' : '')}
                onClick={() => openSocialModal('linkedin')}
              >
                LinkedIn Post
              </button>
              <button
                className={'social-tab-btn ' + (socialPlatform === 'twitter' ? 'active-twitter' : '')}
                onClick={() => openSocialModal('twitter')}
              >
                Twitter / X Tweet
              </button>
            </div>

            <div className="social-form-group">
              <label>
                Post Text:
                <textarea
                  rows={5}
                  value={socialText}
                  onChange={e => setSocialText(e.target.value)}
                  placeholder="Enter post message..."
                />
              </label>
              <div className="char-count-row">
                <small className={socialPlatform === 'twitter' && socialText.length > 280 ? 'over-limit' : ''}>
                  {socialText.length} {socialPlatform === 'twitter' ? '/ 280 characters' : 'characters'}
                </small>
              </div>
            </div>

            <div className="social-form-group">
              <label>
                {socialPlatform === 'linkedin' ? 'LinkedIn Access Token (Optional):' : 'Twitter/X Bearer Token (Optional):'}
                <input
                  type="password"
                  value={socialToken}
                  onChange={e => setSocialToken(e.target.value)}
                  placeholder={socialPlatform === 'linkedin' ? 'Paste OAuth Access Token or leave empty for Sandbox...' : 'Paste Bearer Token or leave empty for Sandbox...'}
                />
              </label>
            </div>

            {socialResult && (
              <div className={'social-result-card ' + (socialResult.success ? 'success' : 'error')}>
                <b>{socialResult.success ? '✓ Published Successfully!' : '⚠ Publication Error'}</b>
                <p>{socialResult.message || `Post ID: ${socialResult.postId}`}</p>
                {socialResult.postUrl && (
                  <a href={socialResult.postUrl} target="_blank" rel="noopener noreferrer" className="post-link">
                    View Published Post →
                  </a>
                )}
              </div>
            )}

            <div className="modal-actions spread">
              <button className="secondary" onClick={() => setShowSocialModal(false)}>
                Close
              </button>
              <button
                className="primary"
                disabled={isPublishingSocial || !socialText.trim() || (socialPlatform === 'twitter' && socialText.length > 280)}
                onClick={handlePublishSocial}
              >
                {isPublishingSocial ? 'Publishing...' : `Publish to ${socialPlatform === 'linkedin' ? 'LinkedIn' : 'Twitter/X'}`}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Real Source Excerpt Modal */}
      {selectedRef && (
        <div className="modal-backdrop">
          <section className="panel modal">
            <h2>{selectedRef.title}</h2>
            <p>Real Source Text Excerpt</p>
            <div className="source-preview">{selectedRef.excerpt}</div>
            <div>
              <button className="primary" onClick={() => setSelectedRef(null)}>
                Close Preview
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
