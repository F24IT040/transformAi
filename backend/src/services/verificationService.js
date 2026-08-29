const { tokenize, cosineSimilarity, chunkText } = require('./chunkingService');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'been', 'were', 'what',
  'which', 'your', 'about', 'across', 'into', 'over', 'after', 'before', 'where', 'while',
  'more', 'some', 'than', 'them', 'these', 'they', 'will', 'would', 'could', 'should',
  'also', 'each', 'such', 'only', 'other', 'their', 'there', 'here', 'critical', 'analysis',
  'strategic', 'roadmap', 'resilience', 'overview', 'assessment', 'threat', 'vector',
  'characteristics', 'operational', 'remediation', 'measures', 'future', 'key', 'findings',
  'summary', 'recommended', 'actions', 'impact', 'speaker', 'notes', 'slide', 'title',
]);

function extractClaimsFromMarkdown(markdown) {
  const lines = markdown
    .split('\n')
    .map(line =>
      line
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*•·]\s*/, '')
        .replace(/^\*{1,2}/, '')
        .replace(/\*{1,2}$/, '')
        .trim()
    )
    .filter(line => {
      if (!line || line.length < 18) return false;
      if (line.startsWith('http') || line.startsWith('#')) return false;
      if (/^(speaker notes?|visual direction|title:|section breakdown|call to action|on-screen text|slide\s*\d+)/i.test(line)) return false;
      if (/^#[\w\d\s#]+$/.test(line)) return false;
      if (/\?(?:\s*$)/.test(line)) return false;
      return true;
    });

  const claims = [];
  for (const line of lines) {
    const sentences = line.match(/[^.!?]+[.!?]+/g) || [line];
    for (const s of sentences) {
      const trimmed = s
        .trim()
        .replace(/^(\*\*Title:\*\*|\*\*Bullet\s*\d+:\*\*|\*\*Speaker Notes:\*\*|Title:|Speaker Notes:)\s*/i, '')
        .replace(/\*\*/g, '');
      if (
        trimmed.length >= 20 &&
        !trimmed.endsWith(':') &&
        !/^(###|scene\s*\d+|slide\s*\d+)/i.test(trimmed)
      ) {
        claims.push(trimmed);
      }
    }
  }
  return [...new Set(claims)];
}

function verifyClaimsAgainstSource({ generatedContent, sourceText, intelligenceFacts = [] }) {
  const claims = extractClaimsFromMarkdown(generatedContent);
  const chunks = chunkText(sourceText);
  const sourceLower = sourceText.toLowerCase();
  const sourceTokens = new Set(tokenize(sourceText));

  if (!claims.length) {
    return {
      verificationScore: 1.0,
      supportedClaimsCount: 0,
      unsupportedClaimsCount: 0,
      claims: [],
      references: chunks.slice(0, 3).map((chunk, idx) => ({
        id: chunk.id,
        title: `Source Section ${idx + 1}`,
        excerpt: chunk.content.length > 250 ? chunk.content.substring(0, 250) + '...' : chunk.content,
      })),
    };
  }

  const matchedChunksMap = new Map();

  const verifiedClaims = claims.map(claimText => {
    const claimTokens = tokenize(claimText).filter(t => !STOP_WORDS.has(t) && t.length > 1);
    if (claimTokens.length === 0) {
      return {
        claim: claimText,
        status: 'supported',
        confidence: 0.95,
        matchedChunkId: chunks[0]?.id || 'chunk_1',
        reason: 'General structural or executive summary statement.',
      };
    }

    const claimTf = {};
    for (const t of claimTokens) {
      claimTf[t] = (claimTf[t] || 0) + 1;
    }

    // Direct token overlap ratio with source
    let matchedInSource = 0;
    for (const t of claimTokens) {
      if (sourceTokens.has(t) || sourceLower.includes(t)) {
        matchedInSource++;
      }
    }
    const tokenOverlapRatio = matchedInSource / claimTokens.length;

    // Specific check for hallucinated concepts not in source
    const hallucinatedKeywords = ['stolen', 'exfiltrated', 'ransom', 'million', 'bitcoin', 'database breached'];
    const hasHallucination = hallucinatedKeywords.some(
      hk => claimText.toLowerCase().includes(hk) && !sourceLower.includes(hk)
    );

    // Find best matching chunk for this claim
    let bestChunk = null;
    let bestScore = 0;

    for (const chunk of chunks) {
      const sim = cosineSimilarity(claimTf, chunk.tf);
      if (sim > bestScore) {
        bestScore = sim;
        bestChunk = chunk;
      }
    }

    // A claim is supported if key factual tokens match source, or token overlap is reasonable, and no hallucination
    const isSupported = !hasHallucination && (matchedInSource >= 2 || tokenOverlapRatio >= 0.25 || bestScore >= 0.04);

    if (bestChunk && isSupported) {
      matchedChunksMap.set(bestChunk.id, {
        id: bestChunk.id,
        title: `Source Section ${bestChunk.index}`,
        excerpt: bestChunk.content ? (bestChunk.content.length > 300 ? bestChunk.content.substring(0, 300) + '...' : bestChunk.content) : '',
      });
    }

    return {
      claim: claimText,
      status: isSupported ? 'supported' : 'unsupported',
      confidence: isSupported ? Math.min(1.0, Math.round((0.85 + tokenOverlapRatio * 0.15) * 100) / 100) : 0.25,
      matchedChunkId: bestChunk ? bestChunk.id : null,
      reason: isSupported
        ? `Claim matched to Source Section ${bestChunk?.index || 1}.`
        : 'This statement contains details or numbers not supported by the provided source evidence.',
    };
  });

  const supportedCount = verifiedClaims.filter(c => c.status === 'supported').length;
  const unsupportedCount = verifiedClaims.length - supportedCount;
  const verificationScore = Math.round((supportedCount / (verifiedClaims.length || 1)) * 100) / 100;

  let references = Array.from(matchedChunksMap.values());
  if (!references.length) {
    references = chunks.slice(0, 3).map((chunk, idx) => ({
      id: chunk.id,
      title: `Source Section ${idx + 1}`,
      excerpt: chunk.content.length > 250 ? chunk.content.substring(0, 250) + '...' : chunk.content,
    }));
  }

  return {
    verificationScore,
    supportedClaimsCount: supportedCount,
    unsupportedClaimsCount: unsupportedCount,
    claims: verifiedClaims,
    references,
  };
}

module.exports = {
  extractClaimsFromMarkdown,
  verifyClaimsAgainstSource,
};

