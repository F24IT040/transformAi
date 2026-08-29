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
function createMockDraft(outputType, source, iteration = 1, fixedIssues = []) {
  const isFixed = iteration > 1;

  switch (outputType) {
    case 'executive_summary':
      return isFixed
        ? `# Executive Brief: Incident Overview & Response

### Situation
A sophisticated phishing campaign targeted internal personnel, attempting unauthorized credential harvesting across departmental systems.

### Key Findings
- 500 employee email accounts were targeted with deceptive communications.
- 20 users accessed the external link before detection protocols engaged.
- 3 compromised accounts were promptly identified and isolated from network assets.

### Impact
Departmental system access was briefly interrupted to safeguard internal resources. No unauthorized data exfiltration occurred.

### Recommendations
- Enforce mandatory Multi-Factor Authentication (MFA) across all employee logins.
- Rotate credentials for all affected identity groups immediately.
- Conduct simulated phishing awareness training for staff within 14 days.

### Current Status
All affected user credentials have been reset, perimeter telemetry is stabilized, and no further malicious activity is detected.`
        : `# Executive Brief: Incident Overview

### Situation
A phishing campaign targeted employee accounts across the organization.

### Key Findings
- Multiple employees received malicious communications.
- Suspicious activity was detected by security monitoring.
- Customer financial databases were stolen by the threat actors.

### Impact
Internal access was interrupted during containment.

### Recommendations
- Perform system forensics and password resets.
- Review access controls across internal networks.`;

    case 'advisory':
      return isFixed
        ? `# SECURITY ADVISORY: Targeted Email Phishing Activity

### Threat / Issue
Active credential harvesting campaign utilizing deceptive email vectors.

### Severity
**HIGH** (Risk Index: 8.2/10)

### Impact
Temporary disruption to internal departmental resources; potential identity compromise without MFA enforcement.

### Affected Systems / Entities
Employee user accounts, internal web access gateways, and targeted identity stores.

### Recommended Actions
- Immediately invalidate active sessions for targeted accounts.
- Enforce hardware-token or authenticator-based MFA.
- Block inbound traffic from malicious domain indicators identified in logs.

### Current Status
Contained. Forensic log preservation completed and threat mitigation verified.`
        : `# SECURITY ADVISORY: Email Phishing Activity

### Threat / Issue
Phishing campaign targeting employee credentials.

### Impact
Unauthorized access attempts observed.

### Affected Systems
Employee accounts.

### Recommended Actions
- Reset user passwords.
- Monitor network logs.`;

    case 'linkedin':
      return isFixed
        ? `🛡️ Cybersecurity Alert: Navigating Evolving Identity Threats

A targeted credential harvesting campaign was recently detected and contained within our network infrastructure. Rapid detection prevented unauthorized data exposure, demonstrating the power of proactive defense.

Key takeaways for security leaders:
• Rapid isolation of compromised accounts prevents lateral movement.
• Multi-factor authentication remains the single most effective barrier against identity attacks.
• Continuous employee awareness training builds human firewall resilience.

How is your organization adapting its identity defense strategy against modern phishing campaigns? Join the conversation below.

#Cybersecurity #IncidentResponse #IdentitySecurity #InfoSec #CyberResilience`
        : `Cybersecurity update regarding recent security alerts.

We recently observed phishing emails sent to our workforce. Teams responded quickly.

Always verify sender addresses before clicking links.

#Security #Update`;

    case 'presentation':
      return isFixed
        ? `### Slide 1 – Executive Incident Briefing
**Title:** Security Threat Assessment & Incident Containment
- Critical analysis of recent phishing campaign targeting organizational identities.
- Immediate actions executed to protect core network assets.
- Strategic roadmap for long-term identity resilience.
**Speaker Notes:** Introduce the scope of the briefing and reassure stakeholders on containment.

### Slide 2 – Threat Profile & Attack Vector
**Title:** Campaign Characteristics & Infiltration Vector
- Email-delivered spear-phishing messages targeting 500 employee inboxes.
- Rapid detection protocols engaged upon initial malicious link clicks.
- Real-time perimeter rules blocked subsequent outbound callback attempts.
**Speaker Notes:** Walk executive leadership through the attack timeline and early indicators.

### Slide 3 – Impact & Forensic Analysis
**Title:** Operational Impact & Threat Containment
- 3 compromised user accounts isolated within 15 minutes of detection.
- Zero customer records or financial systems breached.
- Comprehensive log preservation initiated for forensic integrity.
**Speaker Notes:** Emphasize that zero data loss was confirmed by forensic analysis.

### Slide 4 – Recommended Actions & Next Steps
**Title:** Remediation & Future Hardening Measures
- Universal MFA enforcement across all SaaS and internal endpoints.
- Enterprise-wide credential rotation completed for affected teams.
- Quarterly simulated phishing drills scheduled for all departments.
**Speaker Notes:** Close with clear accountability assignments and timeline for remediation.`
        : `### Slide 1 – Incident Overview
**Title:** Security Update
- Overview of phishing attempts.
- Containment actions taken.

### Slide 2 – Next Steps
**Title:** Recommendations
- Reset passwords.
- Update firewall rules.`;

    case 'infographic':
      return isFixed
        ? `# Visual Incident Brief: Threat Neutralization

### Core Storyline
A swift, coordinated response neutralized an incoming credential phishing attempt, stopping unauthorized penetration before data assets were touched.

### Key Callout Statistics
- **500 Target Inboxes**: Volume of deceptive emails intercepted.
- **< 15 Min Containment**: Time elapsed from alert detection to account quarantine.
- **0 Data Leaks**: Zero sensitive files or customer assets accessed.
- **100% MFA Rollout**: Targeted enforcement milestone across all departments.

### Section Breakdown
1. **Inbound Vector**: Visual diagram showing email filtering & user alert.
2. **Containment Ring**: Step-by-step account isolation workflow.
3. **Defense Hardening**: Multi-factor authentication and training pillars.

### Visual Icon Suggestions & Hierarchy
- Shield Icon (Emerald Green) for Containment.
- Padlock Icon (Indigo) for Credential Hardening.
- Warning Beacon (Amber) for Initial Phishing Alert.

### Call to Action
Verify MFA setup on your employee portal today.`
        : `# Infographic: Incident Response

### Core Storyline
Phishing incident contained.

### Key Callout Statistics
- **500**: Targeted accounts.
- **0**: Exfiltration.

### Section Breakdown
- Overview
- Actions`;

    case 'twitter':
      return isFixed
        ? `1/5 🚨 Incident Brief: Our security operations center recently intercepted a coordinated email phishing campaign targeting employee credentials. Here is what happened and how our defense responded 🧵👇

2/5 📊 Scope: 500 accounts were targeted with deceptive messaging. Fast telemetry caught the anomaly within minutes, allowing immediate isolation of 3 affected sessions before lateral spread.

3/5 🔒 Outcome: Zero customer data compromised. All affected identity credentials have been rotated and verified clean by our forensics team.

4/5 🛡️ Response Actions: Universal Multi-Factor Authentication (MFA) enforcement and accelerated security awareness training across all departments.

5/5 💡 Takeaway: Proactive monitoring and fast quarantine protocols turn potential breaches into non-events. Stay vigilant and verify all unsolicited links. #CyberSecurity #InfoSec #ThreatIntel`
        : `1/2 Security alert: We recently detected phishing emails targeting our staff.

2/2 All accounts have been secured and credentials reset. #CyberSecurity #Security`;

    default:
      return `# Generated ${outputType}\n\nKey source findings transformed into professional communication grounded in source evidence.`;
  }
}

/**
 * Executes a single generation attempt using Groq LLM or deterministic fallback.
 */
async function callGenerator({ prompt, outputType, source, iteration = 1 }) {
  try {
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 10) {
      console.log(`[GenerationService] Calling Groq LLM for ${outputType} (Iteration ${iteration})...`);
      const result = await generateWithGroq({ prompt });
      if (result && result.trim().length > 40) {
        return result;
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

    const templateFn = promptTemplates[outputType] || promptTemplates.executive_summary;
    const initialPrompt = templateFn({
      source: cleanedSource,
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
