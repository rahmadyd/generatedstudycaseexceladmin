import { CaseStudy, GenerateRequest, RegenerateTaskRequest, Task } from '../shared/schema';
import { compileGeneratePrompt, compileRegenerateTaskPrompt } from './prompts';
import { callGroqChat } from './groq';
import { validateAndSanitizeCaseStudy } from './validator';
import { FALLBACK_CASES } from './fallbacks';

function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

export async function generateCaseStudyService(req: GenerateRequest): Promise<CaseStudy> {
  const seed = req.seed && req.seed.trim() !== '' ? req.seed.trim() : generateRandomSeed();
  const apiKey = req.customApiKey || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;

  // If no Groq API Key is configured on server or sent by client, use high-quality seeded fallback
  if (!apiKey || apiKey.trim() === '') {
    const fallbackTemplate = FALLBACK_CASES[req.level] || FALLBACK_CASES.middle;
    return {
      ...fallbackTemplate,
      id: `case-${seed}`,
      seed,
      role: req.role || fallbackTemplate.role,
      excelVersion: req.excelVersion,
      createdAt: new Date().toISOString(),
    };
  }

  const prompt = compileGeneratePrompt(req, seed);
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const rawResponse = await callGroqChat({
        apiKey,
        systemPrompt:
          'You are an expert Indonesian administrative business analyst and Excel educator. You output only valid JSON matching the exact schema requested.',
        userPrompt: prompt,
        temperature: 0.65 + attempt * 0.1,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawResponse);
      } catch (e) {
        throw new Error(`Failed to parse AI JSON response: ${(e as Error).message}`);
      }

      // Inject seed, level, role, excelVersion, createdAt if missing
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
      // If it's auth error (401), don't retry, fail immediately
      const errMsg = (err as Error).message || '';
      if (errMsg.includes('401') || errMsg.includes('API Key tidak valid')) {
        throw err;
      }
    }
  }

  // If all retries failed, fallback gracefully to template if available, or throw descriptive error
  console.warn('Groq generation retries exhausted. Providing fallback case study. Error:', lastError);
  const fallback = FALLBACK_CASES[req.level] || FALLBACK_CASES.middle;
  return {
    ...fallback,
    id: `case-${seed}`,
    seed,
    role: req.role,
    excelVersion: req.excelVersion,
    createdAt: new Date().toISOString(),
  };
}

export async function regenerateTaskService(req: RegenerateTaskRequest): Promise<CaseStudy> {
  const { caseStudy, taskNo } = req;
  const apiKey = req.customApiKey || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;

  const oldTask = caseStudy.tasks.find((t) => t.no === taskNo);
  if (!oldTask) {
    throw new Error(`Tugas nomor ${taskNo} tidak ditemukan pada studi kasus ini.`);
  }

  if (!apiKey || apiKey.trim() === '') {
    // Generate an algorithmic variation for this task
    const updatedTasks = caseStudy.tasks.map((t) => {
      if (t.no === taskNo) {
        return {
          ...t,
          instruction: `[Variasi Baru] ${t.instruction} - Tambahkan validasi batas nilai dan formatting sel.`,
          hint: `${t.hint} (Periksa format angka/tampilan)`,
          targetResult: `${t.targetResult} (Kalkulasi ulang)`,
        };
      }
      return t;
    });

    return {
      ...caseStudy,
      tasks: updatedTasks,
    };
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

  const rawResponse = await callGroqChat({
    apiKey,
    systemPrompt: 'You regenerate a single Excel task. Output strictly valid JSON.',
    userPrompt: prompt,
    temperature: 0.75,
  });

  const parsed = JSON.parse(rawResponse);
  const newTask: Task = parsed.task;
  const newAnswer = parsed.answerKey;

  if (!newTask || !newTask.instruction) {
    throw new Error('Format tugas baru dari AI tidak sesuai.');
  }

  // Replace task
  const updatedTasks = caseStudy.tasks.map((t) => (t.no === taskNo ? { ...newTask, no: taskNo } : t));

  // Replace answer key if returned
  let updatedAnswerKey = caseStudy.answerKey;
  if (newAnswer && newAnswer.formula) {
    updatedAnswerKey = caseStudy.answerKey.map((a) =>
      a.task === taskNo ? { task: taskNo, formula: newAnswer.formula, explanation: newAnswer.explanation || '' } : a
    );
  }

  return {
    ...caseStudy,
    tasks: updatedTasks,
    answerKey: updatedAnswerKey,
  };
}
