module.exports = ({ source, settings, analysis, chunks = [], condensedBullets = null }) => {
  const contextBlock = condensedBullets
    ? `PRE-EXTRACTED KEY FACTS (synthesized from source):\n${condensedBullets}`
    : `RELEVANT SOURCE CONTEXT:\n${chunks.map(c => c.content).join('\n---\n') || source}`;

  return `You are a senior government communications specialist. Create a formal, executive-grade presentation briefing deck with EXACTLY 7 slides following the structure below.

Audience: ${settings.audience || 'Senior Government Leadership'}
Tone: ${settings.tone || 'Formal / Authoritative'}
Language: ${settings.language || 'English'}
Detail level: ${settings.detailLevel || 'high'}
Objective: ${settings.objective || 'Brief leadership on threat landscape and recommended actions'}
Source size: ${analysis.wordCount} words, ${analysis.paragraphCount} paragraphs.

CONTENT REFINEMENT RULES — YOU MUST FOLLOW ALL:
1. FILTER NOISE: Skip all page numbers, headers, footers, disclaimers, and boilerplate meta-commentary.
2. SENTENCE RECONSTRUCTION: Join any broken sentence fragments into complete, coherent sentences.
3. POLISHED SUMMARIZATION: Rephrase raw source lines into executive-ready bullets. NEVER copy fragmented lines verbatim.
4. MAINTAIN GROUNDING: Only include facts present in the source. Do NOT invent or hallucinate.
5. MINIMUM SLIDE COUNT: You MUST produce EXACTLY 7 slides — no more, no fewer.

OUTPUT FORMAT — Use this EXACT Markdown structure for all 7 slides:

### Slide 1 – Title & Classification
**Title:** [Full report or briefing title derived from source]
- Classification: RESTRICTED / OFFICIAL USE ONLY
- Issuing Authority: [Relevant ministry or agency from source]
- Date of Issue: [Extract or use today's date]
- Document Reference: [REF-YYYY-XXX or derived from source]
**Speaker Notes:** Opening slide introduces the briefing scope and classification level.

### Slide 2 – Executive Summary
**Title:** Executive Summary
- [1–2 sentence polished overview of the incident or policy matter]
- Severity Level: [CRITICAL / HIGH / MEDIUM / LOW based on source]
- [Key outcome or status statement from source]
- [Scope of impact — who or what is affected]
**Speaker Notes:** High-level situational overview for senior leadership.

### Slide 3 – Situation & Background
**Title:** 1.0 Situation & Background
- [Context sentence describing what happened or what the policy addresses]
- [Timeline or entity details extracted from source]
- [Who is involved — agencies, threat actors, or stakeholders]
- [Why this matters — operational or strategic significance]
**Speaker Notes:** Establish factual context before findings.

### Slide 4 – Operational Findings & Threat Analysis
**Title:** 2.0 Operational Findings & Threat Analysis
- [Finding 1 — specific, complete sentence with entity/date/number where available]
- [Finding 2 — specific, complete sentence]
- [Finding 3 — specific, complete sentence]
- [Finding 4 — specific, complete sentence if source supports it]
**Speaker Notes:** Core analytical findings grounded in source intelligence.

### Slide 5 – Impact Assessment
**Title:** 3.0 Impact Assessment
- [Impact point 1 — operational, strategic, or security consequence]
- [Impact point 2 — affected systems, users, or organizations]
- [Impact point 3 — magnitude or scale of risk]
- Attack Surface / Exposure: [from source]
**Speaker Notes:** Translate technical findings into leadership-level consequence framing.

### Slide 6 – Strategic Recommendations & Mitigation
**Title:** 4.0 Strategic Recommendations & Mitigation
- [Recommendation 1 — actionable, formal language, e.g. "The Ministry recommends..."]
- [Recommendation 2 — specific control or countermeasure]
- [Recommendation 3 — monitoring or governance action]
- [Recommendation 4 — training, audit, or compliance measure if source supports]
**Speaker Notes:** Prioritized action items for immediate leadership decision.

### Slide 7 – Conclusion & Way Forward
**Title:** 5.0 Conclusion & Way Forward
- [Summary of situation in one complete sentence]
- Next Steps: [Immediate action within 30 days]
- Accountability: [Responsible agency or department]
- Follow-up Review: [Recommended review timeline]
- Document Status: Verified & Approved for Official Release
**Speaker Notes:** Closing slide with accountability and follow-up actions.

${contextBlock}`;
};
