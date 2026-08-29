function analyzeContent(source) {
  const paragraphs = source.split(/\n\s*\n/).filter(Boolean);
  const sentences = source.match(/[^.!?]+[.!?]+/g) || [];
  return {
    wordCount: source.trim().split(/\s+/).filter(Boolean).length,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
  };
}

module.exports = { analyzeContent };
