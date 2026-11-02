import { buildDataset, type DataRow, type DatasetBuildResult, type DatasetGenerationContext } from './dataset-generator';
import {
  DatasetColumn,
  DatasetSpec,
  DatasetTrap,
  DatasetTrapKind,
  columnTypeToCellKind,
  isIsoDate,
  isNumericType,
  normalizeColumnName,
  timeToMinutes,
} from '@/lib/column-types';

export interface DatasetValidationIssue {
  column: string;
  row: number;
  kind: string;
  message: string;
}

export interface DatasetValidationResult {
  valid: boolean;
  errors: string[];
  issues: DatasetValidationIssue[];
  traps: DatasetTrap[];
}

/**
 * Daftar kata Latin/lorem yang tidak boleh muncul di dataset.
 * Sengaja hanya token khas agar tidak menimbulkan false positive pada kata Indonesia.
 */
export const LOREM_WORDS: ReadonlySet<string> = new Set([
  'lorem',
  'ipsum',
  'dolor',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
  'tempor',
  'incididunt',
  'labore',
  'dolore',
  'magna',
  'aliqua',
  'veniam',
  'nostrud',
  'exercitation',
  'ullamco',
  'laboris',
  'aliquip',
  'commodo',
  'consequat',
  'duis',
  'irure',
  'reprehenderit',
  'voluptate',
  'velit',
  'cillum',
  'fugiat',
  'pariatur',
  'excepteur',
  'occaecat',
  'cupidatat',
  'proident',
  'culpa',
  'officia',
  'deserunt',
  'mollit',
  'sunt',
  'aute',
  'nisi',
  'quis',
  'esse',
]);

export function findLoremWords(value: string): string[] {
  const tokens = value.toLocaleLowerCase('id').split(/[^a-z]+/g).filter(Boolean);
  return [...new Set(tokens.filter((token) => LOREM_WORDS.has(token)))];
}

function idPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withDigits = escaped.replace(/#+/g, (match) => `\\d{${match.length}}`);
  return new RegExp(`^${withDigits}$`);
}

function formatIssue(issue: DatasetValidationIssue): string {
  return `[${issue.column} baris ${issue.row + 2}] ${issue.message}`;
}

function trapKey(column: string, row: number): string {
  return `${column}\u0000${row}`;
}

const DEVIATION_KINDS: ReadonlySet<DatasetTrapKind> = new Set([
  'number-as-text',
  'blank-cell',
  'date-slash',
  'extra-space',
]);

/**
 * Memvalidasi baris dataset terhadap skema kolom registry.
 *
 * Aturan penting: setiap penyimpangan tipe HARUS terdaftar di `dataset.traps`.
 * Penyimpangan yang tidak terdaftar dianggap error tak sengaja dan membuat
 * dataset ditolak (regenerate), sehingga dataset gagal tidak pernah ditampilkan.
 */
export function validateDataset(dataset: DatasetSpec, rows: DataRow[]): DatasetValidationResult {
  const issues: DatasetValidationIssue[] = [];
  const columns = dataset.columns;
  const columnNames = new Set(columns.map((column) => column.name));
  const declaredTraps = dataset.traps ?? [];

  const declaredByCell = new Map<string, Set<DatasetTrapKind>>();
  for (const trap of declaredTraps) {
    for (const row of trap.rows) {
      const key = trapKey(trap.column, row);
      const kinds = declaredByCell.get(key) ?? new Set<DatasetTrapKind>();
      kinds.add(trap.kind);
      declaredByCell.set(key, kinds);
    }
  }

  const observed = new Map<string, DatasetTrapKind>();
  const trapSkipped = new Set<string>();

  if (rows.length === 0) {
    issues.push({ column: '-', row: 0, kind: 'empty', message: 'Dataset tidak memiliki baris data.' });
    return buildResult(issues, declaredTraps);
  }

  for (const [rowIndex, row] of rows.entries()) {
    for (const name of Object.keys(row)) {
      if (!columnNames.has(name)) {
        issues.push({
          column: name,
          row: rowIndex,
          kind: 'unknown-column',
          message: `Kolom "${name}" tidak terdaftar pada skema dataset.`,
        });
      }
    }

    for (const column of columns) {
      if (!(column.name in row)) {
        issues.push({
          column: column.name,
          row: rowIndex,
          kind: 'missing-cell',
          message: 'Sel tidak ada pada baris ini (sel kosong tak sengaja).',
        });
        continue;
      }
      const deviation = detectDeviation(column, row[column.name]);
      if (deviation) {
        observed.set(trapKey(column.name, rowIndex), deviation);
        const declared = declaredByCell.get(trapKey(column.name, rowIndex));
        if (!declared || !declared.has(deviation)) {
          issues.push({
            column: column.name,
            row: rowIndex,
            kind: deviation,
            message: `Penyimpangan "${deviation}" tidak terdaftar sebagai jebakan data.`,
          });
        } else {
          trapSkipped.add(trapKey(column.name, rowIndex));
        }
      }
    }

    validateCellAgainstSpec(columns, row, rowIndex, trapSkipped, issues);
  }

  // Setiap jebakan yang dideklarasikan harus benar-benar terjadi.
  for (const trap of declaredTraps) {
    for (const rowIndex of trap.rows) {
      if (observed.get(trapKey(trap.column, rowIndex)) !== trap.kind) {
        issues.push({
          column: trap.column,
          row: rowIndex,
          kind: trap.kind,
          message: `Jebakan "${trap.kind}" terdaftar tetapi tidak ditemukan pada data.`,
        });
      }
    }
  }

  validateCrossColumnRules(columns, rows, trapSkipped, issues);
  validateLorem(columns, rows, trapSkipped, issues);

  return buildResult(issues, declaredTraps);
}

