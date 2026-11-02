import { CaseStudy, CaseStudySchema, DatasetSchema } from '../shared/schema';
import { getIndustryColumnValues, INDUSTRY_PROFILES, M365_ONLY_FORMULAS, ROLE_PROFILES } from '../shared/constants';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';
import { type DataRow } from '../shared/dataset-generator';
import { buildValidatedDataset } from '../shared/dataset-validation';
import { isIsoDate, resolveDatasetColumns } from '@/lib/column-types';
import { validateTaskCalculation } from './formula-engine';
import { getFormulaFunctionNames, LEVEL_RULES } from '../shared/level-rules';

export interface ValidationResult {
  valid: boolean;
  data?: CaseStudy;
  errors: string[];
  warnings: string[];
}

function containsAny(text: string, terms: string[]): boolean {
  const normalize = (value: string) =>
    value.toLocaleLowerCase('id').replace(/[_-]+/g, ' ');
  const normalized = normalize(text);
  return terms.some((term) => normalized.includes(normalize(term)));
}

function sanitizeDatasetRange(
  range: unknown,
  columnType: string | undefined,
): [number, number] | [string, string] | undefined {
  if (!Array.isArray(range) || range.length !== 2) return undefined;

  if (columnType === 'integer' || columnType === 'decimal' || columnType === 'currency' ||
    columnType === 'int' || columnType === 'number') {
    const numericValues = range.map((value) => {
      if (typeof value === 'number') return value;
      if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return NaN;
      return Number(value);
    });
    const [min, max] = numericValues;
    if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
      return [min, max];
    }
    return undefined;
  }

  if (columnType === 'date') {
    const [start, end] = range;
    if (isIsoDate(start) && isIsoDate(end) && start <= end) {
      return [start, end];
    }
  }

  return undefined;
}

function sanitizeDatasetValues(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const sanitized = values
    .filter((value): value is string | number | boolean =>
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
    )
    .map(String);
  return sanitized.length > 0 ? sanitized : undefined;
}

function preSanitizeRawJson(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (typeof record.dataset !== 'object' || record.dataset === null || Array.isArray(record.dataset)) {
    return raw;
  }
  const dataset = record.dataset as Record<string, unknown>;
  const parsedRows = typeof dataset.rows === 'string' ? Number(dataset.rows) : dataset.rows;
  const columns = Array.isArray(dataset.columns)
    ? dataset.columns.map((rawColumn) => {
        if (typeof rawColumn !== 'object' || rawColumn === null || Array.isArray(rawColumn)) return rawColumn;
        const column = rawColumn as Record<string, unknown>;
        const type = column.type === undefined ? undefined : String(column.type).toLowerCase();
        return {
          ...column,
          type,
          values: sanitizeDatasetValues(column.values),
          range: sanitizeDatasetRange(column.range, type),
        };
      })
    : dataset.columns;
  return {
    ...record,
    dataset: {
      ...dataset,
      rows: Number.isSafeInteger(parsedRows) ? parsedRows : dataset.rows,
      columns,
    },
  };
}

export function getCaseStudyAlignmentIssues(
  caseStudy: CaseStudy,
  role: string,
  industry: Exclude<CaseStudy['industry'], undefined | 'Acak'>,
): string[] {
  const issues: string[] = [];
  const narrative = [
    caseStudy.title,
    caseStudy.scenario,
    ...caseStudy.tasks.flatMap((task) => [task.instruction, task.hint, task.targetResult]),
  ].join(' ');
  const taskNarrative = caseStudy.tasks
    .flatMap((task) => [task.instruction, task.hint])
    .join(' ');
  const title = caseStudy.title;
  const datasetDescription = [
    ...caseStudy.dataset.columns.flatMap((column) => [column.name, ...(column.values ?? [])]),
  ].join(' ');
  const profile = ROLE_PROFILES[role];
  if (profile && !containsAny(narrative, profile.signals)) {
    issues.push(`skenario dan tugas tidak menunjukkan tanggung jawab ${profile.label}`);
  }

  if (profile && !containsAny(taskNarrative, profile.specificSignals)) {
    issues.push(`instruksi tugas tidak cukup spesifik untuk bidang admin ${profile.label}`);
  }

  if (profile) {
    const conflictingTitleRoles = Object.entries(ROLE_PROFILES)
      .filter(([candidateRole, candidateProfile]) =>
        candidateRole !== role && containsAny(title, candidateProfile.specificSignals),
      )
      .map(([, candidateProfile]) => candidateProfile.label);
    if (
      conflictingTitleRoles.length > 0 &&
      !containsAny(title, profile.specificSignals)
    ) {
      issues.push(
        `judul "${caseStudy.title}" mengarah ke ${conflictingTitleRoles.join('/')} bukan ${profile.label}`,
      );
    }
  }

  if (profile && !containsAny(datasetDescription, profile.datasetSignals)) {
    issues.push(`kolom dataset tidak cukup spesifik untuk bidang admin ${profile.label}`);
  }

  const industryProfile = INDUSTRY_PROFILES[industry];
  if (!containsAny(narrative, industryProfile.signals)) {
    issues.push(`skenario dan tugas tidak menunjukkan konteks industri ${industry}`);
  }
  const industryDatasetSignals = [
    ...industryProfile.signals,
    ...industryProfile.products,
    ...industryProfile.categories,
  ];
  if (!containsAny(datasetDescription, industryDatasetSignals)) {
    issues.push(`kolom/nilai dataset tidak spesifik untuk industri ${industry}`);
  }

  return issues;
}

