/**
 * Intelligent Chunker — Page-Aware, Token-Budget Semantic Chunking
 *
 * Designed for long intelligence reports (20–30 pages).
 * Produces chunks of 2000–4000 tokens with 10–15% overlap,
 * respecting heading/paragraph/sentence boundaries and tracking page ranges.
 */

const crypto = require('crypto');

// Approximate: 1 token ≈ 0.75 words (conservative estimate for English)
const WORDS_PER_TOKEN = 0.75;
const DEFAULT_MIN_TOKENS = 2000;
const DEFAULT_MAX_TOKENS = 4000;
const OVERLAP_RATIO = 0.12; // 12% overlap

/**
 * Estimate token count from word count.
 */
function estimateTokens(text) {
  const wordCount = (text || '').split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount / WORDS_PER_TOKEN);
}

/**
 * Detect if a line is a heading.
 */
function isHeading(line) {
  const trimmed = line.trim();
  if (/^#{1,6}\s/.test(trimmed)) return true;
  if (/^[A-Z][A-Z\s&:–\-]{4,}$/.test(trimmed) && trimmed.length < 100) return true;
  if (/^\d+\.\d*\s+[A-Z]/.test(trimmed)) return true; // Numbered section: 1.0 TITLE
  return false;
}

/**
 * Detect section heading text (for labeling chunks).
 */
function extractSectionName(line) {
  const trimmed = line.trim();
  return trimmed
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\d+\.\d*\s*/, '')
    .replace(/\*+/g, '')
    .trim();
}

/**
 * Split text into sentence-like segments without breaking mid-sentence.
 */
function splitIntoSentences(text) {
  return text.split(/(?<=[.?!;])\s+/).filter(s => s.trim().length > 0);
}

/**
 * Build page-aware text blocks from pageData.
 *
 * @param {Array<{ page: number, section: string, text: string }>} pageData
 * @returns {Array<{ text: string, page: number, section: string }>} - paragraph-level blocks with page info
 */
function buildPageBlocks(pageData) {
  const blocks = [];

  for (const page of pageData) {
    const paragraphs = page.text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    for (const para of paragraphs) {
      const lines = para.split('\n').filter(l => l.trim().length > 0);

      for (const line of lines) {
        if (isHeading(line)) {
          // Heading gets its own block for boundary detection
          blocks.push({
            text: line.trim(),
            page: page.page,
            section: extractSectionName(line),
            isHeading: true,
          });
        } else {
          blocks.push({
            text: line.trim(),
            page: page.page,
            section: page.section || '',
            isHeading: false,
          });
        }
      }
    }
  }

  return blocks;
}

/**
 * Build page blocks from raw text (when pageData is not available).
 */
function buildPageBlocksFromRawText(rawText) {
  const lines = rawText.split('\n');
  return lines
    .filter(l => l.trim().length > 0)
    .map((line, idx) => ({
      text: line.trim(),
      page: 1, // Unknown page
      section: '',
      isHeading: isHeading(line),
    }));
}

/**
 * Main chunking function.
 *
 * @param {object} opts
 * @param {Array<{ page: number, section: string, text: string }>} [opts.pageData] - Page-aware data
 * @param {string} [opts.rawText] - Fallback: plain text
 * @param {number} [opts.minTokens=2000]
 * @param {number} [opts.maxTokens=4000]
 * @returns {Array<{ chunk_id: string, index: number, start_page: number, end_page: number, section: string, text: string, word_count: number, estimated_tokens: number, content_hash: string }>}
 */
