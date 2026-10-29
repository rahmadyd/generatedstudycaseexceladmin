import { Level, ExcelVersion } from './schema';

export const ADMIN_ROLES = [
  { id: 'Penjualan', label: 'Admin Penjualan', desc: 'Rekap order, omset, komisi sales, piutang customer' },
  { id: 'Inventory/Gudang', label: 'Admin Inventory & Gudang', desc: 'Stock in/out, safety stock, opname, slow moving' },
  { id: 'HRD/Absensi', label: 'Admin HRD & Absensi', desc: 'Presensi harian, lembur, cuti, rekap gaji pokok & tunjangan' },
  { id: 'Keuangan/Kasir', label: 'Admin Keuangan & Kasir', desc: 'Petty cash, arus kas harian, rekonsiliasi, slip pembayaran' },
  { id: 'Pengadaan', label: 'Admin Pengadaan & Purchasing', desc: 'Purchase Order (PO), evaluasi vendor, lead time, selisih budget' },
  { id: 'Sekretaris/Surat', label: 'Sekretaris & Admin Surat', desc: 'Disposisi surat, agenda pimpinan, penomoran dokumen, logistik kantor' },
  { id: 'MBG', label: 'Admin MBG', desc: 'Manajemen bisnis grup, laporan keuangan, dan analisis KPI' },
];

export const LEVEL_CONFIG: Record<
  Level,
  { label: string; badgeColor: string; description: string; recommended: string[]; forbidden: string[] }
