import React, { Component, useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import Results from './pages/Results'
import './App.css'

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || 'A component rendering error occurred.' }
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <section className="panel" style={{ textAlign: 'center', padding: '48px 24px', margin: '24px 0' }}>
          <h2>Something went wrong in this view</h2>
          <p style={{ color: '#f87171', margin: '12px 0 24px', fontSize: '13px' }}>{this.state.error}</p>
          <button className="primary" onClick={() => window.location.reload()}>
            ↻ Reload Application
          </button>
        </section>
      )
    }
    return this.props.children
  }
}

export type View = 'dashboard' | 'new-project' | 'results'
export type GenerationResults = Record<string, string>

export type SourceReference = { id: string; title: string; excerpt: string }
export type ClaimVerification = { claim: string; status: 'supported' | 'unsupported'; confidence: number; reason: string }
export type VerificationResult = {
  verificationScore: number
  supportedClaimsCount: number
  unsupportedClaimsCount: number
  claims: ClaimVerification[]
  references: SourceReference[]
}

export type EvaluationIssue = {
  type: 'unsupported_claim' | 'missing_information' | 'format' | 'consistency' | 'audience' | string
  severity: 'high' | 'medium' | 'low'
  claim?: string
  field?: string
  reason: string
}

export type UnsupportedClaimItem = {
  claim: string
  reason: string
  severity?: string
}

export type MissingInfoItem = {
  field: string
  reason: string
}

export type EvaluationResult = {
  groundingScore: number
  consistencyScore: number
  completenessScore: number
  formatScore: number
  audienceScore: number
  overallScore: number
  passed: boolean
  issues: EvaluationIssue[]
  unsupportedClaims: UnsupportedClaimItem[]
  missingInformation: MissingInfoItem[]
  iteration?: number
  ruleSet?: string
  references?: SourceReference[]
}

export type IterationStep = {
  iteration: number
  draft: string
  evaluation: EvaluationResult
  decision?: {
    passed: boolean
    status: string
    reason: string
  }
  feedback?: {
    issues: EvaluationIssue[]
    instructions: string
  } | null
  timestamp: string
}

export type Project = {
  id?: string
  source: { fileName: string; fileType: string; file: File | null; extractedText: string; status: 'idle' | 'processing' | 'completed' }
  intelligence: {
    domain: string
    topic: string
    severity: string
    threat: string
    attackVector: string
    target: string
    impact: string
    mitigation: string
    entities: string[]
    facts: string[]
    recommendations: string[]
  }
  configuration: {
    outputs: string[]
    audience: string
    tone: string
    language: string
    detailLevel: string
    objective: string
    style: string
    sourceStrictness: string
  }
  generation: {
    status: string
    currentIteration: number
    maxIterations: number
  }
  evaluation: EvaluationResult
  evaluations?: Record<string, EvaluationResult>
  iterationHistory?: Record<string, IterationStep[]>
  loopStatus?: Record<string, string>
  feedback: {
    issues: EvaluationIssue[]
    instructions: string
  }
  retrieval: { status: string; relevantChunks: number; references: SourceReference[] }
  results: GenerationResults
  verifications?: Record<string, VerificationResult>
  validation: { supportedClaims: number; unsupportedClaims: number; conflicts: number }
  review: { status: 'pending' | 'ready_for_review' | 'needs_human_review' | 'approved' | 'edited' }
  reviewStatuses?: Record<string, 'pending' | 'ready_for_review' | 'needs_human_review' | 'approved' | 'edited' | string>
}

export const defaultEvaluation: EvaluationResult = {
  groundingScore: 0,
  consistencyScore: 0,
  completenessScore: 0,
  formatScore: 0,
  audienceScore: 0,
  overallScore: 0,
  passed: false,
  issues: [],
  unsupportedClaims: [],
  missingInformation: [],
}

export const mockIntelligence: Project['intelligence'] = {
  domain: 'Cybersecurity',
  topic: 'Phishing Campaign',
  severity: 'Medium',
  threat: 'Phishing',
  attackVector: 'Email',
  target: 'Employee Accounts',
  impact: 'Credential Compromise',
  mitigation: 'MFA + Password Reset',
  entities: ['Employee Accounts', 'Internal Systems'],
  facts: ['500 employees targeted', '20 employees clicked malicious link', '3 credentials compromised'],
  recommendations: ['Reset credentials', 'Enable MFA', 'Conduct training'],
}

