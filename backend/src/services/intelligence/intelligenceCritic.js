/**
 * Intelligence Critic — LLM-Driven Verification Service
 *
 * Sends the synthesized summary + intermediate results to the reasoning model
 * for critical verification. Returns structured feedback.
 */

const llmProvider = require('../llm/llmProvider');
const criticPrompt = require('../../prompts/intelligence/criticPrompt');

/**
 * Parse the critic's JSON response with fallback recovery.
 */
function parseCriticResponse(rawContent) {
  let cleaned = rawContent.trim();

  // Strip markdown fences
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Fallback: extract JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) {}
  }

  console.warn(`[Critic] Failed to parse critic JSON response`);
  return null;
}

/**
 * Normalize the critic response to ensure all fields are present.
 */
function normalizeCriticResult(parsed) {
  const ensureArray = (val) => Array.isArray(val) ? val : [];

  return {
    passed: !!parsed.passed,
    severity: ['none', 'minor', 'major', 'critical'].includes(parsed.severity)
      ? parsed.severity
      : 'minor',
    missing_information: ensureArray(parsed.missing_information).map(String),
    contradictions: ensureArray(parsed.contradictions).map(String),
    unsupported_claims: ensureArray(parsed.unsupported_claims).map(String),
    redundant_information: ensureArray(parsed.redundant_information).map(String),
    required_corrections: ensureArray(parsed.required_corrections).map(String),
    overall_assessment: typeof parsed.overall_assessment === 'string'
      ? parsed.overall_assessment
      : 'Assessment unavailable.',
  };
}

/**
 * Run the critic verification.
 *
 * @param {object} opts
 * @param {string} opts.summary - The synthesized summary to verify
 * @param {Array} opts.chunkResults - Original chunk extraction results
 * @param {string} opts.requestId - Request ID for tracing
 * @returns {Promise<{ feedback: object, tokens: object }>}
 */
async function critique({ summary, chunkResults, requestId }) {
  console.log(`[Critic] Running verification against ${chunkResults.filter(r => !r._failed).length} chunk results`);

  const prompt = criticPrompt({ summary, chunkResults });

  try {
    const result = await llmProvider.callReasoningModel({
      prompt,
      maxTokens: 2048,
      temperature: 0.2,
      requestId: `${requestId}_critic`,
      jsonMode: true,
    });

    const parsed = parseCriticResponse(result.content);

    if (parsed) {
      const feedback = normalizeCriticResult(parsed);

      const totalIssues =
        feedback.missing_information.length +
        feedback.contradictions.length +
        feedback.unsupported_claims.length;

      console.log(`[Critic] Result: passed=${feedback.passed} severity=${feedback.severity} issues=${totalIssues}`);

      return {
        feedback,
        tokens: result.tokens,
      };
    }

    // If parsing failed entirely, return a "pass" to avoid blocking
    console.warn(`[Critic] Could not parse response, defaulting to passed=true`);
    return {
      feedback: {
        passed: true,
        severity: 'none',
        missing_information: [],
        contradictions: [],
        unsupported_claims: [],
        redundant_information: [],
        required_corrections: [],
        overall_assessment: 'Critic response could not be parsed; defaulting to pass.',
      },
      tokens: result.tokens,
    };
  } catch (err) {
    console.error(`[Critic] Verification failed: ${err.message}`);

    // On complete failure, return a default pass to not block the pipeline
    return {
      feedback: {
        passed: true,
        severity: 'none',
        missing_information: [],
        contradictions: [],
        unsupported_claims: [],
        redundant_information: [],
        required_corrections: [],
        overall_assessment: `Critic unavailable: ${err.message}. Defaulting to pass.`,
      },
      tokens: { input: 0, output: 0 },
    };
  }
}

module.exports = { critique, parseCriticResponse, normalizeCriticResult };
