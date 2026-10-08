const llmProvider = require('../../src/services/llm/llmProvider');
const chunkCache = require('../../src/services/intelligence/chunkCache');
const { runIntelligencePipeline, isLargeDocument } = require('../../src/services/intelligence/intelligencePipeline');

describe('Intelligence Pipeline Orchestrator', () => {
  const originalCallFastModel = llmProvider.callFastModel;
  const originalCallReasoningModel = llmProvider.callReasoningModel;

  afterEach(() => {
    llmProvider.callFastModel = originalCallFastModel;
    llmProvider.callReasoningModel = originalCallReasoningModel;
  });

  test('isLargeDocument correctly identifies documents over 3000 words', () => {
    const smallDoc = 'word '.repeat(500);
    const largeDoc = 'word '.repeat(3200);

    expect(isLargeDocument(smallDoc)).toBe(false);
    expect(isLargeDocument(largeDoc)).toBe(true);
  });

  test('runs full pipeline successfully with structured outputs and metrics', async () => {
    // Generate text for a large document
    const paragraphs = [];
    for (let i = 1; i <= 15; i++) {
      paragraphs.push(`## Section ${i}\n` + 'Operation fact detail confirmed. '.repeat(100));
    }
    const rawText = paragraphs.join('\n\n');

    // Mock fast model for chunk extraction
    llmProvider.callFastModel = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Chunk findings on security operation.',
        key_findings: ['Action completed with high assurance'],
        events: [{ date: '2024-10-15', description: 'Deployment' }],
        people: ['Agent Fox'],
        organizations: ['Ops Div'],
        locations: ['Base 1'],
        dates: ['2024-10-15'],
        threats: ['Unauthorized probing'],
        risks: ['Exposure'],
        evidence: ['Log verification'],
        uncertainties: [],
        recommendations: ['Maintain status'],
        source_pages: [1, 2],
      }),
      model: 'llama-3.1-8b-instant',
      tokens: { input: 200, output: 80 },
    });

    // Mock reasoning model for synthesis and critic
    let callCount = 0;
    llmProvider.callReasoningModel = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Synthesis
        return Promise.resolve({
          content: '# INTELLIGENCE ASSESSMENT: SECURITY INCIDENT\n\n## EXECUTIVE SUMMARY\nHigh assurance operation verified [Page 1].',
          model: 'gemini-2.0-flash',
          provider: 'gemini',
          tokens: { input: 600, output: 250 },
        });
      }
      // Critic
      return Promise.resolve({
        content: JSON.stringify({
          passed: true,
          severity: 'none',
          missing_information: [],
          contradictions: [],
          unsupported_claims: [],
          redundant_information: [],
          required_corrections: [],
          overall_assessment: 'Fully verified.',
        }),
        model: 'gemini-2.0-flash',
        provider: 'gemini',
        tokens: { input: 400, output: 70 },
      });
    });

    const result = await runIntelligencePipeline({
      rawText,
      settings: { title: 'Security Incident Analysis' },
      projectId: 'proj_test_pipe',
    });

    expect(result).toHaveProperty('results');
    expect(result.results).toHaveProperty('executive_summary');
    expect(result.results.executive_summary).toContain('# INTELLIGENCE ASSESSMENT');

    expect(result).toHaveProperty('evaluations');
    expect(result.evaluations.executive_summary.overallScore).toBeGreaterThanOrEqual(0.9);

    expect(result).toHaveProperty('verifications');
    expect(result.verifications.executive_summary.verificationScore).toBeGreaterThanOrEqual(0.9);

    expect(result).toHaveProperty('intelligenceMetadata');
    const { metrics } = result.intelligenceMetadata;
    expect(metrics).toBeDefined();
    expect(metrics.llmCalls).toBeGreaterThan(0);
    expect(metrics.processingTimeMs).toBeGreaterThanOrEqual(0);
  });
});
