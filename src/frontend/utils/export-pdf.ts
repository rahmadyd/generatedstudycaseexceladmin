import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CaseStudy } from '@/shared/schema';
import { DataRow } from './dataset-generator';

export function exportSoalPDF(caseStudy: CaseStudy, previewRows: DataRow[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header banner
  doc.setFillColor(22, 101, 52); // Excel dark green #166534
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('LEMBAR KERJA STUDI KASUS EXCEL ADMIN', 14, 14);

  // Meta info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);

  let cursorY = 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text(caseStudy.title, 14, cursorY);
  cursorY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `Level: ${caseStudy.level.toUpperCase()} | Role: ${caseStudy.role} | Versi Excel: ${caseStudy.excelVersion} | Seed: ${caseStudy.seed}`,
    14,
    cursorY
  );
  cursorY += 10;

  // 1. Skenario
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  doc.text('1. Skenario Kasus', 14, cursorY);
  cursorY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  const scenarioLines = doc.splitTextToSize(caseStudy.scenario, pageWidth - 28);
  doc.text(scenarioLines, 14, cursorY);
  cursorY += scenarioLines.length * 5 + 6;

  // 2. Daftar Tugas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  doc.text('2. Daftar Tugas & Target Output', 14, cursorY);
  cursorY += 4;

  const tasksData = caseStudy.tasks.map((t) => [
    `#${t.no}`,
    `${t.instruction}\nPetunjuk: ${t.hint || '-'}`,
    t.targetResult || '-',
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [['No', 'Instruksi Tugas', 'Target Hasil Akhir']],
    body: tasksData,
    theme: 'grid',
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 120 },
      2: { cellWidth: 50 },
    },
    styles: { fontSize: 8.5, cellPadding: 3 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 8;

  // Check page overflow
  if (cursorY > 230) {
    doc.addPage();
    cursorY = 20;
  }

  // 3. Aturan & Clue Rumus
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  doc.text('3. Panduan Rumus Excel', 14, cursorY);
  cursorY += 4;

  const formulaRows = [
    ['Disarankan (Recommended)', caseStudy.formulas.recommended.join(', ') || '-'],
    ['Boleh Digunakan (Allowed)', caseStudy.formulas.allowed.join(', ') || '-'],
    ['Dilarang (Forbidden)', caseStudy.formulas.forbidden.join(', ') || '-'],
  ];

  autoTable(doc, {
    startY: cursorY,
    head: [['Kategori', 'Daftar Rumus / Fitur']],
    body: formulaRows,
    theme: 'striped',
    headStyles: { fillColor: [55, 65, 81], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 127 },
    },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 8;

  if (cursorY > 220) {
    doc.addPage();
    cursorY = 20;
  }

  // 4. Preview Dataset 5 Baris
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  doc.text(`4. Preview Dataset (${caseStudy.dataset.sheetName} - 5 Baris Pertama)`, 14, cursorY);
  cursorY += 4;

  const colHeaders = caseStudy.dataset.columns.map((c) => c.name);
  const tableRows = previewRows.slice(0, 5).map((row) =>
    colHeaders.map((col) => String(row[col] ?? ''))
  );

  autoTable(doc, {
    startY: cursorY,
    head: [colHeaders],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Halaman ${i} dari ${pageCount} - Dibuat oleh Excel Admin Case Generator`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const safeTitle = caseStudy.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  doc.save(`Soal_${safeTitle}_${caseStudy.seed}.pdf`);
}

export function exportKunciJawabanPDF(caseStudy: CaseStudy) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header banner (Orange/Amber for Answer Key)
  doc.setFillColor(180, 83, 9);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('KUNCI JAWABAN & PEMBAHASAN STUDI KASUS EXCEL', 14, 14);

  let cursorY = 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(146, 64, 14);
  doc.text(caseStudy.title, 14, cursorY);
  cursorY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Level: ${caseStudy.level.toUpperCase()} | Role: ${caseStudy.role} | Versi Excel: ${caseStudy.excelVersion} | Seed: ${caseStudy.seed}`,
    14,
    cursorY
  );
  cursorY += 10;

  // Warning banner
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.rect(14, cursorY, pageWidth - 28, 12, 'FD');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text(
    'PERHATIAN: Kunci jawaban ini memuat rumus acuan dan metodologi verifikasi. Gunakan setelah mencoba mandiri.',
    18,
    cursorY + 7
  );
  cursorY += 18;

  const answerRows = caseStudy.tasks.map((task) => {
    const keyItem = caseStudy.answerKey.find((a) => a.task === task.no);
    const formula = keyItem ? keyItem.formula : '-';
    const explanation = keyItem ? keyItem.explanation : '-';
    return [
      `Tugas #${task.no}`,
      task.instruction,
      formula,
      explanation,
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [['No', 'Instruksi', 'Formula / Rumus Kunci', 'Penjelasan Teknis']],
    body: answerRows,
    theme: 'grid',
    headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 56, fontStyle: 'bold' },
      3: { cellWidth: 60 },
    },
    styles: { fontSize: 8.5, cellPadding: 3 },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Kunci Jawaban - Halaman ${i} dari ${pageCount} | ${caseStudy.seed}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const safeTitle = caseStudy.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  doc.save(`Kunci_Jawaban_${safeTitle}_${caseStudy.seed}.pdf`);
}
