/**
 * Synthesis Prompt — Global Cross-Chunk Intelligence Synthesis
 *
 * Instructs the reasoning model to combine all structured chunk extractions
 * into a single coherent intelligence summary.
 */

module.exports = ({ chunkResults, totalPages, settings = {} }) => {
  // Build a compressed representation of all chunk extractions
  const chunkSummaries = chunkResults
    .filter(r => !r._failed)
    .map(r => {
      const parts = [];
      parts.push(`[${r.chunk_id} | Pages ${r.source_pages.join('-')}]`);
      if (r.summary) parts.push(`Summary: ${r.summary}`);
      if (r.key_findings.length) parts.push(`Findings: ${r.key_findings.join('; ')}`);
      if (r.events.length) parts.push(`Events: ${r.events.map(e => `${e.date ? e.date + ': ' : ''}${e.description}`).join('; ')}`);
      if (r.people.length) parts.push(`People: ${r.people.join(', ')}`);
      if (r.organizations.length) parts.push(`Organizations: ${r.organizations.join(', ')}`);
      if (r.locations.length) parts.push(`Locations: ${r.locations.join(', ')}`);
      if (r.dates.length) parts.push(`Dates: ${r.dates.join(', ')}`);
      if (r.threats.length) parts.push(`Threats: ${r.threats.join('; ')}`);
      if (r.risks.length) parts.push(`Risks: ${r.risks.join('; ')}`);
      if (r.evidence.length) parts.push(`Evidence: ${r.evidence.join('; ')}`);
      if (r.uncertainties.length) parts.push(`Uncertainties: ${r.uncertainties.join('; ')}`);
      if (r.recommendations.length) parts.push(`Recommendations: ${r.recommendations.join('; ')}`);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');

  // Collect all unique entities for cross-referencing
  const allPeople = [...new Set(chunkResults.flatMap(r => r.people || []))];
  const allOrgs = [...new Set(chunkResults.flatMap(r => r.organizations || []))];
  const allLocations = [...new Set(chunkResults.flatMap(r => r.locations || []))];
  const allDates = [...new Set(chunkResults.flatMap(r => r.dates || []))];

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `You are a senior intelligence analyst producing a comprehensive intelligence assessment from structured extraction results.

SOURCE: ${totalPages}-page intelligence report, processed into ${chunkResults.length} analyzed chunks.
DATE: ${today}
AUDIENCE: ${settings.audience || 'Senior Government Leadership / Ministry Officials'}
TONE: ${settings.tone || 'Formal / Authoritative / Objective'}

CROSS-REFERENCE ENTITIES (found across chunks):
- People: ${allPeople.length > 0 ? allPeople.join(', ') : 'None identified'}
- Organizations: ${allOrgs.length > 0 ? allOrgs.join(', ') : 'None identified'}
- Locations: ${allLocations.length > 0 ? allLocations.join(', ') : 'None identified'}
- Key Dates: ${allDates.length > 0 ? allDates.join(', ') : 'None identified'}

SYNTHESIS RULES — YOU MUST FOLLOW ALL:
1. COMBINE related facts from different chunks into coherent narratives. Do NOT simply concatenate chunk summaries.
2. REMOVE duplicate information — if the same fact appears in multiple chunks, state it once.
3. CONNECT events across chunks — build a coherent timeline and causal chain.
4. IDENTIFY relationships between entities — who is connected to what.
5. PRESERVE exact names, dates, numbers, locations — do NOT approximate or round.
6. DISTINGUISH confirmed facts from assumptions/uncertainties. Label uncertain claims.
7. PRESERVE source page references — include [Page X] or [Pages X-Y] citations for key findings.
8. Do NOT introduce any information not present in the chunk extractions below.
9. Do NOT hallucinate or fabricate facts.
10. Use formal, objective, government-report language.

OUTPUT FORMAT — Use EXACTLY this structure in Markdown:

# INTELLIGENCE ASSESSMENT: [Title derived from source content]

---

## EXECUTIVE SUMMARY
[3-5 sentence comprehensive overview of the entire report's key message]

---

## SITUATION OVERVIEW
[Context, background, and triggering events. 4-6 sentences.]

---

## KEY FINDINGS
- [Finding 1 with source reference, e.g. (Page 3)]
- [Finding 2]
- [Finding 3]
- [Continue as needed — include ALL important findings]

---

## MAJOR EVENTS
| Date | Event | Source |
|------|-------|--------|
| [Date] | [Description] | [Page ref] |

---

## KEY ACTORS

### People
- [Person 1 — role/context]

### Organizations
- [Org 1 — role/context]

---

## LOCATIONS
- [Location 1 — relevance to report]

---

## TIMELINE
[Chronological narrative of events, with dates]

---

## THREAT ASSESSMENT
[Analysis of identified threats, attack vectors, vulnerabilities]

---

## RISK ANALYSIS
[Assessment of risks, potential impacts, likelihood]

---

## EVIDENCE
- [Specific data points, statistics, metrics with source pages]

---

## UNCERTAINTIES / INTELLIGENCE GAPS
- [What is unknown, unconfirmed, or requires further investigation]

---

## RECOMMENDED ACTIONS
- [Action 1 — specific, actionable]
- [Action 2]
- [Continue as needed]

---

## SOURCE REFERENCES
| Section | Source Pages |
|---------|------------|
| [Finding/Event] | [Page numbers] |

---

*This assessment is synthesized from ${chunkResults.length} analyzed sections of a ${totalPages}-page intelligence report. All findings are traceable to source pages.*

STRUCTURED CHUNK EXTRACTIONS:

${chunkSummaries}`;
};
