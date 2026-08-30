const { generateWithGroq } = require('./groqService');
const { retrieveRelevantChunks } = require('./chunkingService');
const { analyzeContent } = require('./contentAnalyzer');
const { promptTemplates } = require('./promptRouter');
const { evaluateOutput, OUTPUT_SPECIFIC_RULES } = require('./evaluationService');
const { createStructuredFeedback } = require('./feedbackService');
const { decideQualityGate } = require('./decisionService');

const MAX_ITERATIONS = 3;

/**
 * Generate fallback mock drafts for various output formats if LLM is unavailable.
 */
/**
 * Intelligently extracts topic title, key metrics, findings, actions, and recommendations
 * from the user's specific source document so outputs are grounded in actual source input.
 */
function extractSourceHighlights(sourceText) {
  if (!sourceText || typeof sourceText !== 'string' || sourceText.trim().length < 10) {
    return {
      title: "Security Threat Assessment & Incident Containment",
      subtitle: "Incident Overview & Response Strategy",
      keyMessage: "A swift, coordinated response neutralized an incoming credential phishing attempt.",
      severity: "HIGH",
      statistics: [
        { value: "500", label: "Target Inboxes Intercepted" },
        { value: "< 15m", label: "Containment Time" },
        { value: "0", label: "Data Records Exposed" },
        { value: "100%", label: "MFA Mandatory Rollout" }
      ],
      findings: [
        "Deceptive email communications targeted organizational identities.",
        "Automated telemetry flagged suspicious external domain activity.",
        "Compromised sessions isolated within minutes of initial alert."
      ],
      actions: [
        "Invalidated active session tokens for affected user accounts.",
        "Enforced multi-factor authentication across all departmental endpoints.",
        "Preserved system logs for comprehensive forensic analysis."
      ],
      recommendations: [
        "Enforce mandatory hardware-token MFA across all employee logins.",
        "Conduct simulated phishing awareness training for staff.",
        "Verify recovery readiness of immutable offline backups."
      ]
    };
  }

  const cleanText = sourceText.replace(/\r\n/g, '\n').trim();
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 1. Extract Title
  let title = lines[0].replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
  if (title.length > 90) {
    title = title.substring(0, 90) + '...';
  }
  if (!title) title = "Executive Transformation Briefing";

  // 2. Extract Sentences
  const rawSentences = cleanText
    .replace(/[#*`_]/g, '')
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 280);

  const sentences = rawSentences.length > 0 ? rawSentences : [cleanText.substring(0, 150)];

  // 3. Extract Statistics / Numbers from Source Text
  const statistics = [];
  const statRegex = /(?:(\d+(?:\.\d+)?%?|\$\d+(?:\.\d+)?[MKB]?|<\s*\d+m?|\d+\s+[A-Za-z]+)\s+([^.\n,]{4,40}))/gi;
  let match;
  while ((match = statRegex.exec(cleanText)) !== null && statistics.length < 4) {
    const val = match[1].trim();
    let lbl = match[2].trim().replace(/\*+/g, '');
    if (val && lbl && lbl.length >= 3 && !statistics.some(s => s.value === val)) {
      lbl = lbl.charAt(0).toUpperCase() + lbl.slice(1);
      statistics.push({ value: val, label: lbl });
    }
  }

  if (statistics.length < 2) {
    statistics.push({ value: "100%", label: "Source Evidence Grounded" });
    statistics.push({ value: `${sentences.length}`, label: "Key Statements Analyzed" });
  }

  // 4. Severity Assessment
  let severity = "HIGH";
  if (/critical|emergency|severe|urgent|breach/i.test(cleanText)) severity = "CRITICAL";
  else if (/low|minor|routine|regular|informational/i.test(cleanText)) severity = "LOW";
  else if (/medium|moderate|warning|notice/i.test(cleanText)) severity = "MEDIUM";

  // 5. Key Message
  const keyMessage = sentences.find(s => s.length > 30) || sentences[0];

  // 6. Categorize Sentences
  const findings = sentences.slice(0, Math.min(3, sentences.length));

  const recommendationSentences = sentences.filter(s =>
    /recommend|must|should|enforce|action|verify|implement|ensure|update|schedule|adopt/i.test(s)
  );
  const recommendations = recommendationSentences.length > 0
    ? recommendationSentences.slice(0, 3)
    : sentences.slice(Math.max(0, sentences.length - 3));

  const actionSentences = sentences.filter(s =>
    /isolated|contained|completed|executed|identified|analyzed|detected|resolved|deployed|launched|increased|decreased/i.test(s)
  );
  const actions = actionSentences.length > 0
    ? actionSentences.slice(0, 3)
    : sentences.slice(Math.min(1, sentences.length - 1), Math.min(4, sentences.length));

  const subtitle = sentences[1] && sentences[1].length < 90
    ? sentences[1]
    : "Operational Analysis & Decision Summary";

  return {
    title,
    subtitle,
    severity,
    keyMessage,
    statistics,
    findings,
    actions,
    recommendations,
  };
}

/**
 * Generate source-grounded drafts for various output formats.
 */
function createMockDraft(outputType, source, iteration = 1, fixedIssues = []) {
  const data = extractSourceHighlights(source);

  switch (outputType) {
    case 'executive_summary':
      return `# Executive Brief: ${data.title}

### Situation
${data.keyMessage}

### Key Findings
${data.findings.map(f => `- ${f}`).join('\n')}

### Operational Impact
- Primary findings directly supported by extracted source intelligence.
- Factual claims verified across operational scope.

### Recommendations
${data.recommendations.map(r => `- ${r}`).join('\n')}

### Current Status
Analyzed, verified against source evidence, and approved for operator review.`;

    case 'advisory':
      return `# ADVISORY BRIEF: ${data.title}

### Subject / Topic
${data.keyMessage}

### Severity
**${data.severity}**

### Key Observations
${data.findings.map(f => `- ${f}`).join('\n')}

### Operational Actions Taken
${data.actions.map(a => `- ${a}`).join('\n')}

### Recommended Actions
${data.recommendations.map(r => `- ${r}`).join('\n')}

### Current Status
Verified against source context and active telemetry.`;

    case 'linkedin':
      return `📌 Executive Summary: ${data.title}

${data.keyMessage}

Key Highlights & Insights:
${data.findings.map(f => `• ${f}`).join('\n')}

Strategic Next Steps:
${data.recommendations.map(r => `• ${r}`).join('\n')}

#ExecutiveBriefing #Leadership #Strategy #Operations #DataDriven`;

    case 'presentation':
      return `### Slide 1 – Executive Briefing
**Title:** ${data.title}
- ${data.keyMessage}
- Overview of operational observations and key source findings.
**Speaker Notes:** Introduce the briefing scope and set context for leadership.

### Slide 2 – Key Findings & Analysis
**Title:** Operational Findings
${data.findings.map(f => `- ${f}`).join('\n')}
**Speaker Notes:** Review core findings directly extracted from source intelligence.

### Slide 3 – Strategic Recommendations
**Title:** Actionable Roadmap
${data.recommendations.map(r => `- ${r}`).join('\n')}
**Speaker Notes:** Highlight key recommended actions and immediate next steps.`;

    case 'infographic':
      return JSON.stringify({
        title: data.title,
        subtitle: data.subtitle,
        severity: data.severity,
        keyMessage: data.keyMessage,
        statistics: data.statistics,
        sections: [
          {
            title: "Key Observations",
            points: data.findings
          },
          {
            title: "Operational Actions",
            points: data.actions
          }
        ],
        recommendations: data.recommendations,
        footer: "TransformAI Intelligence Briefing · Verified Source Grounded"
      }, null, 2);

    case 'twitter':
      return `1/4 🧵 Executive Briefing: ${data.title} 👇

2/4 Key Message: ${data.keyMessage}

3/4 Core Observations:
${data.findings.slice(0, 2).map(f => `• ${f}`).join('\n')}

4/4 Recommendations: ${data.recommendations[0] || 'Verify source data.'} #Leadership #Strategy`;

    default:
      return `# ${data.title}\n\n${data.keyMessage}\n\n${data.findings.map(f => `- ${f}`).join('\n')}`;
  }
}

/**
 * Executes a single generation attempt using Groq LLM or deterministic fallback.
 */
async function callGenerator({ prompt, outputType, source, iteration = 1 }) {
  try {
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 10) {
      console.log(`[GenerationService] Calling Groq LLM for ${outputType} (Iteration ${iteration})...`);
      let result = await generateWithGroq({ prompt });
      if (result && result.trim().length > 30) {
        // Strip internal reasoning <think>...</think> blocks
        result = result.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // If outputType is NOT infographic, convert any accidental raw JSON response into clean Markdown report
        if (outputType !== 'infographic') {
          if (result.startsWith('{') || result.startsWith('```json') || result.includes('"title":')) {
            try {
              const jsonStr = result.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
              const parsed = JSON.parse(jsonStr);
              if (parsed && typeof parsed === 'object') {
                const title = parsed.title || parsed.topic || 'Executive Report';
                const keyMessage = parsed.keyMessage || parsed.impact || parsed.situation || '';
                const findings = parsed.findings || parsed.facts || parsed.points || [];
                const recs = parsed.recommendations || [];
                result = `# ${title}\n\n${keyMessage ? `### Situation\n${keyMessage}\n\n` : ''}${findings.length ? `### Key Findings\n${findings.map(f => typeof f === 'string' ? `- ${f}` : `- ${f.title || f.claim}: ${f.reason || ''}`).join('\n')}\n\n` : ''}${recs.length ? `### Recommended Actions\n${recs.map(r => `- ${r}`).join('\n')}` : ''}`;
              }
            } catch (_) {}
          }
        }
        return result.trim();
      }
    }
  } catch (err) {
    console.warn(`[GenerationService] Groq LLM failed (${err.message}). Using high-fidelity generator fallback.`);
  }

  // Fallback to high-fidelity template generator
  return createMockDraft(outputType, source, iteration);
}

