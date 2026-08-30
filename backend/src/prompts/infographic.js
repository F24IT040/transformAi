module.exports = ({ source, settings, analysis, chunks = [] }) => `Create a structured visual infographic content specification using ONLY the source text below.

Audience: ${settings.audience || 'general'}
Tone: ${settings.tone || 'professional'}
Language: ${settings.language || 'English'}
Style: ${settings.style || 'Corporate'}

Return a valid JSON object matching this exact structure:
{
  "title": "Main Infographic Title",
  "subtitle": "Subtitle describing the scope or context",
  "severity": "HIGH",
  "keyMessage": "A concise core key message extracted from the source",
  "statistics": [
    { "value": "3", "label": "Impact Metric Label" },
    { "value": "20", "label": "Entity Metric Label" }
  ],
  "sections": [
    {
      "title": "What Happened?",
      "points": [
        "First key factual observation from source",
        "Second key factual observation"
      ]
    },
    {
      "title": "Actions Taken",
      "points": [
        "First response action",
        "Second response action"
      ]
    }
  ],
  "recommendations": [
    "First actionable recommendation grounded in source",
    "Second actionable recommendation grounded in source"
  ],
  "footer": "TransformAI Security Intelligence Briefing · Official Advisory"
}

RELEVANT SOURCE CONTEXT:
${chunks.map(c => c.content).join('\n---\n') || source}`;
