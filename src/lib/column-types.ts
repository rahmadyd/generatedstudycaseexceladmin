import { z } from 'zod';

/**
 * Registry tipe kolom TERTUTUP.
 *
 * Semua skema dataset (dari AI maupun template) hanya boleh memakai tipe di sini.
 * Tidak ada tipe bebas/teks acak: kolom yang tipenya tidak bisa dipetakan akan
 * melempar UnknownColumnTypeError yang menyebut nama kolomnya.
 */
export const COLUMN_TYPE_VALUES = [
  'time',
  'integer',
  'decimal',
  'currency',
  'date',
  'dateAfter',
  'name',
  'category',
  'id',
  'text',
  'derived',
] as const;

export const ColumnTypeEnum = z.enum(COLUMN_TYPE_VALUES);
export type ColumnType = z.infer<typeof ColumnTypeEnum>;

/** Jenis nilai sel setelah tipe kolom diterjemahkan (dipakai validasi & export). */
export type CellKind = 'number' | 'date' | 'time' | 'text';

const NUMERIC_TYPES: readonly ColumnType[] = ['integer', 'decimal', 'currency'];
const DATE_TYPES: readonly ColumnType[] = ['date', 'dateAfter'];

export function isNumericType(type: ColumnType): boolean {
  return NUMERIC_TYPES.includes(type);
}

export function isDateType(type: ColumnType): boolean {
  return DATE_TYPES.includes(type);
}

export function isCategoryType(type: ColumnType): boolean {
  return type === 'category';
}

export function columnTypeToCellKind(type: ColumnType): CellKind {
  // Kolom derived selalu hasil perhitungan numerik dari kolom lain.
  if (isNumericType(type) || type === 'derived') return 'number';
  if (type === 'time') return 'time';
  if (isDateType(type)) return 'date';
  return 'text';
}

/**
 * Bentuk kolom mentah dari AI/template. Tipe di sini masih teks bebas dan akan
 * dipetakan ke registry tertutup oleh `resolveColumnSpec`.
 */
export interface ColumnInput {
  name: string;
  type?: string;
  values?: string[];
  range?: [number, number] | [string, string];
  min?: number;
  max?: number;
  decimals?: number;
  from?: string;
  to?: string;
  after?: string;
  pattern?: string;
  dictionary?: string;
  expression?: string;
}

// ---------------------------------------------------------------------------
// Deklarasi jebakan data (traps)
// ---------------------------------------------------------------------------

/**
 * Jebakan data yang SENGAJA dibuat untuk level middle/advance.
 * Setiap penyimpangan tipe harus terdaftar di sini; kalau tidak, validasi gagal.
 */
export const DATASET_TRAP_KINDS = [
  'number-as-text',
  'blank-cell',
  'date-slash',
  'extra-space',
] as const;

export const DatasetTrapKindEnum = z.enum(DATASET_TRAP_KINDS);
export type DatasetTrapKind = z.infer<typeof DatasetTrapKindEnum>;

export const DatasetTrapSchema = z.object({
  column: z.string().min(1),
  kind: DatasetTrapKindEnum,
  rows: z.array(z.number().int().min(0)).min(1),
});
export type DatasetTrap = z.infer<typeof DatasetTrapSchema>;

// ---------------------------------------------------------------------------
// Skema kolom
// ---------------------------------------------------------------------------

