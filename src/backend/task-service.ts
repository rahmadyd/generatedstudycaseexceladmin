// Backend services for generating and regenerating case studies
import { randomUUID } from 'crypto';
import {
  AnswerKeyItemSchema,
  CaseStudy,
  GenerateRequest,
  RegenerateTaskRequest,
  Task,
} from '../shared/schema';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';
import {
  compileAnswerKeyPrompt,
  compileGeneratePrompt,
  compileRegenerateTaskPrompt,
  resolveIndustry,
  resolveTaskCount,
} from './prompts';
import { callGroqChat } from './groq';
import { GroqApiError, GroqOutputTruncatedError } from './ai-client';
import { GENERATION_CONFIG, GENERATION_REPAIR_ATTEMPTS } from '../shared/generation-config';
import {
  getCaseStudyAlignmentIssues,
  getTaskAnswerAlignmentIssues,
  validateAndSanitizeCaseStudy,
} from './validator';

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
  return cleaned.trim();
}

function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

export class StagedContentGenerationError extends Error {
  constructor(
    readonly partialCaseStudy: CaseStudy,
    readonly stage: string,
    readonly originalError: unknown,
  ) {
    super(`Gagal melengkapi bagian ${stage}.`);
    this.name = 'StagedContentGenerationError';
  }
}

function hasCompleteAnswerKey(caseStudy: CaseStudy): boolean {
  return caseStudy.tasks.every(
    (task) => caseStudy.answerKey.filter((answer) => answer.task === task.no).length === 1,
  ) && getTaskAnswerAlignmentIssues(caseStudy).length === 0;
}

function parseAIJson(response: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(cleanJsonString(response));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Respons bukan object JSON.');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${label}: ${(error as Error).message}`);
  }
}

async function generateStagedAnswerKey(caseStudy: CaseStudy): Promise<CaseStudy> {
  const prompt = compileAnswerKeyPrompt(caseStudy);
  const requestId = randomUUID();
  const config = GENERATION_CONFIG[caseStudy.level];
  let retryGuidance = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const rawResponse = await callGroqChat({
        systemPrompt: 'Generate validated Excel answer keys. Return compact JSON only.',
        userPrompt: `${prompt}${retryGuidance}`,
        temperature: 0.3,
        maxTokens: attempt === 0
          ? config.stagedAnswerKeyMaxTokens ?? config.maxTokens
          : config.repairMaxTokens,
        requestId,
        callNumber: attempt + 1,
        level: caseStudy.level,
      });
      const parsed = parseAIJson(rawResponse, 'Gagal membaca kunci jawaban bertahap');
      const answerKeyResult = AnswerKeyItemSchema.array().safeParse(parsed.answerKey);
      if (!answerKeyResult.success) {
        throw new Error(
          `Schema kunci jawaban tidak valid: ${answerKeyResult.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')}`,
        );
      }
      const answerKey = answerKeyResult.data.map((answer) => ({
        ...answer,
        formula: normalizeExcelFormulaLocale(answer.formula),
      }));
      const candidate: CaseStudy = {
        ...caseStudy,
        answerKey,
        answerKeyStatus: 'pending',
      };
      const issues = getTaskAnswerAlignmentIssues(candidate);
      if (answerKey.length !== caseStudy.tasks.length) {
        issues.push(`harus ada tepat ${caseStudy.tasks.length} jawaban, AI menghasilkan ${answerKey.length}`);
      }
      if (issues.length > 0) {
        throw new Error(`Kunci jawaban bertahap tidak lolos pemeriksaan: ${issues.join('; ')}`);
      }
      return { ...candidate, answerKeyStatus: 'available' };
    } catch (error) {
      const message = (error as Error).message ?? '';
      const canRetry = error instanceof GroqOutputTruncatedError ||
        message.includes('Gagal membaca kunci jawaban bertahap') ||
        message.includes('Schema kunci jawaban tidak valid') ||
        message.includes('Kunci jawaban bertahap tidak lolos pemeriksaan');
      if (attempt === 0 && canRetry) {
        retryGuidance = `\n\nREPAIR THE PREVIOUS ANSWER-KEY ERRORS: ${message}. Return exactly one answer per task in the required JSON shape. Use the supplied dataset column map and do not change the case.`;
        continue;
      }
      throw error;
    }
  }
  throw new Error('Gagal membuat kunci jawaban setelah satu kali percobaan ulang.');
}

async function completeStagedContent(initialCase: CaseStudy): Promise<CaseStudy> {
  let caseStudy = { ...initialCase };
  if (!hasCompleteAnswerKey(caseStudy)) {
    try {
      caseStudy = await generateStagedAnswerKey(caseStudy);
    } catch (error) {
      console.error('Staged content generation failed:', JSON.stringify({
        stage: 'answer_key',
        seed: caseStudy.seed,
        message: (error as Error).message,
      }));
      throw new StagedContentGenerationError(caseStudy, 'answer_key', error);
    }
  }

  caseStudy.answerKeyStatus = hasCompleteAnswerKey(caseStudy) ? 'available' : 'pending';
  return caseStudy;
}

