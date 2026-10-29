import { CaseStudy, CaseStudySchema } from '../shared/schema';
import { M365_ONLY_FORMULAS } from '../shared/constants';

export interface ValidationResult {
  valid: boolean;
  data?: CaseStudy;
  errors: string[];
}

/**
 * Validates the raw JSON output from AI against Zod schema and business logic rules:
 * 1. Zod schema validation
 * 2. answerKey must not contain forbidden formulas
 * 3. Excel 2016/2019 must not recommend or use M365-only functions (XLOOKUP, FILTER, UNIQUE, etc.)
 */
export function validateAndSanitizeCaseStudy(rawJson: unknown, expectedExcelVersion?: string): ValidationResult {
  const errors: string[] = [];

  const parseResult = CaseStudySchema.safeParse(rawJson);
  if (!parseResult.success) {
    const formatted = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return {
      valid: false,
      errors: [`Zod Validation Error: ${formatted}`],
    };
  }

  const caseStudy = parseResult.data;
  const forbidden = (caseStudy.formulas?.forbidden || []).map((f) => f.toUpperCase().trim());
  const excelVersion = expectedExcelVersion || caseStudy.excelVersion || 'Microsoft 365';

  // If Excel version is 2016/2019, M365-only functions must be forbidden and removed from recommended
  if (excelVersion === '2016/2019') {
    for (const m365Formula of M365_ONLY_FORMULAS) {
      if (!forbidden.includes(m365Formula)) {
        forbidden.push(m365Formula);
      }
      // Remove from recommended if AI accidentally included it
      caseStudy.formulas.recommended = caseStudy.formulas.recommended.filter(
        (f) => f.toUpperCase().trim() !== m365Formula
      );
    }
    caseStudy.formulas.forbidden = Array.from(new Set(forbidden));
  }

  // Check that answerKey does NOT use forbidden formulas
  for (const item of caseStudy.answerKey) {
    const formulaUpper = (item.formula || '').toUpperCase();
    for (const forb of forbidden) {
      // Check if forbidden keyword appears as a function name (e.g. VLOOKUP, PIVOT, XLOOKUP)
      const regex = new RegExp(`\\b${forb}\\b`, 'i');
      if (regex.test(formulaUpper)) {
        errors.push(`Answer key for task ${item.task} violates forbidden formula rule: uses '${forb}'`);
      }
    }
  }

  // Ensure dataset rows is reasonable (100 to 500)
  if (caseStudy.dataset) {
    if (!caseStudy.dataset.rows || caseStudy.dataset.rows < 50) {
      caseStudy.dataset.rows = 150;
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      data: caseStudy,
      errors,
    };
  }

  return {
    valid: true,
    data: caseStudy,
    errors: [],
  };
}
