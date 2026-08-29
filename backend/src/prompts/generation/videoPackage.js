module.exports = ({ source, settings, analysis, chunks = [] }) => `Create a complete video package script and production brief based only on the source below.

Audience: ${settings?.audience || 'general audience'}
Tone: ${settings?.tone || 'engaging and informative'}
Language: ${settings?.language || 'English'}
Style: ${settings?.style || 'Corporate'}

Requirements:
- Structure the package with clear sections:
  1. Video Title & Concept Hook
  2. Scene-by-Scene Breakdown (Scene Number, Visual Direction, Narration Voiceover)
  3. On-Screen Graphics & Subtitles
  4. Call to Action & Outro
- Include at least 3-4 distinct visual scenes.
- Ensure all narration facts are 100% grounded in the source text.
- Do not invent facts, data, or technical details not found in the source.

RELEVANT SOURCE CONTEXT:
${chunks.map(c => c.content).join('\n---\n') || source}`;