function buildResult(issues: DatasetValidationIssue[], traps: DatasetTrap[]): DatasetValidationResult {
  return {
    valid: issues.length === 0,
    errors: issues.map(formatIssue),
    issues,
    traps,
  };
}

/** Mengembalikan jenis penyimpangan bila sel tidak sesuai tipe kanoniknya. */
export function detectDeviation(column: DatasetColumn, value: DataRow[string]): DatasetTrapKind | undefined {
  if (value === null || value === undefined) return 'blank-cell';
  if (typeof value === 'string' && value.trim() === '') return 'blank-cell';
  if (typeof value === 'string' && value !== value.trim() && value.trim() !== '') return 'extra-space';

  const kind = columnTypeToCellKind(column.type);
  if (kind === 'number') {
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return 'number-as-text';
    return undefined;
  }
  if (kind === 'date') {
    if (typeof value === 'string' && /^\d{4}\/\d{2}\/\d{2}$/.test(value)) return 'date-slash';
    return undefined;
  }
  return undefined;
}

function validateCellAgainstSpec(
  columns: DatasetColumn[],
  row: DataRow,
  rowIndex: number,
  trapSkipped: Set<string>,
  issues: DatasetValidationIssue[],
): void {
  for (const column of columns) {
    const key = trapKey(column.name, rowIndex);
    if (trapSkipped.has(key)) continue;
    const value = row[column.name];
    const kind = columnTypeToCellKind(column.type);

    if (kind === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ column: column.name, row: rowIndex, kind: 'type', message: `Nilai harus berupa angka (number), bukan ${describe(value)}.` });
        continue;
      }
      const min = column.min;
      const max = column.max;
      if (min !== undefined && value < min) {
        issues.push({ column: column.name, row: rowIndex, kind: 'range', message: `Nilai ${value} di bawah batas minimum ${min}.` });
      }
      if (max !== undefined && value > max) {
        issues.push({ column: column.name, row: rowIndex, kind: 'range', message: `Nilai ${value} di atas batas maksimum ${max}.` });
      }
      if (column.type === 'integer' && !Number.isInteger(value)) {
        issues.push({ column: column.name, row: rowIndex, kind: 'type', message: `Nilai ${value} harus bilangan bulat.` });
      }
      continue;
    }

    if (typeof value !== 'string') {
      issues.push({ column: column.name, row: rowIndex, kind: 'type', message: `Nilai harus berupa teks, bukan ${describe(value)}.` });
      continue;
    }

    if (kind === 'time') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        issues.push({ column: column.name, row: rowIndex, kind: 'format', message: `Jam "${value}" tidak berformat HH:mm.` });
      }
      continue;
    }

    if (kind === 'date') {
      if (!isIsoDate(value)) {
        issues.push({ column: column.name, row: rowIndex, kind: 'format', message: `Tanggal "${value}" tidak berformat YYYY-MM-DD.` });
        continue;
      }
      if (column.from && column.to && (value < column.from || value > column.to)) {
        issues.push({ column: column.name, row: rowIndex, kind: 'range', message: `Tanggal ${value} di luar rentang ${column.from}..${column.to}.` });
      }
      continue;
    }

    if (column.type === 'category' && column.values && !column.values.includes(value)) {
      issues.push({ column: column.name, row: rowIndex, kind: 'domain', message: `Nilai "${value}" tidak ada pada daftar kategori.` });
    }
    if (column.type === 'id' && column.pattern && !idPatternToRegExp(column.pattern).test(value)) {
      issues.push({ column: column.name, row: rowIndex, kind: 'pattern', message: `Nilai "${value}" tidak mengikuti pola ${column.pattern}.` });
    }
  }
}

