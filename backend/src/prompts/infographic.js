module.exports = ({ source, settings, analysis, chunks = [], condensedBullets = null }) => {
  const contextBlock = condensedBullets
    ? `PRE-EXTRACTED KEY FACTS (synthesized from source):\n${condensedBullets}`
    : `RELEVANT SOURCE CONTEXT:\n${chunks.map(c => c.content).join('\n---\n') || source}`;

  return `Create a structured visual infographic content specification using ONLY the pre-processed source context below.

Audience: ${settings.audience || 'general'}
Tone: ${settings.tone || 'professional'}
Language: ${settings.language || 'English'}
Style: ${settings.style || 'Corporate'}

CONTENT REFINEMENT RULES — YOU MUST FOLLOW ALL:
1. FILTER NOISE: IGNORE page numbers (e.g. "-- 1 of 10 --"), headers, footers, disclaimers, and all meta-commentary.
2. SENTENCE RECONSTRUCTION: Join broken sentence fragments into complete sentences before extracting data.
3. POLISHED SUMMARIZATION: Rephrase raw source lines into concise, executive-ready bullets. Never copy fragmented lines verbatim.
4. STATISTICS MUST BE REAL FIGURES: Only use actual numbers, dates, percentages, or counts found in the source document. Page numbers, section numbers, or reference numbers are NOT valid statistics.
5. MAINTAIN GROUNDING: Do NOT invent facts, organizations, or data not present in the source.

Return a valid JSON object matching this exact structure:
{
  "title": "A precise title derived from the actual document topic",
  "subtitle": "A subtitle describing the real scope or context of the source document",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "keyMessage": "A single, complete, polished key message synthesized from the source facts",
  "statistics": [
    { "value": "<actual number or metric from source>", "label": "<what that number represents, 3+ words>" }
  ],
  "sections": [
    {
      "title": "What Happened?",
      "points": [
        "Complete, polished sentence describing a key finding from source",
        "Another complete, substantive finding"
      ]
    },
    {
      "title": "Actions Taken",
      "points": [
        "A concrete action taken, fully described",
        "Another action"
      ]
    }
  ],
  "recommendations": [
    "First actionable recommendation in complete sentence, grounded in source",
    "Second actionable recommendation"
  ],
  "footer": "TransformAI Security Intelligence Briefing \u00b7 Official Advisory"
}

${contextBlock}`;
};

