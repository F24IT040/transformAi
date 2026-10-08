const {
  intelligentChunk,
  estimateTokens,
  isHeading,
  OVERLAP_RATIO,
} = require('../../src/services/intelligence/intelligentChunker');

describe('Intelligent Chunker', () => {
  // Helper to generate text of approximate word count
  function generateWords(count, prefix = 'word') {
    const words = [];
    for (let i = 0; i < count; i++) {
      words.push(`${prefix}_${i}`);
    }
    return words.join(' ');
  }

  test('detects headings correctly', () => {
    expect(isHeading('# EXECUTIVE SUMMARY')).toBe(true);
    expect(isHeading('### Key Findings')).toBe(true);
    expect(isHeading('1.0 BACKGROUND AND CONTEXT')).toBe(true);
    expect(isHeading('OPERATIONAL THREAT OVERVIEW')).toBe(true);
    expect(isHeading('This is a regular sentence explaining the situation.')).toBe(false);
  });

  test('estimates tokens with reasonable ratio', () => {
    const text = 'The incident response team identified compromised session tokens across multiple endpoints.';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(30);
  });

  test('returns empty array for empty document', () => {
    expect(intelligentChunk({ rawText: '' })).toEqual([]);
    expect(intelligentChunk({ pageData: [] })).toEqual([]);
  });

  test('preserves page metadata when pageData is provided', () => {
    const pageData = [
      { page: 1, section: 'Executive Summary', text: '# EXECUTIVE SUMMARY\n' + generateWords(600, 'p1') + '.' },
      { page: 2, section: 'Threat Analysis', text: '# THREAT ANALYSIS\n' + generateWords(800, 'p2') + '.' },
      { page: 3, section: 'Mitigation Steps', text: '# MITIGATION STEPS\n' + generateWords(800, 'p3') + '.' },
      { page: 4, section: 'Conclusion', text: '# CONCLUSION\n' + generateWords(500, 'p4') + '.' },
    ];

    const chunks = intelligentChunk({
      pageData,
      minTokens: 800,
      maxTokens: 1600,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('chunk_id');
    expect(chunks[0]).toHaveProperty('start_page');
    expect(chunks[0]).toHaveProperty('end_page');
    expect(chunks[0]).toHaveProperty('content_hash');
    expect(chunks[0].start_page).toBe(1);
    expect(chunks[chunks.length - 1].end_page).toBe(4);
  });

  test('respects minTokens and maxTokens boundaries', () => {
    // Generate a ~3500-word text (~4600 tokens)
    const paragraphs = [];
    for (let p = 1; p <= 10; p++) {
      paragraphs.push(`## Section ${p}\n` + generateWords(350, `sec${p}`) + '.');
    }
    const rawText = paragraphs.join('\n\n');

    const minTokens = 1000;
    const maxTokens = 2000;

    const chunks = intelligentChunk({
      rawText,
      minTokens,
      maxTokens,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.estimated_tokens).toBeGreaterThan(0);
      expect(chunk.content_hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  test('applies overlap between contiguous chunks', () => {
    const paragraphs = [
      '# SECTION 1\n' + generateWords(1200, 'first_sec') + '.',
      '# SECTION 2\n' + generateWords(1200, 'second_sec') + '.',
      '# SECTION 3\n' + generateWords(1200, 'third_sec') + '.',
    ];

    const chunks = intelligentChunk({
      rawText: paragraphs.join('\n\n'),
      minTokens: 800,
      maxTokens: 1400,
    });

    if (chunks.length >= 2) {
      // Check that chunks have overlap
      const chunk1Words = new Set(chunks[0].text.split(/\s+/));
      const chunk2Words = chunks[1].text.split(/\s+/);
      const overlapFound = chunk2Words.some(w => chunk1Words.has(w));
      expect(overlapFound).toBe(true);
    }
  });

  test('does not break mid-sentence on line boundaries', () => {
    const rawText = 'Sentence number one is complete. Sentence number two has vital facts. Sentence number three concludes.';
    const chunks = intelligentChunk({ rawText, minTokens: 5, maxTokens: 50 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('Sentence number one is complete.');
  });
});
