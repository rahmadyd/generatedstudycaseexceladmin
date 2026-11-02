import * as XLSX from 'xlsx';
import { CaseStudy } from '@/shared/schema';
import { columnTypeToCellKind, isIsoDate } from '@/lib/column-types';
import { DataRow } from './dataset-generator';

type ExportCell = string | number | Date | null;

/**
 * Menyusun data sheet dengan tipe sel yang benar: angka sebagai number,
 * tanggal sebagai Date (atau ISO untuk CSV), jam tetap string "HH:mm".
 * Sel jebakan data yang dideklarasikan dipertahankan apa adanya agar tantangan
 * pembersihan data tetap ada, bukan sumber campuran tipe yang tak sengaja.
 */
function buildDatasetAoa(caseStudy: CaseStudy, rows: DataRow[], datesAsDate = true): ExportCell[][] {
  const columns = caseStudy.dataset.columns;
  const trapCells = new Set<string>();
  for (const trap of caseStudy.dataset.traps ?? []) {
    for (const rowIndex of trap.rows) trapCells.add(`${trap.column}\u0000${rowIndex}`);
  }
  const header: ExportCell[] = columns.map((column) => column.name);
  const body = rows.map((row, rowIndex) => columns.map<ExportCell>((column) => {
    const value = row[column.name];
    if (trapCells.has(`${column.name}\u0000${rowIndex}`)) return value ?? null;
    if (value === null || value === undefined || value === '') return null;
    const kind = columnTypeToCellKind(column.type);
    if (kind === 'number') return typeof value === 'number' ? value : Number(value);
    if (kind === 'date' && typeof value === 'string' && isIsoDate(value)) {
      return datesAsDate ? new Date(`${value}T00:00:00.000Z`) : value;
    }
    return value;
  }));
  return [header, ...body];
}

function applyDateFormats(ws: XLSX.WorkSheet, caseStudy: CaseStudy, rowCount: number): void {
  caseStudy.dataset.columns.forEach((column, columnIndex) => {
    if (columnTypeToCellKind(column.type) !== 'date') return;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })];
      if (cell) cell.z = 'yyyy-mm-dd';
    }
  });
}

/**
 * Builds a column-letter map from the dataset columns.
 * e.g. { "Nama Barang": "A", "Qty": "B", "Harga": "C", ... }
 * This is used to inject a reference guide into the XLSX so the user can cross-check
 * formulas in the answer key against their actual sheet layout.
 */
function buildColumnMap(columns: CaseStudy['dataset']['columns']): Record<string, string> {
  const map: Record<string, string> = {};
  columns.forEach((col, idx) => {
    const letter = columnIndexToLetter(idx);
    map[col.name] = letter;
  });
  return map;
}

function columnIndexToLetter(index: number): string {
  let letter = '';
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

export function exportDatasetToXLSX(caseStudy: CaseStudy, rows: DataRow[]) {
  const wb = XLSX.utils.book_new();
  const columnMap = buildColumnMap(caseStudy.dataset.columns);

  const sheetName = (caseStudy.dataset.sheetName || 'Data_Admin').substring(0, 31);
  const ws = XLSX.utils.aoa_to_sheet(buildDatasetAoa(caseStudy, rows));
  applyDateFormats(ws, caseStudy, rows.length);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Always add a KUNCI_JAWABAN sheet with full context
  const answerSheetData = buildAnswerKeySheet(caseStudy, columnMap);
  const wsAnswer = XLSX.utils.aoa_to_sheet(answerSheetData);
  XLSX.utils.book_append_sheet(wb, wsAnswer, 'KUNCI_JAWABAN');

  const safeTitle = caseStudy.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40);
  const filename = `${safeTitle}_${caseStudy.seed}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Builds the KUNCI_JAWABAN sheet rows.
 * Includes: column map reference, tasks, answer keys with formulas.
 */
function buildAnswerKeySheet(caseStudy: CaseStudy, columnMap: Record<string, string>): (string | number)[][] {
  const rows: (string | number)[][] = [];

  rows.push(['=== KUNCI JAWABAN & REFERENSI KOLOM ===']);
  rows.push(['Judul Soal', caseStudy.title]);
  rows.push(['Level', caseStudy.level.toUpperCase()]);
  rows.push(['Versi Excel', caseStudy.excelVersion]);
  rows.push(['Gaya Rumus', caseStudy.formulaStyle === 'modern' ? 'Modern (Structured Reference)' : 'Classic (Cell/Range Reference)']);
  rows.push(['Sheet Data', caseStudy.dataset.sheetName || 'Data_Admin']);
  rows.push(['']);

  // Column reference map — crucial for Classic formula alignment
  rows.push(['--- PETA KOLOM (untuk rumus Classic) ---']);
  rows.push(['Nama Kolom', 'Kolom Excel', 'Tipe Data']);
  for (const col of caseStudy.dataset.columns) {
    const letter = columnMap[col.name] ?? '?';
    rows.push([col.name, `Kolom ${letter}`, col.type]);
  }
  rows.push(['']);
  rows.push(['CATATAN: Baris 1 = Header. Data dimulai dari baris 2.']);
  rows.push(['Contoh referensi: kolom A = A2:A1000, kolom B = B2:B1000']);
  rows.push(['']);

  // Tasks
  rows.push(['--- DAFTAR TUGAS ---']);
  for (const task of caseStudy.tasks) {
    rows.push([`Tugas ${task.no}`, task.instruction]);
    rows.push(['  Petunjuk:', task.hint || '-']);
    rows.push(['  Target Hasil:', task.targetResult || '-']);
    rows.push(['']);
  }

  // Answer keys
  rows.push(['--- KUNCI JAWABAN ---']);
  rows.push(['No Tugas', 'Mode', 'Formula', 'Nilai Jawaban', 'Rubrik / Penjelasan']);
  for (const answer of caseStudy.answerKey) {
    rows.push([
      `Tugas ${answer.task}`,
      answer.mode === 'rubric' ? 'Dinilai dengan rubrik' : 'Computed',
      answer.formula ?? '',
      typeof answer.expectedValue === 'boolean'
        ? String(answer.expectedValue)
        : answer.expectedValue ?? '',
      answer.mode === 'rubric'
        ? answer.rubricChecklist.map((item, index) => `${index + 1}. ${item}`).join('\n')
        : answer.explanation || '',
    ]);
  }
  rows.push(['']);

  // Data traps reminder
  if (caseStudy.dataTraps && caseStudy.dataTraps.length > 0) {
    rows.push(['--- JEBAKAN DATA (DATA TRAPS) ---']);
    rows.push(['Perhatikan hal berikut dalam dataset:']);
    for (const trap of caseStudy.dataTraps) {
      rows.push([`• ${trap}`]);
    }
  }

  return rows;
}

export function exportDatasetToCSV(caseStudy: CaseStudy, rows: DataRow[]) {
  const ws = XLSX.utils.aoa_to_sheet(buildDatasetAoa(caseStudy, rows, false));
  const csvContent = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const safeTitle = caseStudy.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40);
  link.href = url;
  link.setAttribute('download', `${safeTitle}_${caseStudy.seed}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
