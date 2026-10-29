// Backend services for generating and regenerating case studies
import { CaseStudy, GenerateRequest, RegenerateTaskRequest, Task } from '../shared/schema';
import { compileGeneratePrompt, compileRegenerateTaskPrompt } from './prompts';
import { callGroqChat } from './groq';
import { validateAndSanitizeCaseStudy } from './validator';

// Utility to strip possible markdown fences from AI output
function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

// Simple random seed generator
function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Generate a new case study */
export async function generateCaseStudyService(req: GenerateRequest): Promise<CaseStudy> {
  const seed = req.seed && req.seed.trim() !== '' ? req.seed.trim() : generateRandomSeed();
  console.log('[task-service] generateCaseStudyService seed:', seed);

  const prompt = compileGeneratePrompt(req, seed);
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // No apiKey passed here — ai-client resolves from env automatically
      const rawResponse = await callGroqChat({
        systemPrompt:
          'You are an expert Indonesian administrative business analyst and Excel educator. You output only valid JSON matching the exact schema requested.',
        userPrompt: prompt,
        temperature: 0.65 + attempt * 0.1,
      });

      let parsed: unknown;
      try {
        const cleaned = cleanJsonString(rawResponse);
        parsed = JSON.parse(cleaned);
      } catch (e) {
        throw new Error(`Failed to parse AI JSON response: ${(e as Error).message}`);
      }

      // Ensure required fields are present
      if (typeof parsed === 'object' && parsed !== null) {
        (parsed as Record<string, unknown>).seed = seed;
        (parsed as Record<string, unknown>).level = req.level;
        (parsed as Record<string, unknown>).role = req.role;
        (parsed as Record<string, unknown>).excelVersion = req.excelVersion;
        (parsed as Record<string, unknown>).createdAt = new Date().toISOString();
        (parsed as Record<string, unknown>).id = `case-${seed}`;
      }

      const validation = validateAndSanitizeCaseStudy(parsed, req.excelVersion);
      if (validation.valid && validation.data) {
        return validation.data;
      }

      throw new Error(`Validation failed on attempt ${attempt + 1}: ${validation.errors.join('; ')}`);
    } catch (err) {
      lastError = err;
      const errMsg = (err as Error).message || '';
      console.error(`[task-service] Attempt ${attempt + 1} failed:`, errMsg);
      // Don't retry on auth errors
      if (errMsg.includes('401') || errMsg.includes('API Key tidak valid') || errMsg.includes('tidak ditemukan')) {
        throw err;
      }
    }
  }

  throw new Error(
    `Gagal men-generate studi kasus dari AI: ${(lastError as Error)?.message || 'Format respons tidak sesuai'}`
  );
}

/** Regenerate a single task within an existing case study */
export async function regenerateTaskService(req: RegenerateTaskRequest): Promise<CaseStudy> {
  const { caseStudy, taskNo } = req;

  const oldTask = caseStudy.tasks.find((t) => t.no === taskNo);
  if (!oldTask) {
    throw new Error(`Tugas nomor ${taskNo} tidak ditemukan pada studi kasus ini.`);
  }

  const prompt = compileRegenerateTaskPrompt({
    title: caseStudy.title,
    level: caseStudy.level,
    role: caseStudy.role,
    scenario: caseStudy.scenario,
    excelVersion: caseStudy.excelVersion,
    recommendedFormulas: caseStudy.formulas.recommended,
    forbiddenFormulas: caseStudy.formulas.forbidden,
    columns: caseStudy.dataset.columns.map((c) => c.name),
    taskNo,
    oldInstruction: oldTask.instruction,
  });

  // No apiKey passed here — ai-client resolves from env automatically
  const rawResponse = await callGroqChat({
    systemPrompt: 'You regenerate a single Excel task. Output strictly valid JSON.',
    userPrompt: prompt,
    temperature: 0.75,
  });

  const cleaned = cleanJsonString(rawResponse);
  const parsed = JSON.parse(cleaned);
  const newTask: Task = parsed.task;
  const newAnswer = parsed.answerKey;

  if (!newTask || !newTask.instruction) {
    throw new Error('Format tugas baru dari AI tidak sesuai.');
  }

  const finalTasks = caseStudy.tasks.map((t) => (t.no === taskNo ? { ...newTask, no: taskNo } : t));

  let finalAnswerKey = caseStudy.answerKey;
  if (newAnswer && newAnswer.formula) {
    finalAnswerKey = caseStudy.answerKey.map((a) =>
      a.task === taskNo
        ? { task: taskNo, formula: newAnswer.formula, explanation: newAnswer.explanation || '' }
        : a
    );
  }

  return {
    ...caseStudy,
    tasks: finalTasks,
    answerKey: finalAnswerKey,
  };
}
