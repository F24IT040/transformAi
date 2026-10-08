/**
 * Global Synthesizer — Cross-Chunk Intelligence Synthesis
 *
 * Takes all structured chunk extraction results and sends them
 * to the reasoning model (Gemini) for global synthesis.
 */

const llmProvider = require('../llm/llmProvider');
const synthesisPrompt = require('../../prompts/intelligence/synthesisPrompt');

/**
 * Synthesize all chunk extractions into a coherent intelligence assessment.
 *
 * @param {object} opts
 * @param {Array} opts.chunkResults - Array of structured extraction results
 * @param {number} opts.totalPages - Total pages in the original document
 * @param {object} [opts.settings] - User settings (audience, tone, etc.)
 * @param {string} opts.requestId - Request ID for tracing
 * @returns {Promise<{ summary: string, metadata: object, tokens: object }>}
 */
async function synthesize({ chunkResults, totalPages, settings = {}, requestId }) {
  const validResults = chunkResults.filter(r => !r._failed && r.summary);

  if (validResults.length === 0) {
    console.warn(`[GlobalSynthesizer] No valid chunk results to synthesize`);
    return {
      summary: '# INTELLIGENCE ASSESSMENT\n\nNo valid extraction results available for synthesis.',
      metadata: { entities: [], traceability: [] },
      tokens: { input: 0, output: 0 },
    };
  }

  console.log(`[GlobalSynthesizer] Synthesizing ${validResults.length} chunk results (${totalPages} pages)`);

  const prompt = synthesisPrompt({
    chunkResults: validResults,
    totalPages,
    settings,
  });

  const result = await llmProvider.callReasoningModel({
    prompt,
    maxTokens: 4096,
    temperature: 0.3,
    requestId: `${requestId}_synthesis`,
  });

  // Build traceability metadata
  const traceability = validResults.map(r => ({
    chunk_id: r.chunk_id,
    source_pages: r.source_pages,
    key_findings_count: r.key_findings.length,
    entities_count: r.people.length + r.organizations.length,
  }));

  // Collect all unique entities
  const entities = {
    people: [...new Set(validResults.flatMap(r => r.people || []))],
    organizations: [...new Set(validResults.flatMap(r => r.organizations || []))],
    locations: [...new Set(validResults.flatMap(r => r.locations || []))],
    dates: [...new Set(validResults.flatMap(r => r.dates || []))],
    threats: [...new Set(validResults.flatMap(r => r.threats || []))],
  };

  return {
    summary: result.content,
    metadata: {
      entities,
      traceability,
      model: result.model,
      provider: result.provider,
    },
    tokens: result.tokens,
  };
}

module.exports = { synthesize };