export const DatasetColumnSchema = z
  .object({
    name: z.string().min(1),
    // Tipe lama (int/number/enum) dinormalisasi agar kasus tersimpan tetap terbaca.
    type: z.preprocess(
      (value) => normalizeLegacyColumnType(value) ?? value,
      ColumnTypeEnum,
    ),
    // Nilai kategorikal (wajib untuk tipe `category`).
    values: z.array(z.string()).optional(),
    // Bentuk masukan ringkas dari AI/template: [min,max] numerik atau [from,to] tanggal.
    range: z
      .union([z.tuple([z.number(), z.number()]), z.tuple([z.string(), z.string()])])
      .optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    decimals: z.number().int().min(0).max(6).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    // dateAfter: nama kolom tanggal acuan.
    after: z.string().optional(),
    // id: pola, mis. "INV-2026-####" (# = digit).
    pattern: z.string().optional(),
    // text: kunci kamus tetap.
    dictionary: z.string().optional(),
    // derived: ekspresi dari kolom lain, mis. "Stok_Awal+Stok_Masuk-Stok_Keluar".
    expression: z.string().optional(),
  })
  .superRefine((column, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });

    if (column.type === 'category' && (!column.values || column.values.length === 0)) {
      issue('values', 'Kolom category harus memiliki minimal satu nilai teks.');
    }
    if (column.values && column.type !== 'category') {
      issue('values', 'values hanya boleh digunakan pada kolom category.');
    }
    if (column.type === 'id' && !column.pattern) {
      issue('pattern', 'Kolom id harus memiliki pola, mis. "INV-2026-####".');
    }
    if (column.type === 'derived' && !column.expression) {
      issue('expression', 'Kolom derived harus memiliki ekspresi perhitungan.');
    }
    if (column.type === 'dateAfter' && !column.after) {
      issue('after', 'Kolom dateAfter harus menyebut kolom tanggal acuan.');
    }

    const [rangeMin, rangeMax] = column.range ?? [];
    if (isNumericType(column.type)) {
      const min = column.min ?? (typeof rangeMin === 'number' ? rangeMin : undefined);
      const max = column.max ?? (typeof rangeMax === 'number' ? rangeMax : undefined);
      if (min === undefined || max === undefined) {
        issue('range', 'Kolom numerik harus memiliki min dan max.');
      } else if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
        issue('range', 'Rentang numerik harus berurutan dengan min <= max.');
      }
      if (column.type !== 'decimal' && column.decimals !== undefined) {
        issue('decimals', 'decimals hanya boleh digunakan pada kolom decimal.');
      }
    }

    if (column.type === 'date') {
      const from = column.from ?? (typeof rangeMin === 'string' ? rangeMin : undefined);
      const to = column.to ?? (typeof rangeMax === 'string' ? rangeMax : undefined);
      if (from === undefined || to === undefined) {
        issue('range', 'Kolom date harus memiliki from dan to.');
      } else if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
        issue('range', 'Rentang tanggal harus ISO valid dan berurutan.');
      }
    }
  });

export type DatasetColumn = z.infer<typeof DatasetColumnSchema>;

export const DatasetSchema = z.object({
  sheetName: z.string().default('Data_Admin'),
  rows: z.number().min(20).max(1000).default(150),
  columns: z.array(DatasetColumnSchema).min(3),
  traps: z.array(DatasetTrapSchema).default([]),
});
export type DatasetSpec = z.infer<typeof DatasetSchema>;

/**
 * Skema longgar untuk masukan mentah dari AI/template: hanya mengunci struktur.
 * Tipe kolom sengaja dibiarkan teks agar `resolveColumnSpec` dapat memetakannya
 * (atau melempar UnknownColumnTypeError yang menyebut nama kolom).
 */
export const RawDatasetColumnSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().optional(),
    values: z
      .preprocess(
        (value) => (Array.isArray(value) ? value.map(String) : value),
        z.array(z.string()).optional(),
      ),
    range: z
      .union([z.tuple([z.number(), z.number()]), z.tuple([z.string(), z.string()])])
      .optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    decimals: z.number().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    after: z.string().optional(),
    pattern: z.string().optional(),
    dictionary: z.string().optional(),
    expression: z.string().optional(),
  })
  .passthrough();

export const RawDatasetSchema = z
  .object({
    sheetName: z.string().default('Data_Admin'),
    rows: z.union([z.number(), z.string()]).default(150),
    columns: z.array(RawDatasetColumnSchema).min(3),
    traps: z.array(DatasetTrapSchema).default([]),
  })
  .passthrough();

export type RawDatasetColumn = z.infer<typeof RawDatasetColumnSchema>;
export type RawDataset = z.infer<typeof RawDatasetSchema>;

/** Masukan dataset yang dapat berupa mentah (AI/template) maupun kanonik. */
export interface DatasetInput {
  sheetName?: string;
  rows?: number | string;
  columns: ColumnInput[];
  traps?: DatasetTrap[];
}