/**
 * Baris dataset yang sudah DIVALIDASI (seed sama dengan yang dipakai prompt/UI).
 * Bila validasi gagal, kembalikan baris kosong agar pemeriksaan kunci jawaban
 * tidak memakai data buruk.
 */
function resolveValidatedRows(caseStudy: CaseStudy): DataRow[] {
  try {
    return buildValidatedDataset({
      seed: caseStudy.seed,
      level: caseStudy.level,
      industry: caseStudy.industry,
      dataset: caseStudy.dataset,
    }).rows;
  } catch (error) {
    console.warn('[validator] dataset gagal divalidasi', (error as Error).message);
    return [];
  }
}

export function getTaskAnswerAlignmentIssues(
  caseStudy: CaseStudy,
  taskNumbers?: number[],
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tasks = taskNumbers
    ? caseStudy.tasks.filter((task) => taskNumbers.includes(task.no))
    : caseStudy.tasks;
  const answers = taskNumbers
    ? caseStudy.answerKey.filter((answer) => taskNumbers.includes(answer.task))
    : caseStudy.answerKey;
  const datasetRows = resolveValidatedRows(caseStudy);
  const availableColumns = new Set(caseStudy.dataset.columns.map((column) => column.name));
  const forbiddenFunctions = new Set(LEVEL_RULES[caseStudy.level].forbiddenFunctions);
  const allowedFunctions = new Set(LEVEL_RULES[caseStudy.level].allowedFunctions);
  const rubricTaskKinds = new Set([
    'formatting',
    'data-validation',
    'pivot-table',
    'conditional-formatting',
    'named-range',
    'portfolio',
  ]);

  for (const task of tasks) {
    const taskAnswers = answers.filter((answer) => answer.task === task.no);
    if (taskAnswers.length !== 1) {
      errors.push(`tugas ${task.no} harus memiliki tepat satu kunci jawaban yang cocok`);
      continue;
    }

    const answer = taskAnswers[0];
    if (answer.mode !== task.answerMode) {
      warnings.push(`mode kunci jawaban tugas ${task.no} tidak sesuai dengan mode tugas`);
    }
    if (rubricTaskKinds.has(task.taskKind) && task.answerMode !== 'rubric') {
      warnings.push(`jenis tugas ${task.taskKind} sebaiknya menggunakan mode rubric`);
    }
    if (!LEVEL_RULES[caseStudy.level].taskKinds.includes(task.taskKind)) {
      warnings.push(`jenis tugas ${task.taskKind} mungkin tidak diizinkan pada level ${caseStudy.level}`);
    }

    // Validasi columnsUsed - FATAL jika kolom tidak ada di dataset
    if (task.columnsUsed.length === 0) {
      warnings.push(`tugas ${task.no} sebaiknya menyebutkan columnsUsed`);
    }
    const missingColumns = [...task.columnsUsed, ...answer.columnsUsed]
      .filter((column) => !availableColumns.has(column));
    for (const column of new Set(missingColumns)) {
      errors.push(`tugas ${task.no} menggunakan kolom yang tidak ada: ${column}`);
    }
    if (task.dateColumn && !availableColumns.has(task.dateColumn)) {
      errors.push(`tugas ${task.no} menggunakan dateColumn yang tidak ada: ${task.dateColumn}`);
    }

    // Validasi mode rubric
    if (answer.mode === 'rubric') {
      if (answer.rubricChecklist.length === 0) {
        warnings.push(`tugas ${task.no} mode rubric sebaiknya memiliki checklist`);
      }
      if (answer.formula?.trim() || task.formula?.trim()) {
        warnings.push(`tugas ${task.no} mode rubric sebaiknya tidak memiliki formula`);
      }
      continue;
    }

    // Validasi mode computed - FATAL jika formula kosong
    const formula = answer.formula?.trim();
    if (!formula) {
      errors.push(`tugas ${task.no} mode computed harus memiliki formula`);
      continue;
    }

    // Validasi fungsi terlarang dengan regex yang benar - FATAL
    const functionNames = getFormulaFunctionNames(formula);
    const forbidden = functionNames.find((name) => forbiddenFunctions.has(name));
    if (forbidden) {
      errors.push(`ERROR FATAL: Kunci tugas ${task.no} memakai fungsi terlarang "${forbidden}" pada level ${caseStudy.level}. Silakan ganti dengan fungsi yang diizinkan: ${Array.from(allowedFunctions).join(', ')}.`);
      continue;
    }

    const unsupported = functionNames.find((name) => !allowedFunctions.has(name));
    if (unsupported) {
      warnings.push(`kunci tugas ${task.no} memakai fungsi ${unsupported} yang mungkin tidak diizinkan pada level ${caseStudy.level}`);
    }

    // Validasi eksekusi formula - FATAL jika gagal eksekusi
    try {
      const expected = validateTaskCalculation(task, formula, caseStudy, datasetRows);
      if (answer.expectedValue === undefined) {
        warnings.push(`tugas ${task.no} belum memiliki expectedValue hasil perhitungan`);
      } else if (answer.expectedValue !== expected) {
        warnings.push(`expectedValue tugas ${task.no} tidak sesuai hasil eksekusi formula`);
      }
    } catch (error) {
      errors.push(`formula tugas ${task.no} gagal dieksekusi: ${(error as Error).message}`);
    }
  }

  return { errors, warnings };
}


