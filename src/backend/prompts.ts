import fs from 'fs';
import path from 'path';
import { GenerateRequest, Industry, Level } from '../shared/schema';
import { ADMIN_ROLES, getRecommendedTaskCount, INDUSTRY_PROFILES, M365_ONLY_FORMULAS, ROLE_GENERATION_THEMES, ROLE_PROFILES, SAMPLE_COMPANIES, SAMPLE_INDUSTRIES, SAMPLE_PERIODS, SAMPLE_THEMES } from '../shared/constants';
import { GENERATION_CONFIG } from '../shared/generation-config';
import { LEVEL_RULES } from '../shared/level-rules';

const COMPACT_DEFAULT_GENERATE_PROMPT = `You design practical Excel case studies for Indonesian administrative work. Return one compact JSON object only.
Level: {{level}} | Role: {{role}} ({{roleDetails}}) | Industry: {{industry}}
Context: {{companyName}}; {{theme}}; {{period}}. Industry guidance: {{industryProfile}}
Recently used themes: {{recentThemes}}. Do not repeat these themes; use the new selected angle in the scenario and tasks.
Excel: {{excelVersion}} | Formula style: {{formulaStyle}} | Structured-reference rule: {{structuredReferenceAt}}
Task count: exactly {{taskCount}} | Seed: {{seed}} | Formula policy: {{levelFormulaPolicy}}
Keep hints within {{hintMaxChars}} characters.
Rules: Return strict valid JSON only. Keep every string one line and escaped. Use the selected random theme. Title/scenario/dataset match selected role and industry. Easy/Middle must return tasks: []. Advance must return exactly {{taskCount}} tasks with taskKind, answerMode, exact columnsUsed, and either executable A1 formula for computed or rubricChecklist for rubric. Allowed functions: {{levelFormulaPolicy}}. No answerKey or formula clues.
Dataset metadata: for number/int/currency, optional range is exactly two whole JSON numbers [min,max] with min <= max; for date, optional range is two valid chronological ISO dates ["YYYY-MM-DD","YYYY-MM-DD"]. Never mix number and string values in range. Omit range for text/enum; use values only for enum as non-empty strings. Omit unused optional fields.
Use supplied industry products/categories as realistic dataset values. Dataset numeric ranges are two whole JSON numbers; date ranges are two valid chronological ISO dates; enum values are non-empty strings. Omit unused optional fields.
{"title":"string","scenario":"string","tasks":[],"dataTraps":["string"],"dataset":{"sheetName":"Data_Admin","rows":150,"columns":[{"name":"Tanggal_Transaksi","type":"date","range":["2026-01-01","2026-03-31"]},{"name":"Qty","type":"int","range":[1,100]},{"name":"Status","type":"enum","values":["Selesai","Diproses"]}]}}`;
const COMPACT_DEFAULT_REGENERATE_TASK_PROMPT = `Regenerate only task {{taskNo}} for this Indonesian Excel case.
Case: {{title}} | Level: {{level}} | Role: {{role}} ({{roleDetails}}) | Industry: {{industry}} | Scenario: {{scenario}}
Excel: {{excelVersion}} | Formula style: {{formulaStyle}} | Structured-reference rule: {{structuredReferenceAt}}
Formula policy: {{levelFormulaPolicy}} | Available columns: {{columns}}
Old instruction: {{oldInstruction}}
Keep the hint within {{hintMaxChars}} characters.
Return strict compact JSON only, no markdown or extra prose. Keep every string one line and escape quotes and backslashes. Include taskKind, answerMode, and exact columnsUsed. Computed tasks need one executable formula; rubric tasks need rubricChecklist. Use only available columns and allowed functions. Use semicolons and English function names. Formula must not start with =; the application adds it.
{"task":{"no":{{taskNo}},"instruction":"string","hint":"string","targetResult":"string","taskKind":"calculation","answerMode":"computed","columnsUsed":["Qty"],"formula":"SUM(A2:A151)"}}`;

