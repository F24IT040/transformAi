/**
 * Critic Prompt — Intelligence Summary Verification
 *
 * Instructs the reasoning model to verify the synthesized summary
 * against the structured chunk extraction results.
 */

module.exports = ({ summary, chunkResults }) => {
  // Build a compact reference of all extracted facts
  const allFindings = chunkResults
    .filter(r => !r._failed)
    .flatMap(r => (r.key_findings || []).map(f => `[${r.chunk_id}] ${f}`));

  const allEvents = chunkResults
    .filter(r => !r._failed)
    .flatMap(r => (r.events || []).map(e => `[${r.chunk_id}] ${e?.date ? e.date + ': ' : ''}${e?.description || e}`));

  const allEvidence = chunkResults
    .filter(r => !r._failed)
    .flatMap(r => (r.evidence || []).map(e => `[${r.chunk_id}] ${e}`));

  const allRecommendations = chunkResults
    .filter(r => !r._failed)
    .flatMap(r => (r.recommendations || []).map(rec => `[${r.chunk_id}] ${rec}`));

  const allEntities = [
    ...new Set(chunkResults.flatMap(r => [...(r.people || []), ...(r.organizations || [])]))
  ];

  return `You are a senior intelligence quality reviewer. Your job is to critically verify a synthesized intelligence summary against the source extraction data.

TASK: Analyze the SUMMARY below against the EXTRACTED FACTS and identify any issues.

You MUST check for ALL of the following:

1. COMPLETENESS — Are any important findings, events, entities, or recommendations from the extracted facts MISSING from the summary?
2. ACCURACY — Does every major claim in the summary have supporting evidence in the extracted facts?
3. CONTRADICTIONS — Are there conflicting dates, names, numbers, or events within the summary?
4. HALLUCINATION — Does the summary contain any information NOT present in the extracted facts?
5. REDUNDANCY — Are the same facts unnecessarily repeated?
6. TRACEABILITY — Can important claims be mapped back to source chunks/pages?

OUTPUT ONLY valid JSON with this exact schema:
{
  "passed": true/false,
  "severity": "none|minor|major|critical",
  "missing_information": ["important fact/finding from chunks that is missing in summary"],
  "contradictions": ["description of contradicting information"],
  "unsupported_claims": ["claim in summary that has no basis in extracted facts"],
  "redundant_information": ["fact that is unnecessarily repeated"],
  "required_corrections": ["specific correction that should be made"],
  "overall_assessment": "1-2 sentence assessment of summary quality"
}

Rules for "passed":
- Set to true if there are NO major or critical issues (minor issues are acceptable)
- Set to false if there are ANY major/critical missing facts, hallucinations, or contradictions

Rules for "severity":
- "none" — summary is accurate, complete, well-structured
- "minor" — small gaps or minor redundancy, no factual errors
- "major" — missing important findings, or contains unsupported claims
- "critical" — contains hallucinated facts or significant contradictions

EXTRACTED FACTS (ground truth):

Key Findings (${allFindings.length}):
${allFindings.length > 0 ? allFindings.join('\n') : 'None extracted'}

Events (${allEvents.length}):
${allEvents.length > 0 ? allEvents.join('\n') : 'None extracted'}

Evidence & Data Points (${allEvidence.length}):
${allEvidence.length > 0 ? allEvidence.join('\n') : 'None extracted'}

Recommendations (${allRecommendations.length}):
${allRecommendations.length > 0 ? allRecommendations.join('\n') : 'None extracted'}

Named Entities: ${allEntities.length > 0 ? allEntities.join(', ') : 'None identified'}

SUMMARY TO VERIFY:

${summary}`;
};