function describe(value: DataRow[string]): string {
  if (value === null || value === undefined) return 'kosong';
  return typeof value === 'string' ? `teks "${value}"` : typeof value;
}

function isRowSkipped(trapSkipped: Set<string>, column: string, rowIndex: number): boolean {
  return trapSkipped.has(trapKey(column, rowIndex));
}

function validateCrossColumnRules(
  columns: DatasetColumn[],
  rows: DataRow[],
  trapSkipped: Set<string>,
  issues: DatasetValidationIssue[],
): void {
  const byNormalized = (pattern: RegExp) =>
    columns.find((column) => pattern.test(normalizeColumnName(column.name)));

  const startColumn = columns.find((column) => column.type === 'time' && /(masuk|datang|mulai)/.test(normalizeColumnName(column.name)));
  const endColumn = columns.find((column) => column.type === 'time' && /(pulang|keluar|selesai|akhir)/.test(normalizeColumnName(column.name)));
  const baseDateColumn = byNormalized(/^(tanggal|tgl|date)(_|$)/);
  const dateAfterColumns = columns.filter((column) => column.type === 'dateAfter');
  const derivedColumns = columns.filter((column) => column.type === 'derived');

  for (const [rowIndex, row] of rows.entries()) {
    if (startColumn && endColumn) {
      const skipped = isRowSkipped(trapSkipped, startColumn.name, rowIndex) || isRowSkipped(trapSkipped, endColumn.name, rowIndex);
      if (!skipped) {
        const start = row[startColumn.name];
        const end = row[endColumn.name];
        if (typeof start === 'string' && typeof end === 'string' && /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)) {
          if (timeToMinutes(end) <= timeToMinutes(start)) {
            issues.push({
              column: endColumn.name,
              row: rowIndex,
              kind: 'cross-column',
              message: `${endColumn.name} (${end}) harus lebih besar dari ${startColumn.name} (${start}).`,
            });
          }
        }
      }
    }

    if (baseDateColumn) {
      for (const column of dateAfterColumns) {
        const skipped = isRowSkipped(trapSkipped, column.name, rowIndex) || isRowSkipped(trapSkipped, baseDateColumn.name, rowIndex);
        if (skipped) continue;
        const base = row[baseDateColumn.name];
        const value = row[column.name];
        if (isIsoDate(base) && isIsoDate(value) && value <= base) {
          issues.push({
            column: column.name,
            row: rowIndex,
            kind: 'cross-column',
            message: `${column.name} (${value}) harus lebih baru dari ${baseDateColumn.name} (${base}).`,
          });
        }
      }
    }

    for (const column of derivedColumns) {
      if (isRowSkipped(trapSkipped, column.name, rowIndex)) continue;
      const expected = evaluateDerived(column.expression ?? '0', row);
      const value = row[column.name];
      if (typeof value !== 'number' || Math.abs(value - expected) > 1e-6) {
        issues.push({
          column: column.name,
          row: rowIndex,
          kind: 'cross-column',
          message: `Nilai turunan tidak konsisten: ${String(value)} seharusnya ${expected}.`,
        });
      }
    }
  }

  // Stok_Akhir = Stok_Awal + Stok_Masuk - Stok_Keluar bila kolom tersedia.
  const opening = byNormalized(/^(stok|saldo|persediaan)_?awal/);
  const incoming = byNormalized(/^(stok|saldo|persediaan)_?masuk/);
  const outgoing = byNormalized(/^(stok|saldo|persediaan)_?keluar/);
  const ending = byNormalized(/(stok|saldo|persediaan)_?(akhir|total)/);
  if (opening && incoming && outgoing && ending) {
    for (const [rowIndex, row] of rows.entries()) {
      const skipped = [opening, incoming, outgoing, ending].some((column) => isRowSkipped(trapSkipped, column.name, rowIndex));
      if (skipped) continue;
      const values = [row[opening.name], row[incoming.name], row[outgoing.name], row[ending.name]];
      if (values.some((value) => typeof value !== 'number')) continue;
      const expected = Number(row[opening.name]) + Number(row[incoming.name]) - Number(row[outgoing.name]);
      if (Math.abs(Number(row[ending.name]) - expected) > 1e-6) {
        issues.push({
          column: ending.name,
          row: rowIndex,
          kind: 'cross-column',
          message: `${ending.name} harus ${opening.name} + ${incoming.name} - ${outgoing.name} = ${expected}, ditemukan ${row[ending.name]}.`,
        });
      }
    }
  }
}

