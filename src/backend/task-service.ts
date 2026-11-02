// Backend services for generating and regenerating case studies
import { randomUUID } from 'crypto';
import {
  CaseStudy,
  DatasetColumn,
  DatasetSchema,
  GenerateRequest,
  Level,
  RegenerateTaskRequest,
  Task,
  TaskSchema,
} from '../shared/schema';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';
import {
  compileAdvanceTasksPrompt,
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
import {
  DatasetInput,
  RawDatasetSchema,
  UnknownColumnTypeError,
  normalizeDatasetRows,
  resolveDatasetColumns,
} from '@/lib/column-types';
import {
  DatasetValidationError,
  buildValidatedDataset,
  type ValidatedDatasetBuild,
} from '../shared/dataset-validation';
import { buildDeterministicTasks, ensureTemplateDataset } from './task-templates';
import { getIndustryColumnValues } from '../shared/constants';
import { validateTaskCalculation } from './formula-engine';
import { LEVEL_RULES } from '../shared/level-rules';
import {
  getCaseStudyAlignmentIssues,
  getTaskAnswerAlignmentIssues,
  validateAndSanitizeCaseStudy,
} from './validator';

/**
 * Membangun dataset tervalidasi dengan seed yang sama seperti yang dipakai
 * prompt, UI, dan perhitungan kunci jawaban. Gagal validasi setelah 3 seed
 * akan melempar DatasetValidationError (dataset buruk tidak pernah dipakai).
 */
function buildCaseDataset(context: {
  seed: string;
  level: CaseStudy['level'];
  industry?: CaseStudy['industry'];
  dataset: DatasetInput;
}): ValidatedDatasetBuild {
  return buildValidatedDataset({
    seed: context.seed,
    level: context.level,
    industry: context.industry,
    dataset: context.dataset,
    categoryValues: (columnName) => getIndustryColumnValues(columnName, context.industry),
  });
}

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
    if (caseStudy.level === 'easy' || caseStudy.level === 'middle') {
      const datasetInput = ensureTemplateDataset(
        caseStudy.dataset,
        caseStudy.level,
        caseStudy.role,
        caseStudy.industry,
      );
      const built = buildCaseDataset({
        seed: caseStudy.seed,
        level: caseStudy.level,
        industry: caseStudy.industry,
        dataset: datasetInput,
      });
      const generated = buildDeterministicTasks({
        dataset: built.dataset,
        level: caseStudy.level,
        role: caseStudy.role,
        excelVersion: caseStudy.excelVersion,
      }, built.rows, caseStudy.tasks.length);
      caseStudy = {
        ...caseStudy,
        seed: built.seed,
        dataset: built.dataset,
        tasks: generated.tasks,
        answerKey: generated.answerKey,
      };
    } else {
      const built = buildCaseDataset({
        seed: caseStudy.seed,
        level: caseStudy.level,
        industry: caseStudy.industry,
        dataset: caseStudy.dataset,
      });
      const rows = built.rows;
      caseStudy = { ...caseStudy, seed: built.seed, dataset: built.dataset };
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
    if (issues.errors.length > 0) throw new Error(issues.errors.join('; '));
    // Log warnings tapi tidak jadikan error fatal
    if (issues.warnings.length > 0) {
      console.warn('[completeStagedContent] warnings', JSON.stringify({
        seed: caseStudy.seed,
        warnings: issues.warnings,
      }));
    }
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

function formatDatasetColumnForPrompt(column: DatasetColumn): string {
  const details = [
    column.values ? `values: ${column.values.join(' | ')}` : '',
    column.min !== undefined && column.max !== undefined ? `min ${column.min}, max ${column.max}` : '',
    column.from && column.to ? `${column.from} s/d ${column.to}` : '',
    column.expression ? `expression: ${column.expression}` : '',
  ].filter(Boolean);
  return `${column.name} (${column.type}${details.length ? `; ${details.join('; ')}` : ''})`;
}

/**
 * Tugas level Advance ditulis AI. Supaya tidak terpotong (finish_reason "length")
 * saat jumlah tugas besar, tugas dipecah menjadi beberapa batch permintaan kecil
 * lalu digabung dan dinomori ulang secara berurutan.
 */
async function generateAdvanceTasks(params: {
  requestId: string;
  title: string;
  scenario: string;
  level: Level;
  role: string;
  industry: string;
  excelVersion: string;
  formulaStyle: string;
  structuredReferenceAt: boolean;
  columns: DatasetColumn[];
  rows: number;
  taskCount: number;
}): Promise<Task[]> {
  const config = GENERATION_CONFIG[params.level];
  const batchSize = Math.max(1, config.taskBatchSize ?? params.taskCount);
  const maxBatches = Math.ceil(params.taskCount / batchSize) + 3;
  const columnDescriptions = params.columns.map(formatDatasetColumnForPrompt);
  const tasks: Task[] = [];
  const seenInstructions = new Set<string>();
  let batchNumber = 0;

  while (tasks.length < params.taskCount && batchNumber < maxBatches) {
    batchNumber += 1;
    const startNo = tasks.length + 1;
    const size = Math.min(batchSize, params.taskCount - tasks.length);
    const prompt = compileAdvanceTasksPrompt({
      title: params.title,
      scenario: params.scenario,
      level: params.level,
      role: params.role,
      industry: params.industry,
      excelVersion: params.excelVersion,
      formulaStyle: params.formulaStyle,
      structuredReferenceAt: params.structuredReferenceAt,
      columns: columnDescriptions,
      rows: params.rows,
      batchSize: size,
      startNo,
      endNo: startNo + size - 1,
      previousInstructions: tasks.map((task) => task.instruction),
      hintMaxChars: config.hintMaxChars,
      explanationMaxChars: config.explanationMaxChars,
    });

    const rawResponse = await callGroqChat({
      systemPrompt: 'Create Excel task metadata for an Advance case study. Return strict compact JSON only.',
      userPrompt: prompt,
      temperature: 0.7,
      maxTokens: config.taskBatchMaxTokens ?? config.maxTokens,
      requestId: params.requestId,
      callNumber: batchNumber + 1,
      level: params.level,
      allowModelFallback: false,
      fallbackOnRateLimit: false,
      jsonMode: true,
    });

    const parsedBatch = parseAIJson(rawResponse, 'Gagal parse JSON tugas Advance');
    const batchTasks = parsedBatch.tasks;
    if (!Array.isArray(batchTasks) || batchTasks.length === 0) {
      throw new Error(`Batch ${batchNumber} tugas Advance tidak berisi tugas apa pun.`);
    }
    if (batchTasks.length > size) {
      throw new Error(`Batch ${batchNumber} tugas Advance melebihi ${size} tugas.`);
    }
    const taskInput = batchTasks as Record<string, unknown>[];
    const missingMetadata = taskInput.flatMap((task, index) => {
      const missing = ['taskKind', 'answerMode', 'columnsUsed']
        .filter((field) => !(field in task))
        .map((field) => `tugas ${startNo + index}: ${field} wajib diisi`);
      return missing;
    });
    if (missingMetadata.length > 0) throw new Error(missingMetadata.join('; '));
    const taskResult = TaskSchema.array().safeParse(taskInput);
    if (!taskResult.success) {
      throw new Error(`Schema tugas Advance tidak valid: ${formatZodIssues(taskResult.error.issues)}`);
    }

    for (const task of taskResult.data) {
      const instructionKey = task.instruction.trim().toLocaleLowerCase('id');
      if (!instructionKey || seenInstructions.has(instructionKey)) continue;
      seenInstructions.add(instructionKey);
      tasks.push({ ...task, no: tasks.length + 1 });
      if (tasks.length >= params.taskCount) break;
    }
  }

  if (tasks.length < params.taskCount) {
    throw new Error(`Hanya ${tasks.length} dari ${params.taskCount} tugas Advance yang berhasil dibuat.`);
  }
  return tasks;
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
        systemPrompt: 'Create the case scenario and dataset only. Always return tasks: []. Return strict compact JSON only.',
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
      if (typeof parsed.title !== 'string' || typeof parsed.scenario !== 'string') {
        throw new Error('Respons AI harus memiliki title dan scenario berupa string.');
      }
      const datasetResult = RawDatasetSchema.safeParse(parsed.dataset);
      if (!datasetResult.success) {
        throw new Error(`Schema dataset tidak valid: ${formatZodIssues(datasetResult.error.issues)}`);
      }

      // Kolom AI dipetakan ke registry tipe TERTUTUP memakai nama kolom lebih dulu,
      // sehingga kolom tak dikenal melempar UnknownColumnTypeError (bukan teks acak).
      const resolvedColumns = resolveDatasetColumns(datasetResult.data.columns, {
        categoryValues: (columnName) => getIndustryColumnValues(columnName, industry),
      });
      const resolvedDataset = DatasetSchema.parse({
        sheetName: datasetResult.data.sheetName,
        rows: normalizeDatasetRows(datasetResult.data.rows),
        columns: resolvedColumns,
        traps: [],
      });
      const dataset = ensureTemplateDataset(resolvedDataset, req.level, req.role, industry);
      // Dataset dibangun + DIVALIDASI sebelum dipakai prompt/UI/export. Bila gagal,
      // buildValidatedDataset mengulang dengan seed baru maksimal 3x lalu melempar error.
      const built = buildCaseDataset({ seed, level: req.level, industry, dataset });
      const effectiveSeed = built.seed;
      const canonicalDataset = built.dataset;
      const rows = built.rows;
      const formulas = {
        recommended: [...LEVEL_RULES[req.level].allowedFunctions],
        allowed: [...LEVEL_RULES[req.level].allowedFunctions],
        forbidden: [...LEVEL_RULES[req.level].forbiddenFunctions],
      };
      const metadata = {
        id: `case-${effectiveSeed}`,
        seed: effectiveSeed,
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
        dataset: canonicalDataset,
      };

      let tasks: Task[];
      let answerKey: CaseStudy['answerKey'];
      if (req.level === 'easy' || req.level === 'middle') {
        const generated = buildDeterministicTasks({
          dataset: canonicalDataset,
          level: req.level,
          role: req.role,
          excelVersion: req.excelVersion,
        }, rows, taskCount);
        tasks = generated.tasks;
        answerKey = generated.answerKey;
      } else {
        tasks = await generateAdvanceTasks({
          requestId,
          title: parsed.title,
          scenario: parsed.scenario,
          level: req.level,
          role: req.role,
          industry,
          excelVersion: req.excelVersion,
          formulaStyle: metadata.formulaStyle,
          structuredReferenceAt: metadata.structuredReferenceAt,
          columns: canonicalDataset.columns,
          rows: canonicalDataset.rows,
          taskCount,
        });
        const availableTaskKinds = new Set(LEVEL_RULES.advance.taskKinds);
        const availableColumns = new Set(canonicalDataset.columns.map((column) => column.name));
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
            { dataset: canonicalDataset, level: req.level, excelVersion: req.excelVersion },
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
      const issues = [...alignmentIssues, ...answerIssues.errors];
      if (issues.length > 0) {
        throw new Error(`Validasi hasil generate gagal: ${issues.join('; ')}`);
      }
      // Log warnings tapi tidak jadikan error fatal
      if (answerIssues.warnings.length > 0) {
        console.warn('[generate] warnings', JSON.stringify({
          requestId,
          clientRequestId,
          warnings: answerIssues.warnings,
        }));
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
      // Error keras: kolom tak dikenal atau dataset gagal validasi setelah 3 seed.
      // Jangan ditutup-tutupi oleh retry generik agar pesannya sampai ke UI.
      if (err instanceof DatasetValidationError || err instanceof UnknownColumnTypeError) {
        throw err;
      }
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
      // Hentikan retry untuk error validasi semantik (bukan error API)
      if (msg.includes('Validasi hasil generate gagal') || msg.includes('ERROR FATAL')) {
        throw err;
      }
      if (attempt === 1) {
        throw new Error(`Gagal generate studi kasus: ${msg || 'Validasi hasil AI gagal.'}`);
      }
      retryGuidance = `\n\nPerbaiki output sebelumnya karena: ${msg}. Keluarkan satu JSON ringkas valid sesuai aturan level. tasks wajib [] untuk semua level karena tugas dibuat pada permintaan terpisah. Pastikan dataset mendukung level dan tema yang diminta.`;
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
    const datasetInput = ensureTemplateDataset(
      caseStudy.dataset,
      caseStudy.level,
      caseStudy.role,
      caseStudy.industry,
    );
    const built = buildCaseDataset({
      seed: caseStudy.seed,
      level: caseStudy.level,
      industry: caseStudy.industry,
      dataset: datasetInput,
    });
    const candidateCount = Math.min(25, caseStudy.tasks.length + 1);
    const generated = buildDeterministicTasks({
      dataset: built.dataset,
      level: caseStudy.level,
      role: caseStudy.role,
      excelVersion: caseStudy.excelVersion,
    }, built.rows, candidateCount);
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
      seed: built.seed,
      dataset: built.dataset,
      tasks: caseStudy.tasks.map((task) => task.no === taskNo ? { ...candidate, no: taskNo } : task),
      answerKey: [
        ...caseStudy.answerKey.filter((answer) => answer.task !== taskNo),
        { ...candidateAnswer, task: taskNo },
      ],
      answerKeyStatus: 'available',
    };
    const issues = getTaskAnswerAlignmentIssues(regeneratedCase, [taskNo]);
    if (issues.errors.length > 0) {
      throw new Error(`Tugas deterministik baru gagal validasi: ${issues.errors.join('; ')}`);
    }
    // Log warnings tapi tidak jadikan error fatal
    if (issues.warnings.length > 0) {
      console.warn('[regenerateTask] warnings', JSON.stringify({
        taskNo,
        warnings: issues.warnings,
      }));
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
    columns: caseStudy.dataset.columns.map(formatDatasetColumnForPrompt),
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
      buildCaseDataset({
        seed: caseStudy.seed,
        level: caseStudy.level,
        industry: caseStudy.industry,
        dataset: caseStudy.dataset,
      }).rows,
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
  if (alignmentIssues.errors.length > 0) {
    throw new Error(`Tugas baru tidak selaras dengan kunci jawaban: ${alignmentIssues.errors.join('; ')}`);
  }
  // Log warnings tapi tidak jadikan error fatal
  if (alignmentIssues.warnings.length > 0) {
    console.warn('[regenerateTask] warnings', JSON.stringify({
      taskNo,
      warnings: alignmentIssues.warnings,
    }));
  }

  return regeneratedCase;
}
