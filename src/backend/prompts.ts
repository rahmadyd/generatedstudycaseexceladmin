import fs from 'fs';
import path from 'path';
import { GenerateRequest } from '../shared/schema';
import { SAMPLE_COMPANIES, SAMPLE_INDUSTRIES, SAMPLE_PERIODS, SAMPLE_THEMES } from '../shared/constants';

function getRandomItem<T>(arr: T[], seedStr?: string): T {
  if (!seedStr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  // Deterministic pick based on seed string
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % arr.length;
  return arr[index];
}

export function loadPromptTemplate(templateName: string): string {
  const filePath = path.join(process.cwd(), 'prompts', templateName);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error(`Prompt template ${templateName} not found at ${filePath}`);
}

export function compileGeneratePrompt(req: GenerateRequest, seed: string): string {
  const template = loadPromptTemplate('generate-case.md');

  const industry = getRandomItem(SAMPLE_INDUSTRIES, seed + '-ind');
  const companyName = getRandomItem(SAMPLE_COMPANIES, seed + '-comp');
  const theme = getRandomItem(SAMPLE_THEMES, seed + '-theme');
  const period = getRandomItem(SAMPLE_PERIODS, seed + '-per');

  const replacements: Record<string, string> = {
    '{{level}}': req.level,
    '{{role}}': req.role,
    '{{excelVersion}}': req.excelVersion,
    '{{companyName}}': companyName,
    '{{industry}}': industry,
    '{{theme}}': theme,
    '{{period}}': period,
    '{{taskCount}}': String(req.taskCount || 5),
    '{{seed}}': seed,
  };

  let compiled = template;
  for (const [key, value] of Object.entries(replacements)) {
    compiled = compiled.split(key).join(value);
  }

  return compiled;
}

export function compileRegenerateTaskPrompt(params: {
  title: string;
  level: string;
  role: string;
  scenario: string;
  excelVersion: string;
  recommendedFormulas: string[];
  forbiddenFormulas: string[];
  columns: string[];
  taskNo: number;
  oldInstruction: string;
}): string {
  const template = loadPromptTemplate('regenerate-task.md');

  const replacements: Record<string, string> = {
    '{{title}}': params.title,
    '{{level}}': params.level,
    '{{role}}': params.role,
    '{{scenario}}': params.scenario,
    '{{excelVersion}}': params.excelVersion,
    '{{recommendedFormulas}}': params.recommendedFormulas.join(', '),
    '{{forbiddenFormulas}}': params.forbiddenFormulas.join(', '),
    '{{columns}}': params.columns.join(', '),
    '{{taskNo}}': String(params.taskNo),
    '{{oldInstruction}}': params.oldInstruction,
  };

  let compiled = template;
  for (const [key, value] of Object.entries(replacements)) {
    compiled = compiled.split(key).join(value);
  }

  return compiled;
}
