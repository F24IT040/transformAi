const llmProvider = require('../../src/services/llm/llmProvider');
const { extractAllChunks } = require('../../src/services/intelligence/chunkExtractor');

describe('Chunk Extractor', () => {
  const originalCallFastModel = llmProvider.callFastModel;

  afterEach(() => {
    llmProvider.callFastModel = originalCallFastModel;
  });

  const sampleChunks = [
    {
      chunk_id: 'chunk_01',
      index: 1,
      start_page: 1,
      end_page: 2,
      section: 'Incident Scope',
      text: 'On October 14, 2024, an unauthorized actor accessed system telemetry. Agent Alice reported suspicious logins.',
      content_hash: 'hash1',
    },
    {
      chunk_id: 'chunk_02',
      index: 2,
      start_page: 3,
      end_page: 4,
      section: 'Containment',
      text: 'Session tokens were revoked immediately. Recommended mandatory hardware security keys.',
      content_hash: 'hash2',
    },
  ];

  test('returns valid extraction schema on well-formed JSON response', async () => {
    llmProvider.callFastModel = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Unauthorized actor gained access to telemetry.',
        key_findings: ['Telemetry accessed without auth'],
        events: [{ date: 'October 14, 2024', description: 'Telemetry breach' }],
        people: ['Agent Alice'],
        organizations: ['Security Operations'],
        locations: ['HQ'],
        dates: ['October 14, 2024'],
        threats: ['Unauthorized access'],
        risks: ['Data exfiltration'],
        evidence: ['Login audit logs'],
        uncertainties: [],
        recommendations: ['Revoke tokens'],
        source_pages: [1, 2],
      }),
      model: 'llama-3.1-8b-instant',
      tokens: { input: 120, output: 80 },
    });

    const { results, metrics } = await extractAllChunks(sampleChunks.slice(0, 1), 'req_test');

    expect(results).toHaveLength(1);
    const item = results[0];
    expect(item.chunk_id).toBe('chunk_01');
    expect(item.summary).toContain('Unauthorized actor');
    expect(item.people).toContain('Agent Alice');
    expect(item.source_pages).toEqual([1, 2]);
    expect(item._failed).toBe(false);
    expect(metrics.successfulChunks).toBe(1);
    expect(metrics.failedChunks).toBe(0);
  });

  test('recovers from markdown code fences in response', async () => {
    llmProvider.callFastModel = jest.fn().mockResolvedValue({
      content: '```json\n{"summary":"Clean summary","key_findings":["Finding 1"],"events":[],"people":[],"organizations":[],"locations":[],"dates":[],"threats":[],"risks":[],"evidence":[],"uncertainties":[],"recommendations":[],"source_pages":[1]}\n```',
      model: 'llama-3.1-8b-instant',
      tokens: { input: 100, output: 50 },
    });

    const { results } = await extractAllChunks(sampleChunks.slice(0, 1), 'req_test');
    expect(results[0].summary).toBe('Clean summary');
    expect(results[0].key_findings).toEqual(['Finding 1']);
  });

  test('retries on failure and marks chunk as failed if all attempts fail without crashing pipeline', async () => {
    llmProvider.callFastModel = jest.fn().mockRejectedValue(new Error('API Timeout'));

    const { results, metrics } = await extractAllChunks(sampleChunks.slice(0, 1), 'req_test');

    expect(results).toHaveLength(1);
    expect(results[0]._failed).toBe(true);
    expect(results[0].chunk_id).toBe('chunk_01');
    expect(metrics.failedChunks).toBe(1);
    // Verified: pipeline does NOT crash
  });

  test('skips LLM call on cache hit', async () => {
    const cachedItem = {
      chunk_id: 'chunk_01',
      summary: 'Cached extraction',
      key_findings: ['Cached finding'],
      events: [],
      people: [],
      organizations: [],
      locations: [],
      dates: [],
      threats: [],
      risks: [],
      evidence: [],
      uncertainties: [],
      recommendations: [],
      source_pages: [1, 2],
      _failed: false,
    };

    const mockGet = jest.fn().mockReturnValue(cachedItem);
    const mockSet = jest.fn();
    llmProvider.callFastModel = jest.fn();

    const { results, metrics } = await extractAllChunks(
      sampleChunks.slice(0, 1),
      'req_test',
      mockGet,
      mockSet
    );

    expect(mockGet).toHaveBeenCalledWith('hash1');
    expect(llmProvider.callFastModel).not.toHaveBeenCalled();
    expect(results[0].summary).toBe('Cached extraction');
    expect(metrics.cacheHits).toBe(1);
  });
});