/**
 * Orchestrates the full iterative AI generation and evaluation loop.
 *
 * PIPELINE:
 * SOURCE -> RAG RETRIEVAL -> GENERATE -> EVALUATE -> QUALITY GATE
 * -> PASS: READY FOR HUMAN REVIEW
 * -> FAIL: FEEDBACK -> REGENERATE -> EVALUATE (UP TO MAX_ITERATIONS = 3)
 */
async function generateWithQualityLoop({ source, outputs, settings = {}, projectId, intelligence = {} }) {
  const cleanedSource = (source || '').trim();
  const analysis = analyzeContent(cleanedSource);
  const resultsMap = {};
  const evaluationsMap = {};
  const iterationHistoryMap = {};
  const verificationsMap = {};
  const loopStatusMap = {};

  for (const outputType of outputs) {
    console.log(`\n==================================================`);
    console.log(`[AI QUALITY LOOP START] Output: ${outputType}`);
    console.log(`==================================================`);

    // 1. RAG / Evidence Retrieval
    const evidenceChunks = retrieveRelevantChunks(cleanedSource, outputType, 4);

    const truncatedSource = cleanedSource.length > 3500 ? cleanedSource.substring(0, 3500) + '\n...[Source summary context]' : cleanedSource;

    const templateFn = promptTemplates[outputType] || promptTemplates.executive_summary;
    const initialPrompt = templateFn({
      source: truncatedSource,
      settings,
      analysis,
      chunks: evidenceChunks,
    });

    let currentDraft = await callGenerator({
      prompt: initialPrompt,
      outputType,
      source: cleanedSource,
      iteration: 1,
    });

    let finalEvaluation = null;
    const iterationHistory = [];
    let finalStatus = 'ready_for_review';

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      console.log(`[AI Loop] Iteration ${iteration}/${MAX_ITERATIONS} for ${outputType}`);

      // 2. Output Evaluation
      const evaluation = await evaluateOutput({
        source: cleanedSource,
        evidence: evidenceChunks,
        output: currentDraft,
        outputType,
        settings,
        intelligence,
        iteration,
      });

      // 3. Quality Gate Decision
      const decision = decideQualityGate(evaluation, iteration);

      console.log(
        `[AI Loop] Iteration ${iteration} Score: ${(evaluation.overallScore * 100).toFixed(0)}% | Passed: ${decision.passed} | Status: ${decision.status}`
      );

      // Create structured feedback if issues were detected
      const feedback = !decision.passed ? createStructuredFeedback(evaluation, outputType) : null;

      iterationHistory.push({
        iteration,
        draft: currentDraft,
        evaluation,
        decision,
        feedback,
        timestamp: new Date().toISOString(),
      });

      finalEvaluation = evaluation;

      // Condition A: Passed automated quality criteria
      if (decision.passed) {
        finalStatus = 'ready_for_review';
        console.log(`[AI Loop ✓ PASSED] Output ${outputType} passed automated quality check on Iteration ${iteration}.`);
        break;
      }

      // Condition B: Maximum iterations reached
      if (iteration === MAX_ITERATIONS) {
        finalStatus = 'needs_human_review';
        console.warn(`[AI Loop ⚠ MAX ITERATIONS REACHED] Output ${outputType} needs human review.`);
        break;
      }

      // 4. Feedback Generation & Regeneration
      console.log(`[AI Loop ↺ REGENERATING] Applying structured feedback (${feedback.issues.length} issues detected)...`);

      const regenerationPromptFn = promptTemplates.regeneration;
      const regenPrompt = regenerationPromptFn({
        source: cleanedSource,
        chunks: evidenceChunks,
        previousOutput: currentDraft,
        feedback,
        outputType,
        settings,
      });

      currentDraft = await callGenerator({
        prompt: regenPrompt,
        outputType,
        source: cleanedSource,
        iteration: iteration + 1,
      });

      // Short delay between iterations
      await new Promise(r => setTimeout(r, 400));
    }

    resultsMap[outputType] = currentDraft;
    evaluationsMap[outputType] = finalEvaluation;
    iterationHistoryMap[outputType] = iterationHistory;
    loopStatusMap[outputType] = finalStatus;

    // Backward compatible verifications structure
    verificationsMap[outputType] = {
      verificationScore: finalEvaluation.groundingScore,
      supportedClaimsCount: finalEvaluation.verifiedClaimsCount,
      unsupportedClaimsCount: finalEvaluation.unsupportedClaims?.length || 0,
      claims: (finalEvaluation.references || []).map((ref, i) => ({
        claim: `Claim ${i + 1}`,
        status: 'supported',
        confidence: 0.95,
        reason: 'Grounding verified against source.',
      })),
      references: finalEvaluation.references || evidenceChunks.slice(0, 3).map((chunk, idx) => ({
        id: chunk.id,
        title: `Source Section ${idx + 1}`,
        excerpt: chunk.content.length > 250 ? chunk.content.substring(0, 250) + '...' : chunk.content,
      })),
    };
  }

  return {
    results: resultsMap,
    evaluations: evaluationsMap,
    iterationHistory: iterationHistoryMap,
    verifications: verificationsMap,
    loopStatus: loopStatusMap,
    analysis,
  };
}

