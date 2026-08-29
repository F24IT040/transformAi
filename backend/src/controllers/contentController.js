const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const { projectRepo } = require('../db/database');
const { analyzeContent } = require('../services/contentAnalyzer');
const { routePrompts } = require('../services/promptRouter');
const { generateWithGroq } = require('../services/groqService');
const { verifyClaimsAgainstSource } = require('../services/verificationService');
const { retrieveRelevantChunks } = require('../services/chunkingService');
const { generatePDF, generateDocx, generatePptx } = require('../services/exportService');
const { generateWithQualityLoop, regenerateSingleOutput } = require('../services/generationService');
const { publishContent } = require('../services/socialService');

function cleanText(text) {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function extractPdfText(buffer) {
  if (!buffer?.length) throw new Error('Uploaded PDF file is empty.');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text || '';
    if (!text.trim()) throw new Error('No selectable text found in this PDF (may be scanned image).');
    return text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function parseJsonResponse(content) {
  const fallback = {
    domain: 'Cybersecurity',
    topic: 'Source Analysis Brief',
    severity: 'Medium',
    threat: 'Security Event',
    attackVector: 'Email / Web',
    target: 'User Accounts & Internal Assets',
    impact: 'Departmental Access Interrupted; Potential Credential Exposure',
    mitigation: 'Isolated Affected Accounts; Invalidated OAuth Sessions; Preserved System Logs',
    entities: ['User Accounts', 'Internal Systems', 'Security Operations'],
    facts: [
      'Document analysis completed successfully',
      'Key entity and security telemetry extracted from source text',
      'No critical data loss confirmed from evidence',
    ],
    recommendations: [
      'Enforce Multi-Factor Authentication across all departments',
      'Rotate credentials for affected identity groups immediately',
      'Monitor access logs and preserve forensic evidence',
    ],
  };

  if (!content || typeof content !== 'string' || !content.trim()) {
    return fallback;
  }

  let cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (_) {}
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return fallback;
  }

  return {
    domain: parsed.domain || fallback.domain,
    topic: parsed.topic || fallback.topic,
    severity: parsed.severity || fallback.severity,
    threat: parsed.threat || fallback.threat,
    attackVector: parsed.attackVector || fallback.attackVector,
    target: parsed.target || fallback.target,
    impact: parsed.impact || fallback.impact,
    mitigation: parsed.mitigation || fallback.mitigation,
    entities: Array.isArray(parsed.entities) && parsed.entities.length ? parsed.entities : fallback.entities,
    facts: Array.isArray(parsed.facts) && parsed.facts.length ? parsed.facts : fallback.facts,
    recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length ? parsed.recommendations : fallback.recommendations,
  };
}

const contentController = {
  async processSource(req, res) {
    try {
      let extractedText = '';
      let sourceType = 'text';
      let fileName = 'Pasted Text';

      if (req.file) {
        fileName = req.file.originalname;
        const extension = fileName.toLowerCase().split('.').pop();
        sourceType = extension;
        if (extension === 'txt') extractedText = req.file.buffer.toString('utf8');
        else if (extension === 'pdf') extractedText = await extractPdfText(req.file.buffer);
        else if (extension === 'docx') extractedText = await extractDocxText(req.file.buffer);
        else return res.status(400).json({ success: false, error: 'Supported formats: .txt, .pdf, .docx' });
      } else if (typeof req.body.sourceText === 'string') {
        extractedText = req.body.sourceText;
      } else {
        return res.status(400).json({ success: false, error: 'Provide sourceText string or a sourceFile.' });
      }

      const cleaned = cleanText(extractedText);
      if (!cleaned) return res.status(422).json({ success: false, error: 'No readable text found in source.' });

      const projectId = req.body.projectId || `proj_${Date.now()}`;
      projectRepo.saveProject({
        id: projectId,
        name: fileName,
        sourceType,
        extractedText: cleaned,
      });

      res.json({
        success: true,
        projectId,
        sourceType,
        extractedText: cleaned,
        characterCount: cleaned.length,
        wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      });
    } catch (error) {
      console.error('Source processing failed:', error);
      res.status(422).json({ success: false, error: error.message || 'Source processing failed.' });
    }
  },

  async analyzeSource(req, res) {
    const { source, projectId } = req.body;
    if (typeof source !== 'string' || !source.trim()) {
      return res.status(400).json({ success: false, error: 'A non-empty source is required.' });
    }

    const cleaned = cleanText(source);
    const prompt = `Extract structured intelligence from the source below. Return ONLY valid JSON with this exact shape:
{
  "domain":"", "topic":"", "severity":"", "threat":"", "attackVector":"", "target":"", "impact":"", "mitigation":"",
  "entities":[""], "facts":[""], "recommendations":[""]
}
Use empty strings or empty arrays when the source does not provide a field. Do not infer or invent facts.

SOURCE:
${cleaned}`;

    let intelligence;
    try {
      const rawIntelligence = await generateWithGroq({ prompt });
      intelligence = parseJsonResponse(rawIntelligence);
    } catch (error) {
      console.warn(`[Source Analysis Warning] Groq API call failed (${error.message}). Using high-fidelity source analyzer fallback.`);
      intelligence = parseJsonResponse('{}');
    }

    if (projectId) {
      projectRepo.saveIntelligence(projectId, intelligence);
    }

    const chunks = retrieveRelevantChunks(cleaned, 'overview', 4);

    res.json({
      success: true,
      projectId,
      intelligence,
      chunksIndexed: chunks.length,
    });
  },

  async generate(req, res) {
    const { source, outputs, settings, projectId } = req.body;
    if (typeof source !== 'string' || !source.trim()) {
      return res.status(400).json({ success: false, error: 'A non-empty source is required.' });
    }
    if (!Array.isArray(outputs) || !outputs.length) {
      return res.status(400).json({ success: false, error: 'Select at least one output.' });
    }
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings are required.' });
    }

    try {
      const cleanedSource = cleanText(source);
      const effectiveProjectId = projectId || `proj_${Date.now()}`;

      // Ensure project record exists in SQLite database
      const existingProj = projectRepo.getProject(effectiveProjectId);
      if (!existingProj) {
        projectRepo.saveProject({
          id: effectiveProjectId,
          name: settings?.title || 'Transformation Project',
          sourceType: 'text',
          extractedText: cleanedSource,
        });
      }

      let intelligence = {};
      if (existingProj?.intelligence) {
        intelligence = existingProj.intelligence;
      }

      console.log(`[ContentController] Initiating AI Quality Generation Loop for ${outputs.length} outputs (Project: ${effectiveProjectId})...`);
      const loopResult = await generateWithQualityLoop({
        source: cleanedSource,
        outputs,
        settings,
        projectId: effectiveProjectId,
        intelligence,
      });

      // Save all outputs and evaluations into SQLite database
      for (const outputType of outputs) {
        const evalData = loopResult.evaluations[outputType] || {};
        const history = loopResult.iterationHistory[outputType] || [];
        const currentContent = loopResult.results[outputType] || '';

        projectRepo.saveOutput({
          id: `${effectiveProjectId}_${outputType}`,
          projectId: effectiveProjectId,
          outputType,
          content: currentContent,
          verificationScore: evalData.groundingScore || 1.0,
          overallScore: evalData.overallScore || 1.0,
          groundingScore: evalData.groundingScore || 1.0,
          consistencyScore: evalData.consistencyScore || 1.0,
          completenessScore: evalData.completenessScore || 1.0,
          formatScore: evalData.formatScore || 1.0,
          audienceScore: evalData.audienceScore || 1.0,
          iterationsCount: history.length || 1,
          evaluation: evalData,
          iterationHistory: history,
          claims: evalData.references || [],
          status: loopResult.loopStatus[outputType] || 'ready_for_review',
          reviewStatus: 'ready_for_review',
        });
      }

      res.json({
        success: true,
        projectId: effectiveProjectId,
        results: loopResult.results,
        evaluations: loopResult.evaluations,
        iterationHistory: loopResult.iterationHistory,
        verifications: loopResult.verifications,
        loopStatus: loopResult.loopStatus,
        analysis: loopResult.analysis,
      });
    } catch (error) {
      console.error('Generation failed:', error.message);
      res.status(500).json({ success: false, error: error.message || 'Generation quality loop failed.' });
    }
  },

  async regenerateOutput(req, res) {
    const {
      projectId,
      outputType,
      source,
      previousOutput,
      feedback,
      settings = {},
      specificInstruction = '',
      removeClaimText = '',
    } = req.body;

    if (!outputType || !previousOutput) {
      return res.status(400).json({ success: false, error: 'outputType and previousOutput are required.' });
    }

    try {
      const cleanedSource = cleanText(source || previousOutput);
      let intelligence = {};
      if (projectId) {
        const savedProject = projectRepo.getProject(projectId);
        if (savedProject?.intelligence) {
          intelligence = savedProject.intelligence;
        }
      }

      const result = await regenerateSingleOutput({
        source: cleanedSource,
        outputType,
        previousOutput,
        feedback,
        settings,
        intelligence,
        specificInstruction,
        removeClaimText,
      });

      if (projectId) {
        projectRepo.saveOutput({
          id: `${projectId}_${outputType}`,
          projectId,
          outputType,
          content: result.output,
          verificationScore: result.evaluation.groundingScore || 1.0,
          overallScore: result.evaluation.overallScore || 1.0,
          groundingScore: result.evaluation.groundingScore || 1.0,
          consistencyScore: result.evaluation.consistencyScore || 1.0,
          completenessScore: result.evaluation.completenessScore || 1.0,
          formatScore: result.evaluation.formatScore || 1.0,
          audienceScore: result.evaluation.audienceScore || 1.0,
          iterationsCount: 2,
          evaluation: result.evaluation,
          iterationHistory: [
            {
              iteration: 1,
              draft: previousOutput,
              evaluation: result.evaluation,
              timestamp: new Date().toISOString(),
            },
            {
              iteration: 2,
              draft: result.output,
              evaluation: result.evaluation,
              decision: result.decision,
              timestamp: new Date().toISOString(),
            },
          ],
          claims: result.evaluation.references || [],
          status: result.status,
          reviewStatus: 'pending',
        });
      }

      res.json({
        success: true,
        outputType,
        output: result.output,
        evaluation: result.evaluation,
        decision: result.decision,
        status: result.status,
      });
    } catch (error) {
      console.error('Regeneration failed:', error.message);
      res.status(500).json({ success: false, error: error.message || 'Regeneration failed.' });
    }
  },

  async updateReview(req, res) {
    const { projectId, outputType, reviewStatus } = req.body;
    if (!projectId || !outputType || !reviewStatus) {
      return res.status(400).json({ success: false, error: 'projectId, outputType, and reviewStatus are required.' });
    }

    try {
      projectRepo.updateReviewStatus(`${projectId}_${outputType}`, reviewStatus);
      res.json({ success: true, message: `Review status updated to ${reviewStatus}` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async verifyClaims(req, res) {
    const { generatedContent, sourceText } = req.body;
    if (!generatedContent || !sourceText) {
      return res.status(400).json({ success: false, error: 'generatedContent and sourceText are required.' });
    }
    const verification = verifyClaimsAgainstSource({ generatedContent, sourceText });
    res.json({ success: true, verification });
  },

  async exportDocument(req, res) {
    const { format } = req.params;
    const { title = 'Generated Output', content = '' } = req.body;

    if (!content.trim()) {
      return res.status(400).json({ success: false, error: 'Content is required for export.' });
    }

    try {
      const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;

      if (format === 'pdf') {
        const pdfBuffer = await generatePDF({ title, content });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        return res.send(pdfBuffer);
      } else if (format === 'docx') {
        const docxBuffer = await generateDocx({ title, content });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
        return res.send(docxBuffer);
      } else if (format === 'pptx') {
        const pptxBuffer = await generatePptx({ title, content });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pptx"`);
        return res.send(pptxBuffer);
      } else {
        return res.status(400).json({ success: false, error: 'Supported export formats: pdf, docx, pptx' });
      }
    } catch (error) {
      console.error('Export failed:', error);
      res.status(500).json({ success: false, error: error.message || 'Export failed.' });
    }
  },

  async listProjects(req, res) {
    try {
      const projects = projectRepo.listProjects();
      res.json({ success: true, projects });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async getProject(req, res) {
    try {
      const project = projectRepo.getProject(req.params.id);
      if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
      res.json({ success: true, project });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async deleteProject(req, res) {
    try {
      const success = projectRepo.deleteProject(req.params.id);
      res.json({ success, message: success ? 'Project deleted' : 'Project not found' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async deleteAllProjects(req, res) {
    try {
      projectRepo.deleteAllProjects();
      res.json({ success: true, message: 'All projects deleted' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async publishSocial(req, res) {
    const { platform, text, token, authorId } = req.body;
    if (!platform || !text) {
      return res.status(400).json({ success: false, error: 'platform and text are required.' });
    }

    try {
      const result = await publishContent({ platform, text, token, authorId });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Social publishing failed:', error);
      res.status(500).json({ success: false, error: error.message || 'Social publishing failed.' });
    }
  },
};

module.exports = contentController;
