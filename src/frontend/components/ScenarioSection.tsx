'use client';

import React from 'react';
import { Briefcase, Building, Calendar, Layers } from 'lucide-react';
import { CaseStudy } from '@/shared/schema';

interface ScenarioSectionProps {
  caseStudy: CaseStudy;
}

export const ScenarioSection: React.FC<ScenarioSectionProps> = ({ caseStudy }) => {
  return (
    <section id="skenario" className="scroll-mt-32">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-700 dark:text-emerald-300">
            <Briefcase className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            2. Skenario Pekerjaan Admin
          </h2>
        </div>

        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed text-sm sm:text-base">
          <p className="whitespace-pre-line bg-gray-50 dark:bg-gray-900/60 p-4 sm:p-6 rounded-xl border border-gray-200/80 dark:border-gray-700/80">
            {caseStudy.scenario}
          </p>
        </div>

        {/* Administrative Context Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <Building className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="text-gray-500 dark:text-gray-400 block">Karakter Penugasan</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Pekerjaan Admin Riil
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <Calendar className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-gray-500 dark:text-gray-400 block">Siklus Laporan</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Audit / Tutup Buku Berkala
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <Layers className="w-4 h-4 text-purple-600" />
            <div>
              <span className="text-gray-500 dark:text-gray-400 block">Target Deliverable</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Rekap Akurat & Teruji
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
