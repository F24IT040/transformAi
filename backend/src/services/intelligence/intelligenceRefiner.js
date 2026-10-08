/**
 * Intelligence Refiner — Iterative Summary Improvement
 *
 * Takes critic feedback and applies targeted corrections to the summary
 * using the reasoning model. Supports up to MAX_REFINEMENT_ITERATIONS passes.
 */

const llmProvider = require('../llm/llmProvider');
const refinementPrompt = require('../../prompts/intelligence/refinementPrompt');

const MAX_REFINEMENT_ITERATIONS = parseInt(process.env.MAX_REFINEMENT_ITERATIONS || '2', 10);

/**
 * Refine the summary based on critic feedback.
 *
 * @param {object} opts
 * @param {string} opts.summary - Current summary to refine
 * @param {object} opts.criticFeedback - Structured feedback from the critic
 * @param {Array} opts.chunkResults - Original chunk extraction results (ground truth)
 * @param {string} opts.requestId - Request ID for tracing
 * @returns {Promise<{ refinedSummary: string, tokens: object }>}
 */
async function refine({ summary, criticFeedback, chunkResults, requestId }) {
  console.log(`[Refiner] Applying corrections (severity: ${criticFeedback.severity})`);

  const prompt = refinementPrompt({
    summary,
    criticFeedback,
    chunkResults,
  });

  const result = await llmProvider.callReasoningModel({
    prompt,
    maxTokens: 4096,
    temperature: 0.25,
    requestId: `${requestId}_refine`,
  });

  if (!result.content || result.content.trim().length < 100) {
    console.warn(`[Refiner] Refinement produced short/empty result. Keeping original.`);
    return {
      refinedSummary: summary,
      tokens: result.tokens,
    };
  }

  console.log(`[Refiner] Refinement complete. Output length: ${result.content.length} chars`);

  return {
    refinedSummary: result.content,
    tokens: result.tokens,
  };
}

/**
 * Determine whether refinement is needed based on critic feedback.
 */
function needsRefinement(criticFeedback) {
  if (!criticFeedback) return false;
  if (criticFeedback.passed) return false;
  if (criticFeedback.severity === 'none' || criticFeedback.severity === 'minor') return false;

  // Check if there are substantive issues
  const totalIssues =
    (criticFeedback.missing_information?.length || 0) +
    (criticFeedback.contradictions?.length || 0) +
    (criticFeedback.unsupported_claims?.length || 0) +
    (criticFeedback.required_corrections?.length || 0);

  return totalIssues > 0;
}

module.exports = {
  refine,
  needsRefinement,
  MAX_REFINEMENT_ITERATIONS,
};