function getRandomItem<T>(arr: readonly T[], seedStr: string): T {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % arr.length;
  return arr[index];
}

export function loadPromptTemplate(templateName: string): string {
  try {
    const filePath = path.join(process.cwd(), 'prompts', templateName);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.warn(`Prompt template lookup failed for ${templateName}; using compact fallback:`, (error as Error).message);
  }

  if (templateName === 'regenerate-task.md') {
    return COMPACT_DEFAULT_REGENERATE_TASK_PROMPT;
  }
  return COMPACT_DEFAULT_GENERATE_PROMPT;
}

export function compileGeneratePrompt(
  req: GenerateRequest,
  seed: string,
): string {
  const template = loadPromptTemplate('generate-case.md');

  const industry: Exclude<Industry, 'Acak'> = req.industry && req.industry !== 'Acak'
    ? req.industry
    : getRandomItem(SAMPLE_INDUSTRIES, seed + '-ind');
  const taskCount = resolveTaskCount(req, industry);
  const companyName = getRandomItem(SAMPLE_COMPANIES, seed + '-comp');
  const theme = resolveGenerationTheme(req, seed);
  const period = getRandomItem(SAMPLE_PERIODS, seed + '-per');
  const roleProfile = ROLE_PROFILES[req.role];
  const roleOption = ADMIN_ROLES.find((item) => item.id === req.role);
  const industryProfile = INDUSTRY_PROFILES[industry];
  const formulaPolicy = LEVEL_RULES[req.level];
  const versionForbiddenFormulas = req.excelVersion === '2016/2019' ? M365_ONLY_FORMULAS : [];
  const replacements: Record<string, string> = {
    '{{level}}': req.level,
    '{{role}}': roleProfile?.label ?? req.role,
    '{{roleDetails}}': roleProfile
      ? `${roleProfile.label}: ${roleProfile.description}. Dataset fields should include at least one of: ${roleProfile.datasetSignals.join(', ')}`
      : roleOption
        ? `${roleOption.label}: ${roleOption.desc}`
        : req.role,
    '{{industry}}': industry,
    '{{industryProfile}}': `${industryProfile.focus}. Contoh produk/layanan: ${industryProfile.products.join(', ')}. Kategori relevan: ${industryProfile.categories.join(', ')}.`,
    '{{levelFormulaPolicy}}': `Boleh: ${formulaPolicy.allowedFunctions.join(', ')}. Dilarang: ${Array.from(new Set([...formulaPolicy.forbiddenFunctions, ...versionForbiddenFormulas])).join(', ')}. Jenis tugas: ${formulaPolicy.taskKinds.join(', ')}.`,
    '{{excelVersion}}': req.excelVersion,
    '{{formulaStyle}}': req.formulaStyle === 'modern' ? 'Modern (structured references)' : 'Classic (cell/range references)',
    '{{structuredReferenceAt}}': req.structuredReferenceAt === false
      ? 'Tanpa @; gunakan referensi seluruh kolom tabel seperti TabelData[Qty Masuk]'
      : 'Pakai @ untuk referensi baris aktif seperti [@[Qty Masuk]]',
    '{{companyName}}': companyName,
    '{{theme}}': theme,
    '{{recentThemes}}': JSON.stringify(req.recentThemes ?? []),
    '{{period}}': period,
    '{{taskCount}}': String(taskCount || 5),
    '{{hintMaxChars}}': String(GENERATION_CONFIG[req.level].hintMaxChars),
    '{{explanationMaxChars}}': String(GENERATION_CONFIG[req.level].explanationMaxChars),
    '{{seed}}': seed,
  };

  let compiled = template;
  for (const [key, value] of Object.entries(replacements)) {
    compiled = compiled.split(key).join(value);
  }

  return compiled;
}

