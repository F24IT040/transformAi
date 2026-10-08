const llmProvider = require('../../src/services/llm/llmProvider');
const { critique } = require('../../src/services/intelligence/intelligenceCritic');
const { needsRefinement } = require('../../src/services/intelligence/intelligenceRefiner');

describe('Intelligence Critic', () => {
  const originalCallReasoningModel = llmProvider.callReasoningModel;

  afterEach(() => {
    llmProvider.callReasoningModel = originalCallReasoningModel;
  });

  const sampleChunkResults = [
    {
      chunk_id: 'chunk_01',
      summary: 'Attack occurred on October 14, 2024.',
      key_findings: ['Attacker compromised 5 accounts.'],
      people: ['Bob Vance'],
      organizations: ['Refrigeration Inc'],
      source_pages: [1, 2],
      _failed: false,
    },
  ];

  test('returns passed: true on clean verified summary', async () => {
    llmProvider.callReasoningModel = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        passed: true,
        severity: 'none',
        missing_information: [],
        contradictions: [],
        unsupported_claims: [],
        redundant_information: [],
        required_corrections: [],
        overall_assessment: 'Fully accurate and verified against source.',
      }),
      tokens: { input: 300, output: 80 },
    });

    const { feedback } = await critique({
      summary: '# Report\nAttack occurred on October 14, compromising 5 accounts.',
      chunkResults: sampleChunkResults,
      requestId: 'req_clean',
    });

    expect(feedback.passed).toBe(true);
    expect(feedback.severity).toBe('none');
    expect(feedback.contradictions).toHaveLength(0);
    expect(needsRefinement(feedback)).toBe(false);
  });

  test('detects contradictions, unsupported claims, and requires refinement', async () => {
    llmProvider.callReasoningModel = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        passed: false,
        severity: 'major',
        missing_information: ['Failure to note Bob Vance reported the incident.'],
        contradictions: ['Summary states attack occurred on November 14, but source states October 14.'],
        unsupported_claims: ['Summary states 500 accounts compromised, but source confirms only 5.'],
        redundant_information: [],
        required_corrections: ['Correct date to October 14', 'Change account count from 500 to 5'],
        overall_assessment: 'Significant hallucinations and date mismatch found.',
      }),
      tokens: { input: 400, output: 150 },
    });

    const { feedback } = await critique({
      summary: '# Report\nAttack occurred on November 14 compromising 500 accounts.',
      chunkResults: sampleChunkResults,
      requestId: 'req_issues',
    });

    expect(feedback.passed).toBe(false);
    expect(feedback.severity).toBe('major');
    expect(feedback.contradictions).toHaveLength(1);
    expect(feedback.unsupported_claims).toHaveLength(1);
    expect(feedback.missing_information).toHaveLength(1);
    expect(needsRefinement(feedback)).toBe(true);
  });

  test('handles malformed critic response gracefully', async () => {
    llmProvider.callReasoningModel = jest.fn().mockResolvedValue({
      content: 'I cannot evaluate this in JSON format.',
      tokens: { input: 100, output: 20 },
    });

    const { feedback } = await critique({
      summary: 'Summary text',
      chunkResults: sampleChunkResults,
      requestId: 'req_bad_json',
    });

    expect(feedback.passed).toBe(true); // Fallback defaults to passing to avoid blocking pipeline
    expect(feedback.severity).toBe('none');
  });
});
