/**
 * LLM Provider Abstraction Layer
 *
 * Routes LLM calls to the configured provider (Groq or Gemini)
 * with retry logic, exponential backoff, and request ID tracking.
 *
 * Environment-driven configuration:
 *   FAST_MODEL_PROVIDER    = groq | gemini       (default: groq)
 *   FAST_MODEL             = model name           (default: llama-3.1-8b-instant)
 *   REASONING_MODEL_PROVIDER = groq | gemini     (default: gemini)
 *   REASONING_MODEL        = model name           (default: gemini-2.0-flash)
 */

const crypto = require('crypto');

// Lazy-loaded adapters to avoid circular deps
let _groqAdapter = null;
let _geminiAdapter = null;

function getGroqAdapter() {
  if (!_groqAdapter) _groqAdapter = require('./groqAdapter');
  return _groqAdapter;
}

function getGeminiAdapter() {
  if (!_geminiAdapter) _geminiAdapter = require('./geminiAdapter');
  return _geminiAdapter;
}

/**
 * Generate a unique request ID for tracing.
 */
function generateRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Sleep helper for backoff.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the configured provider and model for a given role.
 *
 * @param {'fast' | 'reasoning'} role
 * @returns {{ provider: string, model: string }}
 */
function getModelConfig(role) {
  if (role === 'fast') {
    return {
      provider: (process.env.FAST_MODEL_PROVIDER || 'groq').toLowerCase(),
      model: process.env.FAST_MODEL || 'openai/gpt-oss-20b',
    };
  }
  // reasoning
  return {
    provider: (process.env.REASONING_MODEL_PROVIDER || 'gemini').toLowerCase(),
    model: process.env.REASONING_MODEL || 'gemini-2.5-flash',
  };
}

/**
 * Call the appropriate LLM adapter.
 *
 * @param {object} opts
 * @param {'fast' | 'reasoning'} opts.role - Which model tier to use
 * @param {string} opts.prompt - The user prompt
 * @param {string} [opts.systemPrompt] - Optional system prompt
 * @param {number} [opts.maxTokens=2048] - Max output tokens
 * @param {number} [opts.temperature=0.3] - Temperature
 * @param {string} [opts.requestId] - Optional request ID for tracing
 * @param {number} [opts.maxRetries=3] - Max retry attempts
 * @param {boolean} [opts.jsonMode=false] - If true, expect JSON output
 * @returns {Promise<{ content: string, model: string, provider: string, requestId: string, tokens: { input: number, output: number } }>}
 */
async function callLLM({
  role = 'fast',
  prompt,
  systemPrompt,
  maxTokens = 2048,
  temperature = 0.3,
  requestId,
  maxRetries = 3,
  jsonMode = false,
}) {
  const reqId = requestId || generateRequestId();
  const { provider, model } = getModelConfig(role);

  console.log(`[LLM] ${reqId} | role=${role} provider=${provider} model=${model}`);

  const baseDelays = [1000, 2000, 4000]; // Exponential backoff
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let adapter;
      if (provider === 'gemini') {
        adapter = getGeminiAdapter();
      } else {
        adapter = getGroqAdapter();
      }

      const result = await adapter.generate({
        model,
        prompt,
        systemPrompt,
        maxTokens,
        temperature,
        requestId: reqId,
        jsonMode,
      });

      console.log(`[LLM] ${reqId} | ✓ success on attempt ${attempt} | tokens in=${result.tokens?.input || '?'} out=${result.tokens?.output || '?'}`);

      return {
        content: result.content,
        model: result.model || model,
        provider,
        requestId: reqId,
        tokens: result.tokens || { input: 0, output: 0 },
      };
    } catch (err) {
      lastError = err;
      console.warn(`[LLM] ${reqId} | attempt ${attempt}/${maxRetries} failed: ${err.message}`);

      // If provider is decommissioned/unavailable, try fallback immediately
      if (err.isDecommissioned || err.noFallback) {
        break;
      }

      if (attempt < maxRetries) {
        const delay = baseDelays[attempt - 1] || 4000;
        const jitter = Math.random() * 500;
        console.log(`[LLM] ${reqId} | retrying in ${delay + jitter | 0}ms...`);
        await sleep(delay + jitter);
      }
    }
  }

  // Attempt fallback: if reasoning model failed, try Groq as fallback
  if (provider === 'gemini' && role === 'reasoning') {
    console.warn(`[LLM] ${reqId} | Gemini failed, falling back to Groq reasoning model`);
    try {
      const groq = getGroqAdapter();
      const fallbackModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      const result = await groq.generate({
        model: fallbackModel,
        prompt,
        systemPrompt,
        maxTokens,
        temperature,
        requestId: reqId,
        jsonMode,
      });
      console.log(`[LLM] ${reqId} | ✓ Groq fallback succeeded`);
      return {
        content: result.content,
        model: fallbackModel,
        provider: 'groq',
        requestId: reqId,
        tokens: result.tokens || { input: 0, output: 0 },
      };
    } catch (fallbackErr) {
      console.error(`[LLM] ${reqId} | Groq fallback also failed: ${fallbackErr.message}`);
    }
  }

  throw new Error(`[LLM] ${reqId} | All attempts exhausted: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Convenience: call the fast model.
 */
async function callFastModel(opts) {
  return callLLM({ ...opts, role: 'fast' });
}

/**
 * Convenience: call the reasoning model.
 */
async function callReasoningModel(opts) {
  return callLLM({ ...opts, role: 'reasoning' });
}

module.exports = {
  callLLM,
  callFastModel,
  callReasoningModel,
  getModelConfig,
  generateRequestId,
};
