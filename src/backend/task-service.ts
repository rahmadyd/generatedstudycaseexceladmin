// Backend services for generating and regenerating case studies
import { randomUUID } from 'crypto';
import {
  CaseStudy,
  DatasetSchema,
  GenerateRequest,
  RegenerateTaskRequest,
  Task,
  TaskSchema,
} from '../shared/schema';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';
import {
  compileGeneratePrompt,
  compileRegenerateTaskPrompt,
  resolveIndustry,
  resolveGenerationTheme,
  resolveTaskCount,
} from './prompts';
import { callGroqChat } from './groq';
import {
  GroqApiError,
  GroqResponseParseError,
} from './ai-client';
import { GENERATION_CONFIG } from '../shared/generation-config';
import { generateDatasetRows } from '../shared/dataset-generator';
import { buildDeterministicTasks, ensureTemplateDataset } from './task-templates';
import { validateTaskCalculation } from './formula-engine';
import { LEVEL_RULES } from '../shared/level-rules';
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

function normalizeAnswerKeyFormula(formula: string | undefined): string {
  if (!formula?.trim()) return '';
  const trimmedFormula = formula.trim();
  return normalizeExcelFormulaLocale(
    trimmedFormula.startsWith('=') ? trimmedFormula : `=${trimmedFormula}`,
  );
}

