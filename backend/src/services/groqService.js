const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Official Groq API active models list (https://console.groq.com/docs/models)
const DEFAULT_MODEL_CASCADE = [
  process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

// Timestamp tracking for rate limit prevention
let lastCallTimestamp = 0;

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
      max_completion_tokens: 1000,
      messages: [
        {
          role: 'system',
          content:
            'You are a source-grounded content transformation assistant. Follow the requested format exactly. Return polished Markdown only: use headings on their own lines, blank lines between sections, and one bullet per line beginning with "- ". Never place multiple headings, labels, or bullets on one line. Do not use HTML.',
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

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`Model ${model} returned an empty completion response.`);
  }

  return content;
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

        if (err.isDecommissioned) {
          console.warn(`[Groq AI Skip] Model ${currentModel} is decommissioned or unavailable. Moving directly to next model...`);
          break; // Immediately try next model in cascade
        }

        if (err.rateWaitMs && err.rateWaitMs > 0) {
          const waitTime = Math.min(err.rateWaitMs, 15000);
          console.log(`[Groq Rate Limit] Auto-pausing for ${waitTime}ms until token window resets...`);
          await new Promise(r => setTimeout(r, waitTime));
        } else if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    }
    console.warn(`[Groq AI Fallback] Switching from '${currentModel}' to next model in cascade...`);
  }

  console.error('[Groq All Models Failed]', lastError?.message);
  throw new Error(`Groq generation failed across models: ${lastError?.message || 'Rate limit or empty response'}`);
}

module.exports = { generateWithGroq };
