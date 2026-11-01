import { CaseStudy, CaseStudySchema } from '../shared/schema';
import { getIndustryColumnValues, INDUSTRY_PROFILES, LEVEL_CONFIG, M365_ONLY_FORMULAS, ROLE_PROFILES } from '../shared/constants';
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

function containsWholeValue(text: string, value: string): boolean {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedValue}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

function getExcelColumnName(index: number): string {
  let columnNumber = index + 1;
  let columnName = '';
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return columnName;
}

function normalizeNumericLiteral(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, '');
  const normalized = cleaned
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(/,(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? String(number) : '';
}

function getNumericCriteria(text: string): Array<{ operator: string; value: string }> {
  const criteria: Array<{ operator: string; value: string }> = [];
  const pattern =
    /(?:(minimal(?:nya)?|minimum|setidaknya|setidak-tidaknya|sekurang-kurangnya|paling sedikit|paling tidak|tidak kurang dari|maksimal(?:nya)?|maximum|paling banyak|sebanyak-banyaknya|tidak lebih dari|lebih dari(?: atau sama dengan)?|lebih besar(?: dari)?(?: atau sama dengan)?|kurang dari(?: atau sama dengan)?|lebih kecil(?: dari)?(?: atau sama dengan)?|di bawah|di atas)|([<>]=?))\s*(?:rp\s*)?(\d[\d.,]*)(?:\s*(miliar|milyar|juta|jt|ribu|rb)\b)?/gi;

  for (const match of text.matchAll(pattern)) {
    const phrase = (match[1] ?? match[2]).toLocaleLowerCase('id');
    let operator: string;
    if (
      phrase.includes('minimal') ||
      phrase.includes('minimum') ||
      phrase.includes('setidaknya') ||
      phrase.includes('sekurang-kurangnya') ||
      phrase.includes('paling tidak') ||
      phrase.includes('tidak kurang dari') ||
      phrase.includes('paling sedikit') ||
      (phrase.includes('atau sama dengan') && (phrase.includes('lebih') || phrase.includes('besar')))
    ) {
      operator = '>=';
    } else if (
      phrase.includes('maksimal') ||
      phrase.includes('maximum') ||
      phrase.includes('paling banyak') ||
      phrase.includes('sebanyak-banyaknya') ||
      phrase.includes('tidak lebih dari')
    ) {
      operator = '<=';
    } else if (phrase.includes('kurang dari') || phrase.includes('lebih kecil') || phrase.includes('di bawah')) {
      operator = phrase.includes('atau sama dengan') ? '<=' : '<';
    } else if (phrase.includes('di atas')) {
      operator = '>';
    } else if (phrase.includes('lebih dari')) {
      operator = phrase.includes('atau sama dengan') ? '>=' : '>';
    } else {
      operator = phrase;
    }

    const multiplier = {
      miliar: 1_000_000_000,
      milyar: 1_000_000_000,
      juta: 1_000_000,
      jt: 1_000_000,
      ribu: 1_000,
      rb: 1_000,
    }[match[4]?.toLocaleLowerCase('id') ?? ''] ?? 1;
    const parsedValue = Number(normalizeNumericLiteral(match[3])) * multiplier;
    const value = Number.isFinite(parsedValue) ? String(parsedValue) : '';
    if (value) criteria.push({ operator, value });
  }
  return criteria;
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

export function getTaskAnswerAlignmentIssues(
  caseStudy: CaseStudy,
  taskNumbers?: number[],
): string[] {
  const issues: string[] = [];
  const tasks = taskNumbers
    ? caseStudy.tasks.filter((task) => taskNumbers.includes(task.no))
    : caseStudy.tasks;
  const answerKey = taskNumbers
    ? caseStudy.answerKey.filter((answer) => taskNumbers.includes(answer.task))
    : caseStudy.answerKey;
  const taskNumbersInCase = new Set(caseStudy.tasks.map((task) => task.no));

  if (!taskNumbers) {
    if (taskNumbersInCase.size !== caseStudy.tasks.length) {
      issues.push('nomor tugas harus unik');
    }
    if (caseStudy.tasks.some((task, index) => task.no !== index + 1)) {
      issues.push('nomor tugas harus berurutan dari 1');
    }
  }

  for (const task of tasks) {
    const answers = answerKey.filter((answer) => answer.task === task.no);
    if (answers.length !== 1) {
      issues.push(`tugas ${task.no} harus memiliki tepat satu kunci jawaban yang cocok`);
      continue;
    }

    const formula = answers[0].formula.trim();
    const functionNames = new Set(
      Array.from(formula.matchAll(/\b([A-Z][A-Z0-9.]*)\s*\(/gi), (match) => match[1].toUpperCase()),
    );

    const forbiddenFormulas = [
      ...caseStudy.formulas.forbidden,
      ...LEVEL_CONFIG[caseStudy.level].forbidden,
      ...(caseStudy.excelVersion === '2016/2019' ? M365_ONLY_FORMULAS : []),
    ];
    for (const forbidden of forbiddenFormulas) {
      const forbiddenFunctions = forbidden.toUpperCase().match(/[A-Z][A-Z0-9.]*/g) ?? [];
      const usedForbidden = forbiddenFunctions.find((name) =>
        new RegExp(`\\b${name}\\s*\\(`, 'i').test(formula),
      );
      if (usedForbidden) {
        issues.push(`kunci tugas ${task.no} memakai fungsi terlarang ${usedForbidden}`);
      }
    }

    const taskText = `${task.instruction} ${task.hint}`.toLocaleLowerCase('id');
    const isAggregate = /\b(rata-rata|rerata|average|total|jumlahkan|frekuensi|persentase|jumlah keseluruhan|nilai tertinggi|nilai terendah)\b/i
      .test(taskText);
    const mentionsFilterCriterion =
      /\b(berdasarkan|khusus|hanya|filter|difilter|syarat|kriteria|jika|apabila|bila|ketika|berstatus)\b/i.test(taskText) ||
      /\buntuk\s+(layanan|kategori|status|shift|wilayah|departemen|jenis|cabang|produk|barang|pegawai|vendor|pelanggan)\b/i.test(taskText);
    const namesEnumValue = caseStudy.dataset.columns.some((column) =>
      column.values?.some((value) => containsWholeValue(taskText, value)),
    );
    const requiredEnumCriteria = caseStudy.dataset.columns.flatMap((column, index) =>
      column.type === 'enum'
        ? (column.values ?? [])
            .filter((value) => containsWholeValue(taskText, value))
            .map((value) => ({
              column: column.name,
              columnLetter: getExcelColumnName(index),
              value,
            }))
        : [],
    );
    const hasCriteriaAwareAggregate =
      /\b(?:SUMIFS?|COUNTIFS?|AVERAGEIFS?|SUMPRODUCT|SUBTOTAL)\s*\(/i.test(formula) ||
      (/\b(?:AVERAGE|SUM)\s*\(\s*IF\s*\(/i.test(formula) &&
        (caseStudy.excelVersion === 'Microsoft 365' ||
          /ctrl\s*\+\s*shift\s*\+\s*enter/i.test(answers[0].explanation))) ||
      (functionNames.has('IF') &&
        /\b(?:AVERAGE|SUM|COUNT)\s*\(/i.test(formula) &&
        /\b(kolom bantu|helper column)\b/i.test(`${task.instruction} ${task.hint}`));

    if (
      formula.startsWith('=') &&
      isAggregate &&
      (mentionsFilterCriterion || namesEnumValue) &&
      !hasCriteriaAwareAggregate
    ) {
      issues.push(
        `tugas ${task.no} meminta agregasi dengan kriteria, tetapi rumus tidak menerapkan kriteria tersebut (AVERAGE/SUM/COUNT biasa tetap menghitung baris yang difilter)`,
      );
    }

    if (
      formula.startsWith('=') &&
      requiredEnumCriteria.length > 0 &&
      (isAggregate || mentionsFilterCriterion)
    ) {
      for (const criterion of requiredEnumCriteria) {
        if (!containsWholeValue(formula, criterion.value)) {
          issues.push(
            `kunci tugas ${task.no} tidak menerapkan kriteria "${criterion.value}" pada kolom ${criterion.column}`,
          );
        }
      }
    }

    if (formula.startsWith('=')) {
      const requiredNumericCriteria = getNumericCriteria(taskText);
      for (const criterion of requiredNumericCriteria) {
        const operator = criterion.operator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const condition = new RegExp(`${operator}\\s*"?\\s*&?\\s*(\\d[\\d.,]*)`, 'i').exec(formula);
        const hasCriterion = condition !== null && normalizeNumericLiteral(condition[1]) === criterion.value;
        if (!hasCriterion) {
          issues.push(
            `kunci tugas ${task.no} tidak menerapkan kondisi ${criterion.operator} ${criterion.value} yang disebutkan pada instruksi`,
          );
        }
      }

      if (caseStudy.level !== 'portfolio') {
        const referencedSheets = Array.from(
          formula.matchAll(/(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_. ]*))!/g),
          (match) => (match[1] ?? match[2]).replace(/''/g, "'").trim().toLocaleLowerCase('id'),
        );
        const datasetSheetName = caseStudy.dataset.sheetName.toLocaleLowerCase('id');
        for (const sheetName of referencedSheets) {
          if (sheetName !== datasetSheetName) {
            issues.push(
              `kunci tugas ${task.no} merujuk sheet sumber "${sheetName}" yang tidak tersedia; dataset hanya menyediakan "${caseStudy.dataset.sheetName}"`,
            );
          }
        }
      }
    }

    if (formula.startsWith('=')) {
      const normalizedTaskText = taskText.replace(/[_\s]+/g, ' ');
      const formulaWithoutText = formula.replace(/"(?:[^"]|"")*"/g, '""');
      const referencedColumns = new Set(
        Array.from(
          formulaWithoutText.matchAll(/\$?([A-Z]{1,3})\$?\d+/gi),
          (match) => ({
            letter: match[1].toUpperCase(),
            isSheetReference: formulaWithoutText[match.index! - 1] === '!',
          }),
        ),
      );
      const localReferencedColumns = new Set(
        Array.from(referencedColumns)
          .map((reference) => reference.letter),
      );
      const mentionedDatasetColumns = caseStudy.dataset.columns
        .map((column, index) => ({
          name: column.name,
          columnLetter: getExcelColumnName(index),
          normalizedName: column.name.replace(/[_\s]+/g, ' ').toLocaleLowerCase('id'),
          values: caseStudy.dataset.columns[index].values ?? [],
        }))
        .filter((column) => {
          if (column.values.some((value) => containsWholeValue(taskText, value))) {
            return true;
          }
          if (normalizedTaskText.includes(column.normalizedName)) {
            const isOutputStatus =
              column.normalizedName === 'status' &&
              /\b(beri|tentukan|menentukan|klasifikasikan|isi|buat)\s+status\b/i.test(taskText);
            return !isOutputStatus;
          }
          const genericTerms = new Set([
            'transaksi',
            'data',
            'baris',
            'nomor',
            'invoice',
            'voucher',
            'jumlah',
            'total',
            'kode',
            'nama',
            'barang',
            'produk',
            'status',
          ]);
          return column.normalizedName
            .split(' ')
            .filter((part) => part.length >= 3 && !genericTerms.has(part))
            .some((part) => taskText.includes(part));
        });

      for (const column of mentionedDatasetColumns) {
        const formulaReferencesColumn = caseStudy.formulaStyle === 'modern'
          ? formula.includes(`[${column.name}]`)
          : localReferencedColumns.has(column.columnLetter);
        if (!formulaReferencesColumn) {
          issues.push(
            `tugas ${task.no} menyebut kolom ${column.name}, tetapi rumus tidak merujuk kolom tersebut`,
          );
        }
      }
    }
  }

  if (!taskNumbers) {
    for (const answer of caseStudy.answerKey) {
      if (!taskNumbersInCase.has(answer.task)) {
        issues.push(`kunci jawaban merujuk ke tugas ${answer.task} yang tidak ada`);
      }
    }
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
  const forbidden = [
    ...(caseStudy.formulas?.forbidden || []),
    ...LEVEL_CONFIG[caseStudy.level].forbidden,
  ].map((formula) => formula.toUpperCase().trim());
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
  }
  caseStudy.formulas.forbidden = Array.from(new Set(forbidden));
  const forbiddenSet = new Set(caseStudy.formulas.forbidden);
  const usesForbiddenFormula = (formula: string) => {
    const formulaNames = new Set<string>(
      formula.toUpperCase().match(/[A-Z][A-Z0-9.]*/g) ?? [],
    );
    return Array.from(forbiddenSet).some((forbiddenFormula) =>
      (forbiddenFormula.match(/[A-Z][A-Z0-9.]*/g) ?? []).some((name) =>
        formulaNames.has(name),
      ),
    );
  };
  caseStudy.formulas.recommended = caseStudy.formulas.recommended.filter(
    (formula) => !usesForbiddenFormula(formula),
  );
  caseStudy.formulas.allowed = caseStudy.formulas.allowed.filter(
    (formula) => !usesForbiddenFormula(formula),
  );

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
