import { faker } from '@faker-js/faker';
import { CaseStudy, DatasetColumn } from '@/shared/schema';

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

export type DataRow = Record<string, string | number | null>;

/**
 * Generates realistic dataset rows based on CaseStudy.dataset schema and seed.
 * For Middle, Advance, and Portfolio levels, automatically injects intentional data traps!
 */
export function generateDatasetRows(caseStudy: CaseStudy): DataRow[] {
  const seedNum = cyrb53(caseStudy.seed || 'excel-admin-seed');
  faker.seed(seedNum);

  const { columns, rows: targetRowCount } = caseStudy.dataset;
  const rowCount = Math.max(50, Math.min(targetRowCount || 150, 500));
  const isTrapLevel = caseStudy.level !== 'easy';

  const rows: DataRow[] = [];

  for (let i = 0; i < rowCount; i++) {
    const row: DataRow = {};

    for (const col of columns) {
      row[col.name] = generateCellValue(col, i);
    }

    rows.push(row);
  }

  // Inject intentional data traps for level Middle, Advance, Portfolio
  if (isTrapLevel && rows.length > 20) {
    injectDataTraps(rows, columns, seedNum);
  }

  return rows;
}

function generateCellValue(col: DatasetColumn, rowIndex: number): string | number {
  const colNameLower = col.name.toLowerCase();

  // If enum values provided
  if (col.type === 'enum' && col.values && col.values.length > 0) {
    return faker.helpers.arrayElement(col.values);
  }

  // Number / Currency / Int
  if (col.type === 'int' || col.type === 'number' || col.type === 'currency') {
    let min = 1;
    let max = 100;
    if (col.range && Array.isArray(col.range)) {
      min = Number(col.range[0]) || min;
      max = Number(col.range[1]) || max;
    } else if (col.type === 'currency' || colNameLower.includes('harga') || colNameLower.includes('nominal')) {
      min = 25000;
      max = 2500000;
    } else if (colNameLower.includes('qty') || colNameLower.includes('jumlah')) {
      min = 1;
      max = 50;
    }

    const val = faker.number.int({ min, max });
    if (col.type === 'currency') {
      return Math.round(val / 1000) * 1000;
    }
    return val;
  }

  // Date
  if (col.type === 'date') {
    let fromDate = new Date('2026-01-01');
    let toDate = new Date('2026-03-31');

    if (col.range && Array.isArray(col.range) && col.range.length === 2) {
      fromDate = new Date(String(col.range[0]));
      toDate = new Date(String(col.range[1]));
    }

    const d = faker.date.between({ from: fromDate, to: toDate });
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Text heuristics based on column name
  if (colNameLower.includes('no') || colNameLower.includes('id') || colNameLower.includes('kode') || colNameLower.includes('invoice')) {
    const prefix = colNameLower.includes('inv') ? 'INV' : colNameLower.includes('po') ? 'PO' : 'TRX';
    return `${prefix}-${2026}-${String(rowIndex + 1).padStart(4, '0')}`;
  }

  if (colNameLower.includes('nama') || colNameLower.includes('customer') || colNameLower.includes('pegawai')) {
    return faker.person.fullName();
  }

  if (colNameLower.includes('barang') || colNameLower.includes('produk') || colNameLower.includes('item')) {
    return faker.commerce.productName();
  }

  if (colNameLower.includes('kota') || colNameLower.includes('wilayah') || colNameLower.includes('cabang')) {
    return faker.helpers.arrayElement(['Jakarta', 'Bandung', 'Surabaya', 'Semarang', 'Medan', 'Makassar']);
  }

  return `Item-${rowIndex + 1}`;
}

/**
 * Injects deliberate data traps for realistic data-cleaning practice:
 * 1. Leading/trailing spaces on string columns (e.g. " ATK01 ")
 * 2. Text dates with single quote / unformatted string
 * 3. Numbers stored as text (e.g. '15000)
 * 4. Empty / null cells
 * 5. Duplicate rows (2-3 duplicates)
 */
function injectDataTraps(rows: DataRow[], columns: DatasetColumn[], seed: number) {
  const textCols = columns.filter((c) => c.type === 'text' || c.type === 'enum');
  const numCols = columns.filter((c) => c.type === 'int' || c.type === 'number' || c.type === 'currency');
  const dateCols = columns.filter((c) => c.type === 'date');

  // 1. Spasi berlebih pada text columns
  if (textCols.length > 0) {
    const colName = textCols[0].name;
    const targets = [5, 12, 28, 45];
    for (const idx of targets) {
      if (rows[idx] && rows[idx][colName]) {
        rows[idx][colName] = `  ${rows[idx][colName]} `;
      }
    }
  }

  // 2. Angka tersimpan sebagai teks
  if (numCols.length > 0) {
    const colName = numCols[0].name;
    const targets = [8, 22, 39];
    for (const idx of targets) {
      if (rows[idx] && rows[idx][colName] !== null) {
        rows[idx][colName] = String(rows[idx][colName]);
      }
    }
  }

  // 3. Tanggal bertipe teks atau variasi separator
  if (dateCols.length > 0) {
    const colName = dateCols[0].name;
    const targets = [7, 19, 31];
    for (const idx of targets) {
      if (rows[idx] && rows[idx][colName]) {
        const dStr = String(rows[idx][colName]);
        rows[idx][colName] = dStr.replace(/-/g, '/'); // "2026/02/15" text variation
      }
    }
  }

  // 4. Sel kosong (Null/blank)
  if (numCols.length > 1 && rows.length > 25) {
    const colName = numCols[1].name;
    rows[14][colName] = '';
    rows[27][colName] = '';
  }

  // 5. Duplikat 2 baris
  if (rows.length > 30) {
    rows[20] = { ...rows[10] };
    rows[35] = { ...rows[15] };
  }
}