async function completeStagedContent(initialCase: CaseStudy): Promise<CaseStudy> {
  let caseStudy: CaseStudy = { ...initialCase };
  try {
    const rows = generateDatasetRows(caseStudy);
    if (caseStudy.level === 'easy' || caseStudy.level === 'middle') {
      const dataset = ensureTemplateDataset(
        caseStudy.dataset,
        caseStudy.level,
        caseStudy.role,
        caseStudy.industry,
      );
      const generated = buildDeterministicTasks({
        dataset,
        level: caseStudy.level,
        role: caseStudy.role,
        excelVersion: caseStudy.excelVersion,
      }, generateDatasetRows({ seed: caseStudy.seed, level: caseStudy.level, industry: caseStudy.industry, dataset }),
      caseStudy.tasks.length);
      caseStudy = { ...caseStudy, dataset, tasks: generated.tasks, answerKey: generated.answerKey };
    } else {
      caseStudy.answerKey = caseStudy.tasks.map((task) => {
        const existing = caseStudy.answerKey.find((answer) => answer.task === task.no);
        if (task.answerMode === 'rubric') {
          const rubricChecklist = task.rubricChecklist.length > 0
            ? task.rubricChecklist
            : existing?.rubricChecklist ?? [];
          if (rubricChecklist.length === 0) {
            throw new Error(`Tugas ${task.no}: rubricChecklist tidak tersedia.`);
          }
          return {
            task: task.no,
            mode: 'rubric' as const,
            columnsUsed: task.columnsUsed,
            rubricChecklist,
            explanation: task.targetResult,
          };
        }
        const formula = normalizeAnswerKeyFormula(task.formula ?? existing?.formula);
        const expectedValue = validateTaskCalculation(task, formula, caseStudy, rows);
        task.formula = formula;
        return {
          task: task.no,
          mode: 'computed' as const,
          formula,
          expectedValue,
          columnsUsed: task.columnsUsed,
          rubricChecklist: [],
          explanation: task.targetResult,
        };
      });
    }

    caseStudy.formulas = {
      recommended: [...LEVEL_RULES[caseStudy.level].allowedFunctions],
      allowed: [...LEVEL_RULES[caseStudy.level].allowedFunctions],
      forbidden: [...LEVEL_RULES[caseStudy.level].forbiddenFunctions],
    };
    const issues = getTaskAnswerAlignmentIssues(caseStudy);
    if (issues.length > 0) throw new Error(issues.join('; '));
    caseStudy.answerKeyStatus = 'available';
  } catch (error) {
    console.error('Computed answer-key completion failed:', JSON.stringify({
      stage: 'answer_key',
      seed: caseStudy.seed,
      message: (error as Error).message,
    }));
    throw new StagedContentGenerationError(caseStudy, 'answer_key', error);
  }
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
  const prompt = compileGeneratePrompt({ ...req, industry, taskCount }, seed);
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
  let retryGuidance = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const rawResponse = await callGroqChat({
        systemPrompt: 'Create the case scenario and dataset. For Advance only, also create task metadata. Return strict compact JSON only.',
        userPrompt: `${prompt}${retryGuidance}`,
        temperature: 0.7,
        maxTokens: GENERATION_CONFIG[req.level].maxTokens,
        requestId,
        callNumber: attempt + 1,
        level: req.level,
        allowModelFallback: false,
        fallbackOnRateLimit: false,
        jsonMode: true,
      });

      const parsed = parseAIJson(rawResponse, 'Gagal parse JSON dari AI');
      const datasetResult = DatasetSchema.safeParse(parsed.dataset);
      if (!datasetResult.success) {
        throw new Error(`Schema dataset tidak valid: ${formatZodIssues(datasetResult.error.issues)}`);
      }

      const dataset = ensureTemplateDataset({
        ...datasetResult.data,
        rows: Math.max(50, Math.min(datasetResult.data.rows, 500)),
      }, req.level, req.role, industry);
      const rows = generateDatasetRows({ seed, level: req.level, industry, dataset });
      const formulas = {
        recommended: [...LEVEL_RULES[req.level].allowedFunctions],
        allowed: [...LEVEL_RULES[req.level].allowedFunctions],
        forbidden: [...LEVEL_RULES[req.level].forbiddenFunctions],
      };
      const metadata = {
        id: `case-${seed}`,
        seed,
        generationTheme,
        createdAt: new Date().toISOString(),
        title: parsed.title,
        level: req.level,
        role: req.role,
        excelVersion: req.excelVersion,
        formulaStyle: req.formulaStyle ?? 'classic',
        structuredReferenceAt: req.structuredReferenceAt ?? true,
        industry,
        taskCountMode: req.taskCountMode ?? 'auto',
        taskCount,
        scenario: parsed.scenario,
        dataTraps: parsed.dataTraps,
        formulas,
        dataset,
      };

      let tasks: Task[];
      let answerKey: CaseStudy['answerKey'];
      if (req.level === 'easy' || req.level === 'middle') {
        const generated = buildDeterministicTasks({
          dataset,
          level: req.level,
          role: req.role,
          excelVersion: req.excelVersion,
        }, rows, taskCount);
        tasks = generated.tasks;
        answerKey = generated.answerKey;
      } else {
        if (!Array.isArray(parsed.tasks) || parsed.tasks.length !== taskCount) {
          throw new Error(`Advance harus memiliki tepat ${taskCount} tugas.`);
        }
        const taskInput = parsed.tasks as Record<string, unknown>[];
        const missingMetadata = taskInput.flatMap((task, index) => {
          const missing = ['taskKind', 'answerMode', 'columnsUsed']
            .filter((field) => !(field in task))
            .map((field) => `tugas ${index + 1}: ${field} wajib diisi`);
          return missing;
        });
        if (missingMetadata.length > 0) throw new Error(missingMetadata.join('; '));
        const taskResult = TaskSchema.array().safeParse(taskInput);
        if (!taskResult.success) {
          throw new Error(`Schema tugas tidak valid: ${formatZodIssues(taskResult.error.issues)}`);
        }
        tasks = taskResult.data.map((task, index) => ({ ...task, no: index + 1 }));
        const availableTaskKinds = new Set(LEVEL_RULES.advance.taskKinds);
        const availableColumns = new Set(dataset.columns.map((column) => column.name));
        answerKey = tasks.map((task) => {
          if (!availableTaskKinds.has(task.taskKind)) {
            throw new Error(`Tugas ${task.no}: jenis ${task.taskKind} tidak diizinkan pada level Advance.`);
          }
          if (task.columnsUsed.length === 0) {
            throw new Error(`Tugas ${task.no}: columnsUsed wajib menyebut kolom dataset yang digunakan.`);
          }
          const missingColumns = task.columnsUsed.filter((column) => !availableColumns.has(column));
          if (missingColumns.length > 0) {
            throw new Error(`Tugas ${task.no}: kolom tidak ada di dataset: ${missingColumns.join(', ')}.`);
          }
          if (task.dateColumn && !availableColumns.has(task.dateColumn)) {
            throw new Error(`Tugas ${task.no}: dateColumn ${task.dateColumn} tidak ada di dataset.`);
          }
          if (task.answerMode === 'rubric') {
            if (task.rubricChecklist.length === 0) {
              throw new Error(`Tugas ${task.no}: rubricChecklist wajib diisi untuk mode rubric.`);
            }
            return {
              task: task.no,
              mode: 'rubric' as const,
              columnsUsed: task.columnsUsed,
              rubricChecklist: task.rubricChecklist,
              explanation: task.targetResult,
            };
          }
          const formula = normalizeAnswerKeyFormula(task.formula);
          const expectedValue = validateTaskCalculation(
            task,
            formula,
            { dataset, level: req.level, excelVersion: req.excelVersion },
            rows,
          );
          return {
            task: task.no,
            mode: 'computed' as const,
            formula,
            columnsUsed: task.columnsUsed,
            expectedValue,
            explanation: task.targetResult,
            rubricChecklist: [],
          };
        });
      }

      const validation = validateAndSanitizeCaseStudy({
        ...metadata,
        tasks,
        answerKey,
        answerKeyStatus: 'available',
      }, req.excelVersion);
      if (!validation.valid || !validation.data) {
        throw new Error(validation.errors.join('; '));
      }
      const alignmentIssues = getCaseStudyAlignmentIssues(validation.data, req.role, industry);
      const answerIssues = getTaskAnswerAlignmentIssues(validation.data);
      const issues = [...alignmentIssues, ...answerIssues];
      if (issues.length > 0) {
        throw new Error(`Validasi hasil generate gagal: ${issues.join('; ')}`);
      }
      console.log('[generate] completed', JSON.stringify({
        requestId,
        clientRequestId,
        seed,
        generationTheme,
        title: validation.data.title,
        taskCount: validation.data.tasks.length,
        groqCalls: attempt + 1,
      }));
      return validation.data;
    } catch (err) {
      const msg = (err as Error).message || '';
      console.warn('[generate] attempt failed', JSON.stringify({
        requestId,
        clientRequestId,
        attempt: attempt + 1,
        message: msg,
      }));
      if (err instanceof GroqApiError && err.status === 429) {
        throw err;
      }
      const providerError = err instanceof GroqApiError;
      const retryableProviderError = providerError && (err.status === 400 || err.status >= 500);
      if (providerError && !retryableProviderError) throw err;
      if (attempt === 1) {
        throw new Error(`Gagal generate studi kasus: ${msg || 'Validasi hasil AI gagal.'}`);
      }
      retryGuidance = `\n\nPerbaiki output sebelumnya karena: ${msg}. Keluarkan satu JSON ringkas valid sesuai aturan level. Gunakan taskKind, answerMode, columnsUsed, formula atau rubricChecklist yang diwajibkan. Easy/Middle harus tasks: []. Pastikan dataset mendukung level dan tema yang diminta.`;
    }
  }

      const parsed = parseAIJson(rawResponse, 'Gagal parse JSON dari AI');
      const datasetResult = DatasetSchema.safeParse(parsed.dataset);
      if (!datasetResult.success) {
        throw new Error(`Schema dataset tidak valid: ${formatZodIssues(datasetResult.error.issues)}`);
      }

      const dataset = ensureTemplateDataset({
        ...datasetResult.data,
        rows: Math.max(50, Math.min(datasetResult.data.rows, 500)),
      }, req.level, req.role, industry);
      const rows = generateDatasetRows({ seed, level: req.level, industry, dataset });
      const formulas = {
        recommended: [...LEVEL_RULES[req.level].allowedFunctions],
        allowed: [...LEVEL_RULES[req.level].allowedFunctions],
        forbidden: [...LEVEL_RULES[req.level].forbiddenFunctions],
      };
      const metadata = {
        id: `case-${seed}`,
        seed,
        generationTheme,
        createdAt: new Date().toISOString(),
        title: parsed.title,
        level: req.level,
        role: req.role,
        excelVersion: req.excelVersion,
        formulaStyle: req.formulaStyle ?? 'classic',
        structuredReferenceAt: req.structuredReferenceAt ?? true,
        industry,
        taskCountMode: req.taskCountMode ?? 'auto',
        taskCount,
        scenario: parsed.scenario,
        dataTraps: parsed.dataTraps,
        formulas,
        dataset,
      };

      let tasks: Task[];
      let answerKey: CaseStudy['answerKey'];
      if (req.level === 'easy' || req.level === 'middle') {
        const generated = buildDeterministicTasks({
          dataset,
          level: req.level,
          role: req.role,
          excelVersion: req.excelVersion,
        }, rows, taskCount);
        tasks = generated.tasks;
        answerKey = generated.answerKey;
      } else {
        if (!Array.isArray(parsed.tasks) || parsed.tasks.length !== taskCount) {
          throw new Error(`Advance harus memiliki tepat ${taskCount} tugas.`);
        }
        const taskInput = parsed.tasks as Record<string, unknown>[];
        const missingMetadata = taskInput.flatMap((task, index) => {
          const missing = ['taskKind', 'answerMode', 'columnsUsed']
            .filter((field) => !(field in task))
            .map((field) => `tugas ${index + 1}: ${field} wajib diisi`);
          return missing;
        });
        if (missingMetadata.length > 0) throw new Error(missingMetadata.join('; '));
        const taskResult = TaskSchema.array().safeParse(taskInput);
        if (!taskResult.success) {
          throw new Error(`Schema tugas tidak valid: ${formatZodIssues(taskResult.error.issues)}`);
        }
        tasks = taskResult.data.map((task, index) => ({ ...task, no: index + 1 }));
        const availableTaskKinds = new Set(LEVEL_RULES.advance.taskKinds);
        const availableColumns = new Set(dataset.columns.map((column) => column.name));
        answerKey = tasks.map((task) => {
          if (!availableTaskKinds.has(task.taskKind)) {
            throw new Error(`Tugas ${task.no}: jenis ${task.taskKind} tidak diizinkan pada level Advance.`);
          }
          if (task.columnsUsed.length === 0) {
            throw new Error(`Tugas ${task.no}: columnsUsed wajib menyebut kolom dataset yang digunakan.`);
          }
          const missingColumns = task.columnsUsed.filter((column) => !availableColumns.has(column));
          if (missingColumns.length > 0) {
            throw new Error(`Tugas ${task.no}: kolom tidak ada di dataset: ${missingColumns.join(', ')}.`);
          }
          if (task.dateColumn && !availableColumns.has(task.dateColumn)) {
            throw new Error(`Tugas ${task.no}: dateColumn ${task.dateColumn} tidak ada di dataset.`);
          }
          if (task.answerMode === 'rubric') {
            if (task.rubricChecklist.length === 0) {
              throw new Error(`Tugas ${task.no}: rubricChecklist wajib diisi untuk mode rubric.`);
            }
            return {
              task: task.no,
              mode: 'rubric' as const,
              columnsUsed: task.columnsUsed,
              rubricChecklist: task.rubricChecklist,
              explanation: task.targetResult,
            };
          }
          const formula = normalizeAnswerKeyFormula(task.formula);
          const expectedValue = validateTaskCalculation(
            task,
            formula,
            { dataset, level: req.level, excelVersion: req.excelVersion },
            rows,
          );
          return {
            task: task.no,
            mode: 'computed' as const,
            formula,
            columnsUsed: task.columnsUsed,
            expectedValue,
            explanation: task.targetResult,
            rubricChecklist: [],
          };
        });
      }

      const validation = validateAndSanitizeCaseStudy({
        ...metadata,
        tasks,
        answerKey,
        answerKeyStatus: 'available',
      }, req.excelVersion);
      if (!validation.valid || !validation.data) {
        throw new Error(validation.errors.join('; '));
      }
      const alignmentIssues = getCaseStudyAlignmentIssues(validation.data, req.role, industry);
      const answerIssues = getTaskAnswerAlignmentIssues(validation.data);
      const issues = [...alignmentIssues, ...answerIssues];
      if (issues.length > 0) {
        throw new Error(`Validasi hasil generate gagal: ${issues.join('; ')}`);
      }
      console.log('[generate] completed', JSON.stringify({
        requestId,
        clientRequestId,
        seed,
        generationTheme,
        title: validation.data.title,
        taskCount: validation.data.tasks.length,
        groqCalls: attempt + 1,
      }));
      return validation.data;
    } catch (err) {
      const msg = (err as Error).message || '';
      console.warn('[generate] attempt failed', JSON.stringify({
        requestId,
        clientRequestId,
        attempt: attempt + 1,
        message: msg,
      }));
      if (err instanceof GroqApiError && err.status === 429) {
        throw err;
      }
      const providerError = err instanceof GroqApiError;
      const retryableProviderError = providerError && (err.status === 400 || err.status >= 500);
      if (providerError && !retryableProviderError) throw err;
      if (attempt === 1) {
        throw new Error(`Gagal generate studi kasus: ${msg || 'Validasi hasil AI gagal.'}`);
      }
      retryGuidance = `\n\nPerbaiki output sebelumnya karena: ${msg}. Keluarkan satu JSON ringkas valid sesuai aturan level. Gunakan taskKind, answerMode, columnsUsed, formula atau rubricChecklist yang diwajibkan. Easy/Middle harus tasks: []. Pastikan dataset mendukung level dan tema yang diminta.`;
    }
  }

  throw new Error('Gagal generate studi kasus: percobaan ulang habis.');
}

