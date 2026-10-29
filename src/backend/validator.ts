import { CaseStudy, CaseStudySchema } from '../shared/schema';
import { M365_ONLY_FORMULAS } from '../shared/constants';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';

export interface ValidationResult {
  valid: boolean;
  data?: CaseStudy;
  errors: string[];
}

function preSanitizeRawJson(raw: any): any {
  if (typeof raw !== 'object' || raw === null) return raw;

  // 1. Sanitize dataset
  if (raw.dataset && typeof raw.dataset === 'object') {
    if (typeof raw.dataset.rows === 'string') {
      raw.dataset.rows = parseInt(raw.dataset.rows, 10) || 150;
    }
    if (!raw.dataset.sheetName) {
      raw.dataset.sheetName = 'Data_Admin';
    }
    if (Array.isArray(raw.dataset.columns)) {
      raw.dataset.columns = raw.dataset.columns.map((c: any) => {
        if (typeof c !== 'object' || c === null) return { name: 'Item', type: 'text' };
        let colType = c.type ? String(c.type).toLowerCase() : 'text';
        if (colType === 'string') colType = 'text';
        if (colType === 'integer') colType = 'int';
        if (!['date', 'text', 'number', 'int', 'currency', 'enum'].includes(colType)) {
          colType = 'text';
        }
        return {
          name: c.name || 'Kolom',
          type: colType,
          values: Array.isArray(c.values) ? c.values : undefined,
          range: Array.isArray(c.range) ? c.range : undefined,
        };
      });
    }
  }

  // 2. Sanitize tasks
  if (Array.isArray(raw.tasks)) {
    raw.tasks = raw.tasks.map((t: any, idx: number) => ({
      no: typeof t.no === 'number' ? t.no : idx + 1,
      instruction: t.instruction || 'Selesaikan instruksi tugas',
      hint: t.hint || '',
      targetResult: t.targetResult || '',
    }));
  }

  // 3. Sanitize formulas
  if (!raw.formulas || typeof raw.formulas !== 'object') {
    raw.formulas = { recommended: [], allowed: [], forbidden: [] };
  } else {
    raw.formulas.recommended = Array.isArray(raw.formulas.recommended) ? raw.formulas.recommended : [];
    raw.formulas.allowed = Array.isArray(raw.formulas.allowed) ? raw.formulas.allowed : [];
    raw.formulas.forbidden = Array.isArray(raw.formulas.forbidden) ? raw.formulas.forbidden : [];
  }

  // 4. Sanitize answerKey
  if (!Array.isArray(raw.answerKey)) {
    raw.answerKey = [];
  } else {
    raw.answerKey = raw.answerKey.map((a: any, idx: number) => ({
      task: typeof a.task === 'number' ? a.task : idx + 1,
      formula: a.formula || '=SUM(...)',
      explanation: a.explanation || '',
    }));
  }

  return raw;
}

/**
 * Validates the raw JSON output from AI against Zod schema and business logic rules
 */
export function validateAndSanitizeCaseStudy(rawJson: unknown, expectedExcelVersion?: string): ValidationResult {
  const sanitized = preSanitizeRawJson(rawJson);

  const parseResult = CaseStudySchema.safeParse(sanitized);
  if (!parseResult.success) {
    const formatted = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return {
      valid: false,
      errors: [`Zod Validation Error: ${formatted}`],
    };
  }

  const caseStudy = parseResult.data;
  caseStudy.answerKey = caseStudy.answerKey.map((item) => ({
    ...item,
    formula: normalizeExcelFormulaLocale(item.formula),
  }));
  const forbidden = (caseStudy.formulas?.forbidden || []).map((f) => f.toUpperCase().trim());
  const excelVersion = expectedExcelVersion || caseStudy.excelVersion || 'Microsoft 365';

  // If Excel version is 2016/2019, M365-only functions must be forbidden and removed from recommended
  if (excelVersion === '2016/2019') {
    for (const m365Formula of M365_ONLY_FORMULAS) {
      if (!forbidden.includes(m365Formula)) {
        forbidden.push(m365Formula);
      }
      caseStudy.formulas.recommended = caseStudy.formulas.recommended.filter(
        (f) => f.toUpperCase().trim() !== m365Formula
      );
    }
    caseStudy.formulas.forbidden = Array.from(new Set(forbidden));
  }

  // Sanitize answerKey if it accidentally uses a forbidden formula
  for (const item of caseStudy.answerKey) {
    const formulaUpper = (item.formula || '').toUpperCase();
    for (const forb of forbidden) {
      const regex = new RegExp(`\\b${forb}\\b`, 'i');
      if (regex.test(formulaUpper)) {
        // Soft sanitization rather than hard crash
        item.explanation = `${item.explanation || ''} (Catatan: Hindari ${forb} sesuai aturan level).`.trim();
      }
    }
  }

  // Ensure dataset rows is reasonable (100 to 500)
  if (caseStudy.dataset) {
    if (!caseStudy.dataset.rows || caseStudy.dataset.rows < 50) {
      caseStudy.dataset.rows = 150;
    }
  }

  return {
    valid: true,
    data: caseStudy,
    errors: [],
  };
}
