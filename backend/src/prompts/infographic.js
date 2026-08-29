module.exports = ({ source, settings, analysis, chunks = [] }) => `Create a structured visual infographic content brief using only the source below.

Audience: ${settings.audience || 'general'}
Tone: ${settings.tone || 'professional'}
Language: ${settings.language || 'English'}
Style: ${settings.style || 'Corporate'}

Requirements:
- Use the headings: Main Headline, Core Storyline, Key Callout Statistics, Section Breakdown, Visual Icon Suggestions.
- Render every heading on its own Markdown heading line.
- For Key Callout Statistics, extract 3-4 key data points or numbers from the source and format each as "**[Stat/Metric]**: Description".
- Include specific design/layout guidance for visual presentation.
- Do not invent facts or metrics.

RELEVANT SOURCE CONTEXT:
${chunks.map(c => c.content).join('\n---\n') || source}`;
