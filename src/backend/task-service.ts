// Backend services for generating and regenerating case studies
import { CaseStudy, GenerateRequest, RegenerateTaskRequest, Task } from '../shared/schema';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';
import { compileGeneratePrompt, compileRegenerateTaskPrompt, resolveIndustry } from './prompts';
import { callGroqChat } from './groq';
import { validateAndSanitizeCaseStudy } from './validator';

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

/** Generate a new case study */
export async function generateCaseStudyService(req: GenerateRequest): Promise<CaseStudy> {
  const seed = req.seed && req.seed.trim() !== '' ? req.seed.trim() : generateRandomSeed();

  const prompt = compileGeneratePrompt(req, seed);
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // apiKey tidak di-pass → ai-client otomatis baca dari process.env.GROQ_API_KEY
      const rawResponse = await callGroqChat({
        systemPrompt:
          'You are an expert Indonesian administrative business analyst and Excel educator. You output only valid JSON matching the exact schema requested.',
        userPrompt: prompt,
        temperature: 0.65 + attempt * 0.1,
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
        (parsed as Record<string, unknown>).industry = resolveIndustry(req.industry, seed);
        (parsed as Record<string, unknown>).formulaStyle = req.formulaStyle ?? 'classic';
        (parsed as Record<string, unknown>).structuredReferenceAt = req.structuredReferenceAt ?? true;
        (parsed as Record<string, unknown>).createdAt = new Date().toISOString();
        (parsed as Record<string, unknown>).id = `case-${seed}`;
      }

      const validation = validateAndSanitizeCaseStudy(parsed, req.excelVersion);
      if (validation.valid && validation.data) return validation.data;

      throw new Error(`Validasi gagal (attempt ${attempt + 1}): ${validation.errors.join('; ')}`);
    } catch (err) {
      lastError = err;
      const msg = (err as Error).message || '';
      // Langsung lempar error autentikasi — tidak perlu retry
      if (msg.includes('401') || msg.includes('tidak valid') || msg.includes('tidak ditemukan')) {
        throw err;
      }
    }
  }

  throw new Error(
    `Gagal generate studi kasus: ${(lastError as Error)?.message || 'Format respons tidak sesuai'}`
  );
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
    systemPrompt: 'You regenerate a single Excel task. Output strictly valid JSON.',
    userPrompt: prompt,
    temperature: 0.75,
  });

  const parsed = JSON.parse(cleanJsonString(rawResponse));
  const newTask: Task = parsed.task;
  const newAnswer = parsed.answerKey;

  if (!newTask?.instruction) throw new Error('Format tugas baru dari AI tidak sesuai.');

  const finalTasks = caseStudy.tasks.map((t) =>
    t.no === taskNo ? { ...newTask, no: taskNo } : t
  );

  let finalAnswerKey = caseStudy.answerKey;
  if (newAnswer?.formula) {
    finalAnswerKey = caseStudy.answerKey.map((a) =>
      a.task === taskNo
        ? {
            task: taskNo,
            formula: normalizeExcelFormulaLocale(newAnswer.formula),
            explanation: newAnswer.explanation || '',
          }
        : a
    );
  }

  return { ...caseStudy, tasks: finalTasks, answerKey: finalAnswerKey };
}
