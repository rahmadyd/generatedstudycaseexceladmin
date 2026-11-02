import { Faker, id_ID, en } from '@faker-js/faker';
import { CaseStudy, DatasetSpec, Industry, Level } from './schema';
import {
  DatasetColumn,
  DatasetInput,
  DatasetSchema,
  DatasetTrap,
  DatasetTrapKind,
  dictionaryForName,
  isNumericType,
  minutesToTime,
  normalizeColumnName,
  normalizeDatasetRows,
  resolveDatasetColumns,
  timeToMinutes,
} from '@/lib/column-types';

export type DataRow = Record<string, string | number | null>;

export interface DatasetGenerationContext {
  seed: string;
  level: Level;
  industry?: Industry;
  dataset: DatasetInput;
  /** Callback nilai kategori dari industri (opsional, dari backend). */
  categoryValues?: (columnName: string) => string[] | undefined;
}

export interface DatasetBuildResult {
  rows: DataRow[];
  dataset: DatasetSpec;
  traps: DatasetTrap[];
}

// Simple deterministic hash to number for seeded PRNG
function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Faker selalu memakai locale Indonesia dan seed unik per generate. */
function createSeededFaker(seed: string): Faker {
  const faker = new Faker({ locale: [id_ID, en] });
  faker.seed(cyrb53(seed || 'excel-admin-seed'));
  return faker;
}

function resolveColumns(context: DatasetGenerationContext): DatasetColumn[] {
  return resolveDatasetColumns(context.dataset.columns, {
    categoryValues: context.categoryValues,
  });
}

/**
 * Membangun dataset tervalidasi: kolom di-resolve ke registry tipe tertutup,
 * baris dibangkitkan deterministik dari seed, lalu jebakan data yang disengaja
 * diterapkan dan dicatat di `dataset.traps`.
 */
export function buildDataset(context: DatasetGenerationContext | CaseStudy): DatasetBuildResult {
  const faker = createSeededFaker(context.seed);
  const columns = resolveColumns(context as DatasetGenerationContext);
  const rowCount = normalizeDatasetRows(context.dataset.rows);
  const level: Level = context.level;

  const rows: DataRow[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    const row: DataRow = {};
    for (const column of orderColumns(columns)) {
      row[column.name] = generateCellValue(column, i, faker, row);
    }
    applyRowRules(columns, row);
    rows.push(row);
  }

  const traps = planTraps(columns, context.seed, level, rowCount);
  applyTraps(rows, traps);

  return {
    rows,
    // Dataset kanonik yang disimpan: kolom sudah di-resolve ke registry tertutup
    // dan jebakan tercatat, sehingga UI/export/perpustakaan rumus memakai data yang sama.
    dataset: DatasetSchema.parse({
      sheetName: context.dataset.sheetName ?? 'Data_Admin',
      rows: rowCount,
      columns,
      traps,
    }),
    traps,
  };
}

/**
 * Membangkitkan baris dataset. Selalu memakai `buildDataset` sehingga baris yang
 * divalidasi sama dengan yang dipakai prompt, UI, dan perhitungan kunci jawaban.
 */
export function generateDatasetRows(context: DatasetGenerationContext | CaseStudy): DataRow[] {
  return buildDataset(context).rows;
}

/** Kolom turunan (derived) dan dateAfter dihitung setelah kolom dasarnya siap. */
function orderColumns(columns: DatasetColumn[]): DatasetColumn[] {
  const rank = (column: DatasetColumn) => (column.type === 'derived' ? 2 : column.type === 'dateAfter' ? 1 : 0);
  return [...columns].sort((a, b) => rank(a) - rank(b));
}

