import { CaseStudy, CaseStudySchema } from '../shared/schema';
import { getIndustryColumnValues, INDUSTRY_PROFILES, M365_ONLY_FORMULAS, ROLE_PROFILES } from '../shared/constants';
import { normalizeExcelFormulaLocale } from '../shared/excel-formula-locale';

export interface ValidationResult {
  valid: boolean;
  data?: CaseStudy;
  errors: string[];
}

const ROLE_DATASET_SIGNALS: Record<string, string[]> = {
  'Penjualan': ['penjualan', 'order', 'transaksi', 'pelanggan', 'customer', 'omzet', 'subtotal', 'piutang'],
  'Inventory/Gudang': ['stok', 'persediaan', 'barang', 'gudang', 'mutasi', 'opname'],
  'HRD/Absensi': ['pegawai', 'karyawan', 'absen', 'kehadiran', 'cuti', 'lembur'],
  'Keuangan/Kasir': ['kas', 'keuangan', 'pembayaran', 'pengeluaran', 'anggaran', 'rekonsiliasi', 'nominal', 'biaya'],
  'Pengadaan': ['pengadaan', 'pembelian', 'vendor', 'pemasok', 'purchase order', 'nomor_po'],
  'Sekretaris/Surat': ['surat', 'dokumen', 'agenda', 'disposisi', 'arsip'],
  'MBG': ['kpi', 'unit', 'grup', 'pendapatan', 'operasional'],
};

function containsAny(text: string, terms: string[]): boolean {
  const normalized = text.toLocaleLowerCase('id');
  return terms.some((term) => normalized.includes(term.toLocaleLowerCase('id')));
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
  const datasetDescription = [
    ...caseStudy.dataset.columns.flatMap((column) => [column.name, ...(column.values ?? [])]),
  ].join(' ');
  const profile = ROLE_PROFILES[role];
  if (profile && !containsAny(narrative, profile.signals)) {
    issues.push(`skenario dan tugas tidak menunjukkan tanggung jawab ${profile.label}`);
  }

  const roleDatasetSignals = ROLE_DATASET_SIGNALS[role];
  if (roleDatasetSignals && !containsAny(datasetDescription, roleDatasetSignals)) {
    issues.push(`kolom dataset tidak terlihat sesuai dengan bidang admin ${profile?.label ?? role}`);
  }

  const industryProfile = INDUSTRY_PROFILES[industry];
  if (!containsAny(narrative, industryProfile.signals)) {
    issues.push(`skenario dan tugas tidak menunjukkan konteks industri ${industry}`);
  }
  if (!containsAny(datasetDescription, industryProfile.signals)) {
    issues.push(`kolom/nilai dataset tidak spesifik untuk industri ${industry}`);
  }

  return issues;
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
  for (const column of caseStudy.dataset.columns) {
    const industryValues = getIndustryColumnValues(column.name, caseStudy.industry);
    if (industryValues && column.type === 'enum') {
      column.values = industryValues;
    }
  }
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
