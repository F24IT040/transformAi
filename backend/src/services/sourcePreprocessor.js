/**
 * Source Preprocessor
 *
 * Stage A of the two-stage pipeline.
 * Cleans raw PDF/document text before it reaches the chunker or LLM.
 *
 * Operations:
 *  1. Strip page numbers, headers, footers, and layout artifacts
 *  2. Remove boilerplate / disclaimer sentences
 *  3. Join broken sentence fragments across line breaks
 *  4. Normalize bullet characters and whitespace
 *  5. Collapse consecutive blank lines
 */

// ─── Patterns to strip outright ──────────────────────────────────────────────

/** Lines that are ONLY noise: page numbers, separators, standalone numbers */
const STRIP_LINE_PATTERNS = [
  /^--\s*\d+\s*of\s*\d+\s*--\s*$/i,          // -- 1 of 10 --
  /^page\s+\d+\s*(of\s+\d+)?\s*$/i,           // Page 1 / Page 1 of 10
  /^\d+\.?\s*$/,                               // Standalone digit(s) or '1.'
  /^[-─═=*·•]{3,}\s*$/,                        // Separator lines --- ===
  /^(figure|table|chart|appendix)\s+\d+/i,     // Figure 1, Table 2
  /^\[\s*\d+\s*\]$/,                           // [1] reference-only lines
  /\bPage\s+\d+\s*$/i,                         // Heading trailing '...Page 2'
];

/**
 * Standalone section-label lines: single words/phrases that are ONLY structural
 * headers with no substantive content. Only stripped when they appear alone on a line.
 */
const STANDALONE_SECTION_LABELS = new Set([
  'situation',
  'key findings',
  'findings',
  'operational impact',
  'recommendations',
  'current status',
  'status',
  'impact',
  'summary',
  'executive summary',
  'background',
  'overview',
  'introduction',
  'conclusion',
  'actions',
  'actions taken',
]);

function isStandaloneSectionLabel(line) {
  return STANDALONE_SECTION_LABELS.has(line.trim().toLowerCase());
}

/** Sentence-level boilerplate patterns: matched against the full sentence text */
const BOILERPLATE_SENTENCE_PATTERNS = [
  /this report does not claim/i,
  /does not include.*confidential/i,
  /may remain confidential/i,
  /confidential incident records?/i,
  /approved for operator review/i,
  /primary findings directly supported/i,
  /factual claims? verified across/i,
  /quality of content/i,
  /analyzed,?\s+verified against source/i,
  /not based on.*confidential/i,
  /does not provide.*confidential/i,
  /access to confidential/i,
  /source intelligence\./i,
  /operational scope\./i,
];

/** Bullet / special characters to normalize to "- " */
const BULLET_CHARS = /^[\s]*[•·–—▶►▸‣⁃]\s*/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNoiseOnlyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return STRIP_LINE_PATTERNS.some(p => p.test(trimmed));
}

function isBoilerplate(sentence) {
  return BOILERPLATE_SENTENCE_PATTERNS.some(p => p.test(sentence));
}

/**
 * Detect repeated header/footer lines that appear multiple times in the doc.
 * Returns a Set of lowercased lines that appear more than once and are short
 * enough to be headers (< 80 chars).
 */
function detectRepeatedLines(lines) {
  const freq = {};
  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (key.length > 0 && key.length < 80) {
      freq[key] = (freq[key] || 0) + 1;
    }
  }
  const repeated = new Set();
  for (const [key, count] of Object.entries(freq)) {
    if (count >= 2) repeated.add(key);
  }
  return repeated;
}

/**
 * Join consecutive fragment lines into coherent sentences.
 *
 * A line is a fragment if it ends without terminal punctuation (.?!:)
 * and the next line starts with a lowercase letter, a conjunction, or
 * a bullet continuation.
 */
