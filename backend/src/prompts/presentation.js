module.exports = ({ source, settings }) => `Create a presentation outline from the source below.

Audience: ${settings.audience || 'general'}
Tone: ${settings.tone || 'professional'}
Language: ${settings.language || 'English'}
Detail level: ${settings.detailLevel || 'medium'}
Objective: ${settings.objective || 'inform'}

Requirements:
- Provide 6-8 slides.
- Use this exact Markdown structure, with a blank line between every item:
  ### Slide 1 – Short slide topic
  **Title:** Clear, audience-appropriate slide title
  - Concise bullet point
  - Concise bullet point
  - Concise bullet point
- Put each heading, title, and bullet on its own line. Never put labels or slides on the same line.
- Do not use Bullet 1 labels, HTML, tables, or horizontal rules.
- Cover context, key findings, impact, and next steps.
- Do not invent facts.

SOURCE:\n${source}`;
