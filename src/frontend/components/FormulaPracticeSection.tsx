'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Eye, EyeOff, Info, Sparkles } from 'lucide-react';
import { CaseStudy } from '@/shared/schema';
import { normalizeExcelFormulaLocale } from '@/shared/excel-formula-locale';

interface FormulaPracticeSectionProps {
  caseStudy: CaseStudy;
}

type PracticeStyle = 'classic' | 'modern';

const columnIndex = (letters: string) =>
  letters.split('').reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);

const columnName = (index: number) => {
  let name = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
};

const toStructuredFormula = (formula: string, columns: CaseStudy['dataset']['columns'], sheetName: string, useAt: boolean) => {
  let convertedReferences = /\[[^\]]+\]/.test(normalizeExcelFormulaLocale(formula)) ? 1 : 0;
  const headerByColumn = new Map(columns.map((column, index) => [columnName(index + 1), column.name]));
  const getHeader = (letters: string) => headerByColumn.get(letters.toUpperCase()) ?? `Kolom_${letters.toUpperCase()}`;
  const getTableName = (sheet: string) => {
    const unquotedSheet = sheet.replace(/^'|'$/g, '').replace(/''/g, "'");
    if (unquotedSheet.toLocaleLowerCase('id') === sheetName.toLocaleLowerCase('id')) return 'TabelData';
    const safeName = unquotedSheet.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
    return `Tabel_${safeName}`;
  };
  const structuredHeader = (name: string) => useAt ? `[@[${name}]]` : `TabelData[${name}]`;
  const converted = normalizeExcelFormulaLocale(formula)
    .replace(/((?:'[^']+'|[A-Za-z_][A-Za-z0-9_. ]*)!)\$?([A-Z]{1,3})\$?\d+:\$?([A-Z]{1,3})\$?\d+/gi, (_reference, sheet: string, startColumn: string, endColumn: string) => {
      const startName = getHeader(startColumn);
      const endName = getHeader(endColumn);
      const tableName = getTableName(sheet.slice(0, -1));
      convertedReferences++;
      if (startName === endName) return `${tableName}[${startName}]`;
      return `${tableName}[[#Data],[${startName}]:[${endName}]]`;
    })
    .replace(/(?<![A-Z0-9_!])\$?([A-Z]{1,3})\$?\d+:\$?([A-Z]{1,3})\$?\d+(?![A-Z0-9_])/gi, (_reference, startColumn: string, endColumn: string) => {
      const startName = getHeader(startColumn);
      const endName = getHeader(endColumn);
      const startIndex = columnIndex(startColumn.toUpperCase());
      const endIndex = columnIndex(endColumn.toUpperCase());
      const names = Array.from({ length: Math.abs(endIndex - startIndex) + 1 }, (_, index) =>
        getHeader(columnName(Math.min(startIndex, endIndex) + index)));
      convertedReferences++;
      if (names.length === 1) return `TabelData[${startName}]`;
      return `TabelData[[#Data],[${names[0]}]:[${names[names.length - 1]}]]`;
    })
    .replace(/((?:'[^']+'|[A-Za-z_][A-Za-z0-9_. ]*)!)\$?([A-Z]{1,3}):\$?([A-Z]{1,3})/gi, (_reference, sheet: string, startColumn: string, endColumn: string) => {
      const startName = getHeader(startColumn);
      const endName = getHeader(endColumn);
      const tableName = getTableName(sheet.slice(0, -1));
      convertedReferences++;
      if (startName === endName) return `${tableName}[${startName}]`;
      return `${tableName}[[#Data],[${startName}]:[${endName}]]`;
    })
    .replace(/(?<![A-Z0-9_!])\$?([A-Z]{1,3}):\$?([A-Z]{1,3})(?![A-Z0-9_])/gi, (_reference, startColumn: string, endColumn: string) => {
      const startName = getHeader(startColumn);
      const endName = getHeader(endColumn);
      convertedReferences++;
      if (startName === endName) return `TabelData[${startName}]`;
      return `TabelData[[#Data],[${startName}]:[${endName}]]`;
    })
    .replace(/((?:'[^']+'|[A-Za-z_][A-Za-z0-9_. ]*)!)\$?([A-Z]{1,3})\$?(\d+)/gi, (_reference, sheet: string, letters: string, row: string) => {
      const tableName = getTableName(sheet.slice(0, -1));
      convertedReferences++;
      return `INDEX(${tableName}[${getHeader(letters)}];${Math.max(1, Number(row) - 1)})`;
    })
    .replace(/(?<![A-Z0-9_:!])\$?([A-Z]{1,3})\$?(\d+)(?![A-Z0-9_])/gi, (reference, letters: string, row: string) => {
      const header = getHeader(letters);
      if (!header || Number(row) < 2) return reference;
      convertedReferences++;
      return structuredHeader(header);
    });

  return { formula: converted, convertedReferences };
};

