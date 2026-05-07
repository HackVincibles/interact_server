import { Router } from 'express';
import { submitCode, getSupportedLanguages, getLanguageName } from '../services/piston';
import { CodeExecutionRequest } from '../types';

const router = Router();

/**
 * POST /api/execute
 * Execute code using Piston API
 */
router.post('/', async (req, res) => {
  try {
    const { code, language, stdin, expectedOutput }: CodeExecutionRequest = req.body;

    // Validate request
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code is required and must be a string'
      });
    }

    if (!language || typeof language !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Language is required and must be a string'
      });
    }

    // Check code length (prevent abuse)
    if (code.length > 100000) {
      return res.status(400).json({
        success: false,
        error: 'Code exceeds maximum length of 100,000 characters'
      });
    }

    console.log(`[Execute] ${getLanguageName(language)} - Code length: ${code.length} chars`);

    // Submit code for execution
    const result = await submitCode({
      code,
      language,
      stdin,
      expectedOutput
    });

    console.log(`[Execute] Result: ${result.status} (${result.success ? 'success' : 'failed'})`);

    return res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('Code execution route error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during code execution'
    });
  }
});

/**
 * GET /api/execute/languages
 * Get list of supported languages
 */
router.get('/languages', (_req, res) => {
  try {
    const languages = getSupportedLanguages();
    return res.status(200).json({
      success: true,
      languages
    });
  } catch (error) {
    console.error('Get languages error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported languages'
    });
  }
});

/**
 * POST /api/execute/run
 * Alias for POST / (more RESTful naming)
 */
router.post('/run', async (req, res) => {
  // Forward to the main execute handler
  try {
    const { language, code, stdin, expectedOutput } = req.body;
    
    // Validate request
    if (!language || !code) {
      return res.status(400).json({
        success: false,
        error: 'Language and code are required',
      });
    }

    // Check code length (prevent abuse)
    if (code.length > 100000) {
      return res.status(400).json({
        success: false,
        error: 'Code exceeds maximum length of 100,000 characters'
      });
    }

    console.log(`[Execute/Run] ${getLanguageName(language)} - Code length: ${code.length} chars`);

    // Execute code using the same logic as the main handler
    const result = await submitCode({
      code,
      language,
      stdin,
      expectedOutput
    });
    
    console.log(`[Execute/Run] Result: ${result.status} (${result.success ? 'success' : 'failed'})`);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Code execution error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during code execution'
    });
  }
});

export default router;
