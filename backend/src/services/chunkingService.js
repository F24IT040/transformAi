function tokenize(text) {
  return (text || '').toLowerCase().match(/\b[a-z0-9]+\b/g) || [];
}

function computeTf(tokens) {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  const total = tokens.length || 1;
  for (const k in tf) {
    tf[k] /= total;
  }
  return tf;
}

function cosineSimilarity(tf1, tf2) {
  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;
  for (const k in tf1) {
    norm1 += tf1[k] * tf1[k];
    if (tf2[k]) dot += tf1[k] * tf2[k];
  }
  for (const k in tf2) {
    norm2 += tf2[k] * tf2[k];
  }
  if (!norm1 || !norm2) return 0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

function chunkText(text, maxChunkWords = 300, overlapWords = 50) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (currentWordCount + words.length > maxChunkWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      // Keep overlap from end of current chunk
      const joined = currentChunk.join(' ');
      const allWords = joined.split(/\s+/);
      const overlap = allWords.slice(Math.max(0, allWords.length - overlapWords)).join(' ');
      currentChunk = [overlap, paragraph];
      currentWordCount = overlap.split(/\s+/).length + words.length;
    } else {
      currentChunk.push(paragraph);
      currentWordCount += words.length;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks.map((content, index) => ({
    id: `chunk_${index + 1}`,
    index: index + 1,
    content: content.trim(),
    wordCount: content.split(/\s+/).filter(Boolean).length,
    tokens: tokenize(content),
    tf: computeTf(tokenize(content)),
  }));
}

function retrieveRelevantChunks(sourceText, query, topK = 4) {
  const indexedChunks = chunkText(sourceText);
  if (indexedChunks.length <= topK) {
    return indexedChunks;
  }

  const queryTokens = tokenize(query);
  const queryTf = computeTf(queryTokens);

  const scored = indexedChunks.map(chunk => {
    const sim = cosineSimilarity(queryTf, chunk.tf);
    return { ...chunk, score: sim };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = {
  chunkText,
  retrieveRelevantChunks,
  tokenize,
  cosineSimilarity,
};
