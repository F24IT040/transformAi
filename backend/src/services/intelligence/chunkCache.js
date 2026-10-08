/**
 * Chunk Cache — SQLite-backed LLM Result Cache
 *
 * Caches chunk extraction results using SHA256(chunk_text + model) as key.
 * Prevents redundant LLM calls when the same report is processed again.
 */

const { db } = require('../../db/database');

const DEFAULT_TTL_HOURS = parseInt(process.env.CHUNK_CACHE_TTL_HOURS || '24', 10);

// Initialize cache table
function initCacheTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_cache (
        content_hash TEXT PRIMARY KEY,
        result_json TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `);
  } catch (err) {
    console.warn(`[ChunkCache] Table creation warning: ${err.message}`);
  }
}

initCacheTable();

/**
 * Get a cached extraction result by content hash.
 *
 * @param {string} hash - SHA256 hash of chunk content
 * @returns {object|null} - Parsed extraction result or null
 */
function get(hash) {
  try {
    const row = db.prepare(
      'SELECT result_json, expires_at FROM chunk_cache WHERE content_hash = ?'
    ).get(hash);

    if (!row) return null;

    // Check TTL
    if (new Date(row.expires_at) < new Date()) {
      // Expired — delete and return null
      db.prepare('DELETE FROM chunk_cache WHERE content_hash = ?').run(hash);
      return null;
    }

    return JSON.parse(row.result_json);
  } catch (err) {
    console.warn(`[ChunkCache] Get error: ${err.message}`);
    return null;
  }
}

/**
 * Store an extraction result in cache.
 *
 * @param {string} hash - SHA256 hash of chunk content
 * @param {object} result - Extraction result to cache
 * @param {string} [model='unknown'] - Model name used
 */
function set(hash, result, model = 'unknown') {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_TTL_HOURS * 60 * 60 * 1000);

    const stmt = db.prepare(`
      INSERT INTO chunk_cache (content_hash, result_json, model, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(content_hash) DO UPDATE SET
        result_json = excluded.result_json,
        model = excluded.model,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `);

    stmt.run(
      hash,
      JSON.stringify(result),
      model,
      now.toISOString(),
      expiresAt.toISOString()
    );
  } catch (err) {
    console.warn(`[ChunkCache] Set error: ${err.message}`);
  }
}

/**
 * Remove all expired cache entries.
 */
function prune() {
  try {
    const info = db.prepare(
      'DELETE FROM chunk_cache WHERE expires_at < ?'
    ).run(new Date().toISOString());
    if (info.changes > 0) {
      console.log(`[ChunkCache] Pruned ${info.changes} expired entries`);
    }
    return info.changes;
  } catch (err) {
    console.warn(`[ChunkCache] Prune error: ${err.message}`);
    return 0;
  }
}

/**
 * Clear entire cache.
 */
function clear() {
  try {
    db.prepare('DELETE FROM chunk_cache').run();
  } catch (err) {
    console.warn(`[ChunkCache] Clear error: ${err.message}`);
  }
}

/**
 * Get cache statistics.
 */
function stats() {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM chunk_cache').get();
    const valid = db.prepare(
      'SELECT COUNT(*) as count FROM chunk_cache WHERE expires_at >= ?'
    ).get(new Date().toISOString());
    return {
      total: total?.count || 0,
      valid: valid?.count || 0,
      expired: (total?.count || 0) - (valid?.count || 0),
    };
  } catch (err) {
    return { total: 0, valid: 0, expired: 0 };
  }
}

module.exports = { get, set, prune, clear, stats };