function generateCellValue(
  column: DatasetColumn,
  rowIndex: number,
  faker: Faker,
  row: DataRow,
): string | number {
  switch (column.type) {
    case 'time':
      return generateTime(column.name, faker);
    case 'integer':
      return faker.number.int({ min: Math.round(column.min ?? 1), max: Math.round(column.max ?? 100) });
    case 'decimal': {
      const min = column.min ?? 0;
      const max = column.max ?? 1000;
      const decimals = column.decimals ?? 2;
      return Number(faker.number.float({ min, max, fractionDigits: decimals }).toFixed(decimals));
    }
    case 'currency': {
      const min = column.min ?? 1000;
      const max = column.max ?? 5_000_000;
      return Math.round(faker.number.int({ min, max }) / 1000) * 1000;
    }
    case 'date': {
      const from = new Date(`${column.from ?? '2026-01-01'}T00:00:00.000Z`);
      const to = new Date(`${column.to ?? '2026-12-31'}T00:00:00.000Z`);
      return toIsoDate(faker.date.between({ from, to }));
    }
    case 'dateAfter': {
      const base = row[column.after ?? ''];
      const baseDate = typeof base === 'string' ? new Date(`${base}T00:00:00.000Z`) : new Date('2026-01-01T00:00:00.000Z');
      const offsetDays = faker.number.int({ min: 30, max: 400 });
      return toIsoDate(new Date(baseDate.getTime() + offsetDays * 86_400_000));
    }
    case 'id':
      return formatIdPattern(column.pattern ?? 'TRX-2026-####', rowIndex);
    case 'name':
      return faker.person.fullName();
    case 'category': {
      const values = column.values && column.values.length > 0 ? column.values : ['Umum', 'Prioritas'];
      return faker.helpers.arrayElement(values);
    }
    case 'derived':
      return evaluateExpression(column.expression ?? '0', row);
    case 'text': {
      const dictionary = dictionaryForName(column.name, column.dictionary);
      return faker.helpers.arrayElement(dictionary);
    }
    default: {
      // Tidak akan tercapai: resolveDatasetColumns sudah menolak tipe tak dikenal.
      throw new Error(`Tipe kolom "${String((column as DatasetColumn).type)}" pada kolom "${column.name}" tidak didukung.`);
    }
  }
}

function generateTime(name: string, faker: Faker): string {
  const normalized = normalizeColumnName(name);
  const isEnd = /(pulang|keluar|selesai|akhir|istirahat)/.test(normalized);
  if (isEnd) {
    // 14:00 - 19:30
    return minutesToTime(faker.number.int({ min: 840, max: 1170 }) - (faker.number.int({ min: 0, max: 3 }) * 5));
  }
  // 06:30 - 09:30
  return minutesToTime(faker.number.int({ min: 390, max: 570 }) - (faker.number.int({ min: 0, max: 3 }) * 5));
}

function toIsoDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatIdPattern(pattern: string, rowIndex: number): string {
  const digits = String(rowIndex + 1).padStart(4, '0');
  let cursor = 0;
  return pattern.replace(/#+/g, (match) => {
    const slice = digits.slice(Math.min(cursor, Math.max(0, digits.length - match.length)));
    cursor += match.length;
    return slice.padStart(match.length, '0');
  });
}

