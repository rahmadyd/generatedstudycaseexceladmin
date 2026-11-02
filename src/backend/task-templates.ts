import { AnswerKeyItem, CaseStudy, DatasetColumn, DatasetSpec, Industry, Task } from '../shared/schema';
import { DataRow } from '../shared/dataset-generator';
import { LEVEL_RULES, TaskKind } from '../shared/level-rules';
import { getIndustryColumnValues, INDUSTRY_PROFILES } from '../shared/constants';

export interface DeterministicTaskSet {
  tasks: Task[];
  answerKey: AnswerKeyItem[];
}

type TaskContext = Pick<CaseStudy, 'dataset' | 'level' | 'role' | 'excelVersion'>;

export function ensureTemplateDataset(
  dataset: DatasetSpec,
  level: CaseStudy['level'],
  role: string,
  industry?: Industry,
): DatasetSpec {
  const columns = [...dataset.columns];
  const addColumn = (column: DatasetColumn) => {
    if (!columns.some((existing) => existing.name.toLocaleLowerCase('id') === column.name.toLocaleLowerCase('id'))) {
      columns.push(column);
    }
  };
  const numericTypes: DatasetColumn['type'][] = ['number', 'int', 'currency'];
  if (!columns.some((column) => numericTypes.includes(column.type))) {
    addColumn({ name: 'Nilai_Administrasi', type: 'currency', range: [1000, 1000000] });
  }
  if (level !== 'easy') {
    const profile = industry && industry !== 'Acak' ? INDUSTRY_PROFILES[industry] : undefined;
    const industryCategoryExists = columns.some((column) =>
      column.type === 'enum' && Boolean(getIndustryColumnValues(column.name, industry)),
    );
    if (!industryCategoryExists) {
      addColumn({
        name: 'Kategori_Operasional',
        type: 'enum',
        values: profile?.categories.length ? profile.categories : ['Umum', 'Prioritas'],
      });
    }
    if (!columns.some((column) => column.type === 'date')) {
      addColumn({
        name: 'Tanggal_Transaksi',
        type: 'date',
        range: ['2026-01-01', '2026-03-31'],
      });
    }
    const keyColumnExists = columns.some((column) => /(kode|sku|^id|nomor|produk|barang|item)/i.test(column.name) &&
      ['text', 'enum'].includes(column.type));
    const lookupExists = keyColumnExists && columns.some((column) => numericTypes.includes(column.type) &&
      columns.indexOf(column) > columns.findIndex((candidate) =>
        /(kode|sku|^id|nomor|produk|barang|item)/i.test(candidate.name) &&
        ['text', 'enum'].includes(candidate.type),
      ));
    if (!lookupExists) {
      addColumn({
        name: 'Kode_Referensi',
        type: 'text',
      });
      addColumn({
        name: 'Nilai_Referensi',
        type: 'currency',
        range: [1000, 1000000],
      });
    }
  }
  if (/gudang|inventory/i.test(role)) {
    addColumn({ name: 'Stok_Awal', type: 'int', range: [20, 200] });
    addColumn({ name: 'Stok_Masuk', type: 'int', range: [0, 50] });
    addColumn({ name: 'Stok_Keluar', type: 'int', range: [0, 40] });
  }
  return { ...dataset, columns };
}

interface TemplateResult {
  task: Omit<Task, 'no' | 'rubricChecklist'> & { rubricChecklist?: string[] };
  answer: Omit<AnswerKeyItem, 'task'>;
}

function columnLetter(index: number): string {
  let value = index + 1;
  let letter = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    value = Math.floor((value - 1) / 26);
  }
  return letter;
}

function rangeFor(caseStudy: TaskContext, columnName: string): string {
  const index = caseStudy.dataset.columns.findIndex((column) => column.name === columnName);
  if (index < 0) throw new Error(`Kolom ${columnName} tidak tersedia untuk template tugas.`);
  const letter = columnLetter(index);
  const finalRow = Math.max(50, Math.min(caseStudy.dataset.rows || 150, 500)) + 1;
  return `$${letter}$2:$${letter}$${finalRow}`;
}

function cellFor(caseStudy: TaskContext, columnName: string, rowIndex: number): string {
  const index = caseStudy.dataset.columns.findIndex((column) => column.name === columnName);
  if (index < 0) throw new Error(`Kolom ${columnName} tidak tersedia untuk template tugas.`);
  return `${columnLetter(index)}${rowIndex + 2}`;
}