/** Generate a new case study */
export async function generateCaseStudyService(req: GenerateRequest): Promise<CaseStudy> {
  const seed = req.seed && req.seed.trim() !== '' ? req.seed.trim() : generateRandomSeed();
  const industry = resolveIndustry(req.industry, seed);
  const taskCount = resolveTaskCount(req, industry);
  const isStaged = req.level === 'advance';
  const prompt = compileGeneratePrompt(
    { ...req, industry },
    seed,
    isStaged ? { omitAnswerKey: true } : {},
  );
  const requestId = randomUUID();
  let lastError: unknown;
  let retryGuidance = '';

  for (let attempt = 0; attempt <= GENERATION_REPAIR_ATTEMPTS; attempt++) {
    try {
      // apiKey tidak di-pass → ai-client otomatis baca dari process.env.GROQ_API_KEY
      const rawResponse = await callGroqChat({
        systemPrompt: 'Create a practical Excel case in Indonesian. Return compact JSON only in the requested schema.',
        userPrompt: `${prompt}${retryGuidance}`,
        temperature: 0.65 + attempt * 0.1,
        maxTokens: attempt > 0
          ? GENERATION_CONFIG[req.level].repairMaxTokens
          : isStaged
            ? GENERATION_CONFIG[req.level].stagedCaseMaxTokens
            : GENERATION_CONFIG[req.level].maxTokens,
        requestId,
        callNumber: attempt + 1,
        level: req.level,
        allowRateLimitFallback: attempt === 0,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanJsonString(rawResponse));
      } catch (e) {
        const parseError = new Error(`Gagal parse JSON dari AI: ${(e as Error).message}`);
        retryGuidance = '\n\nRETRY OUTPUT FORMAT: The previous response was incomplete or invalid JSON. Return one complete compact JSON object matching the requested schema. Shorten descriptions, hints, explanations, and enum lists; do not omit closing quotes or braces. Do not include markdown or text outside the JSON.';
        throw parseError;
      }

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        retryGuidance = '\n\nRETRY OUTPUT FORMAT: Return one complete JSON object matching the requested schema, with no markdown or extra text.';
        throw new Error('Respons AI bukan object JSON yang valid.');
      }

      (parsed as Record<string, unknown>).seed = seed;
      (parsed as Record<string, unknown>).level = req.level;
      (parsed as Record<string, unknown>).role = req.role;
      (parsed as Record<string, unknown>).excelVersion = req.excelVersion;
      (parsed as Record<string, unknown>).industry = industry;
      (parsed as Record<string, unknown>).formulaStyle = req.formulaStyle ?? 'classic';
      (parsed as Record<string, unknown>).structuredReferenceAt = req.structuredReferenceAt ?? true;
      (parsed as Record<string, unknown>).taskCountMode = req.taskCountMode ?? 'auto';
      (parsed as Record<string, unknown>).taskCount = taskCount;
      (parsed as Record<string, unknown>).createdAt = new Date().toISOString();
      (parsed as Record<string, unknown>).id = `case-${seed}`;

      const validation = validateAndSanitizeCaseStudy(parsed, req.excelVersion);
      if (validation.valid && validation.data) {
        if (isStaged) {
          validation.data.answerKey = [];
          validation.data.answerKeyStatus = 'pending';
        }

        // Jika AI menghasilkan lebih dari taskCount yang diminta, pangkas ke taskCount
        if (validation.data.tasks.length > taskCount) {
          validation.data.tasks = validation.data.tasks.slice(0, taskCount);
          const retainedTaskNumbers = new Set(validation.data.tasks.map((task) => task.no));
          validation.data.answerKey = validation.data.answerKey.filter((answer) =>
            retainedTaskNumbers.has(answer.task),
          );
        }
        const alignmentIssues = getCaseStudyAlignmentIssues(validation.data, req.role, industry);
        alignmentIssues.push(...getTaskAnswerAlignmentIssues(validation.data));
        if (validation.data.tasks.length !== taskCount) {
          alignmentIssues.push(`jumlah tugas harus tepat ${taskCount}, tetapi AI menghasilkan ${validation.data.tasks.length}`);
        }
        if (alignmentIssues.length === 0) {
          return validation.data;
        }
        const columnLayout = validation.data.dataset.columns
          .map((column, index) => {
            let columnNumber = index;
            let columnLetter = '';
            do {
              columnLetter = String.fromCharCode(65 + (columnNumber % 26)) + columnLetter;
              columnNumber = Math.floor(columnNumber / 26) - 1;
            } while (columnNumber >= 0);
            return `${columnLetter}=${column.name}`;
          })
          .join(', ');
        retryGuidance = `\n\nREPAIR THE PREVIOUS VALIDATION ERRORS: ${alignmentIssues.join('; ')}.
Generate a new complete case with role=${req.role} and industry=${industry}. Include clear industry-specific terms in both scenario and dataset headers/values. Make every formula use the exact dataset columns named by its task and apply all stated criteria. Do not mention unused dataset columns in instructions or hints. For Classic formulas, use this column layout: ${columnLayout}. Do not repeat the previous mismatches.`;
        throw new Error(`Hasil AI tidak selaras dengan pilihan bidang admin/industri: ${alignmentIssues.join('; ')}`);
      }

      retryGuidance = `\n\nREPAIR THE PREVIOUS SCHEMA ERRORS: ${validation.errors.join('; ')}. Return a complete compact JSON object matching the required schema exactly. Dataset range rules: number/int/currency ranges are two whole JSON numbers [min,max] with min <= max; date ranges are two valid chronological ISO date strings ["YYYY-MM-DD","YYYY-MM-DD"]; never mix types. Omit range for text/enum and omit optional values/range when unused.`;
      throw new Error(`Validasi gagal (attempt ${attempt + 1}): ${validation.errors.join('; ')}`);
    } catch (err) {
      lastError = err;
      const msg = (err as Error).message || '';
      const malformedJson = err instanceof GroqOutputTruncatedError ||
        msg.includes('Gagal parse JSON dari AI') ||
        msg.includes('bukan object JSON');
      if (attempt < GENERATION_REPAIR_ATTEMPTS && malformedJson) {
        retryGuidance = '\n\nRETRY OUTPUT FORMAT: Return one complete compact JSON object only. Shorten all prose and keep the requested schema unchanged.';
      }
      // Provider rejections won't improve by retrying and may worsen rate limits.
      if (
        (err instanceof GroqApiError && err.status === 429) ||
        msg.includes('429') ||
        msg.includes('401') ||
        msg.includes('AI Error (404)') ||
        msg.includes('tidak ditemukan')
      ) {
        throw err;
      }
    }
  }

  throw new Error(
    `Gagal generate studi kasus: ${(lastError as Error)?.message || 'Format respons tidak sesuai'}`
  );
}

