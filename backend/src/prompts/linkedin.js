module.exports = ({ source, settings }) => `Write a LinkedIn post using only the source below.

Audience: ${settings.audience || 'professional audience'}
Tone: ${settings.tone || 'professional'}
Language: ${settings.language || 'English'}
Objective: ${settings.objective || 'inform'}

Requirements:
- Start with a clear hook.
- Use short, readable paragraphs.
- Explain why the insight matters to the audience.
- End with a thoughtful engagement question and 3-5 relevant hashtags.
- Use short standalone paragraphs with blank lines between them. Put hashtags on their own final line.
- Do not claim information not present in the source.

SOURCE:\n${source}`;