function evaluateDerived(expression: string, row: DataRow): number {
  const tokens = expression.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[+\-*/().]/g) ?? [];
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  const parseFactor = (): number => {
    const token = next();
    if (token === '(') {
      const value = parseExpression();
      if (peek() === ')') next();
      return value;
    }
    if (token === '-') return -parseFactor();
    if (token === undefined) return 0;
    if (/^\d/.test(token)) return Number(token);
    const cell = row[token];
    if (typeof cell === 'number') return cell;
    const numeric = Number(cell ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const operator = next();
      const right = parseFactor();
      value = operator === '*' ? value * right : right === 0 ? 0 : value / right;
    }
    return value;
  };
  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const operator = next();
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };

  const result = parseExpression();
  return Number.isFinite(result) ? result : 0;
}

function validateLorem(
  columns: DatasetColumn[],
  rows: DataRow[],
  trapSkipped: Set<string>,
  issues: DatasetValidationIssue[],
): void {
  for (const column of columns) {
    if (isNumericType(column.type)) continue;
    for (const [rowIndex, row] of rows.entries()) {
      if (isRowSkipped(trapSkipped, column.name, rowIndex)) continue;
      const value = row[column.name];
      if (typeof value !== 'string') continue;
      const words = findLoremWords(value);
      if (words.length > 0) {
        issues.push({
          column: column.name,
          row: rowIndex,
          kind: 'lorem',
          message: `Terdeteksi kata lorem Latin: ${words.join(', ')}.`,
        });
      }
    }
  }
}

export { DEVIATION_KINDS };

// ---------------------------------------------------------------------------
// Build + validasi dengan regenerate
// ---------------------------------------------------------------------------

/** Jumlah maksimum percobaan membangun dataset tervalidasi. */
export const DATASET_VALIDATION_MAX_ATTEMPTS = 3;

export class DatasetValidationError extends Error {
  constructor(
    readonly baseSeed: string,
    readonly issues: string[],
  ) {
    const detail = issues.length > 0 ? ` Masalah: ${issues.slice(0, 5).join('; ')}` : '';
    super(
      `Dataset gagal validasi setelah ${DATASET_VALIDATION_MAX_ATTEMPTS} percobaan dengan seed baru.${detail}`,
    );
    this.name = 'DatasetValidationError';
  }
}

export interface ValidatedDatasetBuild extends DatasetBuildResult {
  /** Seed yang benar-benar dipakai (bila percobaan awal gagal). */
  seed: string;
}

/**
 * Membangun dataset lalu memvalidasinya. Bila gagal, ulangi dengan seed
 * turunan yang baru (maksimal DATASET_VALIDATION_MAX_ATTEMPTS). Bila masih
 * gagal, lempar DatasetValidationError sehingga dataset buruk tidak pernah
 * dipakai prompt, UI, maupun export.
 */
export function buildValidatedDataset(
  context: DatasetGenerationContext,
  options: { attempts?: number } = {},
): ValidatedDatasetBuild {
  const attempts = Math.max(1, options.attempts ?? DATASET_VALIDATION_MAX_ATTEMPTS);
  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const seed = attempt === 1 ? context.seed : `${context.seed}-d${attempt - 1}`;
    const built = buildDataset({ ...context, seed });
    const result = validateDataset(built.dataset, built.rows);
    if (result.valid) return { ...built, seed };
    lastIssues = result.errors;
    console.warn('[dataset] validasi gagal', JSON.stringify({
      seed,
      attempt,
      issueCount: result.errors.length,
      issues: result.errors.slice(0, 10),
    }));
  }
  throw new DatasetValidationError(context.seed, lastIssues);
}

