/**
 * MAP Step Prompt — Fast Bullet Extraction Per Chunk
 *
 * Used with the fast model (llama-3.1-8b-instant) in the Map-Reduce pipeline.
 * Each source chunk is passed through this prompt to produce clean,
 * condensed bullet points before the final REDUCE synthesis step.
 */

module.exports = ({ chunk, index, total }) => `You are a precise fact extractor for executive intelligence documents.

TASK: Extract the ${Math.min(3, Math.ceil(chunk.split(/\s+/).length / 40))} most important factual key points from the document chunk below.

STRICT RULES:
1. Output ONLY a bullet list using "- " prefix. Nothing else.
2. IGNORE and SKIP completely:
   - Page numbers (e.g. "-- 1 of 10 --", "Page 2")
   - Document headers and footers
   - Disclaimer statements ("This report does not claim...", "may remain confidential")
   - Boilerplate meta-commentary ("Primary findings supported by...", "approved for operator review")
   - Standalone numbers or separator lines
3. JOIN broken sentence fragments into one complete sentence before writing the bullet.
4. REPHRASE raw source lines into concise, executive-ready language. Do NOT copy fragmented lines verbatim.
5. Include ONLY substantive facts: named entities, dates, actions taken, statistics, findings, threats, recommendations.
6. If the chunk contains NO substantive facts (only metadata/boilerplate), output exactly: - [No substantive facts in this chunk]

CHUNK ${index} of ${total}:
${chunk}`;
