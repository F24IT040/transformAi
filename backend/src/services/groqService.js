const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Hybrid Model Routing:
 *  MAP (bullet extraction per chunk) — fast, high-RPM model
 *  REDUCE (final synthesis) — high-tier reasoning model
 */
const MAP_MODEL = process.env.FAST_MODEL || 'openai/gpt-oss-20b';
const REDUCE_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const DEFAULT_MODEL_CASCADE = [
  process.env.GROQ_MODEL || REDUCE_MODEL,
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
];

// Timestamp tracking for rate limit prevention
let lastCallTimestamp = 0;

const { processLLMResponse } = require('./responseProcessor');
const mapExtractPrompt = require('../prompts/generation/mapExtract');

async function callSingleModel(model, prompt) {
  // Proactive token pacing: enforce 1.2s delay between consecutive calls to avoid TPM spikes
  const now = Date.now();
  const elapsed = now - lastCallTimestamp;
  if (elapsed < 1200) {
    await new Promise(r => setTimeout(r, 1200 - elapsed));
  }
  lastCallTimestamp = Date.now();

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_completion_tokens: 3000,
      messages: [
        {
          role: 'system',
          content:
            'You are an executive content transformation engine. Output ONLY the requested document, report, or JSON object. Do NOT include internal reasoning, planning, thinking tags (<think>), deconstruction, or meta-commentary under any circumstances.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let msg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = JSON.parse(responseText);
      if (errJson.error?.message) msg = errJson.error.message;
    } catch (_) {}

    let rateWaitMs = 0;
    const rateMatch = msg.match(/try again in ([\d\.]+)s/i);
    if (rateMatch) {
      rateWaitMs = Math.ceil(parseFloat(rateMatch[1]) * 1000) + 600;
    }

    const err = new Error(msg);
    err.rateWaitMs = rateWaitMs;
    err.status = response.status;
    err.isDecommissioned = /decommissioned|no longer supported|not found|does not exist|do not have access/i.test(msg);
    throw err;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error('Invalid JSON response from Groq');
  }

  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error(`Model ${model} returned an empty completion response.`);
  }

  const processed = processLLMResponse(rawContent, 'generic');
  return processed.cleanedContent;
}

/**
 * MAP Step: Extract clean bullet facts from a single chunk using the fast model.
 * Called in parallel for each chunk in the Map-Reduce pipeline.
 *
 * @param {{ content: string, index: number }} chunk - A source chunk object
 * @param {number} total - Total number of chunks (for prompt context)
 * @returns {Promise<string>} - Bullet list string or empty string on failure
 */
async function generateMapStep(chunk, total) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim().length < 10) {
    return ''; // Skip map step in mock mode
  }

  const prompt = mapExtractPrompt({
    chunk: chunk.content,
    index: chunk.index,
    total,
  });

  // Try MAP_MODEL first, fall back to first REDUCE model
  const modelsToTry = [MAP_MODEL, REDUCE_MODEL];

  for (const model of modelsToTry) {
    try {
      console.log(`[Groq MAP] Chunk ${chunk.index}/${total} → ${model}`);
      const result = await callSingleModel(model, prompt);
      if (result && result.trim().length > 10) {
        // Skip chunks that returned the "no facts" placeholder
        if (result.includes('[No substantive facts in this chunk]')) {
          return '';
        }
        return result.trim();
      }
    } catch (err) {
      console.warn(`[Groq MAP] Chunk ${chunk.index} failed on ${model}: ${err.message}`);
    }
  }
  return ''; // Return empty on all failures — REDUCE step still proceeds
}

async function generateWithGroq({ prompt }) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured. Add it to backend/.env.');
  }

  const modelsToTry = [...new Set(DEFAULT_MODEL_CASCADE)];
  let lastError = null;

  for (const currentModel of modelsToTry) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Groq AI] Requesting ${currentModel} (Attempt ${attempt}/3)`);
        const result = await callSingleModel(currentModel, prompt);
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`[Groq AI Warning] ${currentModel} (Attempt ${attempt}/3) failed: ${err.message}`);

        if (err.isDecommissioned || (err.rateWaitMs && err.rateWaitMs > 0) || err.status === 429) {
          console.warn(`[Groq AI Switch] Model ${currentModel} rate limited or unavailable (${err.message}). Instantly switching to next model in cascade...`);
          break; // Instantly switch to next model in cascade to use its separate TPM pool
        }

        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }
    console.warn(`[Groq AI Fallback] Switching from '${currentModel}' to next model in cascade...`);
  }

  console.error('[Groq All Models Failed]', lastError?.message);
  throw new Error(`Groq generation failed across models: ${lastError?.message || 'Rate limit or empty response'}`);
}

module.exports = { generateWithGroq, generateMapStep, MAP_MODEL, REDUCE_MODEL };
