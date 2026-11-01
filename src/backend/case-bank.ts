import { randomUUID } from 'crypto';
import caseBankJson from './case-bank.json';
import { CaseStudy, GenerateRequest } from '../shared/schema';
import { GENERATION_CONFIG } from '../shared/generation-config';
import { resolveTaskCount } from './prompts';
import {
  getCaseStudyAlignmentIssues,
  getTaskAnswerAlignmentIssues,
  validateAndSanitizeCaseStudy,
} from './validator';

export function getCaseBankFallback(request: GenerateRequest): CaseStudy | null {
  for (const rawTemplate of caseBankJson) {
    const templateValidation = validateAndSanitizeCaseStudy(rawTemplate);
    if (!templateValidation.valid || !templateValidation.data) {
      console.error('Ignoring invalid static case-bank entry:', templateValidation.errors);
      continue;
    }

    const template = templateValidation.data;
    const industry = template.industry;
    if (
      !industry ||
      industry === 'Acak' ||
      template.level !== request.level ||
      template.role !== request.role ||
      (request.industry && request.industry !== 'Acak' && request.industry !== industry) ||
      (request.formulaStyle ?? 'classic') !== template.formulaStyle
    ) {
      continue;
    }

    const taskCountConfig = GENERATION_CONFIG[request.level];
    const taskCount = resolveTaskCount(request, industry);
    if (
      taskCount < taskCountConfig.minTasks ||
      taskCount > template.tasks.length ||
      taskCount > taskCountConfig.maxTasks
    ) {
      continue;
    }

    const seed = request.seed?.trim() || `bank-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const selectedTaskNumbers = new Set(
      template.tasks.slice(0, taskCount).map((task) => task.no),
    );
    const candidate: CaseStudy = {
      ...template,
      id: `case-${seed}`,
      seed,
      createdAt: new Date().toISOString(),
      source: 'bank',
      excelVersion: request.excelVersion,
      formulaStyle: template.formulaStyle,
      structuredReferenceAt: request.structuredReferenceAt ?? true,
      taskCountMode: request.taskCountMode,
      taskCount,
      tasks: template.tasks.slice(0, taskCount),
      answerKey: template.answerKey.filter((answer) => selectedTaskNumbers.has(answer.task)),
      answerKeyStatus: 'available',
      ...(template.level === 'portfolio' ? { portfolioStatus: 'available' as const } : {}),
    };
    const validation = validateAndSanitizeCaseStudy(candidate, request.excelVersion);
    if (!validation.valid || !validation.data) {
      console.error('Static case-bank fallback failed schema validation:', validation.errors);
      continue;
    }

    const alignmentIssues = [
      ...getCaseStudyAlignmentIssues(validation.data, request.role, industry),
      ...getTaskAnswerAlignmentIssues(validation.data),
    ];
    if (alignmentIssues.length > 0) {
      console.error('Static case-bank fallback failed business validation:', {
        entryId: template.id,
        issues: alignmentIssues,
      });
      continue;
    }

    return validation.data;
  }

  return null;
}
