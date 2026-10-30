'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Copy, Download, Search, X } from 'lucide-react';
import { errorEntries, formulaGuideEntries, symbolEntries } from '../utils/formula-guide-data';
import { exportFormulaGuidePDF } from '../utils/export-pdf';

interface FormulaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideTab = 'symbols' | 'formulas' | 'errors';

const tabs: { id: GuideTab; label: string }[] = [
  { id: 'symbols', label: 'Simbol' },
  { id: 'formulas', label: 'Rumus' },
  { id: 'errors', label: 'Error' },
];

const formatFormula = (formula: string, separator: ';' | ',') =>
  separator === ',' ? formula.replace(/;/g, ',') : formula;

export const FormulaGuideModal: React.FC<FormulaGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('symbols');
  const [search, setSearch] = useState('');
  const [separator, setSeparator] = useState<';' | ','>(';');
  const [copied, setCopied] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const query = search.trim().toLocaleLowerCase('id');
  const matchingFormulas = useMemo(
    () => formulaGuideEntries.filter((entry) =>
      `${entry.category} ${entry.name} ${entry.purpose} ${entry.syntax} ${entry.arguments} ${entry.classic} ${entry.modern ?? ''} ${entry.commonError}`
        .toLocaleLowerCase('id').includes(query)),
    [query],
  );
  const matchingSymbols = useMemo(
    () => symbolEntries.filter((entry) => `${entry.title} ${entry.description} ${entry.example}`.toLocaleLowerCase('id').includes(query)),
    [query],
  );
  const matchingErrors = useMemo(
    () => errorEntries.filter((entry) => `${entry.title} ${entry.description} ${entry.example}`.toLocaleLowerCase('id').includes(query)),
    [query],
  );

  if (!isOpen) return null;

  const hasSearch = query.length > 0;
  const copyExample = async (value: string) => {
    try {
      await navigator.clipboard.writeText(formatFormula(value, separator));
      setCopied(value);
      window.setTimeout(() => setCopied(null), 1500);
    } catch (error) {
      console.error('Gagal menyalin contoh rumus:', error);
    }
  };
  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportFormulaGuidePDF(separator);
    } catch (error) {
      console.error('Gagal mengekspor kamus rumus PDF:', error);
      alert('Gagal mengekspor kamus rumus PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderFormulaResults = () => {
    const groups = matchingFormulas.reduce<Record<string, typeof matchingFormulas>>((result, entry) => {
      (result[entry.category] ??= []).push(entry);
      return result;
    }, {});
    return (
      <div className="space-y-5">
        {Object.entries(groups).map(([category, entries]) => (
          <section key={category}>
            <h3 className="mb-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">{category}</h3>
            <div className="space-y-3">
              {entries.map((entry) => (
                <article key={entry.name} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">{entry.name}</h4>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{entry.purpose}</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">{entry.version}</span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div><dt className="inline font-semibold text-gray-800 dark:text-gray-200">Sintaks: </dt><dd className="inline font-mono text-gray-600 dark:text-gray-300">{entry.syntax}</dd></div>
                    <div><dt className="inline font-semibold text-gray-800 dark:text-gray-200">Argumen: </dt><dd className="inline text-gray-600 dark:text-gray-300">{entry.arguments}</dd></div>
                  </dl>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <FormulaExample label="Classic" formula={formatFormula(entry.classic, separator)} result={entry.result} copied={copied === entry.classic} onCopy={() => copyExample(entry.classic)} />
                    {entry.modern && <FormulaExample label="Modern" formula={formatFormula(entry.modern, separator)} result={entry.result} copied={copied === entry.modern} onCopy={() => copyExample(entry.modern!)} />}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300"><strong>Kesalahan umum:</strong> {entry.commonError}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
        {matchingFormulas.length === 0 && <EmptySearch />}
      </div>
    );
  };

  const renderReferenceResults = (entries: typeof symbolEntries) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <article key={entry.title} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <h3 className="font-bold text-gray-900 dark:text-white">{entry.title}</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{entry.description}</p>
          <code className="mt-3 block overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-2.5 font-mono text-xs text-emerald-800 dark:bg-gray-800 dark:text-emerald-300">{formatFormula(entry.example, separator)}</code>
        </article>
      ))}
      {entries.length === 0 && <EmptySearch />}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="formula-guide-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-700 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><BookOpen className="h-5 w-5" /></div>
            <div>
              <h2 id="formula-guide-title" className="text-lg font-bold text-gray-900 dark:text-white">Kamus Simbol, Rumus, dan Error Excel</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Referensi praktis untuk belajar Excel, tanpa API.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExport} disabled={isExporting} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40">
              <Download className="h-4 w-4" />{isExporting ? 'Membuat PDF...' : 'Export PDF'}
            </button>
            <button type="button" onClick={onClose} aria-label="Tutup panduan rumus" className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari simbol, rumus, fungsi, atau error..." className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
            </label>
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900" aria-label="Pemisah argumen">
              <span className="px-2 text-[11px] text-gray-500">Pemisah</span>
              {([';', ','] as const).map((value) => (
                <button key={value} type="button" onClick={() => setSeparator(value)} aria-pressed={separator === value} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${separator === value ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700'}`}>{value}</button>
              ))}
            </div>
          </div>

          {hasSearch ? (
            <div className="space-y-6">
              <section><h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Simbol ({matchingSymbols.length})</h3>{renderReferenceResults(matchingSymbols)}</section>
              <section><h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Rumus ({matchingFormulas.length})</h3>{renderFormulaResults()}</section>
              <section><h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Error ({matchingErrors.length})</h3>{renderReferenceResults(matchingErrors)}</section>
            </div>
          ) : (
            <>
              <div className="mb-5 flex gap-2 border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="Kategori panduan rumus">
                {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.id ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}>{tab.label}</button>)}
              </div>
              {activeTab === 'symbols' && renderReferenceResults(matchingSymbols)}
              {activeTab === 'formulas' && <><div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">Pemisah argumen mengikuti pilihan di atas: <strong>{separator}</strong>. Fungsi seperti XLOOKUP, FILTER, UNIQUE, SORT, IFS, TEXTJOIN, dan LET hanya tersedia pada versi Excel tertentu; periksa label versi di setiap kartu.</div>{renderFormulaResults()}</>}
              {activeTab === 'errors' && renderReferenceResults(matchingErrors)}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

const FormulaExample: React.FC<{ label: string; formula: string; result: string; copied: boolean; onCopy: () => void }> = ({ label, formula, result, copied, onCopy }) => (
  <div className="rounded-lg bg-white p-3 dark:bg-gray-800">
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</span>
      <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300">{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? 'Tersalin' : 'Salin'}</button>
    </div>
    <code className="block overflow-x-auto whitespace-nowrap font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300">{formula}</code>
    <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400"><strong>Hasil:</strong> {result}</p>
  </div>
);

const EmptySearch = () => <p className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Tidak ada hasil yang cocok. Coba kata kunci lain.</p>;
