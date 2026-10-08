const llmProvider = require('../../src/services/llm/llmProvider');
const { synthesize } = require('../../src/services/intelligence/globalSynthesizer');

describe('Global Synthesizer', () => {
  const originalCallReasoningModel = llmProvider.callReasoningModel;

  afterEach(() => {
    llmProvider.callReasoningModel = originalCallReasoningModel;
  });

  const validChunkResults = [
    {
      chunk_id: 'chunk_01',
      summary: 'Initial breach discovered on October 14.',
      key_findings: ['Phishing campaign targeted identity credentials (Page 1)'],
      events: [{ date: 'October 14, 2024', description: 'Credential phishing detected' }],
      people: ['John Doe'],
      organizations: ['Agency Alpha'],
      locations: ['Geneva'],
      dates: ['October 14, 2024'],
      threats: ['Credential Phishing'],
      risks: ['Unauthorized access'],
      evidence: ['Email headers'],
      uncertainties: [],
      recommendations: ['Revoke active tokens'],
      source_pages: [1, 2],
      _failed: false,
    },
    {
      chunk_id: 'chunk_02',
      summary: 'Containment actions executed on October 15.',
      key_findings: ['Tokens revoked across all 50 endpoints (Page 3)'],
      events: [{ date: 'October 15, 2024', description: 'Endpoint isolation complete' }],
      people: ['John Doe', 'Jane Smith'],
      organizations: ['Agency Alpha', 'CERT'],
      locations: ['Geneva', 'Zurich'],
      dates: ['October 15, 2024'],
      threats: ['Lateral movement attempt'],
      risks: ['Persistent backdoor'],
      evidence: ['Firewall logs'],
      uncertainties: ['Potential second payload unverified'],
      recommendations: ['Deploy hardware security keys'],
      source_pages: [3, 4],
      _failed: false,
    },
  ];

  test('calls reasoning model and aggregates cross-chunk metadata and entities', async () => {
    llmProvider.callReasoningModel = jest.fn().mockResolvedValue({
      content: '# INTELLIGENCE ASSESSMENT: INCIDENT CONTAINMENT\n\n## EXECUTIVE SUMMARY\nA coordinated attack was stopped on October 15 [Page 1-3].\n\n## KEY FINDINGS\n- Phishing campaign targeted identity credentials [Page 1]\n- Tokens revoked across all 50 endpoints [Page 3]',
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      tokens: { input: 500, output: 250 },
    });

    const result = await synthesize({
      chunkResults: validChunkResults,
      totalPages: 4,
      settings: { audience: 'Executive Committee' },
      requestId: 'req_synth_test',
    });

    expect(result.summary).toContain('# INTELLIGENCE ASSESSMENT');
    expect(result.summary).toContain('October 15');

    // Check entity deduplication across chunks
    expect(result.metadata.entities.people).toEqual(['John Doe', 'Jane Smith']);
    expect(result.metadata.entities.organizations).toEqual(['Agency Alpha', 'CERT']);
    expect(result.metadata.entities.locations).toEqual(['Geneva', 'Zurich']);

    // Check traceability map
    expect(result.metadata.traceability).toHaveLength(2);
    expect(result.metadata.traceability[0].source_pages).toEqual([1, 2]);
    expect(result.metadata.traceability[1].source_pages).toEqual([3, 4]);
  });

  test('returns fallback message gracefully when all chunks failed', async () => {
    const failedChunks = [
      { chunk_id: 'chunk_01', summary: '', _failed: true },
    ];

    const result = await synthesize({
      chunkResults: failedChunks,
      totalPages: 2,
      requestId: 'req_failed',
    });

    expect(result.summary).toContain('No valid extraction results available');
    expect(result.metadata.entities).toEqual([]);
  });
});
