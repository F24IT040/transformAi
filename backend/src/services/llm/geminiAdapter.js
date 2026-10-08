/**
 * Gemini Adapter
 *
 * Wraps Google Gemini API into the common LLM provider interface.
 * Uses the @google/generative-ai SDK.
 *
 * Falls back gracefully if GEMINI_API_KEY is not set.
 */

let GoogleGenerativeAI = null;

/**
 * Lazy-load the Gemini SDK. Returns null if not installed.
 */
function getGeminiSDK() {
  if (GoogleGenerativeAI !== null) return GoogleGenerativeAI;
  try {
    const mod = require('@google/generative-ai');
    GoogleGenerativeAI = mod.GoogleGenerativeAI;
    return GoogleGenerativeAI;
  } catch (_) {
    GoogleGenerativeAI = false; // Mark as unavailable
    return false;
  }
}

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
  model = 'gemini-2.5-flash',
  prompt,
  systemPrompt,
  maxTokens = 2048,
  temperature = 0.3,
  requestId = '',
  jsonMode = false,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length < 10) {
    const err = new Error('GEMINI_API_KEY is not configured. Falling back to Groq.');
    err.noFallback = false;
    throw err;
  }

  const SDK = getGeminiSDK();
  if (!SDK) {
    const err = new Error('@google/generative-ai package is not installed. Run: npm install @google/generative-ai');
    err.noFallback = false;
    throw err;
  }

  const genAI = new SDK(apiKey);

  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens,
  };

  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const modelInstance = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt || 'You are a senior intelligence analyst. Provide precise, factual analysis grounded strictly in the provided source material. Do not hallucinate or fabricate information.',
    generationConfig,
  });

  console.log(`[Gemini] ${requestId} | Calling ${model}...`);

  const result = await modelInstance.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  if (!text || text.trim().length === 0) {
    throw new Error(`Gemini model ${model} returned empty response (${requestId})`);
  }

  // Extract token usage if available
  const usageMetadata = response.usageMetadata || {};
  const tokens = {
    input: usageMetadata.promptTokenCount || 0,
    output: usageMetadata.candidatesTokenCount || 0,
  };

  // Clean thinking tags if present
  let cleanedText = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .trim();

  return {
    content: cleanedText,
    model,
    tokens,
  };
}

module.exports = { generate };