export function validateAndSanitizeCaseStudy(rawJson: unknown, expectedExcelVersion?: string): ValidationResult {
  if (typeof rawJson === 'object' && rawJson !== null && !Array.isArray(rawJson)) {
    const raw = rawJson as Record<string, unknown>;
    const missingFields = ['title', 'scenario', 'tasks', 'formulas', 'dataset', 'answerKey']
      .filter((field) => !(field in raw));
    if (missingFields.length > 0) {
      return {
        valid: false,
        errors: [`Respons AI tidak lengkap; field wajib tidak ada: ${missingFields.join(', ')}`],
        warnings: [],
      };
    }
    if (!Array.isArray(raw.tasks) || !Array.isArray(raw.answerKey)) {
      return {
        valid: false,
        errors: ['Respons AI tidak valid; tasks dan answerKey harus berupa array.'],
        warnings: [],
      };
    }
    if (typeof raw.formulas !== 'object' || raw.formulas === null || Array.isArray(raw.formulas)) {
      return {
        valid: false,
        errors: ['Respons AI tidak valid; formulas harus berupa object.'],
        warnings: [],
      };
    }
    const rawFormulas = raw.formulas as Record<string, unknown>;
    if (!['recommended', 'allowed', 'forbidden'].every((field) => Array.isArray(rawFormulas[field]))) {
      return {
        valid: false,
        errors: ['Respons AI tidak lengkap; formulas harus memiliki array recommended, allowed, dan forbidden.'],
        warnings: [],
      };
    }
    if (
      typeof raw.dataset !== 'object' ||
      raw.dataset === null ||
      typeof (raw.dataset as Record<string, unknown>).sheetName !== 'string' ||
      typeof (raw.dataset as Record<string, unknown>).rows !== 'number' ||
      !Array.isArray((raw.dataset as Record<string, unknown>).columns)
    ) {
      return {
        valid: false,
        errors: ['Respons AI tidak lengkap; dataset harus memiliki sheetName, rows, dan columns.'],
        warnings: [],
      };
    }
  }

  const sanitized = preSanitizeRawJson(rawJson);

  const parseResult = CaseStudySchema.safeParse(sanitized);
  if (!parseResult.success) {
    const formatted = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return {
      valid: false,
      errors: [`Zod Validation Error: ${formatted}`],
      warnings: [],
    };
  }

  const caseStudy = parseResult.data;
  // Kolom AI dipetakan ke registry tipe TERTUTUP memakai nama kolom, sehingga
  // "Jam_Masuk" selalu `time` dan "Cuti" selalu `integer` (tidak pernah teks acak).
  const resolvedColumns = resolveDatasetColumns(caseStudy.dataset.columns, {
    categoryValues: (name) => getIndustryColumnValues(name, caseStudy.industry),
  });
  caseStudy.dataset = DatasetSchema.parse({
    ...caseStudy.dataset,
    columns: resolvedColumns,
  });
  const excelVersion = expectedExcelVersion || caseStudy.excelVersion || 'Microsoft 365';
  const levelRules = LEVEL_RULES[caseStudy.level];
  const versionForbidden = excelVersion === '2016/2019'
    ? M365_ONLY_FORMULAS
    : [];
  caseStudy.formulas = {
    recommended: levelRules.allowedFunctions.filter((name) => !versionForbidden.includes(name)),
    allowed: levelRules.allowedFunctions.filter((name) => !versionForbidden.includes(name)),
    forbidden: [...levelRules.forbiddenFunctions, ...versionForbidden],
  };
  caseStudy.answerKey = caseStudy.answerKey.map((item) => ({
    ...item,
    ...(item.formula ? { formula: normalizeExcelFormulaLocale(item.formula) } : {}),
  }));
  caseStudy.dataset.rows = Math.max(50, Math.min(caseStudy.dataset.rows || 150, 500));

  return {
    valid: true,
    data: caseStudy,
    errors: [],
    warnings: [],
  };
}
