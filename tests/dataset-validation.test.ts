import { describe, expect, it } from 'vitest';

import {
  type ColumnInput,
  resolveDatasetColumns,
  UnknownColumnTypeError,
  resolveColumnSpec,
} from '@/lib/column-types';
import { buildDataset } from '@/shared/dataset-generator';
import {
  buildValidatedDataset,
  findLoremWords,
  validateDataset,
} from '@/shared/dataset-validation';
import { getIndustryColumnValues } from '@/shared/constants';
import { INDUSTRY_OPTIONS, type Industry, type Level } from '@/shared/schema';
import { buildDeterministicTasks, ensureTemplateDataset } from '@/backend/task-templates';
import { TARGET_TASK_COUNT } from '@/shared/generation-config';

const LEVELS: Level[] = ['easy', 'middle', 'advance'];
const INDUSTRIES: Industry[] = [...INDUSTRY_OPTIONS];
const SEED_COUNT = 300;

/** Variasi skema nyata yang menutup seluruh tipe registry. */
const VARIANTS: { name: string; columns: ColumnInput[] }[] = [
  {
    name: 'transaksi',
    columns: [
      { name: 'Jam_Masuk', type: 'time' },
      { name: 'Jam_Pulang', type: 'time' },
      { name: 'Nama_Pelanggan', type: 'name' },
      { name: 'Cuti', type: 'integer', min: 0, max: 12 },
      { name: 'Qty', type: 'integer', min: 1, max: 100 },
      { name: 'Harga', type: 'currency', min: 1000, max: 5_000_000 },
      { name: 'Status', type: 'category', values: ['Selesai', 'Diproses', 'Pending'] },
      { name: 'Kode_Referensi', type: 'id', pattern: 'REF-2026-####' },
      { name: 'Keterangan', type: 'text', dictionary: 'keterangan' },
      { name: 'Tanggal_Transaksi', type: 'date', from: '2026-01-01', to: '2026-06-30' },
    ],
  },
  {
    name: 'inventaris',
    columns: [
      { name: 'Stok_Awal', type: 'integer', min: 20, max: 400 },
      { name: 'Stok_Masuk', type: 'integer', min: 0, max: 150 },
      { name: 'Stok_Keluar', type: 'integer', min: 0, max: 80 },
      { name: 'Stok_Akhir', type: 'integer', min: 0, max: 600 },
      { name: 'Produk', type: 'category', values: ['Semen', 'Besi', 'Cat'] },
      { name: 'Gudang', type: 'category', values: ['Gudang A', 'Gudang B'] },
      { name: 'Kode_Produk', type: 'id', pattern: 'SKU-2026-####' },
      { name: 'Harga_Satuan', type: 'currency', min: 5_000, max: 500_000 },
      { name: 'Berat_Kg', type: 'decimal', min: 0.5, max: 100 },
      { name: 'Tanggal_Masuk', type: 'date', from: '2026-01-01', to: '2026-06-30' },
    ],
  },
  {
    name: 'hrd',
    columns: [
      { name: 'Cuti', type: 'integer', min: 0, max: 12 },
      { name: 'Gaji_Pokok', type: 'currency', min: 3_000_000, max: 15_000_000 },
      { name: 'Nama_Karyawan', type: 'name' },
      { name: 'Departemen', type: 'category', values: ['Finance', 'HRD', 'Operations'] },
      { name: 'NIP', type: 'id', pattern: 'EMP-2026-####' },
      { name: 'Jam_Masuk', type: 'time' },
      { name: 'Jam_Pulang', type: 'time' },
      { name: 'Catatan', type: 'text', dictionary: 'catatan' },
      { name: 'Tanggal_Rekrutmen', type: 'date', from: '2026-01-01', to: '2026-04-30' },
      { name: 'Tanggal_Kontrak_Berakhir', type: 'dateAfter', after: 'Tanggal_Rekrutmen' },
    ],
  },
];

function contextFor(index: number) {
  const level = LEVELS[index % LEVELS.length];
  const industry = INDUSTRIES[index % INDUSTRIES.length];
  const variant = VARIANTS[index % VARIANTS.length];
  return {
    seed: `matrix-${index}-${level}-${industry}`,
    level,
    industry,
    dataset: { sheetName: 'Data_Admin', rows: 50, columns: variant.columns },
    categoryValues: (columnName: string) => getIndustryColumnValues(columnName, industry),
    variant,
  };
}

