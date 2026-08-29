const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance
db.pragma('journal_mode = WAL');

// Initialize schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      extracted_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_intelligence (
      project_id TEXT PRIMARY KEY,
      domain TEXT,
      topic TEXT,
      severity TEXT,
      threat TEXT,
      attack_vector TEXT,
      target TEXT,
      impact TEXT,
      mitigation TEXT,
      entities TEXT,
      facts TEXT,
      recommendations TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generated_outputs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      output_type TEXT NOT NULL,
      content TEXT NOT NULL,
      verification_score REAL DEFAULT 1.0,
      overall_score REAL DEFAULT 1.0,
      grounding_score REAL DEFAULT 1.0,
      consistency_score REAL DEFAULT 1.0,
      completeness_score REAL DEFAULT 1.0,
      format_score REAL DEFAULT 1.0,
      audience_score REAL DEFAULT 1.0,
      iterations_count INTEGER DEFAULT 1,
      evaluation_json TEXT,
      iteration_history_json TEXT,
      claims_json TEXT,
      status TEXT DEFAULT 'ready_for_review',
      review_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Safe migrations for newly added columns if table already exists
  const columnsToAdd = [
    'ALTER TABLE generated_outputs ADD COLUMN overall_score REAL DEFAULT 1.0',
    'ALTER TABLE generated_outputs ADD COLUMN grounding_score REAL DEFAULT 1.0',
    'ALTER TABLE generated_outputs ADD COLUMN consistency_score REAL DEFAULT 1.0',
    'ALTER TABLE generated_outputs ADD COLUMN completeness_score REAL DEFAULT 1.0',
    'ALTER TABLE generated_outputs ADD COLUMN format_score REAL DEFAULT 1.0',
    'ALTER TABLE generated_outputs ADD COLUMN audience_score REAL DEFAULT 1.0',
    'ALTER TABLE generated_outputs ADD COLUMN iterations_count INTEGER DEFAULT 1',
    'ALTER TABLE generated_outputs ADD COLUMN evaluation_json TEXT',
    'ALTER TABLE generated_outputs ADD COLUMN iteration_history_json TEXT',
    'ALTER TABLE generated_outputs ADD COLUMN review_status TEXT DEFAULT "pending"',
  ];

  for (const sql of columnsToAdd) {
    try {
      db.exec(sql);
    } catch (_) {
      // Column already exists
    }
  }
}

initSchema();

