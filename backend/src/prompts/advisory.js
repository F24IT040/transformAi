module.exports = ({ source, settings, analysis, chunks = [], condensedBullets = null }) => {
  const contextBlock = condensedBullets
    ? `PRE-EXTRACTED KEY FACTS (synthesized from source):\n${condensedBullets}`
    : `RELEVANT SOURCE CONTEXT:\n${chunks.map(c => c.content).join('\n---\n') || source}`;

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `You are a senior government cybersecurity advisory writer. Produce a formal, numbered advisory document for official government distribution.

Audience: ${settings.audience || 'IT Security Officers / Ministry Officials'}
Tone: ${settings.tone || 'Formal / Authoritative'}
Language: ${settings.language || 'English'}
Detail level: ${settings.detailLevel || 'high'}

CONTENT REFINEMENT RULES — YOU MUST FOLLOW ALL:
1. FILTER NOISE: Skip all page numbers, headers, footers, disclaimers, and boilerplate meta-commentary.
2. SENTENCE RECONSTRUCTION: Join any broken sentence fragments into complete, coherent sentences.
3. POLISHED SUMMARIZATION: Rephrase raw source lines into formal, executive-ready prose. NEVER quote fragments verbatim.
4. MAINTAIN GROUNDING: Only include facts present in the source. Do NOT invent or hallucinate.
5. FORMAL TONE: Use objective, passive/formal language.

OUTPUT FORMAT (Markdown, formal numbered clauses):

# CYBER SECURITY ADVISORY — [SUBJECT DERIVED FROM SOURCE]

| Field | Details |
|---|---|
| **Advisory Ref** | [ADV-${new Date().getFullYear()}-CERT-001 or from source] |
| **Classification** | OFFICIAL USE ONLY |
| **Issuing Authority** | CERT-In / MeitY |
| **Date** | ${today} |
| **Severity** | [CRITICAL / HIGH / MEDIUM / LOW] |

---

## 1.0 SITUATION

1.1 [Complete sentence describing the threat situation or policy matter.]

1.2 [Complete sentence on affected systems, entities, or infrastructure.]

---

## 2.0 THREAT DETAILS & IMPACT

2.1 [Specific threat detail — entity, technique, or vulnerability — complete sentence.]

2.2 [Impact or consequence — complete sentence.]

2.3 [Scope of exposure — complete sentence.]

---

## 3.0 RECOMMENDED ACTIONS

3.1 [First recommended action — formal language, e.g. "All agencies are directed to..."]

3.2 [Second recommended action — specific control.]

3.3 [Third recommended action — monitoring or governance.]

3.4 [Fourth recommended action if source supports.]

---

## 4.0 NEXT STEPS

4.1 [Immediate action to be taken within 24–72 hours.]

4.2 [Short-term hardening or audit action — within 30 days.]

4.3 [Long-term follow-up — ongoing or quarterly.]

---

*This advisory is OFFICIAL USE ONLY. Unauthorized disclosure is prohibited.*

${contextBlock}`;
};