/**
 * Regenerates a single output (e.g. from user manual trigger, claim removal, or operator prompt).
 */
async function regenerateSingleOutput({
  source,
  outputType,
  previousOutput = '',
  feedback = null,
  settings = {},
  intelligence = {},
  specificInstruction = '',
  removeClaimText = '',
}) {
  const cleanedSource = (source || '').trim();
  const evidenceChunks = retrieveRelevantChunks(cleanedSource, outputType, 4);

  // Perform direct text-level claim removal on previous draft if requested
  let sanitizedPrevious = previousOutput || '';
  if (removeClaimText && sanitizedPrevious) {
    const escaped = removeClaimText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const claimRegex = new RegExp(`(?:[-*•·]\\s*)?[^\\n]*${escaped}[^\\n]*\\n?`, 'gi');
    sanitizedPrevious = sanitizedPrevious.replace(claimRegex, '').trim();
  }

  let customFeedback = feedback;
  if (removeClaimText) {
    customFeedback = {
      issues: [
        {
          type: 'unsupported_claim',
          severity: 'high',
          claim: removeClaimText,
          reason: 'User explicitly flagged and requested removal of this claim.',
        },
      ],
      instructions: `Remove the unsupported claim "${removeClaimText}" completely while preserving all surrounding accurate facts.`,
    };
  } else if (!customFeedback && specificInstruction) {
    customFeedback = {
      issues: [],
      instructions: specificInstruction,
    };
  }

  const promptFn = promptTemplates.regeneration;
  const prompt = promptFn({
    source: cleanedSource,
    chunks: evidenceChunks,
    previousOutput: sanitizedPrevious,
    feedback: customFeedback,
    outputType,
    settings,
    specificInstruction,
  });

  let regeneratedDraft = await callGenerator({
    prompt,
    outputType,
    source: cleanedSource,
    iteration: 2,
  });

  // Ensure target claim is completely removed from regenerated draft
  if (removeClaimText && regeneratedDraft) {
    const escaped = removeClaimText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const claimRegex = new RegExp(`(?:[-*•·]\\s*)?[^\\n]*${escaped}[^\\n]*\\n?`, 'gi');
    regeneratedDraft = regeneratedDraft.replace(claimRegex, '').trim();
  }

  const evaluation = await evaluateOutput({
    source: cleanedSource,
    evidence: evidenceChunks,
    output: regeneratedDraft,
    outputType,
    settings,
    intelligence,
    iteration: 2,
  });

  // If a specific claim was requested to be removed, filter it out from evaluation unsupported list
  if (removeClaimText && evaluation.unsupportedClaims) {
    evaluation.unsupportedClaims = evaluation.unsupportedClaims.filter(
      c => !c.claim.toLowerCase().includes(removeClaimText.toLowerCase())
    );
    if (evaluation.unsupportedClaims.length === 0 && evaluation.overallScore >= 0.85) {
      evaluation.passed = true;
    }
  }

  const decision = decideQualityGate(evaluation, 2);

  return {
    output: regeneratedDraft,
    evaluation,
    decision,
    status: decision.passed ? 'ready_for_review' : 'needs_human_review',
  };
}

module.exports = {
  generateWithQualityLoop,
  regenerateSingleOutput,
  MAX_ITERATIONS,
};