export const FormulaPracticeSection: React.FC<FormulaPracticeSectionProps> = ({ caseStudy }) => {
  const [style, setStyle] = useState<PracticeStyle>('classic');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<number[]>([]);

  useEffect(() => {
    setStyle(caseStudy.formulaStyle ?? 'classic');
    setAnswers({});
    setRevealed([]);
  }, [caseStudy.seed, caseStudy.formulaStyle]);

  const solutions = useMemo(() => new Map(
    caseStudy.answerKey.map((item) => [item.task, toStructuredFormula(item.formula, caseStudy.dataset.columns, caseStudy.dataset.sheetName, caseStudy.structuredReferenceAt ?? true)]),
  ), [caseStudy.answerKey, caseStudy.dataset.columns, caseStudy.dataset.sheetName, caseStudy.structuredReferenceAt]);

  const toggleReveal = (taskNo: number) => {
    setRevealed((current) => current.includes(taskNo) ? current.filter((value) => value !== taskNo) : [...current, taskNo]);
  };

  return (
    <section id="latihan-rumus" className="scroll-mt-32">
      <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900/70 dark:bg-gray-800 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-100 p-2 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"><BookOpenCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Latihan Rumus Classic &amp; Modern</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Coba tulis rumus untuk tiap tugas, lalu buka pembahasan dan bandingkan gaya penulisannya.</p>
            </div>
          </div>
          <div className="flex shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900" role="group" aria-label="Pilih gaya rumus">
            {(['classic', 'modern'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={style === value} onClick={() => setStyle(value)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${style === value ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700'}`}>{value === 'classic' ? 'Classic' : 'Modern'}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-relaxed text-violet-950 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-100">
          {style === 'classic' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
          <p>{style === 'classic'
            ? 'Classic memakai alamat sel seperti C2 dan $D$2:$D$100. Gaya ini paling umum digunakan dan cocok untuk range biasa.'
            : 'Modern memakai structured reference seperti [@[Stok Awal]] dan TabelData[Qty Masuk]. Ubah data menjadi Table (Ctrl+T) dan beri nama TabelData. Fungsi XLOOKUP, FILTER, UNIQUE, SORT, IFS, TEXTJOIN, dan LET tertentu memerlukan Excel 2021/365.'}</p>
        </div>

        <div className="mt-5 space-y-4">
          {caseStudy.tasks.map((task) => {
            const solution = solutions.get(task.no);
            const isRevealed = revealed.includes(task.no);
            const selectedFormula = style === 'classic'
              ? solution && normalizeExcelFormulaLocale(caseStudy.answerKey.find((item) => item.task === task.no)?.formula ?? '')
              : solution?.formula;

            return (
              <article key={task.no} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">Soal #{task.no}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">Mode {style === 'classic' ? 'Classic' : 'Modern'}</span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-900 dark:text-white">{task.instruction}</p>
                {task.hint && <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Petunjuk: {task.hint}</p>}
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">Jawaban rumus Anda</span>
                  <textarea value={answers[task.no] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [task.no]: event.target.value }))} rows={2} placeholder={style === 'classic' ? '=SUM(C2:C100)' : '=SUM(TabelData[Total])'} className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                </label>
                <button type="button" onClick={() => toggleReveal(task.no)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-300 px-3 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40">
                  {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{isRevealed ? 'Tutup pembahasan' : 'Lihat pembahasan'}
                </button>
                {isRevealed && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/25">
                    {selectedFormula ? (
                      <>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Contoh jawaban {style === 'classic' ? 'Classic' : 'Modern'}</div>
                        <code className="mt-1.5 block overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs font-semibold text-emerald-900 dark:text-emerald-200">{selectedFormula}</code>
                        {style === 'modern' && (solution?.convertedReferences ?? 0) === 0 && (
                          <p className="mt-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">Gunakan formula ini di dalam Table bernama TabelData agar structured reference baris aktif dikenali.</p>
                        )}
                        {style === 'modern' && selectedFormula.includes('Kolom_') && <p className="mt-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">Nama Kolom_A, Kolom_B, dan seterusnya adalah placeholder untuk kolom yang tidak ada pada dataset saat ini. Jadikan range sumber/master sebagai Table dan ganti placeholder dengan ejaan header yang tepat.</p>}
                      </>
                    ) : <p className="text-xs text-gray-600 dark:text-gray-300">Kunci jawaban untuk soal ini belum tersedia.</p>}
                    {caseStudy.answerKey.find((item) => item.task === task.no)?.explanation && <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">{caseStudy.answerKey.find((item) => item.task === task.no)?.explanation}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">Jawaban Anda hanya digunakan sebagai latihan di halaman ini dan tidak dikirim ke server.</p>
      </div>
    </section>
  );
};
