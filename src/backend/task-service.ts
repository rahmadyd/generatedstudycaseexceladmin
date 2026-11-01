// Backend services for generating and regenerating case studies
import { randomUUID } from 'crypto';
import {
  AnswerKeyItemSchema,
  CaseStudy,
  GenerateRequest,
  PortfolioBriefSchema,
  RegenerateTaskRequest,
  Task,
} from '../shared/schema';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';
import {
  compileAnswerKeyPrompt,
  compileGeneratePrompt,
  compilePortfolioBriefPrompt,
  compilePortfolioRubricPrompt,
  compileRegenerateTaskPrompt,
  resolveIndustry,
  resolveTaskCount,
} from './prompts';
import { callGroqChat } from './groq';
import { GroqApiError } from './ai-client';
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
  const rawResponse = await callGroqChat({
    systemPrompt: 'Generate validated Excel answer keys. Return compact JSON only.',
    userPrompt: compileAnswerKeyPrompt(caseStudy),
    temperature: 0.3,
    maxTokens: GENERATION_CONFIG[caseStudy.level].stagedAnswerKeyMaxTokens,
    requestId: randomUUID(),
    callNumber: 1,
    level: caseStudy.level,
  });
  const parsed = parseAIJson(rawResponse, 'Gagal membaca kunci jawaban bertahap');
  const answerKey = AnswerKeyItemSchema.array().parse(parsed.answerKey).map((answer) => ({
    ...answer,
    formula: normalizeExcelFormulaLocale(answer.formula),
  }));
  const candidate: CaseStudy = {
    ...caseStudy,
    answerKey,
    answerKeyStatus: 'pending',
  };
  const issues = getTaskAnswerAlignmentIssues(candidate);
  if (issues.length > 0) {
    throw new Error(`Kunci jawaban bertahap tidak lolos pemeriksaan: ${issues.join('; ')}`);
  }
  return { ...candidate, answerKeyStatus: 'available' };
}

async function generatePortfolioBrief(caseStudy: CaseStudy): Promise<CaseStudy> {
  const rawResponse = await callGroqChat({
    systemPrompt: 'Write portfolio client brief and deliverables. Return compact JSON only.',
    userPrompt: compilePortfolioBriefPrompt(caseStudy),
    temperature: 0.3,
    maxTokens: GENERATION_CONFIG.portfolio.stagedPortfolioBriefMaxTokens,
    requestId: randomUUID(),
    callNumber: 1,
    level: caseStudy.level,
  });
  const parsed = parseAIJson(rawResponse, 'Gagal membaca brief portofolio');
  const portfolioBrief = PortfolioBriefSchema.parse(parsed.portfolioBrief);
  return { ...caseStudy, portfolioBrief };
}

async function generatePortfolioRubric(caseStudy: CaseStudy): Promise<CaseStudy> {
  const rawResponse = await callGroqChat({
    systemPrompt: 'Create a concise portfolio assessment rubric. Return compact JSON only.',
    userPrompt: compilePortfolioRubricPrompt(caseStudy),
    temperature: 0.3,
    maxTokens: GENERATION_CONFIG.portfolio.stagedPortfolioRubricMaxTokens,
    requestId: randomUUID(),
    callNumber: 1,
    level: caseStudy.level,
  });
  const parsed = parseAIJson(rawResponse, 'Gagal membaca rubrik portofolio');
  if (!Array.isArray(parsed.rubric) ||
      !parsed.rubric.every((item): item is string => typeof item === 'string' && Boolean(item.trim()))) {
    throw new Error('Rubrik portofolio tidak valid.');
  }
  return { ...caseStudy, rubric: parsed.rubric };
}