export function resolveGenerationTheme(req: GenerateRequest, seed: string): string {
  const themes = ROLE_GENERATION_THEMES[req.role] ?? SAMPLE_THEMES;
  const recentThemes = new Set(
    (req.recentThemes ?? []).map((theme) =>
      theme.toLocaleLowerCase('id').replace(/\s+/g, ' ').trim(),
    ),
  );
  const unusedThemes = themes.filter((theme) =>
    !recentThemes.has(theme.toLocaleLowerCase('id').replace(/\s+/g, ' ').trim()),
  );
  return getRandomItem(unusedThemes.length > 0 ? unusedThemes : themes, `${seed}-theme`);
}

export function resolveIndustry(industry: GenerateRequest['industry'], seed: string): Exclude<Industry, 'Acak'> {
  return industry && industry !== 'Acak'
    ? industry
    : getRandomItem(SAMPLE_INDUSTRIES, seed + '-ind');
}

export function resolveTaskCount(
  req: Pick<GenerateRequest, 'level' | 'taskCountMode' | 'taskCount'>,
  industry: Exclude<Industry, 'Acak'>,
): number {
  const config = GENERATION_CONFIG[req.level];
  if (req.taskCountMode !== 'manual') {
    return getRecommendedTaskCount(req.level, industry);
  }
  if (!config.taskCountOptions.includes(req.taskCount)) {
    throw new Error(
      `Jumlah tugas untuk level ${req.level} harus ${config.taskCountOptions.join(' atau ')}.`,
    );
  }
  return req.taskCount;
}

export function compileRegenerateTaskPrompt(params: {
  title: string;
  level: Level;
  role: string;
  industry?: string;
  scenario: string;
  excelVersion: string;
  formulaStyle?: string;
  structuredReferenceAt?: boolean;
  recommendedFormulas: string[];
  forbiddenFormulas: string[];
  columns: string[];
  taskNo: number;
  oldInstruction: string;
}): string {
  const template = loadPromptTemplate('regenerate-task.md');
  const roleProfile = ROLE_PROFILES[params.role];

  const replacements: Record<string, string> = {
    '{{title}}': params.title,
    '{{level}}': params.level,
    '{{role}}': roleProfile?.label ?? params.role,
    '{{roleDetails}}': roleProfile
      ? `${roleProfile.label}: ${roleProfile.description}. Dataset fields: ${roleProfile.datasetSignals.join(', ')}`
      : params.role,
    '{{industry}}': params.industry ?? 'Tidak ditentukan',
    '{{levelFormulaPolicy}}': (() => {
      const policy = LEVEL_RULES[params.level];
      const versionForbiddenFormulas = params.excelVersion === '2016/2019' ? M365_ONLY_FORMULAS : [];
      const forbidden = Array.from(new Set([...policy.forbiddenFunctions, ...versionForbiddenFormulas]));
      return `Diizinkan: ${policy.allowedFunctions.join(', ')}. Dilarang: ${forbidden.join(', ')}. Jenis tugas: ${policy.taskKinds.join(', ')}.`;
    })(),
    '{{scenario}}': params.scenario,
    '{{excelVersion}}': params.excelVersion,
    '{{formulaStyle}}': params.formulaStyle ?? 'Classic (cell/range references)',
    '{{structuredReferenceAt}}': params.structuredReferenceAt === false
      ? 'Tanpa @; gunakan referensi seluruh kolom tabel'
      : 'Pakai @ untuk referensi baris aktif',
    '{{recommendedFormulas}}': params.recommendedFormulas.join(', '),
    '{{forbiddenFormulas}}': params.forbiddenFormulas.join(', '),
    '{{columns}}': params.columns.join(', '),
    '{{taskNo}}': String(params.taskNo),
    '{{oldInstruction}}': params.oldInstruction,
    '{{hintMaxChars}}': String(GENERATION_CONFIG[params.level].hintMaxChars),
    '{{explanationMaxChars}}': String(GENERATION_CONFIG[params.level].explanationMaxChars),
  };

  let compiled = template;
  for (const [key, value] of Object.entries(replacements)) {
    compiled = compiled.split(key).join(value);
  }

  return compiled;
}
