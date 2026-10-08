/**
 * Groq Adapter
 *
 * Wraps the Groq API into the common LLM provider interface.
 * Handles rate-limit detection, model cascading, and response parsing.
 */

const { processLLMResponse } = require('../responseProcessor');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODEL_CASCADE = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
];

// Rate limit pacing
let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL_MS = 1200;

/**
 * @param {object} opts
 * @param {string} opts.model
 * @param {string} opts.prompt
 * @param {string} [opts.systemPrompt]
 * @param {number} [opts.maxTokens=2048]
 * @param {number} [opts.temperature=0.3]
 * @param {string} [opts.requestId]
 * @param {boolean} [opts.jsonMode=false]
 * @returns {Promise<{ content: string, model: string, tokens: { input: number, output: number } }>}
 */
async function generate({
  model,
  prompt,
  systemPrompt,
  maxTokens = 2048,
  temperature = 0.3,
  requestId = '',
  jsonMode = false,
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim().length < 10) {
    const err = new Error('GROQ_API_KEY is not configured.');
    err.noFallback = false;
    throw err;
  }

  // Proactive rate-limit pacing
  const now = Date.now();
  const elapsed = now - lastCallTimestamp;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_CALL_INTERVAL_MS - elapsed));
  }
  lastCallTimestamp = Date.now();

  const systemContent = systemPrompt ||
    'You are an executive content transformation engine. Output ONLY the requested document, report, or JSON object. Do NOT include internal reasoning, planning, thinking tags (<think>), deconstruction, or meta-commentary under any circumstances.';

  const body = {
    model,
    temperature,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: prompt },
    ],
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let msg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = JSON.parse(responseText);
      if (errJson.error?.message) msg = errJson.error.message;
    } catch (_) {}

    const err = new Error(msg);
    err.status = response.status;
    err.isDecommissioned = /decommissioned|no longer supported|not found|does not exist|do not have access/i.test(msg);

    // Extract rate-limit wait time
    const rateMatch = msg.match(/try again in ([\d.]+)s/i);
    if (rateMatch) {
      err.rateWaitMs = Math.ceil(parseFloat(rateMatch[1]) * 1000) + 600;
    }

    throw err;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Invalid JSON response from Groq (${requestId})`);
  }

  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error(`Model ${model} returned empty completion (${requestId})`);
  }

  // Clean thinking tags
  const processed = processLLMResponse(rawContent, 'generic');

  return {
    content: processed.cleanedContent,
    model,
    tokens: {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
    },
  };
}

module.exports = { generate, MODEL_CASCADE };