// Repository methods
const projectRepo = {
  saveProject({ id, name, sourceType, extractedText }) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO projects (id, name, source_type, extracted_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        extracted_text = excluded.extracted_text,
        updated_at = excluded.updated_at
    `);
    stmt.run(id, name || 'Untitled Project', sourceType || 'text', extractedText, now, now);
    return id;
  },

  saveIntelligence(projectId, intelligence) {
    const stmt = db.prepare(`
      INSERT INTO source_intelligence (
        project_id, domain, topic, severity, threat, attack_vector, target, impact, mitigation, entities, facts, recommendations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        domain = excluded.domain,
        topic = excluded.topic,
        severity = excluded.severity,
        threat = excluded.threat,
        attack_vector = excluded.attack_vector,
        target = excluded.target,
        impact = excluded.impact,
        mitigation = excluded.mitigation,
        entities = excluded.entities,
        facts = excluded.facts,
        recommendations = excluded.recommendations
    `);
    stmt.run(
      projectId,
      intelligence.domain || '',
      intelligence.topic || '',
      intelligence.severity || '',
      intelligence.threat || '',
      intelligence.attackVector || '',
      intelligence.target || '',
      intelligence.impact || '',
      intelligence.mitigation || '',
      JSON.stringify(intelligence.entities || []),
      JSON.stringify(intelligence.facts || []),
      JSON.stringify(intelligence.recommendations || [])
    );
  },

  saveOutput({
    id,
    projectId,
    outputType,
    content,
    verificationScore = 1.0,
    overallScore = 1.0,
    groundingScore = 1.0,
    consistencyScore = 1.0,
    completenessScore = 1.0,
    formatScore = 1.0,
    audienceScore = 1.0,
    iterationsCount = 1,
    evaluation = null,
    iterationHistory = [],
    claims = [],
    status = 'ready_for_review',
    reviewStatus = 'pending',
  }) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO generated_outputs (
        id, project_id, output_type, content, verification_score, overall_score,
        grounding_score, consistency_score, completeness_score, format_score, audience_score,
        iterations_count, evaluation_json, iteration_history_json, claims_json, status, review_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        verification_score = excluded.verification_score,
        overall_score = excluded.overall_score,
        grounding_score = excluded.grounding_score,
        consistency_score = excluded.consistency_score,
        completeness_score = excluded.completeness_score,
        format_score = excluded.format_score,
        audience_score = excluded.audience_score,
        iterations_count = excluded.iterations_count,
        evaluation_json = excluded.evaluation_json,
        iteration_history_json = excluded.iteration_history_json,
        claims_json = excluded.claims_json,
        status = excluded.status,
        review_status = excluded.review_status,
        created_at = excluded.created_at
    `);
    stmt.run(
      id,
      projectId,
      outputType,
      content,
      verificationScore,
      overallScore,
      groundingScore,
      consistencyScore,
      completenessScore,
      formatScore,
      audienceScore,
      iterationsCount,
      JSON.stringify(evaluation || {}),
      JSON.stringify(iterationHistory || []),
      JSON.stringify(claims || []),
      status,
      reviewStatus,
      now
    );
  },

  updateReviewStatus(id, reviewStatus) {
    const stmt = db.prepare('UPDATE generated_outputs SET review_status = ? WHERE id = ?');
    stmt.run(reviewStatus, id);
  },

  getProject(id) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return null;

    const intel = db.prepare('SELECT * FROM source_intelligence WHERE project_id = ?').get(id);
    const outputs = db.prepare('SELECT * FROM generated_outputs WHERE project_id = ?').all(id);

    return {
      id: project.id,
      name: project.name,
      sourceType: project.source_type,
      extractedText: project.extracted_text,
      createdAt: project.created_at,
      intelligence: intel
        ? {
            domain: intel.domain,
            topic: intel.topic,
            severity: intel.severity,
            threat: intel.threat,
            attackVector: intel.attack_vector,
            target: intel.target,
            impact: intel.impact,
            mitigation: intel.mitigation,
            entities: JSON.parse(intel.entities || '[]'),
            facts: JSON.parse(intel.facts || '[]'),
            recommendations: JSON.parse(intel.recommendations || '[]'),
          }
        : null,
      outputs: outputs.reduce((acc, curr) => {
        acc[curr.output_type] = {
          id: curr.id,
          content: curr.content,
          verificationScore: curr.verification_score,
          overallScore: curr.overall_score || 1.0,
          groundingScore: curr.grounding_score || 1.0,
          consistencyScore: curr.consistency_score || 1.0,
          completenessScore: curr.completeness_score || 1.0,
          formatScore: curr.format_score || 1.0,
          audienceScore: curr.audience_score || 1.0,
          iterationsCount: curr.iterations_count || 1,
          evaluation: JSON.parse(curr.evaluation_json || '{}'),
          iterationHistory: JSON.parse(curr.iteration_history_json || '[]'),
          claims: JSON.parse(curr.claims_json || '[]'),
          status: curr.status || 'ready_for_review',
          reviewStatus: curr.review_status || 'pending',
          createdAt: curr.created_at,
        };
        return acc;
      }, {}),
    };
  },

  listProjects(limit = 20) {
    const rows = db.prepare(`
      SELECT p.id, p.name, p.source_type, p.created_at,
             COUNT(g.id) as output_count
      FROM projects p
      LEFT JOIN generated_outputs g ON p.id = g.project_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(limit);
    return rows;
  },

  deleteProject(id) {
    db.prepare('DELETE FROM generated_outputs WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM source_intelligence WHERE project_id = ?').run(id);
    const info = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return info.changes > 0;
  },

  deleteAllProjects() {
    db.prepare('DELETE FROM generated_outputs').run();
    db.prepare('DELETE FROM source_intelligence').run();
    db.prepare('DELETE FROM projects').run();
    return true;
  },
};

module.exports = { db, projectRepo };

