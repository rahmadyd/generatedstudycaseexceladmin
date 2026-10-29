'use client';

import React, { useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';

interface FormulaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formulaCategories = [
  {
    title: '1. Menghitung dan meringkas',
    purpose: 'Untuk rekap penjualan, stok, biaya, atau nilai transaksi.',
    examples: [
      ['=SUM(E2:E100)', 'Menjumlahkan semua nilai pada kolom E.'],
      ['=AVERAGE(E2:E100)', 'Menghitung nilai rata-rata.'],
      ['=MIN(E2:E100) / =MAX(E2:E100)', 'Mencari nilai terkecil dan terbesar.'],
    ],
  },
  {
    title: '2. Rekap berdasarkan kriteria',
    purpose: 'Untuk menjawab pertanyaan seperti “berapa omzet yang sudah lunas?” atau “berapa transaksi dari Jakarta?”.',
    examples: [
      ['=SUMIF(C2:C100;"Lunas";E2:E100)', 'Menjumlahkan kolom E untuk baris dengan status Lunas.'],
      ['=SUMIFS(E2:E100;C2:C100;"Lunas";D2:D100;"Jakarta")', 'Menjumlahkan kolom E dengan dua syarat: Lunas dan Jakarta.'],
      ['=COUNTIF(D2:D100;"Jakarta")', 'Menghitung jumlah baris dari Jakarta.'],
      ['=COUNTIFS(C2:C100;"Lunas";D2:D100;"Jakarta")', 'Menghitung baris yang memenuhi dua syarat sekaligus.'],
    ],
  },
  {
    title: '3. Logika dan penanganan error',
    purpose: 'Untuk memberi label otomatis atau menampilkan pesan yang mudah dipahami saat data tidak ditemukan.',
    examples: [
      ['=IF(F2>=1500000;"Perlu persetujuan";"Aman")', 'Jika nilai F2 minimal 1.500.000, tampilkan Perlu persetujuan; jika tidak, tampilkan Aman.'],
      ['=IFERROR(VLOOKUP(A2;Master!A:C;3;FALSE);"Tidak ditemukan")', 'Mencari data dan menampilkan pesan jika pencarian gagal.'],
    ],
  },
  {
    title: '4. Mencari data master',
    purpose: 'Untuk mengambil nama barang, harga, nama vendor, atau departemen dari tabel referensi.',
    examples: [
      ['=VLOOKUP(A2;Master!A:C;3;FALSE)', 'Mencari nilai A2 di kolom pertama tabel Master, lalu mengambil nilai dari kolom ke-3.'],
      ['=XLOOKUP(A2;Master!A:A;Master!C:C;"Tidak ditemukan")', 'Alternatif pencarian yang lebih fleksibel di Excel Microsoft 365.'],
    ],
  },
  {
    title: '5. Membersihkan dan mengolah teks',
    purpose: 'Untuk merapikan kode, nama, atau nomor dokumen hasil ekspor sistem.',
    examples: [
      ['=TRIM(B2)', 'Menghapus spasi berlebih di awal dan akhir teks.'],
      ['=LEFT(A2;3) / =RIGHT(A2;4)', 'Mengambil karakter dari sisi kiri atau kanan teks.'],
      ['=MID(A2;4;5)', 'Mengambil sejumlah karakter mulai dari posisi tertentu.'],
    ],
  },
  {
    title: '6. Mengolah tanggal',
    purpose: 'Untuk mengelompokkan transaksi per bulan/tahun dan menentukan batas periode laporan.',
    examples: [
      ['=MONTH(B2) / =YEAR(B2)', 'Mengambil nomor bulan atau tahun dari tanggal.'],
      ['=EOMONTH(B2;0)', 'Mencari tanggal terakhir pada bulan yang sama.'],
      ['=TODAY()', 'Menampilkan tanggal hari ini.'],
    ],
  },
];

export const FormulaGuideModal: React.FC<FormulaGuideModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="formula-guide-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <header className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-700 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 id="formula-guide-title" className="text-lg font-bold text-gray-900 dark:text-white">
                Panduan Rumus Excel untuk Admin
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Rumus yang sering dipakai, kegunaan, dan contoh format Indonesia.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan rumus"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
            <h3 className="font-bold">Cara membaca tanda `;` dan `,`</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
              <li>Titik koma `;` memisahkan argumen atau bagian input rumus. Contoh: `SUMIFS(range_jumlah; range_kriteria; kriteria)`.</li>
              <li>Koma `,` dipakai sebagai tanda desimal: 1,5 berarti satu setengah.</li>
              <li>Titik pada tampilan angka biasanya pemisah ribuan: Rp1.500.000. Di dalam rumus, tulis angkanya tanpa titik ribuan, misalnya `1500000`.</li>
              <li>Nama fungsi pada contoh memakai bahasa Inggris. Jika Excel Anda memakai nama fungsi atau pemisah lain, ikuti pengaturan Excel yang digunakan.</li>
            </ul>
          </div>

          <div className="space-y-4">
            {formulaCategories.map((category) => (
              <article
                key={category.title}
                className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <h3 className="font-bold text-gray-900 dark:text-white">{category.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{category.purpose}</p>
                <div className="mt-3 space-y-2">
                  {category.examples.map(([formula, explanation]) => (
                    <div key={formula} className="rounded-lg bg-white p-3 dark:bg-gray-800">
                      <code className="block overflow-x-auto whitespace-nowrap font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        {formula}
                      </code>
                      <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                        {explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="border-t border-gray-100 p-4 text-right dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
          >
            Mengerti
          </button>
        </footer>
      </section>
    </div>
  );
};
