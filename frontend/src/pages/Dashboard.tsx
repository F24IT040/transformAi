import { useEffect, useState } from 'react'

type ProjectRow = {
  id: string
  name: string
  source_type: string
  created_at: string
  output_count: number
}

type DashboardProps = {
  onNew: () => void
  onLoadProject: (id: string) => void
  onNotice?: (msg: string) => void
}

export default function Dashboard({ onNew, onLoadProject, onNotice }: DashboardProps) {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [showClearAllModal, setShowClearAllModal] = useState(false)

  const fetchProjects = () => {
    setLoading(true)
    fetch('http://localhost:5000/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.projects)) {
          setProjects(data.projects)
        }
      })
      .catch(err => console.error('Failed to fetch project history:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleDeleteSingle = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/projects/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setProjects(prev => prev.filter(p => p.id !== id))
        setSelectedIds(prev => prev.filter(x => x !== id))
        onNotice?.('Project deleted from history.')
      }
    } catch (_) {
      onNotice?.('Failed to delete project.')
    } finally {
      setDeleteTargetId(null)
    }
  }

  const handleDeleteBulk = async () => {
    if (!selectedIds.length) return
    try {
      for (const id of selectedIds) {
        await fetch(`http://localhost:5000/api/projects/${id}`, { method: 'DELETE' })
      }
      setProjects(prev => prev.filter(p => !selectedIds.includes(p.id)))
      onNotice?.(`${selectedIds.length} projects deleted from history.`)
      setSelectedIds([])
    } catch (_) {
      onNotice?.('Failed to delete selected projects.')
    }
  }

  const handleClearAll = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/projects', {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setProjects([])
        setSelectedIds([])
        onNotice?.('All saved transformation history cleared.')
      }
    } catch (_) {
      onNotice?.('Failed to clear history.')
    } finally {
      setShowClearAllModal(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProjects.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredProjects.map(p => p.id))
    }
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.source_type?.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'ALL' || p.source_type?.toUpperCase() === typeFilter
    return matchesSearch && matchesType
  })

  const totalProjects = projects.length
  const totalOutputs = projects.reduce((acc, p) => acc + (p.output_count || 0), 0)

  return (
    <section className="fade dashboard">
      <div className="page-title">
        <div>
          <h1>Transformation History &amp; Workspace</h1>
          <p>Review, search, and manage your AI-transformed communication projects.</p>
        </div>
        <div className="head-btn-group">
          {projects.length > 0 && (
            <button className="secondary danger-secondary" onClick={() => setShowClearAllModal(true)}>
              🗑 Clear All History
            </button>
          )}
          <button className="primary" onClick={onNew}>
            + New Project
          </button>
        </div>
      </div>

      <div className="stats">
        {[
          ['▤', 'Total Projects', loading ? '...' : String(totalProjects), 'Active History'],
          ['✓', 'Generated Outputs', loading ? '...' : String(totalOutputs), 'Quality Verified'],
          ['◷', 'Processing Loop', 'MAX 3', 'Quality Gate'],
        ].map((item, i) => (
          <article className={'stat stat-' + i} key={item[1]}>
            <div>
              <span className="stat-icon">{item[0]}</span>
              <b>{item[3]}</b>
            </div>
            <small>{item[1]}</small>
            <h2>{item[2]}</h2>
          </article>
        ))}
      </div>

      <section className="panel recent">
        <div className="panel-head history-toolbar">
          <div className="history-title-group">
            <h2>Transformation History ({filteredProjects.length})</h2>
            {selectedIds.length > 0 && (
              <button className="danger-btn small-btn" onClick={handleDeleteBulk}>
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>

          <div className="history-filters">
            <label className="table-search">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search history..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>

            <select
              className="type-filter-select"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Source Formats</option>
              <option value="PDF">PDF Documents</option>
              <option value="DOCX">Word (.docx)</option>
              <option value="TXT">Text (.txt)</option>
            </select>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredProjects.length > 0 && selectedIds.length === filteredProjects.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Project Name</th>
                <th>Source Format</th>
                <th>Outputs</th>
                <th>Created Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
                    Loading saved project history from database...
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {projects.length === 0
                      ? 'No saved projects found. Click + New Project to start your first transformation!'
                      : 'No projects match your search filter.'}
                  </td>
                </tr>
              ) : (
                filteredProjects.map(project => {
                  const isSelected = selectedIds.includes(project.id)
                  return (
                    <tr
                      key={project.id}
                      onClick={() => onLoadProject(project.id)}
                      style={{ cursor: 'pointer' }}
                      className={'project-table-row ' + (isSelected ? 'selected-row' : '')}
                    >
                      <td onClick={e => toggleSelect(project.id, e)}>
                        <input type="checkbox" checked={isSelected} readOnly />
                      </td>
                      <td>
                        <span className="file-icon">◈</span>
                        <b>{project.name || 'Untitled Project'}</b>
                      </td>
                      <td>
                        <mark className="format-badge">{project.source_type?.toUpperCase() || 'DOCUMENT'}</mark>
                      </td>
                      <td>{project.output_count || 1} Outputs</td>
                      <td>{new Date(project.created_at).toLocaleDateString()}</td>
                      <td>
                        <mark className="status-mark">Ready</mark>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div className="table-actions-cell">
                          <button
                            className="table-action-btn view-btn"
                            title="Open Project"
                            onClick={() => onLoadProject(project.id)}
                          >
                            Open
                          </button>
                          <button
                            className="table-action-btn delete-btn"
                            title="Delete Project"
                            onClick={() => setDeleteTargetId(project.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Single Project Delete Modal */}
      {deleteTargetId && (
        <div className="modal-backdrop">
          <section className="panel modal">
            <h2>Delete Saved Project?</h2>
            <p>
              Are you sure you want to delete this project from your history? Saved outputs and quality evaluation
              records will be permanently removed.
            </p>
            <div>
              <button className="secondary" onClick={() => setDeleteTargetId(null)}>
                Cancel
              </button>
              <button
                className="primary danger-primary"
                onClick={() => handleDeleteSingle(deleteTargetId)}
              >
                Delete Project
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Clear All History Modal */}
      {showClearAllModal && (
        <div className="modal-backdrop">
          <section className="panel modal">
            <h2>Clear All Transformation History?</h2>
            <p>
              This will permanently delete all ({projects.length}) saved projects, intelligence briefs, and quality
              evaluation records from your database.
            </p>
            <div>
              <button className="secondary" onClick={() => setShowClearAllModal(false)}>
                Cancel
              </button>
              <button className="primary danger-primary" onClick={handleClearAll}>
                Yes, Clear All History
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