function evaluateExpression(expression: string, row: DataRow): number {
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

/** Aturan antar kolom yang harus selalu benar. */
function applyRowRules(columns: DatasetColumn[], row: DataRow): void {
  const startColumn = columns.find((column) => column.type === 'time' && /(masuk|datang|mulai)/.test(normalizeColumnName(column.name)));
  const endColumn = columns.find((column) => column.type === 'time' && /(pulang|keluar|selesai|akhir)/.test(normalizeColumnName(column.name)));
  if (startColumn && endColumn) {
    const start = String(row[startColumn.name] ?? '08:00');
    const end = String(row[endColumn.name] ?? '17:00');
    const startMinutes = isTimeLike(start) ? timeToMinutes(start) : 480;
    const endMinutes = isTimeLike(end) ? timeToMinutes(end) : 1020;
    if (endMinutes <= startMinutes) {
      row[endColumn.name] = minutesToTime(startMinutes + 480);
    }
  }

  // Stok tidak boleh negatif setelah pengurangan.
  const opening = columns.find((column) => isNumericType(column.type) && /^(stok|saldo|persediaan)_?awal/.test(normalizeColumnName(column.name)));
  const incoming = columns.find((column) => isNumericType(column.type) && /^(stok|saldo|persediaan)_?masuk/.test(normalizeColumnName(column.name)));
  const outgoing = columns.find((column) => isNumericType(column.type) && /^(stok|saldo|persediaan)_?keluar/.test(normalizeColumnName(column.name)));
  if (opening && incoming && outgoing) {
    const available = Number(row[opening.name] ?? 0) + Number(row[incoming.name] ?? 0);
    if (Number(row[outgoing.name] ?? 0) > available) {
      row[outgoing.name] = Math.max(0, Math.floor(available / 2));
    }
  }

  // Kolom turunan dihitung ulang agar konsisten dengan nilai akhir kolom dasar.
  for (const column of columns) {
    if (column.type === 'derived') {
      row[column.name] = evaluateExpression(column.expression ?? '0', row);
    }
  }
}

function isTimeLike(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// ---------------------------------------------------------------------------
// Jebakan data (traps) yang disengaja
// ---------------------------------------------------------------------------

function trapRandom(seed: string, salt: string): number {
  return cyrb53(`${seed}:${salt}`);
}

function pickRows(seed: string, salt: string, rowCount: number, count: number, startRow = 6): number[] {
  const rows = new Set<number>();
  let cursor = 0;
  while (rows.size < count && rows.size < rowCount - startRow) {
    const candidate = startRow + (trapRandom(seed, `${salt}:${cursor}`) % (rowCount - startRow));
    rows.add(candidate);
    cursor += 1;
  }
  return [...rows].sort((a, b) => a - b);
}

/**
 * Menyusun rencana jebakan secara deterministik dari seed.
 * Hanya level middle/advance yang mendapat jebakan.
 */
export function planTraps(
  columns: DatasetColumn[],
  seed: string,
  level: Level,
  rowCount: number,
): DatasetTrap[] {
  if (level === 'easy') return [];

  const protectedNames = new Set<string>();
  for (const column of columns) {
    if (column.type === 'derived' && column.expression) {
      for (const token of column.expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) protectedNames.add(token);
    }
    if (column.type === 'dateAfter' && column.after) protectedNames.add(column.after);
    // Kolom waktu dilindungi agar aturan Jam_Pulang > Jam_Masuk tetap valid.
    if (column.type === 'time') protectedNames.add(column.name);
  }

  const usedColumns = new Set<string>();
  const takeColumn = (predicate: (column: DatasetColumn) => boolean): DatasetColumn | undefined => {
    const column = columns.find((candidate) =>
      predicate(candidate) && !protectedNames.has(candidate.name) && !usedColumns.has(candidate.name),
    );
    if (column) usedColumns.add(column.name);
    return column;
  };

  const traps: DatasetTrap[] = [];

  const numericColumn = takeColumn((column) => isNumericType(column.type));
  if (numericColumn) {
    traps.push({
      column: numericColumn.name,
      kind: 'number-as-text',
      rows: pickRows(seed, 'number-as-text', rowCount, 2),
    });
  }

  const blankColumn = takeColumn((column) => column.type !== 'derived' && column.type !== 'dateAfter');
  if (blankColumn) {
    traps.push({
      column: blankColumn.name,
      kind: 'blank-cell',
      rows: pickRows(seed, 'blank-cell', rowCount, 2, 10),
    });
  }

  const dateColumn = takeColumn((column) => column.type === 'date');
  if (dateColumn) {
    traps.push({
      column: dateColumn.name,
      kind: 'date-slash',
      rows: pickRows(seed, 'date-slash', rowCount, 3),
    });
  }

  const textColumn = takeColumn((column) =>
    column.type === 'text' || column.type === 'id' || column.type === 'category' || column.type === 'name',
  );
  if (textColumn) {
    traps.push({
      column: textColumn.name,
      kind: 'extra-space',
      rows: pickRows(seed, 'extra-space', rowCount, 4, 12),
    });
  }

  return traps;
}

function applyTraps(rows: DataRow[], traps: DatasetTrap[]): void {
  for (const trap of traps) {
    for (const rowIndex of trap.rows) {
      const row = rows[rowIndex];
      if (!row || !(trap.column in row)) continue;
      const value = row[trap.column];
      switch (trap.kind) {
        case 'number-as-text':
          if (typeof value === 'number') row[trap.column] = String(value);
          break;
        case 'blank-cell':
          row[trap.column] = '';
          break;
        case 'date-slash':
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            row[trap.column] = value.replace(/-/g, '/');
          }
          break;
        case 'extra-space':
          if (typeof value === 'string' && value.trim()) row[trap.column] = ` ${value} `;
          break;
        default:
          break;
      }
    }
  }
}

export type { DatasetTrapKind };