describe('registry tipe kolom', () => {
  it('memetakan nama kolom umum ke tipe registry yang benar', () => {
    const resolved = resolveDatasetColumns([
      { name: 'Jam_Masuk' },
      { name: 'Jam_Pulang' },
      { name: 'Cuti' },
      { name: 'Stok_Awal' },
      { name: 'Stok_Masuk' },
      { name: 'Stok_Keluar' },
      { name: 'Stok_Akhir' },
      { name: 'Tanggal' },
      { name: 'Tanggal_Kedaluwarsa' },
      { name: 'Gudang' },
      { name: 'Kategori' },
      { name: 'Produk' },
    ]);
    const byName = Object.fromEntries(resolved.map((column) => [column.name, column]));
    expect(byName['Jam_Masuk'].type).toBe('time');
    expect(byName['Jam_Pulang'].type).toBe('time');
    expect(byName['Cuti'].type).toBe('integer');
    expect(byName['Stok_Awal'].type).toBe('integer');
    expect(byName['Stok_Masuk'].type).toBe('integer');
    expect(byName['Stok_Keluar'].type).toBe('integer');
    expect(byName['Stok_Akhir'].type).toBe('derived');
    expect(byName['Tanggal'].type).toBe('date');
    expect(byName['Tanggal_Kedaluwarsa'].type).toBe('dateAfter');
    expect(byName['Gudang'].type).toBe('category');
    expect(byName['Kategori'].type).toBe('category');
    expect(byName['Produk'].type).toBe('category');
  });
});