export const emptyProject: Project = {
  source: { fileName: '', fileType: '', file: null, extractedText: '', status: 'idle' },
  intelligence: mockIntelligence,
  configuration: {
    outputs: [],
    audience: '',
    tone: '',
    language: 'English',
    detailLevel: 'Medium',
    objective: '',
    style: 'Corporate',
    sourceStrictness: 'Strictly Source-Based',
  },
  generation: {
    status: 'idle',
    currentIteration: 0,
    maxIterations: 3,
  },
  evaluation: defaultEvaluation,
  evaluations: {},
  iterationHistory: {},
  loopStatus: {},
  feedback: {
    issues: [],
    instructions: '',
  },
  retrieval: { status: 'Not started', relevantChunks: 0, references: [] },
  results: {},
  verifications: {},
  validation: { supportedClaims: 0, unsupportedClaims: 0, conflicts: 0 },
  review: { status: 'pending' },
}

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [toast, setToast] = useState('')
  const [project, setProject] = useState<Project>(emptyProject)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadProjectFromDb = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/projects/${id}`)
      const data = await res.json()
      if (data.success && data.project) {
        const p = data.project
        const outputsMap: Record<string, string> = {}
        const verificationsMap: Record<string, VerificationResult> = {}
        const evaluationsMap: Record<string, EvaluationResult> = {}
        const iterationHistoryMap: Record<string, IterationStep[]> = {}
        const loopStatusMap: Record<string, string> = {}

        for (const [key, val] of Object.entries(p.outputs || {})) {
          const item = val as any
          outputsMap[key] = item.content
          evaluationsMap[key] = item.evaluation || {
            groundingScore: item.groundingScore || 0.95,
            consistencyScore: item.consistencyScore || 0.92,
            completenessScore: item.completenessScore || 0.90,
            formatScore: item.formatScore || 1.0,
            audienceScore: item.audienceScore || 0.95,
            overallScore: item.overallScore || 0.94,
            passed: (item.overallScore || 1.0) >= 0.9,
            issues: [],
            unsupportedClaims: [],
            missingInformation: [],
          }
          iterationHistoryMap[key] = item.iterationHistory || []
          loopStatusMap[key] = item.status || 'ready_for_review'

          verificationsMap[key] = {
            verificationScore: item.verificationScore || 1.0,
            supportedClaimsCount: item.claims?.length || 0,
            unsupportedClaimsCount: 0,
            claims: item.claims || [],
            references: [],
          }
        }

        const primaryKey = Object.keys(outputsMap)[0] || ''
        const primaryEval = evaluationsMap[primaryKey] || defaultEvaluation

        setProject({
          id: p.id,
          source: {
            fileName: p.name,
            fileType: p.sourceType,
            file: null,
            extractedText: p.extractedText,
            status: 'completed',
          },
          intelligence: p.intelligence || mockIntelligence,
          configuration: {
            outputs: Object.keys(outputsMap),
            audience: 'Leadership',
            tone: 'Professional',
            language: 'English',
            detailLevel: 'Medium',
            objective: 'Inform',
            style: 'Corporate',
            sourceStrictness: 'Strictly Source-Based',
          },
          generation: {
            status: 'completed',
            currentIteration: primaryEval.iteration || 1,
            maxIterations: 3,
          },
          evaluation: primaryEval,
          evaluations: evaluationsMap,
          iterationHistory: iterationHistoryMap,
          loopStatus: loopStatusMap,
          feedback: {
            issues: [],
            instructions: '',
          },
          retrieval: {
            status: 'Retrieval Complete',
            relevantChunks: Object.keys(outputsMap).length * 3,
            references: [],
          },
          results: outputsMap,
          verifications: verificationsMap,
          validation: { supportedClaims: 12, unsupportedClaims: 0, conflicts: 0 },
          review: { status: 'approved' },
        })

        setView('results')
        setToast(`Loaded saved project: ${p.name}`)
      }
    } catch (err) {
      setToast('Unable to load selected project.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="side-content">
          <div className="brand">
            <span className="brand-mark">Z</span>
            <b>TransformAI</b>
          </div>
          <nav>
            <button className={'nav-link ' + (view === 'dashboard' ? 'active' : '')} onClick={() => setView('dashboard')}>
              <i>▦</i>Dashboard
            </button>
            <button className={'nav-link ' + (view === 'new-project' ? 'active' : '')} onClick={() => setView('new-project')}>
              <i>⊕</i>New Project
            </button>
            <button className="nav-link" onClick={() => setView('dashboard')}>
              <i>▱</i>Projects
            </button>
            <button className="nav-link" onClick={() => setView('dashboard')}>
              <i>◴</i>History
            </button>
            <button className="nav-link">
              <i>⚙</i>Settings
            </button>
          </nav>
        </div>
        <div className="profile">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Alex Thompson" />
          <span>
            <b>Alex Thompson</b>
            <small>Pro Plan</small>
          </span>
          <i>⌄</i>
        </div>
      </aside>

      <main>
        <header>
          <label className="search">
            ⌕<input placeholder="Search projects..." />
          </label>
          <div className="header-actions">
            <button className="bell">
              ♧<em />
            </button>
            <span className="divider" />
            <button>
              ⓘ <span>Support</span>
            </button>
          </div>
        </header>

        <div className="page">
          <ErrorBoundary>
            {view === 'dashboard' && (
              <Dashboard
                onNew={() => {
                  setProject(emptyProject)
                  setView('new-project')
                }}
                onLoadProject={loadProjectFromDb}
                onNotice={setToast}
              />
            )}
            {view === 'new-project' && (
              <NewProject
                project={project}
                setProject={setProject}
                onComplete={() => setView('results')}
                onNotice={setToast}
              />
            )}
            {view === 'results' && (
              <Results
                project={project}
                setProject={setProject}
                onNew={() => {
                  setProject(emptyProject)
                  setView('new-project')
                }}
                onNotice={setToast}
              />
            )}
          </ErrorBoundary>
        </div>
      </main>

      <div className={'toast ' + (toast ? 'show' : '')}>
        <span>✓</span>
        <div>
          <b>Success</b>
          <small>{toast}</small>
        </div>
      </div>
    </div>
  )
}
