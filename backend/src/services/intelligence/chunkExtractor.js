/**
 * Chunk Extractor — Parallel Structured Intelligence Extraction
 *
 * Processes all chunks concurrently (with concurrency cap) using the fast model.
 * Each chunk produces a structured JSON extraction result.
 * Failed chunks are retried once, then skipped with a warning.
 */

const llmProvider = require('../llm/llmProvider');
const chunkExtractionPrompt = require('../../prompts/intelligence/chunkExtractionPrompt');

const MAX_CONCURRENCY = 5;

/**
 * Default empty extraction result for failed/skipped chunks.
 */
function emptyExtractionResult(chunk) {
  return {
    chunk_id: chunk.chunk_id,
    summary: '',
    key_findings: [],
    events: [],
    people: [],
    organizations: [],
    locations: [],
    dates: [],
    threats: [],
    risks: [],
    evidence: [],
    uncertainties: [],
    recommendations: [],
    source_pages: [chunk.start_page, chunk.end_page].filter((v, i, a) => a.indexOf(v) === i),
    _failed: true,
  };
}

/**
 * Attempt to parse JSON from LLM response, with fallback recovery.
 */
function parseExtractionResult(rawContent, chunk) {
  // Try direct JSON parse first
  let cleaned = rawContent.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return normalizeExtraction(parsed, chunk);
  } catch (_) {}

  // Fallback: try to extract JSON object from the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizeExtraction(parsed, chunk);
    } catch (_) {}
  }

  console.warn(`[ChunkExtractor] Failed to parse JSON for ${chunk.chunk_id}. Raw: ${cleaned.substring(0, 200)}`);
  return null;
}

/**
 * Normalize and validate the extraction result.
 */
function normalizeExtraction(parsed, chunk) {
  const ensureArray = (val) => Array.isArray(val) ? val : [];
  const ensureString = (val) => typeof val === 'string' ? val : '';

  return {
    chunk_id: chunk.chunk_id,
    summary: ensureString(parsed.summary),
    key_findings: ensureArray(parsed.key_findings).map(String),
    events: ensureArray(parsed.events).map(e => ({
      date: ensureString(e?.date || e?.Date || ''),
      description: ensureString(e?.description || e?.Description || (typeof e === 'string' ? e : '')),
    })),
    people: ensureArray(parsed.people).map(String),
    organizations: ensureArray(parsed.organizations).map(String),
    locations: ensureArray(parsed.locations).map(String),
    dates: ensureArray(parsed.dates).map(String),
    threats: ensureArray(parsed.threats).map(String),
    risks: ensureArray(parsed.risks).map(String),
    evidence: ensureArray(parsed.evidence).map(String),
    uncertainties: ensureArray(parsed.uncertainties).map(String),
    recommendations: ensureArray(parsed.recommendations).map(String),
    source_pages: ensureArray(parsed.source_pages || [chunk.start_page, chunk.end_page])
      .map(Number)
      .filter(n => !isNaN(n))
      .filter((v, i, a) => a.indexOf(v) === i),
    _failed: false,
  };
}

/**
 * Extract structured intelligence from a single chunk.
 */
async function extractSingleChunk(chunk, totalChunks, requestId, retryCount = 0) {
  const prompt = chunkExtractionPrompt({
    chunkText: chunk.text,
    chunkId: chunk.chunk_id,
    startPage: chunk.start_page,
    endPage: chunk.end_page,
    chunkIndex: chunk.index,
    totalChunks,
  });

  try {
    const result = await llmProvider.callFastModel({
      prompt,
      maxTokens: 1500,
      temperature: 0.2,
      requestId: `${requestId}_${chunk.chunk_id}`,
      jsonMode: true,
    });

    const parsed = parseExtractionResult(result.content, chunk);
    if (parsed) {
      parsed._tokens = result.tokens;
      parsed._model = result.model;
      return parsed;
    }

    // Parsing failed — retry once
    if (retryCount < 1) {
      console.warn(`[ChunkExtractor] Parse failed for ${chunk.chunk_id}, retrying...`);
      return extractSingleChunk(chunk, totalChunks, requestId, retryCount + 1);
    }

    return emptyExtractionResult(chunk);
  } catch (err) {
    console.warn(`[ChunkExtractor] ${chunk.chunk_id} failed: ${err.message}`);

    if (retryCount < 1) {
      console.log(`[ChunkExtractor] Retrying ${chunk.chunk_id}...`);
      await new Promise(r => setTimeout(r, 2000));
      return extractSingleChunk(chunk, totalChunks, requestId, retryCount + 1);
    }

    console.error(`[ChunkExtractor] ${chunk.chunk_id} permanently failed. Skipping.`);
    return emptyExtractionResult(chunk);
  }
}

/**
 * Process all chunks with bounded concurrency.
 *
 * @param {Array} chunks - Chunks from intelligentChunker
 * @param {string} requestId - Request ID for tracing
 * @param {Function} [cacheGet] - Optional: (hash) => cachedResult or null
 * @param {Function} [cacheSet] - Optional: (hash, result) => void
 * @returns {Promise<{ results: Array, metrics: object }>}
 */
async function extractAllChunks(chunks, requestId, cacheGet = null, cacheSet = null) {
  const totalChunks = chunks.length;
  const results = new Array(totalChunks);
  let cacheHits = 0;
  let llmCalls = 0;
  let failedChunks = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  console.log(`[ChunkExtractor] Processing ${totalChunks} chunks (concurrency: ${MAX_CONCURRENCY})`);

  // Process in batches of MAX_CONCURRENCY
  for (let batchStart = 0; batchStart < totalChunks; batchStart += MAX_CONCURRENCY) {
    const batchEnd = Math.min(batchStart + MAX_CONCURRENCY, totalChunks);
    const batch = chunks.slice(batchStart, batchEnd);

    const batchPromises = batch.map(async (chunk, batchIdx) => {
      const globalIdx = batchStart + batchIdx;

      // Check cache first
      if (cacheGet) {
        const cached = cacheGet(chunk.content_hash);
        if (cached) {
          console.log(`[ChunkExtractor] Cache HIT for ${chunk.chunk_id}`);
          cacheHits++;
          results[globalIdx] = cached;
          return;
        }
      }

      // LLM call
      llmCalls++;
      const result = await extractSingleChunk(chunk, totalChunks, requestId);
      results[globalIdx] = result;

      if (result._failed) {
        failedChunks++;
      } else {
        // Cache the result
        if (cacheSet) {
          cacheSet(chunk.content_hash, result);
        }
        if (result._tokens) {
          totalInputTokens += result._tokens.input || 0;
          totalOutputTokens += result._tokens.output || 0;
        }
      }
    });

    await Promise.all(batchPromises);
  }

  const metrics = {
    totalChunks,
    cacheHits,
    llmCalls,
    failedChunks,
    successfulChunks: totalChunks - failedChunks,
    totalInputTokens,
    totalOutputTokens,
  };

  console.log(`[ChunkExtractor] Complete: ${metrics.successfulChunks}/${totalChunks} succeeded, ${cacheHits} cache hits, ${failedChunks} failed`);

  return { results, metrics };
}

module.exports = {
  extractAllChunks,
  extractSingleChunk,
  parseExtractionResult,
  emptyExtractionResult,
};