async function completeStagedContent(initialCase: CaseStudy): Promise<CaseStudy> {
  let caseStudy = { ...initialCase };
  const stages: Array<{ name: string; run: (current: CaseStudy) => Promise<CaseStudy> }> = [
    { name: 'answer_key', run: generateStagedAnswerKey },
  ];
  if (caseStudy.level === 'portfolio') {
    stages.push(
      { name: 'portfolio_brief', run: generatePortfolioBrief },
      { name: 'portfolio_rubric', run: generatePortfolioRubric },
    );
  }

  for (const stage of stages) {
    const isComplete = stage.name === 'answer_key'
      ? hasCompleteAnswerKey(caseStudy)
      : stage.name === 'portfolio_brief'
        ? Boolean(caseStudy.portfolioBrief)
        : Boolean(caseStudy.rubric?.length);
    if (isComplete) continue;

    try {
      caseStudy = await stage.run(caseStudy);
    } catch (error) {
      console.error('Staged content generation failed:', JSON.stringify({
        stage: stage.name,
        seed: caseStudy.seed,
        message: (error as Error).message,
      }));
      throw new StagedContentGenerationError(caseStudy, stage.name, error);
    }
  }

  caseStudy.answerKeyStatus = hasCompleteAnswerKey(caseStudy) ? 'available' : 'pending';
  if (caseStudy.level === 'portfolio') {
    caseStudy.portfolioStatus = caseStudy.portfolioBrief && caseStudy.rubric?.length
      ? 'available'
      : 'pending';
  }
  return caseStudy;
}

/** Generate a new case study */
export async function generateCaseStudyService(req: GenerateRequest): Promise<CaseStudy> {
  const seed = req.seed && req.seed.trim() !== '' ? req.seed.trim() : generateRandomSeed();
  const industry = resolveIndustry(req.industry, seed);
  const taskCount = resolveTaskCount(req, industry);
  const isStaged = req.level === 'advance' || req.level === 'portfolio';
  const prompt = compileGeneratePrompt(
    { ...req, industry },
    seed,
    isStaged ? { omitAnswerKey: true, omitPortfolio: true } : {},
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
        maxTokens: isStaged
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
        throw new Error(`Gagal parse JSON dari AI: ${(e as Error).message}`);
      }

      if (typeof parsed === 'object' && parsed !== null) {
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
      }

      const validation = validateAndSanitizeCaseStudy(parsed, req.excelVersion);
      if (validation.valid && validation.data) {
        if (isStaged) {
          validation.data.answerKey = [];
          validation.data.answerKeyStatus = 'pending';
          validation.data.portfolioBrief = undefined;
          validation.data.rubric = undefined;
          if (req.level === 'portfolio') validation.data.portfolioStatus = 'pending';
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
        if (taskCount >= 15) {
          if (validation.data.tasks.length < taskCount - 2) {
            alignmentIssues.push(`jumlah tugas harus mendekati ${taskCount}, tetapi AI menghasilkan ${validation.data.tasks.length}`);
          }
        } else {
          if (validation.data.tasks.length !== taskCount) {
            alignmentIssues.push(`jumlah tugas harus tepat ${taskCount}, tetapi AI menghasilkan ${validation.data.tasks.length}`);
          }
        }
        if (alignmentIssues.length === 0) {
          return validation.data;
        }
        retryGuidance = `\n\nMANDATORY: The previous response did not match the requested criteria: ${alignmentIssues.join('; ')}. Regenerate the entire case and ensure role=${req.role}, industry=${industry}, the narrative/tasks show the selected role, and dataset columns/values are specific to both. Do not return an unrelated generic business case.`;
        throw new Error(`Hasil AI tidak selaras dengan pilihan bidang admin/industri: ${alignmentIssues.join('; ')}`);
      }

      throw new Error(`Validasi gagal (attempt ${attempt + 1}): ${validation.errors.join('; ')}`);
    } catch (err) {
      lastError = err;
      const msg = (err as Error).message || '';
      // Provider rejections won't improve by retrying and may worsen rate limits.
      if (
        (err instanceof GroqApiError && err.status === 429) ||
        msg.includes('429') ||
        msg.includes('401') ||
        msg.includes('tidak valid') ||
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