export function normalizeDatasetRows(value: number | string | undefined): number {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return 150;
  return Math.max(50, Math.min(Math.round(numeric), 500));
}

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isTimeString(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Tipe lama (schema sebelum registry) dipetakan agar kasus lama tetap terbaca. */
export function normalizeLegacyColumnType(rawType: unknown): ColumnType | undefined {
  if (typeof rawType !== 'string') return undefined;
  const type = rawType.trim().toLowerCase();
  const aliases: Record<string, ColumnType> = {
    int: 'integer',
    integer: 'integer',
    number: 'decimal',
    float: 'decimal',
    double: 'decimal',
    decimal: 'decimal',
    currency: 'currency',
    money: 'currency',
    date: 'date',
    datetime: 'date',
    time: 'time',
    enum: 'category',
    category: 'category',
    text: 'text',
    string: 'text',
    name: 'name',
    id: 'id',
    code: 'id',
    derived: 'derived',
    formula: 'derived',
    calculated: 'derived',
    dateafter: 'dateAfter',
  };
  return aliases[type];
}

export class UnknownColumnTypeError extends Error {
  constructor(
    readonly columnName: string,
    readonly declaredType: unknown,
  ) {
    const declared = typeof declaredType === 'string' ? declaredType : 'tidak ada';
    super(
      `Kolom "${columnName}" memakai tipe tidak dikenal ("${declared}"). ` +
        `Gunakan salah satu tipe registry: ${COLUMN_TYPE_VALUES.join(', ')}.`,
    );
    this.name = 'UnknownColumnTypeError';
  }
}

// ---------------------------------------------------------------------------
// Kamus tetap untuk tipe `text`
// ---------------------------------------------------------------------------

export const TEXT_DICTIONARIES: Record<string, string[]> = {
  keterangan: ['Lengkap', 'Perlu follow-up', 'Urgent', 'Normal', 'Belum dikonfirmasi'],
  catatan: ['Sesuai SOP', 'Menunggu approval', 'Sudah diverifikasi', 'Perlu revisi'],
  alamat: [
    'Jl. Merdeka No. 12',
    'Jl. Sudirman No. 45',
    'Jl. Gatot Subroto No. 8',
    'Jl. Ahmad Yani No. 27',
    'Jl. Diponegoro No. 3',
  ],
  email: [
    'admin@nusantara.co.id',
    'finance@nusantara.co.id',
    'hrd@nusantara.co.id',
    'ops@nusantara.co.id',
  ],
  telepon: ['0812-3456-7890', '0857-1234-5678', '0821-9876-5432', '0813-2468-1357'],
  deskripsi: ['Pencatatan rutin', 'Data hasil input operator', 'Rekap periode berjalan'],
  default: ['Data terlampir', 'Sudah dicatat', 'Menunggu pemeriksaan'],
};

export function dictionaryForName(name: string, dictionary?: string): string[] {
  if (dictionary && TEXT_DICTIONARIES[dictionary]) return TEXT_DICTIONARIES[dictionary];
  const normalized = normalizeColumnName(name);
  const key = Object.keys(TEXT_DICTIONARIES).find((candidate) => normalized.includes(candidate));
  return TEXT_DICTIONARIES[key ?? 'default'];
}

// ---------------------------------------------------------------------------
// Kamus kategori tetap (dipakai bila AI/template tidak menyediakan values)
// ---------------------------------------------------------------------------

export const CATEGORY_DICTIONARIES: Record<string, string[]> = {
  status: ['Selesai', 'Diproses', 'Pending', 'Batal', 'Draft'],
  metode: ['Transfer Bank', 'Tunai', 'Kartu Kredit', 'E-Wallet', 'Cek'],
  bank: ['BCA', 'Mandiri', 'BNI', 'BRI', 'Jago', 'Dana'],
  departemen: ['Finance', 'HRD', 'Operations', 'Sales', 'Marketing', 'IT'],
  jabatan: ['Manager', 'Supervisor', 'Staff', 'Lead', 'Specialist'],
  kota: ['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Medan', 'Makassar'],
  gudang: ['Gudang A', 'Gudang B', 'Gudang C', 'Gudang Utama'],
  kualitas: ['Grade A', 'Grade B', 'Grade C'],
  satuan: ['Pcs', 'Box', 'Kg', 'Liter', 'Unit'],
  shift: ['Pagi', 'Siang', 'Malam'],
  default: ['Umum', 'Prioritas', 'Reguler', 'Khusus'],
};

export function defaultCategoryValues(name: string): string[] {
  const normalized = normalizeColumnName(name);
  const key = Object.keys(CATEGORY_DICTIONARIES).find((candidate) => normalized.includes(candidate));
  return CATEGORY_DICTIONARIES[key ?? 'default'];
}

// ---------------------------------------------------------------------------
// Pemetaan nama kolom umum -> tipe registry
// ---------------------------------------------------------------------------

export interface ColumnRule {
  type: ColumnType;
  test: RegExp;
  min?: number;
  max?: number;
  decimals?: number;
  from?: string;
  to?: string;
  dictionary?: string;
}

const DATE_FROM = '2026-01-01';
const DATE_TO = '2026-12-31';

/**
 * Aturan diproses berurutan; aturan pertama yang cocok menang.
 * Tujuannya: nama kolom umum selalu mendapat tipe yang benar, sehingga
 * `Jam_Masuk` tidak pernah jatuh ke teks acak dan `Cuti` tidak pernah jadi teks.
 */
export const COLUMN_NAME_RULES: ColumnRule[] = [
  // Jam kerja / durasi = angka (diletakkan sebelum aturan `time`)
  { type: 'integer', test: /(jam_kerja|jam_lembur|durasi|_menit$|_menit_|_detik|_detik_)/ },
  // Waktu HH:mm
  { type: 'time', test: /(^|_)(jam|waktu|time)(_|$)|jam_masuk|jam_pulang|jam_(datang|keluar|mulai|selesai|istirahat|absen)/ },
  // Nilai uang (sebelum aturan integer agar "Jumlah_Harga" tetap uang)
  { type: 'currency', test: /harga|tarif|biaya|gaji|upah|nominal|amount|price|cost|pendapatan|pengeluaran|pemasukan|omzet|revenue|subtotal|(^|_)total|(^|_)nilai|(^|_)fee|tagihan|dibayar|bayar/ },
  // Satuan barang = integer
  { type: 'integer', test: /stok|persediaan|qty|kuantitas|quantity|jumlah|kuota|kapasitas|(^|_)cuti|(^|_)sakit|(^|_)izin|(^|_)alpha|terlambat|kehadiran|(^|_)umur|(^|_)usia|(^|_)poin|(^|_)skor|(^|_)score|(^|_)hari|(^|_)bulan|(^|_)tahun|jumlah_/ },
  // Besaran desimal
  { type: 'decimal', test: /berat|volume|panjang|luas|jarak|suhu|persentase|persen|rasio|(^|_)rate|tinggi|lebar|kedalaman|liter/, decimals: 2 },
  // Tanggal (termasuk Tanggal_Kedaluwarsa)
  { type: 'date', test: /tanggal|(^|_)tgl(_|$)|(^|_)date(_|$)/, from: DATE_FROM, to: DATE_TO },
  // Kontak (harus sebelum aturan id agar "No_HP" tidak jadi id)
  { type: 'text', test: /telepon|telp|tlp|phone|(^|_)hp(_|$)|whatsapp|(^|_)wa(_|$)|kontak|handphone|no_hp|nomor_hp|fax/, dictionary: 'telepon' },
  { type: 'text', test: /email|e_mail/, dictionary: 'email' },
  { type: 'text', test: /alamat|address/, dictionary: 'alamat' },
  // Identitas berpola
  { type: 'id', test: /(^|_)(kode|sku|id|no|nomor|nomer|invoice|faktur|ref|referensi|resi|batch|lot|nik|nip|nopol|serial)(_|$)/, },
  // Nama orang/perusahaan
  { type: 'name', test: /(^|_)(nama|name)(_|$)|pelanggan|customer|klien|nasabah|pegawai|karyawan|mekanik|operator|supir|driver|supplier|vendor|pemasok|perusahaan/ },
  // Kategorikal
  { type: 'category', test: /kategori|jenis|tipe|kelompok|golongan|gudang|cabang|wilayah|kota|daerah|divisi|departemen|(^|_)unit(_|$)|(^|_)bank|metode|pembayaran|status|kondisi|produk|barang|item|komoditas|layanan|jasa|satuan|kualitas|grade|merk|merek|brand|shift/ },
  // Teks dari kamus tetap
  { type: 'text', test: /keterangan|catatan|note|deskripsi|uraian|remark|komentar|alasan/, dictionary: 'keterangan' },
];

export function normalizeColumnName(name: string): string {
  return name
    .toLocaleLowerCase('id')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export interface ResolveColumnOptions {
  /** Dipakai untuk kolom `category` yang punya padanan nilai industri. */
  categoryValues?: (columnName: string) => string[] | undefined;
}

function defaultNumericRange(name: string, type: 'integer' | 'decimal' | 'currency'): { min: number; max: number } {
  const normalized = normalizeColumnName(name);
  if (type === 'currency') return { min: 1_000, max: 5_000_000 };
  if (type === 'decimal') return { min: 0, max: 1000 };
  if (/cuti|sakit|izin|alpha|hari|bulan|tahun/.test(normalized)) return { min: 0, max: 12 };
  if (/terlambat|kehadiran|shift/.test(normalized)) return { min: 0, max: 30 };
  if (/poin|skor|score/.test(normalized)) return { min: 0, max: 100 };
  if (/stok|persediaan/.test(normalized)) return { min: 0, max: 500 };
  if (/jumlah|qty|kuantitas|quantity/.test(normalized)) return { min: 1, max: 100 };
  return { min: 1, max: 100 };
}

function defaultIdPattern(name: string): string {
  const normalized = normalizeColumnName(name);
  const prefix = /invoice|faktur/.test(normalized)
    ? 'INV'
    : /(^|_)po(_|$)/.test(normalized)
      ? 'PO'
      : /(^|_)so(_|$)/.test(normalized)
        ? 'SO'
        : /sku|produk|barang/.test(normalized)
          ? 'SKU'
          : /nik|nip|pegawai|karyawan/.test(normalized)
            ? 'EMP'
            : /resi/.test(normalized)
              ? 'RST'
              : /kode|code/.test(normalized)
                ? 'KD'
                : 'TRX';
  return `${prefix}-2026-####`;
}

function buildNumericColumn(
  name: string,
  type: 'integer' | 'decimal' | 'currency',
  source: ColumnInput,
  rule: ColumnRule,
): DatasetColumn {
  const rangeMin = source.range && typeof source.range[0] === 'number' ? source.range[0] : undefined;
  const rangeMax = source.range && typeof source.range[1] === 'number' ? source.range[1] : undefined;
  const fallback = defaultNumericRange(name, type);
  let min = source.min ?? rangeMin ?? rule.min ?? fallback.min;
  let max = source.max ?? rangeMax ?? rule.max ?? fallback.max;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    min = fallback.min;
    max = fallback.max;
  }
  if (type === 'integer') {
    min = Math.round(min);
    max = Math.round(max);
  }
  const column: DatasetColumn = { name, type, min, max };
  if (type === 'decimal') {
    column.decimals = source.decimals ?? rule.decimals ?? 2;
  }
  return column;
}

function buildDateColumn(name: string, source: ColumnInput, rule: ColumnRule): DatasetColumn {
  const rangeFrom = source.range && typeof source.range[0] === 'string' ? source.range[0] : undefined;
  const rangeTo = source.range && typeof source.range[1] === 'string' ? source.range[1] : undefined;
  let from = source.from ?? rangeFrom ?? rule.from ?? DATE_FROM;
  let to = source.to ?? rangeTo ?? rule.to ?? DATE_TO;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    from = DATE_FROM;
    to = DATE_TO;
  }
  return { name, type: 'date', from, to };
}