> = {
  easy: {
    label: 'Easy',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Fokus pada rumus dasar, kalkulasi total, rata-rata, logika sederhana, dan formatting.',
    recommended: ['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX', 'IF', 'SORT', 'FILTER (Tabel)'],
    forbidden: ['VLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'Pivot Table', 'SUMIFS', 'Macro/VBA'],
  },
  middle: {
    label: 'Middle',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    description: 'Lookup data lintas tabel, rekap bersyarat, manipulasi teks, dan validasi data.',
    recommended: ['VLOOKUP', 'XLOOKUP', 'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'IFERROR', 'TEXT', 'LEFT', 'RIGHT', 'MID', 'Data Validation'],
    forbidden: ['Pivot Table', 'Macro/VBA', 'Power Query'],
  },
  advance: {
    label: 'Advance',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    description: 'INDEX-MATCH multi-kriteria, SUMPRODUCT, Pivot Table dinamis, Conditional Formatting rumus.',
    recommended: ['INDEX-MATCH', 'SUMPRODUCT', 'Pivot Table', 'Conditional Formatting Rumus', 'Named Range', 'Nested IF/IFS'],
    forbidden: ['Macro/VBA'],
  },
  portfolio: {
    label: 'Portofolio',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    description: 'Studi kasus komprehensif tingkat profesional dengan Client Brief, Rubrik, dan Dashboard.',
    recommended: ['Multi-sheet modeling', 'Interactive Dashboard (Pivot + Slicer + Chart)', 'Dynamic Formulas', 'Data Cleansing Pipeline'],
    forbidden: ['Data kotor tidak dibersihkan', 'Formula statis hardcoded'],
  },
};

export const M365_ONLY_FORMULAS = ['XLOOKUP', 'FILTER', 'UNIQUE', 'SORTBY', 'LET', 'LAMBDA', 'XMATCH', 'SEQUENCE'];

export const SAMPLE_INDUSTRIES = [
  'Distributor Farmasi & Alkes',
  'Retail Supermarket Bahan Segar',
  'Logistik & Ekspedisi Antar-Kota',
  'Pabrik Manufaktur Makanan Ringan',
  'Agensi Digital & Pengadaan Event',
  'Jasa Konstruksi & Interior Kantor',
  'Dealer Suku Cadang Otomotif',
  'Perusahaan Ekspor-Impor Tekstil',
  'Klinik & Laboratorium Medis',
  'Franchise Restoran & Kafe Cepat Saji',
];

export const SAMPLE_COMPANIES = [
  'PT Mitra Sentosa Sejahtera',
  'CV Cahaya Logistik Nusantara',
  'PT Mega Prima Medika',
  'PT Sukses Makmur Abadi',
  'CV Graha Sarana Distribusi',
  'PT Mandiri Multi Niaga',
  'PT Samudra Kencana Cargo',
  'CV Berkah Utama Perkasa',
];

export const SAMPLE_THEMES = [
  'Audit kuartal tahunan',
  'Penutupan buku akhir bulan',
  'Pembersihan database vendor bermasalah',
  'Rekonsiliasi data selisih fisik vs sistem',
  'Efisiensi biaya operasional operasional',
  'Kesiapan presentasi rapat dewan direksi',
];

export const SAMPLE_PERIODS = [
  'Kuartal I 2026',
  'Kuartal II 2026',
  'Periode Januari - Maret 2026',
  'Periode Mei - Juni 2026',
  'Penutupan Semester Ganjil 2026',
];


export const ADMIN_ROLES = [
  { id: 'Penjualan', label: 'Admin Penjualan', desc: 'Rekap order, omset, komisi sales, piutang customer' },
  { id: 'Inventory/Gudang', label: 'Admin Inventory & Gudang', desc: 'Stock in/out, safety stock, opname, slow moving' },
  { id: 'HRD/Absensi', label: 'Admin HRD & Absensi', desc: 'Presensi harian, lembur, cuti, rekap gaji pokok & tunjangan' },
  { id: 'Keuangan/Kasir', label: 'Admin Keuangan & Kasir', desc: 'Petty cash, arus kas harian, rekonsiliasi, slip pembayaran' },
  { id: 'Pengadaan', label: 'Admin Pengadaan & Purchasing', desc: 'Purchase Order (PO), evaluasi vendor, lead time, selisih budget' },
  { id: 'Sekretaris/Surat', label: 'Sekretaris & Admin Surat', desc: 'Disposisi surat, agenda pimpinan, penomoran dokumen, logistik kantor' },
  { id: 'MBG', label: 'Admin MBG', desc: 'Manajemen bisnis grup, laporan keuangan, dan analisis KPI' },


export const LEVEL_CONFIG: Record<
  Level,
  { label: string; badgeColor: string; description: string; recommended: string[  { id: 'MBG', label: 'Admin MBG', desc: 'Manajemen bisnis grup, laporan keuangan, dan analisis KPI' },
 forbidden: string[] }
> = {
  easy: {
    label: 'Easy',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Fokus pada rumus dasar, kalkulasi total, rata-rata, logika sederhana, dan formatting.',
    recommended: ['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX', 'IF', 'SORT', 'FILTER (Tabel)'],
    forbidden: ['VLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'Pivot Table', 'SUMIFS', 'Macro/VBA'],
  },
  middle: {
    label: 'Middle',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    description: 'Lookup data lintas tabel, rekap bersyarat, manipulasi teks, dan validasi data.',
    recommended: ['VLOOKUP', 'XLOOKUP', 'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'IFERROR', 'TEXT', 'LEFT', 'RIGHT', 'MID', 'Data Validation'],
    forbidden: ['Pivot Table', 'Macro/VBA', 'Power Query'],
  },
  advance: {
    label: 'Advance',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    description: 'INDEX-MATCH multi-kriteria, SUMPRODUCT, Pivot Table dinamis, Conditional Formatting rumus.',
    recommended: ['INDEX-MATCH', 'SUMPRODUCT', 'Pivot Table', 'Conditional Formatting Rumus', 'Named Range', 'Nested IF/IFS'],
    forbidden: ['Macro/VBA'],
  },
  portfolio: {
    label: 'Portofolio',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    description: 'Studi kasus komprehensif tingkat profesional dengan Client Brief, Rubrik, dan Dashboard.',
    recommended: ['Multi-sheet modeling', 'Interactive Dashboard (Pivot + Slicer + Chart)', 'Dynamic Formulas', 'Data Cleansing Pipeline'],
    forbidden: ['Data kotor tidak dibersihkan', 'Formula statis hardcoded'],
  },
};

export const M365_ONLY_FORMULAS = ['XLOOKUP', 'FILTER', 'UNIQUE', 'SORTBY', 'LET', 'LAMBDA', 'XMATCH', 'SEQUENCE'  { id: 'MBG', label: 'Admin MBG', desc: 'Manajemen bisnis grup, laporan keuangan, dan analisis KPI' },


export const SAMPLE_INDUSTRIES = [
  'Distributor Farmasi & Alkes',
  'Retail Supermarket Bahan Segar',
  'Logistik & Ekspedisi Antar-Kota',
  'Pabrik Manufaktur Makanan Ringan',
  'Agensi Digital & Pengadaan Event',
  'Jasa Konstruksi & Interior Kantor',
  'Dealer Suku Cadang Otomotif',
  'Perusahaan Ekspor-Impor Tekstil',
  'Klinik & Laboratorium Medis',
  'Franchise Restoran & Kafe Cepat Saji',
  { id: 'MBG', label: 'Admin MBG', desc: 'Manajemen bisnis grup, laporan keuangan, dan analisis KPI' },


export const SAMPLE_COMPANIES = [
  'PT Mitra Sentosa Sejahtera',
  'CV Cahaya Logistik Nusantara',
  'PT Mega Prima Medika',
  'PT Sukses Makmur Abadi',
  'CV Graha Sarana Distribusi',
  'PT Mandiri Multi Niaga',
  'PT Samudra Kencana Cargo',
  'CV Berkah Utama Perkasa',
  { id: 'MBG', label: 'Admin MBG', desc: 'Manajemen bisnis grup, laporan keuangan, dan analisis KPI' },


export const SAMPLE_THEMES = [
  'Audit kuartal tahunan',
  'Penutupan buku akhir bulan',
  'Pembersihan database vendor bermasalah',
  'Rekonsiliasi data selisih fisik vs sistem',
  'Efisiensi biaya operasional operasional',
  'Kesiapan presentasi rapat dewan direksi',
  { id: 'MBG', label: 'Admin MBG', desc: 'Manajemen bisnis grup, laporan keuangan, dan analisis KPI' },


export const SAMPLE_PERIODS = [
  'Kuartal I 2026',
  'Kuartal II 2026',
  'Periode Januari - Maret 2026',
  'Periode Mei - Juni 2026',
  'Penutupan Semester Ganjil 2026',
  { id: 'MBG', label: 'Admin MBG', desc: 'Manajemen bisnis grup, laporan keuangan, dan analisis KPI' },

