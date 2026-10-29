import * as XLSX from 'xlsx';
import { CaseStudy } from '@/shared/schema';
import { DataRow } from './dataset-generator';

export function exportDatasetToXLSX(caseStudy: CaseStudy, rows: DataRow[]) {
  const wb = XLSX.utils.book_new();

  if (caseStudy.level === 'portfolio' && caseStudy.portfolioBrief) {
    // 1. README sheet
    const readmeData = [
      ['STUDI KASUS ADMIN EXCEL - PORTOFOLIO'],
      ['Judul', caseStudy.title],
      ['Role', caseStudy.role],
      ['Level', caseStudy.level.toUpperCase()],
      ['Versi Excel', caseStudy.excelVersion],
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
    const sheetName = caseStudy.dataset.sheetName || 'Data_Admin';
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const safeTitle = caseStudy.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const filename = `${safeTitle}_${caseStudy.seed}.xlsx`;

  XLSX.writeFile(wb, filename);
}

export function exportDatasetToCSV(caseStudy: CaseStudy, rows: DataRow[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csvContent = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const safeTitle = caseStudy.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  link.href = url;
  link.setAttribute('download', `${safeTitle}_${caseStudy.seed}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
