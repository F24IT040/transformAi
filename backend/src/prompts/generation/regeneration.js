module.exports = ({
  source,
  chunks = [],
  previousOutput,
  feedback,
  outputType,
  settings = {},
  specificInstruction = '',
}) => {
  const issuesText =
    feedback?.issues?.length > 0
      ? feedback.issues
          .map(
            (issue, idx) =>
              `${idx + 1}. [${(issue.type || 'General').toUpperCase()} - ${issue.severity || 'Medium'}] ${issue.reason || issue.claim || issue.field || 'Quality issue'}`
          )
          .join('\n')
      : 'Improve grounding and ensure all required sections are present.';

  const instructionsText = feedback?.instructions || 'Fix the identified defects without altering valid facts.';

  return `You are an automated AI content improvement engine.
Your task is to REGENERATE and REFINE the previous output draft by fixing the identified evaluation issues, while strictly preserving all correct and source-grounded information.

DO NOT blindly rewrite everything from scratch if it is already accurate.
Focus on fixing the specific detected issues below.

CONFIGURATION:
- Target Output Type: ${outputType}
- Target Audience: ${settings.audience || 'Leadership'}
- Tone: ${settings.tone || 'Professional'}
- Language: ${settings.language || 'English'}
- Detail Level: ${settings.detailLevel || 'Medium'}
- Communication Objective: ${settings.objective || 'Inform'}

IDENTIFIED EVALUATION ISSUES TO FIX:
${issuesText}

ACTIONABLE IMPROVEMENT INSTRUCTIONS:
${instructionsText}
${specificInstruction ? `\nSPECIAL USER DIRECTIVE: ${specificInstruction}` : ''}

PREVIOUS OUTPUT DRAFT:
${previousOutput}

TRUSTED SOURCE EVIDENCE:
${chunks.length > 0 ? chunks.map(c => c.content).join('\n---\n') : source}

REGENERATION RULES:
1. Fix all unsupported claims by either grounding them directly in the source text or removing them.
2. Add any missing required sections or fields required for ${outputType}.
3. Maintain clear Markdown formatting: headings on their own lines, bullet lists formatted cleanly with '- '.
4. FILTER NOISE: Strip page numbers, headers, footers, disclaimers, and boilerplate meta-commentary from your output.
5. SENTENCE RECONSTRUCTION: Join any broken sentence fragments into complete, coherent sentences.
6. POLISHED SUMMARIZATION: Rephrase raw source lines into executive-ready prose. NEVER copy fragmented source lines word-for-word.
7. Return ONLY the complete improved Markdown content. Do not include meta-commentary, apologies, or explanations.`;
};
