module.exports = ({ source, settings }) => `Create a structured advisory from the source below.

Audience: ${settings.audience || 'general'}
Tone: ${settings.tone || 'professional'}
Language: ${settings.language || 'English'}
Detail level: ${settings.detailLevel || 'medium'}
Objective: ${settings.objective || 'inform'}

Requirements:
- Use the headings: Situation, Impact, Recommended Actions, Next Steps.
- Render every heading on its own Markdown heading line and every action as a separate bullet line.
- State uncertainty when the source is inconclusive.
- Make actions specific and prioritized.
- Do not invent facts, risks, or instructions beyond the source.

SOURCE:\n${source}`;
