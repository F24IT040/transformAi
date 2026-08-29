const DEFAULT_THRESHOLDS = {
  overallScore: 0.9,
  groundingScore: 0.9,
  consistencyScore: 0.9,
  formatScore: 0.9,
  completenessScore: 0.85,
  maxHighSeverityIssues: 0,
  maxIterations: 3,
};

/**
 * Decides whether an evaluation output meets the automated quality gate criteria.
 * @param {Object} evaluation - The structured evaluation object
 * @param {number} currentIteration - The current iteration number (1-based)
 * @param {Object} customThresholds - Optional threshold overrides
 * @returns {Object} Decision result with passed status, rationale, and next workflow state
 */
function decideQualityGate(evaluation, currentIteration = 1, customThresholds = {}) {
  const config = { ...DEFAULT_THRESHOLDS, ...customThresholds };

  const highSeverityIssues = (evaluation.issues || []).filter(
    issue => issue.severity === 'high' || issue.type === 'unsupported_claim'
  );

  const groundingPassed = (evaluation.groundingScore ?? 0) >= config.groundingScore;
  const consistencyPassed = (evaluation.consistencyScore ?? 0) >= config.consistencyScore;
  const formatPassed = (evaluation.formatScore ?? 0) >= config.formatScore;
  const completenessPassed = (evaluation.completenessScore ?? 0) >= config.completenessScore;
  const overallPassed = (evaluation.overallScore ?? 0) >= config.overallScore;
  const noHighSeverityPassed = highSeverityIssues.length <= config.maxHighSeverityIssues;

  const passed =
    overallPassed &&
    groundingPassed &&
    consistencyPassed &&
    formatPassed &&
    completenessPassed &&
    noHighSeverityPassed;

  let status = 'ready_for_review';
  let reason = 'Passed all automated quality checks.';

  if (!passed) {
    if (currentIteration >= config.maxIterations) {
      status = 'needs_human_review';
      reason = `Maximum iterations (${config.maxIterations}) reached. Sent to Human Review with warnings.`;
    } else {
      status = 'needs_regeneration';
      const failedCriteria = [];
      if (!groundingPassed) failedCriteria.push(`Grounding ${(evaluation.groundingScore * 100).toFixed(0)}% < ${(config.groundingScore * 100).toFixed(0)}%`);
      if (!consistencyPassed) failedCriteria.push(`Consistency ${(evaluation.consistencyScore * 100).toFixed(0)}% < ${(config.consistencyScore * 100).toFixed(0)}%`);
      if (!formatPassed) failedCriteria.push(`Format ${(evaluation.formatScore * 100).toFixed(0)}% < ${(config.formatScore * 100).toFixed(0)}%`);
      if (!completenessPassed) failedCriteria.push(`Completeness ${(evaluation.completenessScore * 100).toFixed(0)}% < ${(config.completenessScore * 100).toFixed(0)}%`);
      if (!overallPassed) failedCriteria.push(`Overall ${(evaluation.overallScore * 100).toFixed(0)}% < ${(config.overallScore * 100).toFixed(0)}%`);
      if (!noHighSeverityPassed) failedCriteria.push(`${highSeverityIssues.length} high-severity issue(s) detected`);

      reason = `Quality threshold not met: ${failedCriteria.join(', ')}. Triggering automated feedback loop.`;
    }
  }

  return {
    passed,
    status,
    reason,
    thresholds: config,
    currentIteration,
    maxIterations: config.maxIterations,
    highSeverityIssuesCount: highSeverityIssues.length,
  };
}

module.exports = {
  decideQualityGate,
  DEFAULT_THRESHOLDS,
};
