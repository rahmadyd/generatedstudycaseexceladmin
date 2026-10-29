'use client';

import React, { useState } from 'react';
import { Download, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { CaseStudy } from '@/shared/schema';
import { DataRow } from '../utils/dataset-generator';
import { exportSoalPDF, exportKunciJawabanPDF } from '../utils/export-pdf';

interface PDFExportSectionProps {
  caseStudy: CaseStudy;
  datasetRows: DataRow[];
}

export const PDFExportSection: React.FC<PDFExportSectionProps> = ({
  caseStudy,
  datasetRows,
}) => {
  const [downloadingSoal, setDownloadingSoal] = useState<boolean>(false);
  const [downloadingJawaban, setDownloadingJawaban] = useState<boolean>(false);

  const handleDownloadSoal = async () => {
    try {
      setDownloadingSoal(true);
      await exportSoalPDF(caseStudy, datasetRows);
    } catch (err) {
      console.error('Failed to export Soal PDF:', err);
      alert('Gagal mengekspor PDF Soal.');
    } finally {
      setDownloadingSoal(false);
    }
  };

  const handleDownloadJawaban = async () => {
    try {
      setDownloadingJawaban(true);
      await exportKunciJawabanPDF(caseStudy);
    } catch (err) {
      console.error('Failed to export Kunci Jawaban PDF:', err);
      alert('Gagal mengekspor PDF Kunci Jawaban.');
    } finally {
      setDownloadingJawaban(false);
    }
  };

  return (
    <section id="download-pdf" className="scroll-mt-32 pt-2">
      <div className="bg-gradient-to-r from-emerald-900 to-green-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-emerald-700/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center space-x-2">
              <Download className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-bold tracking-tight">
                7. Cetak & Unduh Dokumen Resmi PDF
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
              Ekspor lembar soal dan kunci jawaban terpisah dalam format PDF siap cetak untuk arsip pelatihan, modul offline, atau lampiran penilaian portofolio.
            </p>
            <div className="flex items-center space-x-4 pt-1 text-[11px] text-emerald-300">
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Format Standar A4</span>
              </span>
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Kunci Terpisah Aman</span>
              </span>
            </div>
          </div>

          {/* Action buttons (MANDATED AT THE VERY BOTTOM OF THE PAGE BY SPEC!) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadSoal}
              disabled={downloadingSoal}
              className="flex items-center justify-center space-x-2 px-5 py-3.5 bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition active:scale-95"
            >
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>{downloadingSoal ? 'Membuat PDF...' : 'Download Soal PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJawaban}
              disabled={downloadingJawaban}
              className="flex items-center justify-center space-x-2 px-5 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/30 transition active:scale-95"
            >
              <FileText className="w-4 h-4 text-amber-100" />
              <span>
                {downloadingJawaban ? 'Membuat PDF...' : 'Download Kunci Jawaban PDF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
