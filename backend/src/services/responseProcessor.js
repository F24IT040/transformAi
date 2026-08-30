/**
 * Global Response Processor
 * Intercepts, cleanses, and structures raw LLM responses before validation or frontend delivery.
 * Strips internal model reasoning (<think>, <analysis>), meta-commentary, and deconstruction blocks.
 */

function cleanStructuralTags(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // 1. Remove XML/HTML reasoning tags
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<plan>[\s\S]*?<\/plan>/gi, '')
    .replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, '')
    // 2. Remove unclosed opening tags at the beginning
    .replace(/^<think>[\s\S]*/gi, match => match.includes('</think>') ? match : '')
    .replace(/^<thought>[\s\S]*/gi, match => match.includes('</thought>') ? match : '')
    .replace(/^<analysis>[\s\S]*/gi, match => match.includes('</analysis>') ? match : '')
    .replace(/^<reasoning>[\s\S]*/gi, match => match.includes('</reasoning>') ? match : '')
    .trim();
}

/**
 * Remove model meta‑planning commentary that appears before the actual report content.
 */
function cleanMetaCommentary(text) {
  if (!text || typeof text !== 'string') return '';

  const lines = text.split('\n');
  const cleanedLines = [];
  let skippingMetaHeader = true;

  const metaPatterns = [
    /^\s*•?\s*Here's\s+a\s+thinking\s+process:?/i,
    /^\s*•?\s*Thinking\s+process:?/i,
    /^\s*•?\s*Let's\s+analyze\s+user\s+input/i,
    /^\s*•?\s*Let's\s+think\s+step\s+by\s+step/i,
    /^\s*•?\s*\d+\.\s*\*\*Analyze\s+User\s+Input:?\*\*/i,
    /^\s*•?\s*\d+\.\s*\*\*Deconstruct\s*\&\s*Plan:?\*\*/i,
    /^\s*•?\s*Here's\s+what\s+I\s+need\s+to\s+do:?/i,
    /^\s*•?\s*Wait,\s+the\s+prompt\s+says/i,
    /^\s*•?\s*Identified\s+Issues\s+to\s+Fix:?/i,
    /^\s*•?\s*Target\s+Output\s+Type:?/i,
    /^\s*•?\s*Target\s+Audience:?/i,
    /^\s*•?\s*Communication\s+Objective:?/i,
    /^\s*•?\s*Actionable\s+Instructions:?/i,
    /^\s*•?\s*Format\s+Requirements:?/i,
    /^\s*•?\s*Source\s+Material:?/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isMeta = metaPatterns.some(p => p.test(line));
    if (skippingMetaHeader && isMeta) continue;
    if (/^#+\s+/.test(line) || /^Slide\s*\d+/i.test(line) || /^1\/\d+/i.test(line) || line.startsWith('{')) {
      skippingMetaHeader = false;
    }
    if (!skippingMetaHeader || !isMeta) {
      cleanedLines.push(line);
    }
  }

  return cleanedLines.join('\n').trim();
}

/**
 * Strip stray markdown formatting such as bold markers and table pipes.
 * Transforms markdown tables into bullet lists.
 */
function cleanFormatting(text) {
  if (!text || typeof text !== 'string') return '';
  // Remove bold (**)
  let cleaned = text.replace(/\*\*/g, '');
  const lines = cleaned.split('\n');
  const result = [];
  for (let line of lines) {
    if (line.includes('|')) {
      // Trim leading/trailing pipes and split into cells
      const cells = line.replace(/^\s*\|/, '').replace(/\|\s*$/,'').split('|').map(c => c.trim());
      // Skip separator rows like ---|---
      if (cells.every(c => /^-+$/.test(c))) continue;
      // Skip header row containing Metric/Observation
      if (cells[0].toLowerCase().includes('metric') && cells[1]?.toLowerCase().includes('observation')) continue;
      if (cells.length >= 2) {
        result.push(`- ${cells[0]}: ${cells[1]}`);
      } else if (cells.length === 1) {
        result.push(`- ${cells[0]}`);
      }
    } else {
      result.push(line);
    }
  }
  return result.join('\n').trim();
}

function processLLMResponse(rawResponse, outputType) {
  const raw = rawResponse || '';
  // 1️⃣ Strip structural tags, then meta‑commentary, then formatting
  const initialCleaned = cleanMetaCommentary(cleanStructuralTags(raw));
  const formatted = cleanFormatting(initialCleaned);

  const hasLeakage = /<think>|<thought>|<analysis>|<reasoning>|Here's a thinking process|Deconstruct \& Plan|Identified Issues to Fix/i.test(raw);

  let cleanedContent = formatted;

  // Handle JSON outputs (infographic or accidental)
  if (outputType === 'infographic') {
    if (cleanedContent.startsWith('{') || cleanedContent.startsWith('```json') || cleanedContent.includes('"title"')) {
      try {
        const jsonStr = cleanedContent.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object') {
          cleanedContent = JSON.stringify(parsed, null, 2);
        }
      } catch (_) {}
    }
  } else if (cleanedContent.startsWith('{') || cleanedContent.startsWith('```json')) {
    try {
      const jsonStr = cleanedContent.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        const title = parsed.title || parsed.topic || 'Executive Report';
        const keyMessage = parsed.keyMessage || parsed.impact || parsed.situation || parsed.summary || '';
        const findings = parsed.findings || parsed.facts || parsed.points || parsed.key_findings || [];
        const recs = parsed.recommendations || [];
        cleanedContent = `# ${title}\n\n${keyMessage ? `### Situation\n${keyMessage}\n\n` : ''}${findings.length ? `### Key Findings\n${findings.map(f => typeof f === 'string' ? `- ${f}` : `- ${f.title || f.claim || ''}: ${f.reason || f.label || ''}`).join('\n')}\n\n` : ''}${recs.length ? `### Recommended Actions\n${recs.map(r => `- ${r}`).join('\n')}` : ''}`;
      }
    } catch (_) {}
  }

  return {
    cleanedContent: cleanedContent.trim(),
    outputType,
    rawResponse: raw,
    hasLeakage,
    metadata: {
      originalLength: raw.length,
      cleanedLength: cleanedContent.length,
      strippedReasoning: hasLeakage,
    },
  };
}

module.exports = {
  cleanStructuralTags,
  cleanMetaCommentary,
  cleanFormatting,
  processLLMResponse,
};
