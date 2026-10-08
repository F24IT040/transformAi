/**
 * Refinement Prompt — Iterative Summary Improvement
 *
 * Instructs the reasoning model to fix specific issues identified
 * by the critic, using the intermediate chunk results as ground truth.
 */

module.exports = ({ summary, criticFeedback, chunkResults }) => {
  // Build compact ground truth from chunk results
  const groundTruth = chunkResults
    .filter(r => !r._failed)
    .map(r => {
      const parts = [`[${r.chunk_id} | Pages ${(r.source_pages || []).join('-')}]`];
      if (r.summary) parts.push(`Summary: ${r.summary}`);
      if (r.key_findings?.length) parts.push(`Findings: ${r.key_findings.join('; ')}`);
      if (r.events?.length) parts.push(`Events: ${r.events.map(e => `${e?.date ? e.date + ': ' : ''}${e?.description || e}`).join('; ')}`);
      if (r.evidence?.length) parts.push(`Evidence: ${r.evidence.join('; ')}`);
      if (r.recommendations?.length) parts.push(`Recommendations: ${r.recommendations.join('; ')}`);
      return parts.join('\n');
    })
    .join('\n---\n');

  // Build structured issue list from critic feedback
  const issues = [];

  if (criticFeedback.missing_information?.length > 0) {
    issues.push(`MISSING INFORMATION (must be added):\n${criticFeedback.missing_information.map((m, i) => `  ${i + 1}. ${m}`).join('\n')}`);
  }
  if (criticFeedback.contradictions?.length > 0) {
    issues.push(`CONTRADICTIONS (must be resolved):\n${criticFeedback.contradictions.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`);
  }
  if (criticFeedback.unsupported_claims?.length > 0) {
    issues.push(`UNSUPPORTED CLAIMS (must be removed or grounded):\n${criticFeedback.unsupported_claims.map((u, i) => `  ${i + 1}. ${u}`).join('\n')}`);
  }
  if (criticFeedback.redundant_information?.length > 0) {
    issues.push(`REDUNDANT INFORMATION (should be consolidated):\n${criticFeedback.redundant_information.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`);
  }
  if (criticFeedback.required_corrections?.length > 0) {
    issues.push(`REQUIRED CORRECTIONS:\n${criticFeedback.required_corrections.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`);
  }

  const issuesText = issues.length > 0
    ? issues.join('\n\n')
    : 'Minor quality improvements needed.';

  return `You are a senior intelligence editor refining an intelligence assessment.

TASK: Fix the specific issues identified by the quality reviewer while preserving all accurate content.

REFINEMENT RULES:
1. DO NOT rewrite the entire summary from scratch. Only fix the identified issues.
2. ADD any missing information that exists in the GROUND TRUTH DATA below.
3. REMOVE or CORRECT any unsupported claims or contradictions.
4. CONSOLIDATE redundant information without losing important nuance.
5. PRESERVE all accurate facts, source page references, and proper formatting.
6. PRESERVE the exact same document structure and section headings.
7. Do NOT introduce any new information not present in the ground truth data.
8. Do NOT hallucinate or fabricate facts.
9. Maintain formal, objective government-report language.
10. Return ONLY the complete refined Markdown document. No meta-commentary.

CRITIC ASSESSMENT: ${criticFeedback.overall_assessment || 'Issues identified below.'}
SEVERITY: ${criticFeedback.severity || 'minor'}

IDENTIFIED ISSUES:
${issuesText}

CURRENT SUMMARY TO REFINE:
${summary}

GROUND TRUTH DATA (use this to fix missing information and verify claims):
${groundTruth}`;
};
