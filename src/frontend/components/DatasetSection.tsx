'use client';

import React, { useState } from 'react';
import { Database, FileSpreadsheet, FileText, AlertTriangle, Copy, Check } from 'lucide-react';
import { CaseStudy } from '@/shared/schema';
import { DataRow } from '../utils/dataset-generator';
import { exportDatasetToXLSX, exportDatasetToCSV } from '../utils/export-xlsx';

interface DatasetSectionProps {
  caseStudy: CaseStudy;
  datasetRows: DataRow[];
}

export const DatasetSection: React.FC<DatasetSectionProps> = ({ caseStudy, datasetRows }) => {
  const [copiedCol, setCopiedCol] = useState<string | null>(null);

  const previewRows = datasetRows.slice(0, 5);
  const columns = caseStudy.dataset.columns;

  const handleCopyColumnName = (colName: string) => {
    navigator.clipboard.writeText(colName);
    setCopiedCol(colName);
    setTimeout(() => setCopiedCol(null), 2000);
  };

  return (
    <section id="dataset" className="scroll-mt-32">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-700 dark:text-emerald-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                3. Dataset Praktik
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Sheet: <span className="font-semibold text-emerald-600">{caseStudy.dataset.sheetName}</span> | Total:{' '}
                <span className="font-semibold">{datasetRows.length} baris</span>
              </p>
            </div>
          </div>

          {/* Download Buttons placed right in the Dataset section as required! */}
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={() => exportDatasetToXLSX(caseStudy, datasetRows)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition"
              title="Download file Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download XLSX</span>
            </button>

            <button
              type="button"
              onClick={() => exportDatasetToCSV(caseStudy, datasetRows)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold text-xs sm:text-sm rounded-xl border border-gray-300 dark:border-gray-600 transition"
              title="Download file Comma-Separated Values (.csv)"
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        {/* Data Traps Warning (if any) */}
        {caseStudy.dataTraps && caseStudy.dataTraps.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80">
            <div className="flex items-start space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Perhatian: Data Traps (Jebakan Data Kotor) Disisipkan!
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  Sebagai admin profesional, bersihkan inkonsistensi berikut sebelum membuat rumus agregasi:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {caseStudy.dataTraps.map((trap, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] rounded-md font-medium border border-amber-300 dark:border-amber-700"
                    >
                      ⚠️ {trap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5-row Dataset Preview Table */}
        <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="bg-gray-50 dark:bg-gray-900/70 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Preview 5 Baris Pertama (Klik nama kolom untuk menyalin)
            </span>
            <span className="text-[11px] text-gray-400">
              {columns.length} Kolom
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3.5 py-2.5 text-center w-12 text-gray-400">#</th>
                  {columns.map((col) => (
                    <th key={col.name} className="px-3.5 py-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleCopyColumnName(col.name)}
                        className="group flex items-center space-x-1.5 hover:text-emerald-600 transition"
                        title="Klik untuk salin nama kolom"
                      >
                        <span>{col.name}</span>
                        {copiedCol === col.name ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </button>
                      <span className="block text-[10px] font-normal text-gray-400 capitalize">
                        {col.type}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {previewRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition font-mono"
                  >
                    <td className="px-3.5 py-2 text-center text-gray-400">{rIdx + 1}</td>
                    {columns.map((col) => {
                      const val = row[col.name];
                      const isNull = val === null || val === '';
                      return (
                        <td key={col.name} className="px-3.5 py-2 whitespace-nowrap">
                          {isNull ? (
                            <span className="text-gray-300 italic dark:text-gray-600">(kosong)</span>
                          ) : col.type === 'currency' && typeof val === 'number' ? (
                            `Rp ${val.toLocaleString('id-ID')}`
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
