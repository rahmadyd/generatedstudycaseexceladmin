'use client';

import React, { useState } from 'react';
import { Award, Briefcase, CheckCircle, FileCode, Copy, Check, FileText } from 'lucide-react';
import { PortfolioBrief } from '@/shared/schema';

interface PortfolioSectionProps {
  portfolioBrief?: PortfolioBrief;
  rubric?: string[];
}

export const PortfolioSection: React.FC<PortfolioSectionProps> = ({
  portfolioBrief,
  rubric,
}) => {
  const [copiedReadme, setCopiedReadme] = useState<boolean>(false);

  if (!portfolioBrief && (!rubric || rubric.length === 0)) {
    return null;
  }

  const handleCopyReadme = () => {
    if (portfolioBrief?.readmeTemplate) {
      navigator.clipboard.writeText(portfolioBrief.readmeTemplate);
      setCopiedReadme(true);
      setTimeout(() => setCopiedReadme(false), 2000);
    }
  };

  return (
    <section id="portofolio-mode" className="scroll-mt-32">
      <div className="bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-emerald-500/10 dark:from-amber-950/30 dark:via-purple-950/20 dark:to-emerald-950/30 rounded-2xl p-6 sm:p-8 shadow-sm border border-amber-300 dark:border-amber-800/80">
        <div className="flex items-center space-x-2.5 mb-6">
          <div className="p-2 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Spesifikasi Portofolio Kerja
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white">
                Level Portofolio
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              Standar deliverable untuk melamar posisi Admin Perusahaan / Data Support.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Brief Klien & Deliverables */}
          {portfolioBrief && (
            <div className="space-y-4">
              <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
                <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 dark:text-white">
                  <Briefcase className="w-4 h-4 text-amber-600" />
                  <span>Brief Klien / User Requirement</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {portfolioBrief.clientBrief}
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2.5">
                <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 dark:text-white">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Target Deliverables Portofolio</span>
                </div>
                <ul className="space-y-1.5">
                  {portfolioBrief.deliverables.map((d, i) => (
                    <li key={i} className="flex items-start space-x-2 text-xs text-gray-700 dark:text-gray-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Rubrik Penilaian & Template README */}
          <div className="space-y-4">
            {rubric && rubric.length > 0 && (
              <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2.5">
                <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 dark:text-white">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Rubrik Penilaian Profesional</span>
                </div>
                <ul className="space-y-2">
                  {rubric.map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-xs text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {portfolioBrief?.readmeTemplate && (
              <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 dark:text-white">
                    <FileCode className="w-4 h-4 text-blue-600" />
                    <span>Template Dokumentasi README.md</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReadme}
                    className="flex items-center space-x-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                  >
                    {copiedReadme ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Markdown</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 bg-gray-900 text-gray-200 rounded-lg font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre leading-relaxed border border-gray-800">
                  {portfolioBrief.readmeTemplate}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