export async function generateMissingCaseContentService(caseStudy: CaseStudy): Promise<CaseStudy> {
  return completeStagedContent(caseStudy);
}

/** Regenerate a single task within an existing case study */
export async function regenerateTaskService(req: RegenerateTaskRequest): Promise<CaseStudy> {
  const { caseStudy, taskNo } = req;

  const oldTask = caseStudy.tasks.find((t) => t.no === taskNo);
  if (!oldTask) throw new Error(`Tugas nomor ${taskNo} tidak ditemukan.`);

  const prompt = compileRegenerateTaskPrompt({
    title: caseStudy.title,
    level: caseStudy.level,
    role: caseStudy.role,
    scenario: caseStudy.scenario,
    excelVersion: caseStudy.excelVersion,
    industry: caseStudy.industry ?? 'Tidak ditentukan',
    formulaStyle: caseStudy.formulaStyle,
    structuredReferenceAt: caseStudy.structuredReferenceAt,
    recommendedFormulas: caseStudy.formulas.recommended,
    forbiddenFormulas: caseStudy.formulas.forbidden,
    columns: caseStudy.dataset.columns.map((c) => c.name),
    taskNo,
    oldInstruction: oldTask.instruction,
  });

  // apiKey tidak di-pass → ai-client otomatis baca dari process.env.GROQ_API_KEY
  const rawResponse = await callGroqChat({
    systemPrompt: 'Regenerate one practical Excel task in Indonesian. Return compact JSON only in the requested schema.',
    userPrompt: prompt,
    temperature: 0.75,
    maxTokens: GENERATION_CONFIG[caseStudy.level].regenerateMaxTokens,
    requestId: randomUUID(),
    callNumber: 1,
    level: caseStudy.level,
  });

  const parsed = JSON.parse(cleanJsonString(rawResponse));
  const newTask: Task = parsed.task;
  const newAnswer = parsed.answerKey;

  if (!newTask?.instruction || !newTask?.hint || !newTask?.targetResult || !newAnswer?.formula) {
    throw new Error('Format tugas baru dari AI tidak lengkap (instruksi, petunjuk, target, dan kunci wajib tersedia).');
  }

  const finalTasks = caseStudy.tasks.map((t) =>
    t.no === taskNo ? { ...newTask, no: taskNo } : t
  );

  const replacementAnswer = {
    task: taskNo,
    formula: normalizeExcelFormulaLocale(newAnswer.formula),
    explanation: newAnswer.explanation || '',
  };
  const finalAnswerKey = [
    ...caseStudy.answerKey.filter((answer) => answer.task !== taskNo),
    replacementAnswer,
  ];
  const regeneratedCase = {
    ...caseStudy,
    tasks: finalTasks,
    answerKey: finalAnswerKey,
  };
  if (hasCompleteAnswerKey(regeneratedCase)) regeneratedCase.answerKeyStatus = 'available';
  const alignmentIssues = getTaskAnswerAlignmentIssues(regeneratedCase, [taskNo]);
  if (alignmentIssues.length > 0) {
    throw new Error(`Tugas baru tidak selaras dengan kunci jawaban: ${alignmentIssues.join('; ')}`);
  }

  return regeneratedCase;
}