describe('kolom tak dikenal', () => {
  it('melempar UnknownColumnTypeError yang menyebut nama kolom (nama & tipe tak dikenal)', () => {
    let error: unknown;
    try {
      resolveColumnSpec({ name: 'Kolom_Aneh', type: 'warna' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(UnknownColumnTypeError);
    expect((error as Error).message).toContain('Kolom_Aneh');
    expect((error as Error).message).toContain('tidak dikenal');
    expect((error as UnknownColumnTypeError).columnName).toBe('Kolom_Aneh');
  });

  it('melempar error saat membangun dataset dengan kolom tak dikenal', () => {
    expect(() =>
      buildDataset({
        seed: 's-unknown',
        level: 'easy',
        dataset: {
          sheetName: 'Data_Admin',
          rows: 50,
          columns: [
            { name: 'Aneh_Sekali', type: 'warna' },
            { name: 'Jam_Masuk' },
            { name: 'Jam_Pulang' },
          ],
        },
      }),
    ).toThrow(/Aneh_Sekali/);
  });

  it('tidak pernah mengisi kolom tak dikenal dengan kata lorem (error keras, bukan fallback)', () => {
    expect(() =>
      resolveDatasetColumns([{ name: 'Field1', type: 'campuran' }]),
    ).toThrow(UnknownColumnTypeError);
  });
});

describe('validateDataset menolak penyimpangan tak terdeklarasi', () => {
  it('menolak angka yang tersimpan sebagai teks bila tidak dideklarasikan sebagai trap', () => {
    const dataset = resolveDatasetColumns([
      { name: 'Cuti' },
      { name: 'Jam_Masuk' },
      { name: 'Jam_Pulang' },
    ]);
    const result = validateDataset(
      { sheetName: 'Data_Admin', rows: 50, columns: dataset, traps: [] },
      [{ Cuti: '5', Jam_Masuk: '07:00', Jam_Pulang: '16:00' }],
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Cuti');
  });

  it('menolak kata lorem Latin pada kolom teks', () => {
    const dataset = resolveDatasetColumns([
      { name: 'Keterangan' },
      { name: 'Jam_Masuk' },
      { name: 'Jam_Pulang' },
    ]);
    const result = validateDataset(
      { sheetName: 'Data_Admin', rows: 50, columns: dataset, traps: [] },
      [{ Keterangan: 'lorem ipsum dolor', Jam_Masuk: '07:00', Jam_Pulang: '16:00' }],
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ').toLowerCase()).toContain('lorem');
  });
});

describe('matriks 300 seed (semua level & industri)', () => {
  it('selalu lolos validateDataset dan tidak pernah memuat kata lorem', () => {
    const failures: string[] = [];

    for (let index = 0; index < SEED_COUNT; index += 1) {
      const context = contextFor(index);
      let built;
      try {
        built = buildValidatedDataset({
          seed: context.seed,
          level: context.level,
          industry: context.industry,
          dataset: context.dataset,
          categoryValues: context.categoryValues,
        });
      } catch (error) {
        failures.push(`${context.seed}: build gagal -> ${(error as Error).message}`);
        continue;
      }

      const result = validateDataset(built.dataset, built.rows);
      if (!result.valid) {
        failures.push(`${context.seed}: ${result.errors.slice(0, 3).join(' | ')}`);
      }

      const loremColumns = new Set<string>();
      for (const row of built.rows) {
        for (const [column, value] of Object.entries(row)) {
          if (typeof value === 'string' && findLoremWords(value).length > 0) {
            loremColumns.add(`${column}="${value}"`);
          }
        }
      }
      if (loremColumns.size > 0) {
        failures.push(`${context.seed}: lorem -> ${[...loremColumns].join(', ')}`);
      }

      // Tipe kanonik wajib konsisten pada setiap kolom.
      for (const column of built.dataset.columns) {
        if (column.type === 'time') {
          for (const row of built.rows) {
            const value = row[column.name];
            if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
              failures.push(`${context.seed}: ${column.name} bukan HH:mm -> ${String(value)}`);
              break;
            }
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

describe('determinisme seed', () => {
  it('seed yang sama selalu menghasilkan baris yang identik', () => {
    const context = contextFor(0);
    const base = {
      seed: context.seed,
      level: context.level,
      industry: context.industry,
      dataset: context.dataset,
      categoryValues: context.categoryValues,
    };
    const first = buildValidatedDataset(base);
    const second = buildValidatedDataset(base);
    expect(second.seed).toBe(first.seed);
    expect(JSON.stringify(second.rows)).toBe(JSON.stringify(first.rows));
  });
});

describe('tugas deterministik memenuhi standar tes admin', () => {
  it(`menghasilkan tepat ${TARGET_TASK_COUNT} tugas unik untuk Easy dan Middle`, () => {
    const failures: string[] = [];
    const roles = ['Penjualan', 'Staf Gudang'];

    for (const [variantIndex, variant] of VARIANTS.entries()) {
      const industry = INDUSTRIES[variantIndex % INDUSTRIES.length];
      for (const level of ['easy', 'middle'] as Level[]) {
        for (const role of roles) {
          const label = `${variant.name}/${level}/${role}`;
          try {
            const datasetInput = ensureTemplateDataset(
              { sheetName: 'Data_Admin', rows: 50, columns: variant.columns },
              level,
              role,
              industry,
            );
            const built = buildValidatedDataset({
              seed: `task-${variant.name}-${level}-${role}`,
              level,
              industry,
              dataset: datasetInput,
              categoryValues: (columnName) => getIndustryColumnValues(columnName, industry),
            });
            const generated = buildDeterministicTasks({
              dataset: built.dataset,
              level,
              role,
              excelVersion: 'Microsoft 365',
            }, built.rows, TARGET_TASK_COUNT);

            if (generated.tasks.length !== TARGET_TASK_COUNT) {
              failures.push(`${label}: hanya ${generated.tasks.length} tugas`);
            }
            const instructions = generated.tasks.map((task) => task.instruction);
            if (new Set(instructions).size !== instructions.length) {
              failures.push(`${label}: ada instruksi tugas yang duplikat`);
            }
            if (generated.answerKey.length !== generated.tasks.length) {
              failures.push(`${label}: kunci ${generated.answerKey.length} vs tugas ${generated.tasks.length}`);
            }
            const taskNumbers = generated.tasks.map((task) => task.no);
            if (new Set(taskNumbers).size !== taskNumbers.length) {
              failures.push(`${label}: nomor tugas duplikat`);
            }
          } catch (error) {
            failures.push(`${label}: ${(error as Error).message}`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
