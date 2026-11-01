import * as XLSX from 'xlsx';
import { CaseStudy } from '@/shared/schema';
import { DataRow } from './dataset-generator';
import { ROLE_PROFILES } from '@/shared/constants';

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

  if (caseStudy.level === 'portfolio' && caseStudy.portfolioBrief) {
    // 1. README sheet
    const readmeData = [
      ['STUDI KASUS ADMIN EXCEL - PORTOFOLIO'],
      ['Judul', caseStudy.title],
      ['Bidang Admin', ROLE_PROFILES[caseStudy.role]?.label ?? caseStudy.role],
      ['Industri', caseStudy.industry ?? '-'],
      ['Level', caseStudy.level.toUpperCase()],
      ['Versi Excel', caseStudy.excelVersion],
      ['Gaya Rumus', caseStudy.formulaStyle === 'modern' ? 'Modern (Structured Reference)' : 'Classic (Cell Reference)'],
      ['Seed', caseStudy.seed],
      [''],
      ['BRIEF KLIEN'],
      [caseStudy.portfolioBrief.clientBrief],
      [''],
      ['DELIVERABLES'],
      ...caseStudy.portfolioBrief.deliverables.map((d, i) => [`${i + 1}. ${d}`]),
      [''],
      ['DAFTAR TUGAS'],
      ...caseStudy.tasks.map((t) => [`Tugas ${t.no}`, t.instruction, `Target: ${t.targetResult}`]),
    ];
    const wsReadme = XLSX.utils.aoa_to_sheet(readmeData);
    XLSX.utils.book_append_sheet(wb, wsReadme, '01_README');

    // 2. RAW_DATA sheet
    const wsRaw = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsRaw, '02_RAW_DATA');

    // 3. CALC_ENGINE template placeholder
    const calcTemplate = [
      ['CALCULATION ENGINE / DATA CLEANSING HELPER'],
      ['Gunakan sheet ini untuk meletakkan formula pembantu, intermediate lookup, dan summary pivot.'],
    ];
    const wsCalc = XLSX.utils.aoa_to_sheet(calcTemplate);
    XLSX.utils.book_append_sheet(wb, wsCalc, '03_CALC_ENGINE');

    // 4. EXECUTIVE_DASHBOARD placeholder
    const dashTemplate = [
      ['EXECUTIVE DASHBOARD'],
      ['Rancang pivot chart, kartu skor KPI, dan slicer interaktif pada lembar kerja ini.'],
    ];
    const wsDash = XLSX.utils.aoa_to_sheet(dashTemplate);
    XLSX.utils.book_append_sheet(wb, wsDash, '04_DASHBOARD');
  } else {
    // Standard single-sheet dataset
    const sheetName = (caseStudy.dataset.sheetName || 'Data_Admin').substring(0, 31);
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

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
  rows.push(['No Tugas', 'Formula', 'Penjelasan']);
  for (const answer of caseStudy.answerKey) {
    rows.push([`Tugas ${answer.task}`, answer.formula, answer.explanation || '']);
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
  const ws = XLSX.utils.json_to_sheet(rows);
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