function findColumn(
  columns: DatasetColumn[],
  pattern: RegExp,
  allowedTypes?: DatasetColumn['type'][],
): DatasetColumn | undefined {
  return columns.find((column) =>
    pattern.test(column.name) && (!allowedTypes || allowedTypes.includes(column.type)),
  );
}

function numericValue(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return 0;
}

function normalizeText(value: string | number | null | undefined): string {
  return String(value ?? '').trim();
}

function escapeFormulaText(value: string): string {
  return value.replace(/"/g, '""');
}

function addTemplate(
  results: TemplateResult[],
  result: TemplateResult | undefined,
): void {
  if (result) results.push(result);
}

function createCategorySum(
  caseStudy: TaskContext,
  rows: DataRow[],
  categoryColumn: DatasetColumn | undefined,
  valueColumn: DatasetColumn | undefined,
  category = categoryColumn ? normalizeText(rows[0]?.[categoryColumn.name]) : '',
): TemplateResult | undefined {
  if (!categoryColumn || !valueColumn || rows.length === 0 || !category) return undefined;
  if (!category) return undefined;
  const total = rows.reduce((sum, row) =>
    String(row[categoryColumn.name] ?? '') === category
      ? sum + numericValue(row[valueColumn.name])
      : sum, 0,
  );
  const formula = `=SUMIFS(${rangeFor(caseStudy, valueColumn.name)};${rangeFor(caseStudy, categoryColumn.name)};"${escapeFormulaText(category)}")`;
  return {
    task: {
      instruction: `Hitung total ${valueColumn.name} untuk kategori ${categoryColumn.name} bernilai ${category}.`,
      hint: 'Gunakan SUMIFS agar kriteria kategori diterapkan oleh rumus.',
      targetResult: `Satu nilai total ${valueColumn.name} untuk kategori ${category}.`,
      columnsUsed: [valueColumn.name, categoryColumn.name],
      answerMode: 'computed',
      taskKind: 'conditional-aggregation',
    },
    answer: {
      formula,
      expectedValue: total,
      columnsUsed: [valueColumn.name, categoryColumn.name],
      mode: 'computed',
      explanation: `Menjumlahkan ${valueColumn.name} hanya pada baris dengan ${categoryColumn.name}=${category}.`,
      rubricChecklist: [],
    },
  };
}

function createCategoryCount(
  caseStudy: TaskContext,
  rows: DataRow[],
  categoryColumn: DatasetColumn | undefined,
  category = categoryColumn ? normalizeText(rows[0]?.[categoryColumn.name]) : '',
): TemplateResult | undefined {
  if (!categoryColumn || rows.length === 0 || !category) return undefined;
  if (!category) return undefined;
  const count = rows.filter((row) =>
    String(row[categoryColumn.name] ?? '') === category,
  ).length;
  return {
    task: {
      instruction: `Hitung banyak baris dengan ${categoryColumn.name} bernilai ${category}.`,
      hint: 'Gunakan COUNTIFS dengan kolom kategori sebagai criteria_range.',
      targetResult: `Satu angka jumlah baris untuk kategori ${category}.`,
      columnsUsed: [categoryColumn.name],
      answerMode: 'computed',
      taskKind: 'conditional-aggregation',
    },
    answer: {
      formula: `=COUNTIFS(${rangeFor(caseStudy, categoryColumn.name)};"${escapeFormulaText(category)}")`,
      expectedValue: count,
      columnsUsed: [categoryColumn.name],
      mode: 'computed',
      explanation: `COUNTIFS menghitung baris yang memenuhi kategori ${category}.`,
      rubricChecklist: [],
    },
  };
}

function createLookup(
  caseStudy: TaskContext,
  rows: DataRow[],
  keyColumn: DatasetColumn | undefined,
  resultColumn: DatasetColumn | undefined,
  rowIndex = 0,
): TemplateResult | undefined {
  if (!keyColumn || !resultColumn || rowIndex >= rows.length) return undefined;
  const keyIndex = caseStudy.dataset.columns.indexOf(keyColumn);
  const resultIndex = caseStudy.dataset.columns.indexOf(resultColumn);
  if (resultIndex <= keyIndex) return undefined;
  const lookupValue = normalizeText(rows[rowIndex][keyColumn.name]);
  if (!lookupValue) return undefined;
  const match = rows.find((row) =>
    String(row[keyColumn.name] ?? '') === lookupValue,
  );
  if (!match) return undefined;
  const range = `$${columnLetter(keyIndex)}$2:$${columnLetter(resultIndex)}$${caseStudy.dataset.rows + 1}`;
  const formula = caseStudy.excelVersion === 'Microsoft 365'
    ? `=XLOOKUP("${escapeFormulaText(lookupValue)}";${rangeFor(caseStudy, keyColumn.name)};${rangeFor(caseStudy, resultColumn.name)};"Tidak ditemukan";0)`
    : `=VLOOKUP("${escapeFormulaText(lookupValue)}";${range};${resultIndex - keyIndex + 1};FALSE)`;
  return {
    task: {
      instruction: `Temukan nilai ${resultColumn.name} yang cocok dengan ${keyColumn.name} ${lookupValue}.`,
      hint: caseStudy.excelVersion === 'Microsoft 365'
        ? 'Gunakan XLOOKUP dengan pencocokan tepat.'
        : 'Gunakan VLOOKUP dengan pencocokan tepat.',
      targetResult: `Satu nilai ${resultColumn.name} untuk ${keyColumn.name} ${lookupValue}.`,
      columnsUsed: [keyColumn.name, resultColumn.name],
      answerMode: 'computed',
      taskKind: 'lookup',
    },
    answer: {
      formula,
      expectedValue: match[resultColumn.name] ?? null,
      columnsUsed: [keyColumn.name, resultColumn.name],
      mode: 'computed',
      explanation: `Mencari ${lookupValue} pada ${keyColumn.name}, lalu mengambil ${resultColumn.name}.`,
      rubricChecklist: [],
    },
  };
}

function createNestedIf(
  caseStudy: TaskContext,
  rows: DataRow[],
  valueColumn: DatasetColumn | undefined,
  rowIndex = 0,
): TemplateResult | undefined {
  if (!valueColumn || rowIndex >= rows.length) return undefined;
  const maximum = valueColumn.range && typeof valueColumn.range[1] === 'number'
    ? valueColumn.range[1]
    : Math.max(...rows.map((row) => numericValue(row[valueColumn.name])));
  const minimum = valueColumn.range && typeof valueColumn.range[0] === 'number'
    ? valueColumn.range[0]
    : Math.min(...rows.map((row) => numericValue(row[valueColumn.name])));
  const middle = Math.floor((maximum + minimum) / 2);
  const firstValue = numericValue(rows[rowIndex][valueColumn.name]);
  const label = firstValue >= maximum ? 'Tinggi' : firstValue >= middle ? 'Sedang' : 'Rendah';
  const cell = cellFor(caseStudy, valueColumn.name, rowIndex);
  return {
    task: {
      instruction: `Klasifikasikan ${valueColumn.name} pada baris ${rowIndex + 1}: Tinggi jika minimal ${maximum}, Sedang jika minimal ${middle}, selain itu Rendah.`,
      hint: 'Gunakan IF bertingkat dengan ambang tertinggi diperiksa lebih dahulu.',
      targetResult: 'Satu label klasifikasi: Tinggi, Sedang, atau Rendah.',
      columnsUsed: [valueColumn.name],
      answerMode: 'computed',
      taskKind: caseStudy.level === 'easy' ? 'conditional-logic' : 'calculation',
    },
    answer: {
      formula: `=IF(${cell}>=${maximum};"Tinggi";IF(${cell}>=${middle};"Sedang";"Rendah"))`,
      expectedValue: label,
      columnsUsed: [valueColumn.name],
      mode: 'computed',
      explanation: `IF pertama menguji ambang ${maximum}; IF kedua menguji ambang ${middle}.`,
      rubricChecklist: [],
    },
  };
}

function createStockReconciliation(
  caseStudy: TaskContext,
  rows: DataRow[],
  openingColumn: DatasetColumn | undefined,
  incomingColumn: DatasetColumn | undefined,
  outgoingColumn: DatasetColumn | undefined,
): TemplateResult | undefined {
  if (!openingColumn || !incomingColumn || !outgoingColumn || rows.length === 0) return undefined;
  const opening = numericValue(rows[0][openingColumn.name]);
  const incoming = numericValue(rows[0][incomingColumn.name]);
  const outgoing = numericValue(rows[0][outgoingColumn.name]);
  return {
    task: {
      instruction: `Rekonsiliasi saldo stok pada baris pertama dengan menghitung ${openingColumn.name} + ${incomingColumn.name} - ${outgoingColumn.name}.`,
      hint: 'Saldo akhir = saldo awal + barang masuk - barang keluar.',
      targetResult: 'Satu angka saldo stok akhir.',
      columnsUsed: [openingColumn.name, incomingColumn.name, outgoingColumn.name],
      answerMode: 'computed',
      taskKind: 'calculation',
    },
    answer: {
      formula: `=${cellFor(caseStudy, openingColumn.name, 0)}+${cellFor(caseStudy, incomingColumn.name, 0)}-${cellFor(caseStudy, outgoingColumn.name, 0)}`,
      expectedValue: opening + incoming - outgoing,
      columnsUsed: [openingColumn.name, incomingColumn.name, outgoingColumn.name],
      mode: 'computed',
      explanation: 'Saldo akhir dihitung dari saldo awal ditambah penerimaan lalu dikurangi pengeluaran.',
      rubricChecklist: [],
    },
  };
}

function parseDate(value: string | number | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
}

function createPeriodAggregate(
  caseStudy: TaskContext,
  rows: DataRow[],
  dateColumn: DatasetColumn | undefined,
  valueColumn: DatasetColumn | undefined,
): TemplateResult | undefined {
  if (!dateColumn || !valueColumn || rows.length === 0) return undefined;
  const dates = rows
    .map((row) => parseDate(row[dateColumn.name]))
    .filter((date): date is string => date !== undefined)
    .sort();
  if (dates.length === 0) return undefined;
  const startDate = dates[0].slice(0, 7) + '-01';
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const endDate = end.toISOString().slice(0, 10);
  const total = rows.reduce((sum, row) => {
    const date = parseDate(row[dateColumn.name]);
    return date && date >= startDate && date <= endDate
      ? sum + numericValue(row[valueColumn.name])
      : sum;
  }, 0);
  return {
    task: {
      instruction: `Hitung total ${valueColumn.name} untuk periode ${startDate} sampai ${endDate} menggunakan kolom ${dateColumn.name}.`,
      hint: 'Terapkan kedua batas tanggal >= awal dan <= akhir di dalam SUMIFS.',
      targetResult: `Satu nilai total ${valueColumn.name} selama periode tersebut.`,
      columnsUsed: [valueColumn.name, dateColumn.name],
      dateColumn: dateColumn.name,
      answerMode: 'computed',
      taskKind: 'conditional-aggregation',
    },
    answer: {
      formula: `=SUMIFS(${rangeFor(caseStudy, valueColumn.name)};${rangeFor(caseStudy, dateColumn.name)};">=${startDate}";${rangeFor(caseStudy, dateColumn.name)};"<=${endDate}")`,
      expectedValue: total,
      columnsUsed: [valueColumn.name, dateColumn.name],
      mode: 'computed',
      explanation: `SUMIFS menjumlahkan hanya baris bertanggal ${startDate} sampai ${endDate}.`,
      rubricChecklist: [],
    },
  };
}

function createTotal(
  caseStudy: TaskContext,
  rows: DataRow[],
  valueColumn: DatasetColumn | undefined,
): TemplateResult | undefined {
  if (!valueColumn || rows.length === 0) return undefined;
  const total = rows.reduce((sum, row) => sum + numericValue(row[valueColumn.name]), 0);
  return {
    task: {
      instruction: `Hitung total seluruh nilai pada kolom ${valueColumn.name}.`,
      hint: 'Gunakan SUM pada seluruh rentang data.',
      targetResult: `Satu nilai total ${valueColumn.name}.`,
      columnsUsed: [valueColumn.name],
      answerMode: 'computed',
      taskKind: 'calculation',
    },
    answer: {
      formula: `=SUM(${rangeFor(caseStudy, valueColumn.name)})`,
      expectedValue: total,
      columnsUsed: [valueColumn.name],
      mode: 'computed',
      explanation: `SUM menjumlahkan seluruh nilai numerik pada ${valueColumn.name}.`,
      rubricChecklist: [],
    },
  };
}

function createBasicAggregate(
  caseStudy: TaskContext,
  rows: DataRow[],
  valueColumn: DatasetColumn | undefined,
  operation: 'AVERAGE' | 'MIN' | 'MAX',
): TemplateResult | undefined {
  if (!valueColumn || rows.length === 0) return undefined;
  const values = rows.map((row) => numericValue(row[valueColumn.name]));
  const result = operation === 'AVERAGE'
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : operation === 'MIN'
      ? Math.min(...values)
      : Math.max(...values);
  return {
    task: {
      instruction: `Tentukan ${operation === 'AVERAGE' ? 'rata-rata' : operation === 'MIN' ? 'nilai terkecil' : 'nilai terbesar'} dari kolom ${valueColumn.name}.`,
      hint: `Gunakan fungsi ${operation} pada seluruh rentang data.`,
      targetResult: `Satu nilai ${operation} untuk ${valueColumn.name}.`,
      columnsUsed: [valueColumn.name],
      answerMode: 'computed',
      taskKind: 'calculation',
    },
    answer: {
      formula: `=${operation}(${rangeFor(caseStudy, valueColumn.name)})`,
      expectedValue: result,
      columnsUsed: [valueColumn.name],
      mode: 'computed',
      explanation: `${operation} menghitung ${valueColumn.name} pada seluruh baris dataset.`,
      rubricChecklist: [],
    },
  };
}

function createRubricTask(
  caseStudy: TaskContext,
  taskKind: TaskKind,
  column: DatasetColumn | undefined,
): TemplateResult {
  const columnName = column?.name ?? caseStudy.dataset.columns[0].name;
  const definitions: Record<string, { instruction: string; checklist: string[] }> = {
    formatting: {
      instruction: `Format kolom ${columnName} agar konsisten dan mudah dibaca, tanpa mengubah nilai sumber.`,
      checklist: [
        `Terapkan format yang sesuai untuk ${columnName}.`,
        'Gunakan format header konsisten dan aktifkan filter.',
        'Pastikan seluruh data tetap terlihat dan tidak terpotong.',
      ],
    },
    'data-validation': {
      instruction: `Buat Data Validation untuk kolom ${columnName} agar hanya nilai yang sesuai dapat dimasukkan.`,
      checklist: [
        `Batasi input ${columnName} menggunakan daftar/nilai yang sah.`,
        'Tambahkan input message atau error alert yang jelas.',
        'Uji satu nilai valid dan satu nilai tidak valid.',
      ],
    },
    'pivot-table': {
      instruction: `Buat Pivot Table untuk merangkum ${columnName} berdasarkan kategori yang relevan pada dataset.`,
      checklist: [
        'Gunakan seluruh dataset sebagai sumber Pivot Table.',
        `Tempatkan ${columnName} pada area nilai bila sesuai tipenya.`,
        'Tambahkan kategori yang relevan pada area baris dan pastikan total ringkasan cocok dengan sumber.',
      ],
    },
  };
  const definition = definitions[taskKind] ?? definitions.formatting;
  return {
    task: {
      instruction: definition.instruction,
      hint: 'Tugas ini dinilai dengan checklist, bukan satu formula.',
      targetResult: definition.checklist.join(' '),
      columnsUsed: column ? [column.name] : [],
      answerMode: 'rubric',
      taskKind,
    },
    answer: {
      mode: 'rubric',
      columnsUsed: column ? [column.name] : [],
      rubricChecklist: definition.checklist,
      explanation: 'Kunci tugas ini dinilai dengan rubrik langkah dan hasil yang diharapkan.',
    },
  };
}

export function buildDeterministicTasks(
  caseStudy: TaskContext,
  rows: DataRow[],
  taskCount: number,
): DeterministicTaskSet {
  const columns = caseStudy.dataset.columns;
  const numericColumns = columns.filter((column) =>
    ['number', 'int', 'currency'].includes(column.type),
  );
  const categoryColumn = columns.find((column) =>
    column.type === 'enum' && (column.values?.length ?? 0) > 1,
  ) ?? columns.find((column) => column.type === 'enum');
  const dateColumn = columns.find((column) => column.type === 'date');
  const preferredValueColumn = numericColumns.find((column) => column.type === 'currency') ??
    findColumn(columns, /(jumlah|qty|kuantitas|total|nilai|nominal|harga|biaya|stok|saldo|amount)/i, numericColumns.map((column) => column.type)) ??
    numericColumns[0];
  const openingColumn = findColumn(columns, /(stok|saldo|persediaan).*(awal|opening)|^(stok|saldo|persediaan)[ _-]?awal/i, ['number', 'int', 'currency']);
  const incomingColumn = findColumn(columns, /(stok|qty|jumlah|barang|saldo|persediaan).*(masuk|terima|penerimaan|inbound)|^(masuk|penerimaan|inbound)/i, ['number', 'int', 'currency']);
  const outgoingColumn = findColumn(columns, /(stok|qty|jumlah|barang|saldo|persediaan).*(keluar|pakai|pengeluaran|outbound)|^(keluar|pengeluaran|outbound)/i, ['number', 'int', 'currency']);
  const keyColumn = findColumn(columns, /(kode|sku|id|nomor|produk|barang|item)/i, ['text', 'enum']);
  const lookupResultColumn = keyColumn
    ? numericColumns.find((column) => columns.indexOf(column) > columns.indexOf(keyColumn))
    : undefined;
  const categoryValues = categoryColumn
    ? [...new Set(rows.map((row) => normalizeText(row[categoryColumn.name])).filter(Boolean))]
    : [];
  const results: TemplateResult[] = [];

  if (caseStudy.level === 'easy') {
    // Easy level: hanya SUM, AVERAGE, COUNT, MIN, MAX, IF, SORT, FILTER
    for (const valueColumn of numericColumns) {
      addTemplate(results, createTotal(caseStudy, rows, valueColumn));
      addTemplate(results, createBasicAggregate(caseStudy, rows, valueColumn, 'AVERAGE'));
      addTemplate(results, createBasicAggregate(caseStudy, rows, valueColumn, 'MIN'));
      addTemplate(results, createBasicAggregate(caseStudy, rows, valueColumn, 'MAX'));
    }
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, taskCount); rowIndex += 1) {
      addTemplate(results, createNestedIf(caseStudy, rows, preferredValueColumn, rowIndex));
    }
    // Easy tidak boleh menggunakan conditional aggregation (SUMIFS, COUNTIFS) atau lookup (VLOOKUP, XLOOKUP)
  } else {
    // Middle/Advance level: boleh VLOOKUP, XLOOKUP, SUMIF, SUMIFS, COUNTIF, COUNTIFS, dll
    const firstCategory = categoryValues[0];
    addTemplate(results, createCategorySum(caseStudy, rows, categoryColumn, preferredValueColumn, firstCategory));
    addTemplate(results, createCategoryCount(caseStudy, rows, categoryColumn, firstCategory));
    addTemplate(results, createLookup(caseStudy, rows, keyColumn, lookupResultColumn));
    addTemplate(results, createPeriodAggregate(caseStudy, rows, dateColumn, preferredValueColumn));
    if (caseStudy.role.toLocaleLowerCase('id').includes('gudang') ||
        caseStudy.role.toLocaleLowerCase('id').includes('inventory')) {
      addTemplate(results, createStockReconciliation(
        caseStudy, rows, openingColumn, incomingColumn, outgoingColumn,
      ));
    }
    for (const category of categoryValues.slice(1)) {
      addTemplate(results, createCategorySum(caseStudy, rows, categoryColumn, preferredValueColumn, category));
      addTemplate(results, createCategoryCount(caseStudy, rows, categoryColumn, category));
    }
    for (const valueColumn of numericColumns) {
      if (valueColumn !== preferredValueColumn) {
        addTemplate(results, createCategorySum(
          caseStudy, rows, categoryColumn, valueColumn, firstCategory,
        ));
      }
    }
    for (let rowIndex = 1; rowIndex < Math.min(rows.length, taskCount); rowIndex += 1) {
      addTemplate(results, createLookup(caseStudy, rows, keyColumn, lookupResultColumn, rowIndex));
    }
  }

  const uniqueResults = results.filter((result, index) =>
    results.findIndex((candidate) => candidate.task.instruction === result.task.instruction) === index,
  );
  const selected = [...uniqueResults];
  const rubricKinds: TaskKind[] = caseStudy.level === 'middle'
    ? ['data-validation', 'formatting']
    : ['formatting'];
  for (const rubricKind of rubricKinds) {
    if (selected.length >= taskCount) break;
    if (LEVEL_RULES[caseStudy.level].taskKinds.includes(rubricKind)) {
      selected.push(createRubricTask(caseStudy, rubricKind, categoryColumn ?? preferredValueColumn));
    }
  }
  const finalSelection = selected.slice(0, taskCount);
  if (finalSelection.length < taskCount) {
    throw new Error(
      `Template tugas hanya dapat membuat ${finalSelection.length} dari ${taskCount} tugas. Pastikan dataset memiliki kolom numerik dan kategori yang sesuai.`,
    );
  }

  return {
    tasks: finalSelection.map((result, index) => ({
      no: index + 1,
      ...result.task,
      rubricChecklist: result.task.rubricChecklist ?? [],
      ...(result.answer.formula ? { formula: result.answer.formula } : {}),
    })),
    answerKey: finalSelection.map((result, index) => ({
      task: index + 1,
      ...result.answer,
    })),
  };
}
