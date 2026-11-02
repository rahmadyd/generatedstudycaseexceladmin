// Backend services for generating and regenerating case studies
import { randomUUID } from 'crypto';
import {
  AnswerKeyItemSchema,
  CaseStudy,
  FormulasSchema,
  GenerateRequest,
  RegenerateTaskRequest,
  Task,
  TaskSchema,
} from '../shared/schema';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';
import {
  compileAnswerKeyPrompt,
  compileGeneratePrompt,
  compileRegenerateTaskPrompt,
  resolveIndustry,
  resolveGenerationTheme,
  resolveTaskCount,
} from './prompts';
import { callGroqChat } from './groq';
import {
  GroqApiError,
  GroqJsonValidationError,
  GroqOutputTruncatedError,
  GroqResponseParseError,
} from './ai-client';
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
  const cleaned = cleanJsonString(response);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error(`${label}: ${(error as Error).message}`);
    }
    try {
      parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch (fallbackError) {
      throw new Error(`${label}: ${(fallbackError as Error).message}`);
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label}: respons bukan object JSON.`);
  }
  return parsed as Record<string, unknown>;
}

const FORMULA_CLUE_KEYS = ['formulas', 'formula_clues', 'formulaClue', 'clues'] as const;
const RESPONSE_WRAPPER_KEYS = ['data', 'result'] as const;
const FORMULA_CATEGORY_KEYS = ['recommended', 'allowed', 'forbidden'] as const;
const FormulaClueResponseSchema = FormulasSchema.refine(
  (formulas) => formulas.recommended.length + formulas.allowed.length + formulas.forbidden.length > 0,
  { message: 'Minimal satu daftar formula clue harus berisi satu formula.' },
);

interface NormalizedAnswerKeyResponse {
  formulas: unknown;
  answerKey: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFormulaClueObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && FORMULA_CATEGORY_KEYS.some((key) => key in value);
}

function isResponseEnvelope(value: Record<string, unknown>): boolean {
  return [...RESPONSE_WRAPPER_KEYS, ...FORMULA_CLUE_KEYS].some((key) => key in value);
}

function normalizeFormulaClueArray(value: unknown[]): Record<string, unknown> {
  const grouped: Record<(typeof FORMULA_CATEGORY_KEYS)[number], string[]> = {
    recommended: [],
    allowed: [],
    forbidden: [],
  };
  for (const clue of value) {
    if (typeof clue === 'string') {
      grouped.recommended.push(clue);
      continue;
    }
    if (!isRecord(clue)) continue;
    const category = String(clue.category ?? clue.type ?? '').toLocaleLowerCase('en');
    const key = FORMULA_CATEGORY_KEYS.find((candidate) => candidate === category);
    const formula = clue.formula ?? clue.name ?? clue.value;
    if (key && typeof formula === 'string') grouped[key].push(formula);
  }
  return grouped;
}

function normalizeAnswerKeyResponse(
  parsed: Record<string, unknown>,
): NormalizedAnswerKeyResponse {
  const queue: unknown[] = [parsed];
  const visited = new Set<object>();
  let formulas: unknown;
  let answerKey: unknown;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isRecord(current) || visited.has(current)) continue;
    visited.add(current);

    if (answerKey === undefined && current.answerKey !== undefined) {
      answerKey = current.answerKey;
    }

    if (formulas === undefined && isFormulaClueObject(current)) {
      formulas = current;
    }

    for (const key of RESPONSE_WRAPPER_KEYS) {
      if (current[key] !== undefined) queue.push(current[key]);
    }
    for (const key of FORMULA_CLUE_KEYS) {
      const value = current[key];
      if (value === undefined || value === null) continue;
      if (formulas === undefined && !isRecord(value) && !Array.isArray(value)) {
        formulas = value;
      } else if (Array.isArray(value)) {
        if (formulas === undefined) formulas = value;
      } else if (isRecord(value)) {
        if (formulas === undefined && (isFormulaClueObject(value) || !isResponseEnvelope(value))) {
          formulas = value;
        } else {
          queue.push(value);
        }
      }
    }
  }

  if (Array.isArray(formulas)) {
    formulas = normalizeFormulaClueArray(formulas);
  }

  return { formulas, answerKey };
}

function formatZodIssues(issues: Array<{
  path: PropertyKey[];
  message: string;
  expected?: string;
  input?: unknown;
}>): string {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '<root>';
    const received = issue.input === undefined ? 'undefined' : JSON.stringify(issue.input);
    return `${path}: ${issue.message} (expected=${issue.expected ?? 'valid value'}, received=${received})`;
  }).join('; ');
}

function normalizeAnswerKeyFormula(formula: string): string {
  const trimmedFormula = formula.trim();
  return normalizeExcelFormulaLocale(
    trimmedFormula.startsWith('=') ? trimmedFormula : `=${trimmedFormula}`,
  );
}

async function generateStagedAnswerKey(caseStudy: CaseStudy): Promise<CaseStudy> {
  const prompt = compileAnswerKeyPrompt(caseStudy);
  const requestId = randomUUID();
  const config = GENERATION_CONFIG[caseStudy.level];
  let retryGuidance = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const rawResponse = await callGroqChat({
        systemPrompt: 'Generate formula clues and validated Excel answer keys. Return strict compact JSON only.',
        userPrompt: `${prompt}${retryGuidance}`,
        temperature: 0.7,
        maxTokens: attempt === 0
          ? config.stagedAnswerKeyMaxTokens ?? config.maxTokens
          : config.repairMaxTokens,
        requestId,
        callNumber: attempt + 1,
        level: caseStudy.level,
        fallbackOnRateLimit: false,
        jsonMode: true,
      });
      const parsed = parseAIJson(rawResponse, 'Gagal membaca formula clues dan kunci jawaban');
      const normalizedResponse = normalizeAnswerKeyResponse(parsed);
      const formulaClueKeys = isRecord(normalizedResponse.formulas)
        ? Object.keys(normalizedResponse.formulas)
        : [];
      console.info('[generate] formula clue response shape', JSON.stringify({
        requestId,
        attempt: attempt + 1,
        responseKeys: Object.keys(parsed),
        formulaClueKeys,
        formulaCluesType: Array.isArray(normalizedResponse.formulas)
          ? 'array'
          : typeof normalizedResponse.formulas,
      }));
      const formulasResult = FormulaClueResponseSchema.safeParse(normalizedResponse.formulas);
      if (!formulasResult.success) {
        console.error('[generate] formula clue schema mismatch', JSON.stringify({
          requestId,
          attempt: attempt + 1,
          rawOutput: rawResponse,
          responseKeys: Object.keys(parsed),
          normalizedFormulaClues: normalizedResponse.formulas,
          issues: formulasResult.error.issues,
        }));
        throw new Error(
          `Schema formula clues tidak valid: ${formatZodIssues(formulasResult.error.issues)}`,
        );
      }
      const answerKeyResult = AnswerKeyItemSchema.array().safeParse(normalizedResponse.answerKey);
      if (!answerKeyResult.success) {
        throw new Error(
          `Schema kunci jawaban tidak valid: ${formatZodIssues(answerKeyResult.error.issues)}`,
        );
      }
      const answerKey = answerKeyResult.data.map((answer) => ({
        ...answer,
        formula: normalizeAnswerKeyFormula(answer.formula),
      }));
      const candidate: CaseStudy = {
        ...caseStudy,
        formulas: formulasResult.data,
        answerKey,
        answerKeyStatus: 'pending',
      };
      const candidateValidation = validateAndSanitizeCaseStudy(candidate, caseStudy.excelVersion);
      if (!candidateValidation.valid || !candidateValidation.data) {
        throw new Error(`Kasus lengkap tidak lolos validasi Zod: ${candidateValidation.errors.join('; ')}`);
      }
      const validatedCandidate = candidateValidation.data;
      const issues = getTaskAnswerAlignmentIssues(validatedCandidate);
      if (answerKey.length !== caseStudy.tasks.length) {
        issues.push(`harus ada tepat ${caseStudy.tasks.length} jawaban, AI menghasilkan ${answerKey.length}`);
      }
      if (issues.length > 0) {
        throw new Error(`Kunci jawaban bertahap tidak lolos pemeriksaan: ${issues.join('; ')}`);
      }
      return { ...validatedCandidate, answerKeyStatus: 'available' };
    } catch (error) {
      const message = (error as Error).message ?? '';
      const canRetry = error instanceof GroqJsonValidationError ||
        error instanceof GroqOutputTruncatedError ||
        message.includes('Gagal membaca formula clues dan kunci jawaban') ||
        message.includes('Schema formula clues tidak valid') ||
        message.includes('Schema kunci jawaban tidak valid') ||
        message.includes('Kunci jawaban bertahap tidak lolos pemeriksaan');
      if (attempt === 0 && canRetry) {
        retryGuidance = error instanceof GroqJsonValidationError
          ? '\n\nOutput sebelumnya JSON tidak valid, ulangi dengan JSON valid saja. Keluarkan satu object JSON ringkas sesuai schema, tanpa markdown, dan jangan ubah soal atau dataset.'
          : `\n\nREPAIR THE PREVIOUS FORMULA CLUE OR ANSWER-KEY ERRORS: ${message}. Return exactly one answer per task in the required JSON shape. Use the supplied dataset column map and do not change the case.`;
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
export async function generateCaseStudyService(
  req: GenerateRequest,
  clientRequestId?: string,
): Promise<CaseStudy> {
  const seed = randomUUID().replace(/-/g, '');
  const industry = resolveIndustry(req.industry, seed);
  const generationTheme = resolveGenerationTheme({ ...req, industry }, seed);
  const taskCount = resolveTaskCount(req, industry);
  const isStaged = req.level === 'advance';
  const prompt = compileGeneratePrompt({ ...req, industry }, seed);
  const requestId = randomUUID();
  console.log('[generate] started', JSON.stringify({
    requestId,
    clientRequestId,
    seed,
    role: req.role,
    industry,
    level: req.level,
    generationTheme,
    recentThemeCount: req.recentThemes?.length ?? 0,
  }));
  let lastError: unknown;
  let retryGuidance = '';
  let validatedCase: CaseStudy | null = null;

  for (let attempt = 0; attempt <= GENERATION_REPAIR_ATTEMPTS; attempt++) {
    try {
      // apiKey tidak di-pass → ai-client otomatis baca dari process.env.GROQ_API_KEY
      const rawResponse = await callGroqChat({
        systemPrompt: 'Create the case scenario, tasks, and dataset only. Return strict compact JSON only.',
        userPrompt: `${prompt}${retryGuidance}`,
        temperature: 0.7,
        maxTokens: attempt > 0
          ? GENERATION_CONFIG[req.level].repairMaxTokens
          : isStaged
            ? GENERATION_CONFIG[req.level].stagedCaseMaxTokens
            : GENERATION_CONFIG[req.level].maxTokens,
        requestId,
        callNumber: attempt + 1,
        level: req.level,
        allowModelFallback: true,
        fallbackOnRateLimit: false,
        jsonMode: true,
      });

      const parsed = parseAIJson(rawResponse, 'Gagal parse JSON dari AI');
      parsed.seed = seed;
      parsed.generationTheme = generationTheme;
      parsed.level = req.level;
      parsed.role = req.role;
      parsed.excelVersion = req.excelVersion;
      parsed.industry = industry;
      parsed.formulaStyle = req.formulaStyle ?? 'classic';
      parsed.structuredReferenceAt = req.structuredReferenceAt ?? true;
      parsed.taskCountMode = req.taskCountMode ?? 'auto';
      parsed.taskCount = taskCount;
      parsed.createdAt = new Date().toISOString();
      parsed.id = `case-${seed}`;
      parsed.formulas = { recommended: [], allowed: [], forbidden: [] };
      parsed.answerKey = [];
      parsed.answerKeyStatus = 'pending';

      const validation = validateAndSanitizeCaseStudy(parsed, req.excelVersion);
      if (validation.valid && validation.data) {
        // Jika AI menghasilkan lebih dari taskCount yang diminta, pangkas ke taskCount
        if (validation.data.tasks.length > taskCount) {
          validation.data.tasks = validation.data.tasks.slice(0, taskCount);
          const retainedTaskNumbers = new Set(validation.data.tasks.map((task) => task.no));
          validation.data.answerKey = validation.data.answerKey.filter((answer) =>
            retainedTaskNumbers.has(answer.task),
          );
        }
        const alignmentIssues = getCaseStudyAlignmentIssues(validation.data, req.role, industry);
        if (validation.data.tasks.length !== taskCount) {
          alignmentIssues.push(`jumlah tugas harus tepat ${taskCount}, tetapi AI menghasilkan ${validation.data.tasks.length}`);
        }
        if (alignmentIssues.length === 0) {
          validatedCase = validation.data;
          console.log('[generate] completed', JSON.stringify({
            requestId,
            clientRequestId,
            seed: validatedCase.seed,
            generationTheme,
            title: validatedCase.title,
            taskCount: validatedCase.tasks.length,
            stage: 'case_and_dataset',
          }));
          break;
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
Generate a new complete case strictly for role=${req.role} and industry=${industry}. The title and every task must match this role; remove any conflicting role topic (for example sales/penjualan when the selected role is inventory/gudang). Include a role-specific task and dataset field; generic terms such as barang, data, or transaksi are not sufficient. Include a concrete product/service/category from the selected industry's profile in dataset columns/enum values. Ensure every stated task criterion is supported by a real dataset column and value. Do not mention unused dataset columns in instructions or hints. Return only the case scenario, tasks, and dataset; formula clues and answer keys are generated in the next sequential request. Do not repeat the previous mismatches.`;
        throw new Error(`Hasil AI tidak selaras dengan pilihan bidang admin/industri: ${alignmentIssues.join('; ')}`);
      }

      retryGuidance = `\n\nREPAIR THE PREVIOUS SCHEMA ERRORS: ${validation.errors.join('; ')}. Return only the complete case scenario, tasks, and dataset JSON object. Numeric ranges are two whole JSON numbers [min,max]; date ranges are two chronological ISO dates ["YYYY-MM-DD","YYYY-MM-DD"]; omit ranges for text/enum. Do not return formula clues or answer keys.`;
      throw new Error(`Validasi gagal (attempt ${attempt + 1}): ${validation.errors.join('; ')}`);
    } catch (err) {
      lastError = err;
      const msg = (err as Error).message || '';
      console.warn('[generate] attempt failed', JSON.stringify({
        requestId,
        clientRequestId,
        attempt: attempt + 1,
        message: msg,
      }));
      const malformedJson = err instanceof GroqOutputTruncatedError ||
        msg.includes('Gagal parse JSON dari AI') ||
        msg.includes('bukan object JSON');
      if (err instanceof GroqJsonValidationError) {
        if (attempt < GENERATION_REPAIR_ATTEMPTS) {
          retryGuidance = '\n\nOutput sebelumnya JSON tidak valid, ulangi dengan JSON valid saja. Keluarkan hanya satu object JSON ringkas sesuai schema, tanpa markdown, dan pastikan semua string satu baris serta escape karakter kutip dan backslash.';
          continue;
        }
        throw err;
      }
      if (attempt < GENERATION_REPAIR_ATTEMPTS && malformedJson) {
        retryGuidance = '\n\nRETRY OUTPUT FORMAT: Return one complete compact JSON object only. Shorten all prose and keep the requested schema unchanged.';
      }
      // Provider rejections won't improve by retrying and may worsen rate limits.
      if (err instanceof GroqApiError || msg.includes('tidak ditemukan')) {
        throw err;
      }
    }
  }

  if (validatedCase) {
    try {
      return await generateStagedAnswerKey(validatedCase);
    } catch (error) {
      if (isStaged) {
        console.error('Formula clue and answer-key stage failed:', JSON.stringify({
          stage: 'formula_clues_and_answer_key',
          seed: validatedCase.seed,
          message: (error as Error).message,
        }));
        return { ...validatedCase, answerKeyStatus: 'pending' };
      }
      throw error;
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
    columns: caseStudy.dataset.columns.map((column) =>
      `${column.name} (${column.type}${column.values ? `; values: ${column.values.join(' | ')}` : ''}${column.range ? `; range: ${column.range.join(' to ')}` : ''})`,
    ),
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
    jsonMode: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseAIJson(rawResponse, 'Gagal membaca tugas yang dibuat ulang');
  } catch {
    throw new GroqResponseParseError();
  }
  const taskResult = TaskSchema.safeParse(parsed.task);
  const answerResult = AnswerKeyItemSchema.safeParse(parsed.answerKey);
  if (!taskResult.success || !answerResult.success) {
    throw new Error('Format tugas baru dari AI tidak sesuai schema tugas dan kunci jawaban.');
  }
  const newTask: Task = taskResult.data;
  const newAnswer = answerResult.data;

  if (!newTask?.instruction || !newTask?.hint || !newTask?.targetResult || !newAnswer?.formula) {
    throw new Error('Format tugas baru dari AI tidak lengkap (instruksi, petunjuk, target, dan kunci wajib tersedia).');
  }

  const finalTasks = caseStudy.tasks.map((t) =>
    t.no === taskNo ? { ...newTask, no: taskNo } : t
  );

  const replacementAnswer = {
    task: taskNo,
    formula: normalizeAnswerKeyFormula(newAnswer.formula),
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
