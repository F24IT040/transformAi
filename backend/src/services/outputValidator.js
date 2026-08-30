/**
 * Global Output Validator Service
 * Validates processed LLM outputs for reasoning leakage, prompt leakage, contract compliance,
 * and format-specific structural integrity before quality evaluation or operator presentation.
 */

const { OUTPUT_SPECIFIC_RULES } = require('./evaluationService');

const LEAKAGE_PATTERNS = [
  /<think>/i,
  /<\/think>/i,
  /<thought>/i,
  /<analysis>/i,
  /<reasoning>/i,
  /<plan>/i,
  /Here's a thinking process/i,
  /Deconstruct & Plan/i,
  /Identified Issues to Fix/i,
  /Target Output Type:/i,
  /Actionable Instructions:/i,
  /Communication Objective:/i,
  /Format Requirements:/i,
];

const PLACEHOLDER_PATTERNS = [
  /\[Insert\s+[^\]]+\]/i,
  /\[Your\s+Name\s+Here\]/i,
  /\[Add\s+Title\s+Here\]/i,
  /\[Fill\s+in\s+[^\]]+\]/i,
];

function validateLLMOutput(content, outputType) {
  const errors = [];
  const warnings = [];

  if (!content || typeof content !== 'string' || content.trim().length < 20) {
    errors.push('Output is empty or too short.');
    return {
      valid: false,
      reasoningLeakage: false,
      promptLeakage: false,
      errors,
      warnings,
    };
  }

  // 1. Check for Reasoning Leakage
  let reasoningLeakage = false;
  for (const pattern of LEAKAGE_PATTERNS) {
    if (pattern.test(content)) {
      reasoningLeakage = true;
      errors.push(`Internal reasoning / meta-commentary leakage detected (pattern: ${pattern.toString()}).`);
      break;
    }
  }

  // 2. Check for Placeholder Text
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push(`Placeholder text detected in output (${pattern.toString()}).`);
    }
  }

  // 3. Format-specific contract checks
  if (outputType === 'infographic') {
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (_) {}

    if (!parsed || typeof parsed !== 'object') {
      // Check if markdown has title and key message
      if (!/#|\*\*title\*\*/i.test(content)) {
        errors.push('Infographic contract violation: Missing title or structured infographic fields.');
      }
    } else {
      if (!parsed.title) errors.push('Infographic schema missing required "title" field.');
      if (!parsed.keyMessage && !parsed.subtitle) errors.push('Infographic schema missing required "keyMessage" or "subtitle" field.');
    }
  } else if (outputType === 'presentation') {
    if (!/slide\s*\d+|###\s*Slide/i.test(content)) {
      warnings.push('Presentation output missing explicit Slide headings.');
    }
  } else if (outputType === 'executive_summary') {
    if (!/situation|findings|recommend/i.test(content)) {
      warnings.push('Executive summary missing core section headings (Situation, Findings, Recommendations).');
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    reasoningLeakage,
    promptLeakage: reasoningLeakage,
    errors,
    warnings,
  };
}

module.exports = {
  validateLLMOutput,
  LEAKAGE_PATTERNS,
};
