const executiveSummary = require('../prompts/executiveSummary');
const linkedin = require('../prompts/linkedin');
const advisory = require('../prompts/advisory');
const presentation = require('../prompts/presentation');
const twitter = require('../prompts/twitter');
const infographic = require('../prompts/infographic');
const videoPackage = require('../prompts/generation/videoPackage');
const regeneration = require('../prompts/generation/regeneration');
const { retrieveRelevantChunks } = require('./chunkingService');

const promptTemplates = {
  executive_summary: executiveSummary,
  linkedin,
  advisory,
  presentation,
  twitter,
  infographic,
  video_package: videoPackage,
  regeneration,
};

function routePrompts({ source, outputs, settings, analysis }) {
  return outputs.map(output => {
    const template = promptTemplates[output];
    if (!template) {
      throw new Error(`Unsupported output format requested: ${output}`);
    }

    // Retrieve relevant semantic source chunks for RAG context
    const chunks = retrieveRelevantChunks(source, output, 4);

    return {
      output,
      prompt: template({ source, settings, analysis, chunks }),
    };
  });
}

module.exports = { routePrompts, promptTemplates };