function intelligentChunk({
  pageData,
  rawText = '',
  minTokens = DEFAULT_MIN_TOKENS,
  maxTokens = DEFAULT_MAX_TOKENS,
} = {}) {
  // Build blocks
  const blocks = pageData && pageData.length > 0
    ? buildPageBlocks(pageData)
    : buildPageBlocksFromRawText(rawText);

  if (blocks.length === 0) return [];

  const chunks = [];
  let currentBlocks = [];
  let currentTokens = 0;
  let currentStartPage = blocks[0].page;
  let currentSection = '';
  let chunkIndex = 0;

  function flushChunk() {
    if (currentBlocks.length === 0) return;

    chunkIndex++;
    const text = currentBlocks.map(b => b.text).join('\n');
    const endPage = currentBlocks[currentBlocks.length - 1].page;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const hash = crypto.createHash('sha256').update(text).digest('hex');

    chunks.push({
      chunk_id: `chunk_${String(chunkIndex).padStart(2, '0')}`,
      index: chunkIndex,
      start_page: currentStartPage,
      end_page: endPage,
      section: currentSection || currentBlocks.find(b => b.section)?.section || '',
      text,
      word_count: wordCount,
      estimated_tokens: estimateTokens(text),
      content_hash: hash,
    });
  }

  function getOverlapBlocks() {
    if (currentBlocks.length === 0) return [];

    // Take ~12% of current chunk tokens as overlap
    const overlapTokenTarget = Math.floor(currentTokens * OVERLAP_RATIO);
    const overlap = [];
    let overlapTokens = 0;

    // Take from end of current blocks
    for (let i = currentBlocks.length - 1; i >= 0; i--) {
      const blockTokens = estimateTokens(currentBlocks[i].text);
      if (overlapTokens + blockTokens > overlapTokenTarget && overlap.length > 0) break;
      overlap.unshift(currentBlocks[i]);
      overlapTokens += blockTokens;
    }

    return overlap;
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockTokens = estimateTokens(block.text);

    // Check if adding this block would exceed max tokens
    if (currentTokens + blockTokens > maxTokens && currentTokens >= minTokens) {
      // Current chunk is full — flush it
      const overlap = getOverlapBlocks();
      flushChunk();

      // Start new chunk with overlap
      currentBlocks = [...overlap];
      currentTokens = overlap.reduce((sum, b) => sum + estimateTokens(b.text), 0);
      currentStartPage = overlap.length > 0 ? overlap[0].page : block.page;
      currentSection = '';
    }

    // If this block is a heading and we have accumulated enough content, prefer to break here
    if (block.isHeading && currentTokens >= minTokens) {
      const overlap = getOverlapBlocks();
      flushChunk();

      currentBlocks = [...overlap];
      currentTokens = overlap.reduce((sum, b) => sum + estimateTokens(b.text), 0);
      currentStartPage = overlap.length > 0 ? overlap[0].page : block.page;
      currentSection = block.section || '';
    }

    // Track section name
    if (block.isHeading && block.section) {
      currentSection = block.section;
    }

    currentBlocks.push(block);
    currentTokens += blockTokens;

    if (currentBlocks.length === 1) {
      currentStartPage = block.page;
    }
  }

  // Flush remaining blocks
  if (currentBlocks.length > 0) {
    // If remaining is too small, merge with previous chunk if possible
    if (currentTokens < minTokens / 2 && chunks.length > 0) {
      // Append to previous chunk
      const prev = chunks[chunks.length - 1];
      const mergedText = prev.text + '\n' + currentBlocks.map(b => b.text).join('\n');
      const mergedWordCount = mergedText.split(/\s+/).filter(Boolean).length;
      prev.text = mergedText;
      prev.end_page = currentBlocks[currentBlocks.length - 1].page;
      prev.word_count = mergedWordCount;
      prev.estimated_tokens = estimateTokens(mergedText);
      prev.content_hash = crypto.createHash('sha256').update(mergedText).digest('hex');
    } else {
      flushChunk();
    }
  }

  console.log(`[IntelligentChunker] Produced ${chunks.length} chunks from ${blocks.length} blocks`);
  return chunks;
}

module.exports = {
  intelligentChunk,
  estimateTokens,
  isHeading,
  buildPageBlocks,
  OVERLAP_RATIO,
};
