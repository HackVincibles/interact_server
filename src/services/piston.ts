import axios, { AxiosError } from 'axios';
import { 
  PistonExecuteRequest, 
  PistonResponse, 
  CodeExecutionRequest, 
  CodeExecutionResult,
  LANGUAGE_MAPPINGS 
} from '../types';

const PISTON_API_URL = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

// Create axios instance for Piston API
const pistonClient = axios.create({
  baseURL: PISTON_API_URL,
  headers: {
    'content-type': 'application/json'
  },
  timeout: 30000 // 30 seconds timeout
});

/**
 * Get Piston language mapping from internal language identifier
 */
export const getPistonMapping = (language: string) => {
  return LANGUAGE_MAPPINGS.find(lang => lang.id === language);
};

/**
 * Get all supported languages
 */
export const getSupportedLanguages = () => {
  return LANGUAGE_MAPPINGS.map(({ id, label }) => ({ id, label }));
};

/**
 * Submit code to Piston for execution
 */
export const submitCode = async (
  request: CodeExecutionRequest
): Promise<CodeExecutionResult> => {
  try {
    const mapping = getPistonMapping(request.language);
    
    if (!mapping) {
      return {
        success: false,
        output: '',
        error: `Unsupported language: ${request.language}`,
        status: 'error'
      };
    }

    const executeRequest: PistonExecuteRequest = {
      language: mapping.pistonLanguage,
      version: mapping.pistonVersion,
      files: [
        {
          content: request.code
        }
      ],
      stdin: request.stdin || ''
    };

    // Execute code using Piston
    const executeResponse = await pistonClient.post('/execute', executeRequest);
    const result: PistonResponse = executeResponse.data;

    // Process the result
    return processPistonResult(result);

  } catch (error) {
    console.error('Piston execution error:', error);
    
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          output: '',
          error: 'Request timed out. Code execution took too long.',
          status: 'timeout'
        };
      }
      
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.message;
        
        if (status === 429) {
          return {
            success: false,
            output: '',
            error: 'Rate limit exceeded. Please try again later.',
            status: 'rate_limited'
          };
        }
        
        return {
          success: false,
          output: '',
          error: `API Error (${status}): ${message}`,
          status: 'api_error'
        };
      }
    }

    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 'error'
    };
  }
};

/**
 * Process Piston response into a standardized result
 */
const processPistonResult = (result: PistonResponse): CodeExecutionResult => {
  const { run, compile } = result;
  
  // If there was a compilation and it failed, use that error
  if (compile && compile.code !== 0 && compile.code !== null) {
    return {
      success: false,
      output: '',
      error: compile.stderr || compile.output || 'Compilation error occurred',
      status: 'Compilation Error',
      exitCode: compile.code,
      compileOutput: compile.output
    };
  }

  // Check for runtime success
  const isSuccessful = run.code === 0;
  
  return {
    success: isSuccessful,
    output: run.stdout.trim(),
    error: run.stderr ? run.stderr.trim() : undefined,
    status: isSuccessful ? 'Accepted' : 'Runtime Error',
    exitCode: run.code,
    compileOutput: compile ? compile.output : undefined
  };
};

/**
 * Get language name by ID
 */
export const getLanguageName = (languageId: string): string => {
  const mapping = getPistonMapping(languageId);
  return mapping ? mapping.label : languageId;
};