function joinFragments(lines) {
  const joined = [];
  let buffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // Blank line: flush buffer and emit blank
      if (buffer) {
        joined.push(buffer.trim());
        buffer = '';
      }
      joined.push('');
      continue;
    }

    // Normalize bullet chars first
    const normalized = trimmed.replace(BULLET_CHARS, '').trim();

    if (!buffer) {
      buffer = normalized;
    } else {
      // Check if the current buffer-end is a fragment (no terminal punctuation)
      const lastChar = buffer[buffer.length - 1];
      const endsWithTerminator = /[.?!;:]\s*$/.test(buffer);

      // Next line starts lowercase or starts with a continuation word → fragment
      const nextStartsLower = /^[a-z]/.test(normalized);
      const nextStartsConjunction = /^(and|or|but|nor|so|yet|for|because|since|although|though|while|as|if|unless|until|when|where|which|who|whom|that|this|these|those|access|to|of|in|on|at|with|from|by)\b/i.test(normalized);

      if (!endsWithTerminator && (nextStartsLower || nextStartsConjunction)) {
        // Fragment continuation — join with a space
        buffer = buffer + ' ' + normalized;
      } else {
        // Complete line — flush buffer and start new
        joined.push(buffer.trim());
        buffer = normalized;
      }
    }
  }

  if (buffer) joined.push(buffer.trim());

  return joined;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Preprocesses raw source text before chunking or LLM ingestion.
 *
 * @param {string} rawText - Raw document text (e.g. from PDF extraction)
 * @returns {{ cleanText: string, stats: Object }}
 */
function preprocessSource(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: '', stats: { removedLines: 0, joinedFragments: 0, boilerplateRemoved: 0 } };
  }

  const originalLines = rawText.replace(/\r\n/g, '\n').split('\n');
  let removedLines = 0;
  let boilerplateRemoved = 0;

  // 1. Detect repeated header/footer lines
  const repeatedLines = detectRepeatedLines(originalLines);

  // 2. First pass: strip noise-only lines and repeated headers
  const firstPass = [];
  for (const line of originalLines) {
    const trimmed = line.trim();

    if (isNoiseOnlyLine(trimmed)) {
      removedLines++;
      continue;
    }

    if (trimmed.length < 80 && repeatedLines.has(trimmed.toLowerCase())) {
      removedLines++;
      continue;
    }

    // Strip standalone structural section labels (no content, just a heading word)
    if (isStandaloneSectionLabel(trimmed)) {
      removedLines++;
      continue;
    }

    // Normalize bullet chars in non-noise lines
    const normalized = trimmed.replace(BULLET_CHARS, '- ');
    firstPass.push(normalized);
  }

  // 3. Join sentence fragments across line breaks
  const fragmentsBefore = firstPass.length;
  const secondPass = joinFragments(firstPass);
  const joinedFragments = Math.max(0, fragmentsBefore - secondPass.filter(l => l.trim()).length);

  // 4. Third pass: remove boilerplate sentences
  const thirdPass = [];
  for (const line of secondPass) {
    const trimmed = line.trim();

    if (!trimmed) {
      thirdPass.push('');
      continue;
    }

    // Check if line (now a full sentence) is boilerplate
    if (isBoilerplate(trimmed)) {
      boilerplateRemoved++;
      continue;
    }

    thirdPass.push(trimmed);
  }

  // 5. Collapse multiple consecutive blank lines into a single blank line
  const finalLines = [];
  let lastWasBlank = false;
  for (const line of thirdPass) {
    const isBlank = !line.trim();
    if (isBlank && lastWasBlank) continue;
    finalLines.push(line);
    lastWasBlank = isBlank;
  }

  const cleanText = finalLines.join('\n').trim();

  return {
    cleanText,
    stats: {
      originalLines: originalLines.length,
      removedLines,
      joinedFragments,
      boilerplateRemoved,
      finalLines: finalLines.length,
    },
  };
}

/**
 * Filter an array of extracted sentences to remove boilerplate.
 * Useful for the fallback `extractSourceHighlights` path.
 *
 * @param {string[]} sentences
 * @returns {string[]}
 */
function filterBoilerplateSentences(sentences) {
  return sentences.filter(s => {
    if (!s || s.trim().length < 20) return false;
    if (isBoilerplate(s)) return false;
    return true;
  });
}

module.exports = {
  preprocessSource,
  filterBoilerplateSentences,
  isBoilerplate,
  joinFragments,
};
