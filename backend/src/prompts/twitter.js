module.exports = ({ source, settings, analysis, chunks = [] }) => `Write a compelling, source-grounded Twitter/X thread based only on the source below.

Audience: ${settings.audience || 'tech and business professionals'}
Tone: ${settings.tone || 'engaging and professional'}
Language: ${settings.language || 'English'}

Requirements:
- Start with Tweet 1/X: A strong hook calling out the primary insight or metric.
- Provide 4-6 numbered tweets breaking down key findings, impacts, and actions.
- Keep each tweet concise (under 280 characters).
- End with a final tweet summarizing the key takeaway and 3-4 relevant hashtags on a separate line.
- Use only facts present in the source. Do not invent details.

RELEVANT SOURCE CONTEXT:
${chunks.map(c => c.content).join('\n---\n') || source}`;
