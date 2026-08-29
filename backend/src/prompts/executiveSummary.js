module.exports = ({ source, settings, analysis }) => `Create an executive summary from the source below.

Audience: ${settings.audience || 'general'}
Tone: ${settings.tone || 'professional'}
Language: ${settings.language || 'English'}
Detail level: ${settings.detailLevel || 'medium'}
Objective: ${settings.objective || 'inform'}
Source analysis: ${analysis.wordCount} words, ${analysis.paragraphCount} paragraphs.

Requirements:
- Lead with the most important conclusion.
- Include key findings, business impact, and actionable recommendations.
- Use a title followed by the headings Key Findings, Impact, and Recommended Actions.
- Use Markdown headings and one bullet per line; leave a blank line between sections.
- Be concise, accurate, and grounded only in the source.
- Do not invent facts.

SOURCE:\n${source}`;
