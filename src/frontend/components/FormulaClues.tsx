'use client';

import React, { useState } from 'react';
import { Lightbulb, CheckCircle2, AlertCircle, Ban, Copy, Check } from 'lucide-react';
import { FormulasSpec } from '@/shared/schema';

interface FormulaCluesProps {
  formulas: FormulasSpec;
}

export const FormulaClues: React.FC<FormulaCluesProps> = ({ formulas }) => {
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);

  const handleCopy = (formula: string) => {
    navigator.clipboard.writeText(formula);
    setCopiedFormula(formula);
    setTimeout(() => setCopiedFormula(null), 1500);
  };

  return (
    <section id="clue" className="scroll-mt-32">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2.5 mb-6">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-700 dark:text-emerald-300">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              5. Clue & Aturan Rumus Excel
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Panduan formula resmi agar hasil pengerjaan sesuai dengan standar level yang dipilih.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Recommended (Disarankan) */}
          <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Disarankan (Recommended)</span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-3">
              Rumus utama yang didesain khusus untuk menyelesaikan studi kasus ini:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {formulas.recommended && formulas.recommended.length > 0 ? (
                formulas.recommended.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleCopy(f)}
                    className="group inline-flex items-center space-x-1 px-2.5 py-1 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-mono font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition"
                    title="Klik untuk menyalin rumus"
                  >
                    <span>{f}</span>
                    {copiedFormula === f ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-emerald-500 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                ))
              ) : (
                <span className="text-xs text-gray-500">-</span>
              )}
            </div>
          </div>

          {/* 2. Allowed (Boleh) */}
          <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20">
            <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-300 font-bold text-sm mb-3">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <span>Boleh (Allowed)</span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
              Formula alternatif yang diperbolehkan untuk membantu perhitungan:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {formulas.allowed && formulas.allowed.length > 0 ? (
                formulas.allowed.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleCopy(f)}
                    className="group inline-flex items-center space-x-1 px-2.5 py-1 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 text-xs font-mono font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 transition"
                    title="Klik untuk menyalin rumus"
                  >
                    <span>{f}</span>
                    {copiedFormula === f ? (
                      <Check className="w-3 h-3 text-blue-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-blue-500 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                ))
              ) : (
                <span className="text-xs text-gray-500">-</span>
              )}
            </div>
          </div>

          {/* 3. Forbidden (Dilarang) */}
          <div className="p-5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20">
            <div className="flex items-center space-x-2 text-red-800 dark:text-red-300 font-bold text-sm mb-3">
              <Ban className="w-4 h-4 text-red-600" />
              <span>Dilarang (Forbidden)</span>
            </div>
            <p className="text-xs text-red-700 dark:text-red-400 mb-3">
              Hindari penggunaan fitur atau rumus berikut untuk menjaga integritas level latihan:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {formulas.forbidden && formulas.forbidden.length > 0 ? (
                formulas.forbidden.map((f, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-red-100 dark:bg-red-900/60 text-red-900 dark:text-red-200 text-xs font-mono font-semibold rounded-lg border border-red-300 dark:border-red-800 line-through opacity-80"
                  >
                    {f}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">Tidak ada batasan ketat</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
