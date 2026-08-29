const express = require('express');
const multer = require('multer');
const contentController = require('../controllers/contentController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const extension = file.originalname.toLowerCase().match(/\.(pdf|docx|txt)$/)?.[1];
    callback(null, allowed.includes(file.mimetype) || Boolean(extension));
  },
});

// Source Processing & Intelligence
router.post('/process-source', upload.single('sourceFile'), contentController.processSource);
router.post('/analyze-source', contentController.analyzeSource);

// Content Generation, Iterative Quality Loop & Claim Verification
router.post('/generate', contentController.generate);
router.post('/regenerate-output', contentController.regenerateOutput);
router.post('/review-status', contentController.updateReview);
router.post('/verify-claims', contentController.verifyClaims);

// Binary Document Export (PDF, DOCX, PPTX) & Social Publishing
router.post('/export/:format', contentController.exportDocument);
router.post('/publish-social', contentController.publishSocial);

// Project History & Persistence
router.get('/projects', contentController.listProjects);
router.get('/projects/:id', contentController.getProject);
router.delete('/projects/:id', contentController.deleteProject);
router.delete('/projects', contentController.deleteAllProjects);

module.exports = router;
