/**
 * Merge consecutive short lines within a paragraph block into a single line.
 * Prevents multi-line sentence fragments from being split across chunk boundaries.
 * A line is considered a fragment if it:
 *   - Is shorter than 55 characters AND
 *   - Does not end with terminal punctuation (.?!:;)
 */
function mergeShortLines(text) {
  const lines = text.split('\n');
  const result = [];
  let buffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // Blank line — flush buffer, preserve paragraph break
      if (buffer) {
        result.push(buffer.trim());
        buffer = '';
      }
      result.push('');
      continue;
    }

    // Heading lines — always flush and emit as-is
    if (/^#{1,6}\s/.test(trimmed) || /^[A-Z][A-Z\s]{4,}$/.test(trimmed)) {
      if (buffer) {
        result.push(buffer.trim());
        buffer = '';
      }
      result.push(trimmed);
      continue;
    }

    const endsWithTerminator = /[.?!;:]\s*$/.test(trimmed);
    const isShort = trimmed.length < 55;

    if (buffer) {
      const bufferEndsWithTerminator = /[.?!;:]\s*$/.test(buffer);
      if (!bufferEndsWithTerminator && isShort) {
        // Both buffer and current line are fragments — join them
        buffer = buffer + ' ' + trimmed;
      } else {
        result.push(buffer.trim());
        buffer = trimmed;
      }
    } else {
      buffer = trimmed;
    }

    // If current line ends with terminator and is long enough, flush immediately
    if (endsWithTerminator && buffer.length > 55) {
      result.push(buffer.trim());
      buffer = '';
    }
  }

  if (buffer) result.push(buffer.trim());
  return result.join('\n');
}

/**
 * Split text into sections by detecting Markdown headings or ALL-CAPS section titles.
 * Returns an array of section strings.
 */
function splitBySections(text) {
  // Split on markdown headings (## Heading) or ALL CAPS lines (e.g. "EXECUTIVE SUMMARY")
  const sectionBreak = /(?=^#{1,4}\s|^[A-Z][A-Z\s]{4,}$)/m;
  const sections = text.split(sectionBreak).filter(s => s.trim().length > 0);
  return sections.length > 1 ? sections : null; // null = no headings found, fall back to paragraph split
}

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
  // Pre-process: merge short fragmented lines within paragraphs
  const mergedText = mergeShortLines(text || '');
  const paragraphs = mergedText.split(/\n\s*\n/).filter(p => p.trim());
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

/**
 * Section-aware chunking: tries to split on document headings first.
 * Falls back to paragraph-based chunking if no sections are found.
 * Ensures complete ideas stay within the same chunk.
 *
 * @param {string} text - Pre-processed source text
 * @param {number} maxChunkWords - Max words per chunk
 * @returns {Array} Array of chunk objects
 */
function semanticChunk(text, maxChunkWords = 300) {
  if (!text || text.trim().length < 50) return chunkText(text, maxChunkWords);

  // Try section-based splitting first
  const sections = splitBySections(text);

  if (sections && sections.length > 1) {
    const allChunks = [];
    let globalIndex = 0;

    for (const section of sections) {
      const sectionWords = section.split(/\s+/).filter(Boolean).length;

      if (sectionWords <= maxChunkWords) {
        // Section fits in one chunk
        const content = mergeShortLines(section).trim();
        if (content.length > 20) {
          globalIndex++;
          allChunks.push({
            id: `chunk_${globalIndex}`,
            index: globalIndex,
            content,
            wordCount: content.split(/\s+/).filter(Boolean).length,
            tokens: tokenize(content),
            tf: computeTf(tokenize(content)),
            isSection: true,
          });
        }
      } else {
        // Section too large — sub-chunk it with paragraph split
        const subChunks = chunkText(section, maxChunkWords);
        for (const sc of subChunks) {
          globalIndex++;
          allChunks.push({ ...sc, id: `chunk_${globalIndex}`, index: globalIndex, isSection: false });
        }
      }
    }

    if (allChunks.length > 0) return allChunks;
  }

  // Fallback: standard paragraph-based chunking with short-line merging already applied
  return chunkText(text, maxChunkWords);
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
  semanticChunk,
  retrieveRelevantChunks,
  tokenize,
  cosineSimilarity,
  mergeShortLines,
};