function buildCategoryColumn(name: string, source: ColumnInput, options: ResolveColumnOptions): DatasetColumn {
  const industryValues = options.categoryValues?.(name);
  const values = industryValues?.length
    ? industryValues
    : source.values?.length
      ? source.values
      : defaultCategoryValues(name);
  return { name, type: 'category', values };
}

/**
 * Menyelesaikan satu kolom mentah menjadi spesifikasi kanonik registry.
 * Melempar UnknownColumnTypeError bila nama maupun tipe deklarasinya tidak dikenali.
 */
export function resolveColumnSpec(column: ColumnInput, options: ResolveColumnOptions = {}): DatasetColumn {
  const declared = normalizeLegacyColumnType(column.type) ?? (column.type as ColumnType | undefined);
  const rule = COLUMN_NAME_RULES.find((candidate) => candidate.test.test(normalizeColumnName(column.name)));

  if (column.expression?.trim()) {
    return { name: column.name, type: 'derived', expression: column.expression.trim() };
  }

  if (rule) {
    switch (rule.type) {
      case 'time':
        return { name: column.name, type: 'time' };
      case 'integer':
        return buildNumericColumn(column.name, 'integer', column, rule);
      case 'decimal':
        return buildNumericColumn(column.name, 'decimal', column, rule);
      case 'currency':
        return buildNumericColumn(column.name, 'currency', column, rule);
      case 'date':
        return buildDateColumn(column.name, column, rule);
      case 'id':
        return { name: column.name, type: 'id', pattern: column.pattern ?? defaultIdPattern(column.name) };
      case 'name':
        return { name: column.name, type: 'name' };
      case 'category':
        return buildCategoryColumn(column.name, column, options);
      case 'text':
        return { name: column.name, type: 'text', dictionary: dictionaryKey(column.name, column.dictionary) };
      default:
        break;
    }
  }

  // Nama tidak dikenali: pakai tipe deklarasi bila termasuk registry tertutup.
  if (!declared) {
    throw new UnknownColumnTypeError(column.name, column.type);
  }
  switch (declared) {
    case 'integer':
    case 'decimal':
    case 'currency':
      return buildNumericColumn(column.name, declared, column, { type: declared, test: /(?:)/ });
    case 'date':
      return buildDateColumn(column.name, column, { type: 'date', test: /(?:)/ });
    case 'dateAfter':
      return { name: column.name, type: 'dateAfter', after: column.after ?? column.name };
    case 'category':
      return buildCategoryColumn(column.name, column, options);
    case 'id':
      return { name: column.name, type: 'id', pattern: column.pattern ?? 'TRX-2026-####' };
    case 'text':
      return { name: column.name, type: 'text', dictionary: dictionaryKey(column.name, column.dictionary) };
    case 'name':
      return { name: column.name, type: 'name' };
    case 'time':
      return { name: column.name, type: 'time' };
    case 'derived':
      if (!column.expression?.trim()) {
        throw new UnknownColumnTypeError(column.name, column.type);
      }
      return { name: column.name, type: 'derived', expression: column.expression.trim() };
    default:
      throw new UnknownColumnTypeError(column.name, column.type);
  }
}

