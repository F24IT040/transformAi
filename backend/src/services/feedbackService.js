/**
 * Generates structured, prioritized feedback from an evaluation result.
 * @param {Object} evaluation - Evaluation results containing scores, unsupported claims, missing fields, and issues.
 * @param {string} outputType - The target output type (e.g. executive_summary, advisory, etc.)
 * @returns {Object} Structured feedback object with prioritized issues list and instructions for regeneration.
 */
function createStructuredFeedback(evaluation, outputType) {
  const issues = [];

  // 1. Process unsupported claims (High Severity)
  if (Array.isArray(evaluation.unsupportedClaims)) {
    for (const item of evaluation.unsupportedClaims) {
      issues.push({
        type: 'unsupported_claim',
        severity: 'high',
        claim: typeof item === 'string' ? item : item.claim || item.text,
        reason: item.reason || 'This claim was not found or supported by the source text evidence.',
      });
    }
  }

  // 2. Process missing required information (Medium Severity)
  if (Array.isArray(evaluation.missingInformation)) {
    for (const item of evaluation.missingInformation) {
      issues.push({
        type: 'missing_information',
        severity: 'medium',
        field: typeof item === 'string' ? item : item.field || item.section,
        reason: item.reason || `Required section "${item.field || item}" was omitted or incomplete.`,
      });
    }
  }

  // 3. Process other issues (Format, Consistency, Audience)
  if (Array.isArray(evaluation.issues)) {
    for (const item of evaluation.issues) {
      const isDuplicate = issues.some(
        existing =>
          existing.type === item.type &&
          (existing.claim === item.claim || existing.field === item.field || existing.reason === item.reason)
      );

      if (!isDuplicate) {
        issues.push({
          type: item.type || 'format',
          severity: item.severity || 'low',
          field: item.field || undefined,
          claim: item.claim || undefined,
          reason: item.reason || 'Format or structural improvement recommended.',
        });
      }
    }
  }

  // Sort issues by severity: high -> medium -> low
  const severityWeight = { high: 3, medium: 2, low: 1 };
  issues.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));

  // Build natural language instructions for the regeneration prompt
  const instructionDirectives = [];

  const unsupported = issues.filter(i => i.type === 'unsupported_claim');
  if (unsupported.length > 0) {
    instructionDirectives.push(
      `ELIMINATE OR GROUND CLAIMS: Remove or adjust the following unverified claims: ${unsupported
        .map(u => `"${u.claim}"`)
        .join(', ')}.`
    );
  }

  const missing = issues.filter(i => i.type === 'missing_information');
  if (missing.length > 0) {
    instructionDirectives.push(
      `ADD MISSING REQUIRED SECTIONS: Add the following required sections with factual content from source: ${missing
        .map(m => m.field)
        .join(', ')}.`
    );
  }

  const formatIssues = issues.filter(i => i.type === 'format');
  if (formatIssues.length > 0) {
    instructionDirectives.push(
      `FIX FORMATTING & STRUCTURE: ${formatIssues.map(f => f.reason).join('; ')}.`
    );
  }

  const instructions =
    instructionDirectives.length > 0
      ? instructionDirectives.join('\n')
      : 'Refine grounding, ensure consistent facts, and format cleanly.';

  return {
    issues,
    instructions,
    outputType,
    totalIssuesCount: issues.length,
    highSeverityCount: issues.filter(i => i.severity === 'high').length,
  };
}

module.exports = {
  createStructuredFeedback,
};
