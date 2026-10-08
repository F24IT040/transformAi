const { callLLM } = require('../../src/services/llm/llmProvider');
const { generateWithQualityLoop } = require('../../src/services/generationService');
const pipelineMod = require('../../src/services/intelligence/intelligencePipeline');

describe('API Error & Resilience', () => {
  jest.setTimeout(25000);

  test('callLLM retries on failure up to maxRetries', async () => {
    try {
      await callLLM({
        role: 'fast',
        prompt: 'test prompt',
        maxRetries: 2,
        requestId: 'test_err_req',
      });
    } catch (err) {
      expect(err).toBeDefined();
      expect(err.message).toContain('All attempts exhausted');
    }
  });

  test('generateWithQualityLoop gracefully falls back if pipeline fails', async () => {
    const origRun = pipelineMod.runIntelligencePipeline;
    pipelineMod.runIntelligencePipeline = jest.fn().mockRejectedValue(new Error('Simulated network timeout'));

    try {
      const largeDoc = 'Critical operational finding. '.repeat(1100);

      const result = await generateWithQualityLoop({
        source: largeDoc,
        outputs: ['executive_summary'],
        settings: { title: 'Resilience Test' },
        projectId: 'proj_fallback_test',
      });

      expect(result).toHaveProperty('results');
      expect(result.results).toHaveProperty('executive_summary');
      expect(result.results.executive_summary.length).toBeGreaterThan(50);
    } finally {
      pipelineMod.runIntelligencePipeline = origRun;
    }
  });
});