function dictionaryKey(name: string, explicit?: string): string {
  if (explicit && TEXT_DICTIONARIES[explicit]) return explicit;
  const normalized = normalizeColumnName(name);
  const key = Object.keys(TEXT_DICTIONARIES).find((candidate) => normalized.includes(candidate));
  return key ?? 'default';
}

/**
 * Menyelesaikan seluruh kolom + menerapkan relasi antar kolom:
 * - `Tanggal_Kedaluwarsa` menjadi `dateAfter` bila ada kolom tanggal acuan.
 * - `Stok_Akhir` menjadi kolom `derived` bila Stok_Awal/Masuk/Keluar tersedia.
 */
export function resolveDatasetColumns(
  columns: ColumnInput[],
  options: ResolveColumnOptions = {},
): DatasetColumn[] {
  const resolved = columns.map((column) => resolveColumnSpec(column, options));

  const byName = new Map(resolved.map((column) => [normalizeColumnName(column.name), column]));
  const findColumn = (pattern: RegExp): DatasetColumn | undefined =>
    resolved.find((column) => pattern.test(normalizeColumnName(column.name)));

  const baseDateColumn = findColumn(/^(tanggal|tgl|date)(_|$)/);
  const openingColumn = findColumn(/^(stok|saldo|persediaan)_?awal/);
  const incomingColumn = findColumn(/^(stok|saldo|persediaan)_?masuk/);
  const outgoingColumn = findColumn(/^(stok|saldo|persediaan)_?keluar/);

  return resolved.map((column) => {
    const normalized = normalizeColumnName(column.name);

    if (
      isDateType(column.type) &&
      /(kedaluwarsa|expire|kadaluarsa|jatuh_tempo|due|berlaku|akhir)/.test(normalized) &&
      baseDateColumn &&
      baseDateColumn.name !== column.name
    ) {
      const base = byName.get(normalizeColumnName(baseDateColumn.name))!;
      return { name: column.name, type: 'dateAfter', after: base.name };
    }

    if (
      /(stok|saldo|persediaan)_?(akhir|akhir_|total)/.test(normalized) ||
      (/(akhir|ending)/.test(normalized) && /stok|saldo|persediaan/.test(normalized))
    ) {
      if (openingColumn && incomingColumn && outgoingColumn) {
        const expression = `${openingColumn.name}+${incomingColumn.name}-${outgoingColumn.name}`;
        return { name: column.name, type: 'derived', expression };
      }
    }

    return column;
  });
}

/**
 * Menyelesaikan dataset mentah menjadi DatasetSpec kanonik (tipe tertutup).
 * Melempar UnknownColumnTypeError bila ada kolom dengan tipe tak dikenal.
 */
export function resolveDatasetSpec(
  raw: DatasetInput,
  options: ResolveColumnOptions = {},
): DatasetSpec {
  const columns = resolveDatasetColumns(raw.columns, options);
  return DatasetSchema.parse({
    sheetName: raw.sheetName ?? 'Data_Admin',
    rows: normalizeDatasetRows(raw.rows),
    columns,
    traps: raw.traps ?? [],
  });
}
