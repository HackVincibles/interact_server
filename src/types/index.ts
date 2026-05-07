// Piston API Types
export interface PistonFile {
  name?: string;
  content: string;
  encoding?: string;
}

export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: PistonFile[];
  stdin?: string;
  args?: string[];
  compile_timeout?: number;
  run_timeout?: number;
  compile_memory_limit?: number;
  run_memory_limit?: number;
}

export interface PistonExecutionResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  output: string;
}

export interface PistonResponse {
  language: string;
  version: string;
  run: PistonExecutionResult;
  compile?: PistonExecutionResult;
}

export interface CodeExecutionRequest {
  code: string;
  language: string;
  stdin?: string;
  expectedOutput?: string;
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime?: string;
  memory?: number;
  status: string;
  exitCode?: number | null;
  compileOutput?: string;
}

// Language mapping for Piston
export interface LanguageMapping {
  id: string;
  label: string;
  pistonLanguage: string;
  pistonVersion: string;
}

export const LANGUAGE_MAPPINGS: LanguageMapping[] = [
  { id: 'javascript', label: 'JavaScript', pistonLanguage: 'javascript', pistonVersion: '18.15.0' },
  { id: 'typescript', label: 'TypeScript', pistonLanguage: 'typescript', pistonVersion: '5.0.3' },
  { id: 'python', label: 'Python', pistonLanguage: 'python', pistonVersion: '3.10.0' },
  { id: 'java', label: 'Java', pistonLanguage: 'java', pistonVersion: '15.0.2' },
  { id: 'cpp', label: 'C++', pistonLanguage: 'c++', pistonVersion: '10.2.0' },
  { id: 'c', label: 'C', pistonLanguage: 'c', pistonVersion: '10.2.0' },
  { id: 'csharp', label: 'C#', pistonLanguage: 'csharp', pistonVersion: '6.12.0' },
  { id: 'go', label: 'Go', pistonLanguage: 'go', pistonVersion: '1.16.2' },
  { id: 'rust', label: 'Rust', pistonLanguage: 'rust', pistonVersion: '1.68.2' },
  { id: 'php', label: 'PHP', pistonLanguage: 'php', pistonVersion: '8.2.3' },
  { id: 'ruby', label: 'Ruby', pistonLanguage: 'ruby', pistonVersion: '3.0.1' },
  { id: 'swift', label: 'Swift', pistonLanguage: 'swift', pistonVersion: '5.3.3' },
];
