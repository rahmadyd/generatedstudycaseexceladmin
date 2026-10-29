'use client';

import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Copy, Check, Terminal, ShieldAlert } from 'lucide-react';
import { AnswerKeyItem } from '@/shared/schema';
import { normalizeExcelFormulaLocale } from '@/shared/excel-formula-locale';

interface AnswerKeySectionProps {
  answerKey: AnswerKeyItem[];
}

export const AnswerKeySection: React.FC<AnswerKeySectionProps> = ({ answerKey }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [copiedTask, setCopiedTask] = useState<number | null>(null);

  const handleCopyFormula = (taskNo: number, formula: string) => {
    navigator.clipboard.writeText(formula);
    setCopiedTask(taskNo);
    setTimeout(() => setCopiedTask(null), 2000);
  };

  return (
    <section id="kunci-jawaban" className="scroll-mt-32">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-100 dark:bg-amber-950/60 rounded-xl text-amber-700 dark:text-amber-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                6. Kunci Jawaban & Pembahasan Rumus
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Kunci disembunyikan secara default agar Anda dapat menyelesaikan latihan secara mandiri terlebih dahulu.
              </p>
            </div>
          </div>

          {/* Toggle Button */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition border ${
              isOpen
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-650 shadow-sm'
            }`}
          >
            {isOpen ? (
              <>
                <EyeOff className="w-4 h-4 text-amber-600" />
                <span>Sembunyikan Kunci Jawaban</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-amber-600" />
                <span>Buka Kunci Jawaban</span>
              </>
            )}
          </button>
        </div>

        {/* Revealed Content */}
        {isOpen ? (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-start space-x-2 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                Formula memakai format Excel Indonesia: pemisah argumen titik koma (;) dan koma desimal (,). Kolom atau referensi sel dapat bervariasi bergantung pada struktur sheet Anda.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {answerKey.map((item) => (
                <div
                  key={item.task}
                  className="p-4 sm:p-5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Solusi Tugas #{item.task}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopyFormula(item.task, normalizeExcelFormulaLocale(item.formula))}
                      className="flex items-center space-x-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                      title="Salin formula ke clipboard"
                    >
                      {copiedTask === item.task ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Formula Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Formula</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Formula Box */}
                  <div className="flex items-center space-x-2 bg-gray-900 text-emerald-400 px-3.5 py-2.5 rounded-lg font-mono text-xs sm:text-sm overflow-x-auto border border-gray-800">
                    <Terminal className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <code>{normalizeExcelFormulaLocale(item.formula)}</code>
                  </div>

                  {/* Explanation */}
                  {item.explanation && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed pl-1">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">
                        Penjelasan Logika:{' '}
                      </span>
                      {item.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 p-6 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Kunci jawaban tertutup. Selesaikan tugas di atas lalu klik tombol <strong>"Buka Kunci Jawaban"</strong> untuk mencocokkan rumus.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