export async function generateMissingCaseContentService(caseStudy: CaseStudy): Promise<CaseStudy> {
  return completeStagedContent(caseStudy);
}

/** Regenerate a single task within an existing case study */
export async function regenerateTaskService(req: RegenerateTaskRequest): Promise<CaseStudy> {
  const { caseStudy, taskNo } = req;

  const oldTask = caseStudy.tasks.find((t) => t.no === taskNo);
  if (!oldTask) throw new Error(`Tugas nomor ${taskNo} tidak ditemukan.`);

  if (caseStudy.level !== 'advance') {
    const dataset = ensureTemplateDataset(
      caseStudy.dataset,
      caseStudy.level,
      caseStudy.role,
      caseStudy.industry,
    );
    const candidateCount = Math.min(25, caseStudy.tasks.length + 1);
    const generated = buildDeterministicTasks({
      dataset,
      level: caseStudy.level,
      role: caseStudy.role,
      excelVersion: caseStudy.excelVersion,
    }, generateDatasetRows({
      seed: caseStudy.seed,
      level: caseStudy.level,
      industry: caseStudy.industry,
      dataset,
    }), candidateCount);
    const otherInstructions = new Set(
      caseStudy.tasks.filter((task) => task.no !== taskNo).map((task) => task.instruction),
    );
    const candidate = generated.tasks.find((task) =>
      task.instruction !== oldTask.instruction && !otherInstructions.has(task.instruction),
    );
    if (!candidate) {
      throw new Error('Tidak tersedia variasi tugas deterministik lain untuk dataset ini.');
    }
    const candidateAnswer = generated.answerKey.find((answer) => answer.task === candidate.no);
    if (!candidateAnswer) throw new Error('Kunci tugas deterministik tidak ditemukan.');
    const regeneratedCase: CaseStudy = {
      ...caseStudy,
      dataset,
      tasks: caseStudy.tasks.map((task) => task.no === taskNo ? { ...candidate, no: taskNo } : task),
      answerKey: [
        ...caseStudy.answerKey.filter((answer) => answer.task !== taskNo),
        { ...candidateAnswer, task: taskNo },
      ],
      answerKeyStatus: 'available',
    };
    const issues = getTaskAnswerAlignmentIssues(regeneratedCase, [taskNo]);
    if (issues.length > 0) {
      throw new Error(`Tugas deterministik baru gagal validasi: ${issues.join('; ')}`);
    }
    return regeneratedCase;
  }

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
    allowModelFallback: false,
    fallbackOnRateLimit: false,
    jsonMode: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseAIJson(rawResponse, 'Gagal membaca tugas yang dibuat ulang');
  } catch {
    throw new GroqResponseParseError();
  }
  if (typeof parsed.task !== 'object' || parsed.task === null || Array.isArray(parsed.task)) {
    throw new Error('Respons tugas baru harus memiliki object task.');
  }
  const taskInput = parsed.task as Record<string, unknown>;
  const missingMetadata = ['taskKind', 'answerMode', 'columnsUsed']
    .filter((field) => !(field in taskInput));
  if (missingMetadata.length > 0) {
    throw new Error(`Metadata tugas baru tidak lengkap: ${missingMetadata.join(', ')}.`);
  }
  const taskResult = TaskSchema.safeParse(taskInput);
  if (!taskResult.success) {
    throw new Error(`Schema tugas baru tidak valid: ${formatZodIssues(taskResult.error.issues)}`);
  }
  const task: Task = { ...taskResult.data, no: taskNo };
  if (!LEVEL_RULES.advance.taskKinds.includes(task.taskKind)) {
    throw new Error(`Jenis tugas ${task.taskKind} tidak diizinkan pada level Advance.`);
  }
  const availableColumns = new Set(caseStudy.dataset.columns.map((column) => column.name));
  const missingColumns = task.columnsUsed.filter((column) => !availableColumns.has(column));
  if (task.columnsUsed.length === 0 || missingColumns.length > 0) {
    throw new Error(`columnsUsed tugas baru harus berisi header dataset yang tersedia${missingColumns.length ? `: ${missingColumns.join(', ')}` : ''}.`);
  }

  let replacementAnswer: CaseStudy['answerKey'][number];
  if (task.answerMode === 'rubric') {
    if (task.rubricChecklist.length === 0) {
      throw new Error('Tugas rubric baru harus menyertakan rubricChecklist.');
    }
    replacementAnswer = {
      task: taskNo,
      mode: 'rubric',
      columnsUsed: task.columnsUsed,
      rubricChecklist: task.rubricChecklist,
      explanation: task.targetResult,
    };
  } else {
    if (!task.formula?.trim()) {
      throw new Error('Tugas computed baru harus menyertakan formula.');
    }
    const formula = normalizeAnswerKeyFormula(task.formula);
    const expectedValue = validateTaskCalculation(
      task,
      formula,
      caseStudy,
      generateDatasetRows(caseStudy),
    );
    task.formula = formula;
    replacementAnswer = {
      task: taskNo,
      formula,
      expectedValue,
      mode: 'computed',
      columnsUsed: task.columnsUsed,
      rubricChecklist: [],
      explanation: task.targetResult,
    };
  }

  const finalTasks = caseStudy.tasks.map((existing) =>
    existing.no === taskNo ? task : existing
  );
  const finalAnswerKey = [
    ...caseStudy.answerKey.filter((answer) => answer.task !== taskNo),
    replacementAnswer,
  ];
  const regeneratedCase: CaseStudy = {
    ...caseStudy,
    tasks: finalTasks,
    answerKey: finalAnswerKey,
    answerKeyStatus: 'available',
  };
  const alignmentIssues = getTaskAnswerAlignmentIssues(regeneratedCase, [taskNo]);
  if (alignmentIssues.length > 0) {
    throw new Error(`Tugas baru tidak selaras dengan kunci jawaban: ${alignmentIssues.join('; ')}`);
  }

  return regeneratedCase;
}
