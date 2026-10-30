import { INDUSTRY_OPTIONS, Industry, Level, ExcelVersion } from './schema';

export const ADMIN_ROLES = [
  { id: 'Penjualan', label: 'Admin Penjualan', desc: 'Order, pelanggan, penjualan, dan piutang' },
  { id: 'Inventory/Gudang', label: 'Admin Gudang & Stok', desc: 'Barang masuk/keluar, persediaan, dan stok opname' },
  { id: 'HRD/Absensi', label: 'Admin SDM & Absensi', desc: 'Data karyawan, kehadiran, cuti, dan lembur' },
  { id: 'Keuangan/Kasir', label: 'Admin Keuangan & Kasir', desc: 'Kas masuk/keluar, pembayaran, dan rekonsiliasi' },
  { id: 'Pengadaan', label: 'Admin Pembelian & Pengadaan', desc: 'Pembelian, pesanan barang, dan data pemasok' },
  { id: 'Sekretaris/Surat', label: 'Admin Surat & Sekretariat', desc: 'Surat, agenda, disposisi, dan arsip dokumen' },
  { id: 'MBG', label: 'Admin Operasional & Laporan', desc: 'Rekap kegiatan, biaya operasional, target, dan KPI' },
];

const RECOMMENDED_ADMIN_ROLES: Record<Industry, string> = {
  Acak: 'Penjualan',
  'Kelapa sawit': 'Inventory/Gudang',
  Karet: 'Inventory/Gudang',
  Kopi: 'Penjualan',
  'Pertambangan batu bara': 'Inventory/Gudang',
  Perkebunan: 'Inventory/Gudang',
  Perikanan: 'Inventory/Gudang',
  Peternakan: 'Inventory/Gudang',
  'Pertanian dan pangan': 'Inventory/Gudang',
  'Kehutanan dan kayu': 'Inventory/Gudang',
  'Otomotif dan bengkel': 'Penjualan',
  Manufaktur: 'Inventory/Gudang',
  Konstruksi: 'Pengadaan',
  'Properti dan real estate': 'Penjualan',
  'Logistik dan ekspedisi': 'Inventory/Gudang',
  'Distribusi dan perdagangan': 'Penjualan',
  'Retail dan minimarket': 'Penjualan',
  'E-commerce': 'Penjualan',
  Perbankan: 'Keuangan/Kasir',
  Leasing: 'Keuangan/Kasir',
  Asuransi: 'Keuangan/Kasir',
  'Akuntansi dan keuangan': 'Keuangan/Kasir',
  'Kesehatan: rumah sakit, klinik, apotek': 'Inventory/Gudang',
  'Pendidikan: sekolah dan kampus': 'Sekretaris/Surat',
  'Pemerintahan dan kantor dinas': 'Sekretaris/Surat',
  'Perhotelan dan pariwisata': 'Keuangan/Kasir',
  'Restoran dan kafe (F&B)': 'Keuangan/Kasir',
  Telekomunikasi: 'Penjualan',
  'Energi dan listrik': 'Inventory/Gudang',
  'Percetakan dan advertising': 'Pengadaan',
  'Konsultan dan jasa profesional': 'Keuangan/Kasir',
};

export function getRecommendedAdminRole(industry: Industry): string {
  return RECOMMENDED_ADMIN_ROLES[industry];
}

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

export const SAMPLE_INDUSTRIES = INDUSTRY_OPTIONS;

export interface IndustryProfile {
  signals: string[];
  focus: string;
  products: string[];
  categories: string[];
}

export const INDUSTRY_PROFILES: Record<Exclude<Industry, 'Acak'>, IndustryProfile> = {
  'Kelapa sawit': {
    signals: ['sawit', 'tandan buah', 'tbs', 'cpo', 'kernel', 'pabrik kelapa sawit'],
    focus: 'penerimaan TBS, panen, rendemen CPO, pengiriman kernel, dan stok pupuk',
    products: ['Tandan Buah Segar (TBS)', 'Crude Palm Oil (CPO)', 'Palm Kernel', 'Pupuk NPK Sawit', 'Bibit Kelapa Sawit'],
    categories: ['TBS Matang', 'TBS Mentah', 'CPO', 'Kernel'],
  },
  Karet: {
    signals: ['karet', 'lateks', 'getah', 'crumb rubber', 'sheet rss'],
    focus: 'penerimaan lateks, hasil olahan karet, kualitas, dan pengiriman',
    products: ['Lateks', 'Karet Sheet RSS', 'Crumb Rubber', 'Getah Karet', 'Koagulan Lateks'],
    categories: ['Lateks', 'Sheet RSS', 'Crumb Rubber', 'Bahan Pendukung'],
  },
  Kopi: {
    signals: ['kopi', 'arabika', 'robusta', 'green bean', 'roastery'],
    focus: 'pembelian biji kopi, sortasi kualitas, proses roasting, dan penjualan',
    products: ['Biji Kopi Arabika', 'Biji Kopi Robusta', 'Green Bean', 'Roasted Bean', 'Kemasan Kopi'],
    categories: ['Arabika', 'Robusta', 'Green Bean', 'Roasted Bean'],
  },
  'Pertambangan batu bara': {
    signals: ['batu bara', 'batubara', 'tambang', 'hauling', 'overburden', 'tonase'],
    focus: 'produksi tonase, kegiatan hauling, penggunaan alat berat, dan pengiriman batu bara',
    products: ['Batu Bara GAR 4200', 'Batu Bara GAR 5000', 'Solar Alat Berat', 'Suku Cadang Excavator', 'Jasa Hauling'],
    categories: ['Produksi', 'Hauling', 'Overburden', 'Pengiriman'],
  },
  Perkebunan: {
    signals: ['perkebunan', 'panen', 'kebun', 'pupuk', 'bibit'],
    focus: 'aktivitas kebun, jadwal panen, pemakaian pupuk, dan hasil komoditas',
    products: ['Bibit Tanaman', 'Pupuk NPK', 'Pestisida', 'Hasil Panen', 'Alat Perkebunan'],
    categories: ['Bibit', 'Pupuk', 'Perawatan Kebun', 'Hasil Panen'],
  },
  Perikanan: {
    signals: ['perikanan', 'ikan', 'tambak', 'budidaya', 'udang', 'hasil laut'],
    focus: 'budidaya dan panen ikan/udang, pakan, kualitas hasil, dan distribusi rantai dingin',
    products: ['Ikan Nila', 'Ikan Lele', 'Ikan Bandeng', 'Udang Vaname', 'Pakan Ikan'],
    categories: ['Ikan Air Tawar', 'Ikan Laut', 'Udang', 'Pakan'],
  },
  Peternakan: {
    signals: ['peternakan', 'ternak', 'ayam', 'sapi', 'pakan', 'telur'],
    focus: 'populasi ternak, produksi telur/susu/daging, pakan, dan kesehatan hewan',
    products: ['Ayam Broiler', 'Telur Ayam', 'Susu Sapi', 'Pakan Ternak', 'Vaksin Hewan'],
    categories: ['Ternak', 'Hasil Ternak', 'Pakan', 'Kesehatan Hewan'],
  },
  'Pertanian dan pangan': {
    signals: ['pertanian', 'pangan', 'beras', 'gabah', 'jagung', 'hasil panen'],
    focus: 'pengadaan hasil panen, stok pangan, kualitas komoditas, dan distribusi',
    products: ['Beras', 'Gabah', 'Jagung Pipil', 'Kedelai', 'Pupuk Pertanian'],
    categories: ['Beras', 'Palawija', 'Sayuran', 'Sarana Pertanian'],
  },
  'Kehutanan dan kayu': {
    signals: ['kehutanan', 'kayu', 'hutan', 'log kayu', 'plywood', 'penggergajian'],
    focus: 'penerimaan kayu, pengolahan hasil hutan, pemakaian bahan, dan pengiriman',
    products: ['Log Kayu Jati', 'Kayu Meranti', 'Plywood', 'Veneer', 'Kayu Lapis'],
    categories: ['Log Kayu', 'Kayu Olahan', 'Plywood', 'Bahan Pendukung'],
  },
  'Otomotif dan bengkel': {
    signals: ['otomotif', 'bengkel', 'kendaraan', 'suku cadang', 'servis', 'sparepart'],
    focus: 'penerimaan servis kendaraan, pemakaian suku cadang, jasa mekanik, dan tagihan',
    products: ['Oli Mesin', 'Kampas Rem', 'Filter Udara', 'Aki Kendaraan', 'Ban Kendaraan'],
    categories: ['Servis Berkala', 'Perbaikan', 'Suku Cadang', 'Jasa Mekanik'],
  },
  Manufaktur: {
    signals: ['manufaktur', 'produksi', 'pabrik', 'bahan baku', 'barang jadi'],
    focus: 'rencana produksi, pemakaian bahan baku, hasil barang jadi, dan produk cacat',
    products: ['Bahan Baku Produksi', 'Barang Setengah Jadi', 'Barang Jadi', 'Kemasan Produk', 'Komponen Mesin'],
    categories: ['Bahan Baku', 'Dalam Proses', 'Barang Jadi', 'Produk Cacat'],
  },
  Konstruksi: {
    signals: ['konstruksi', 'proyek', 'bangunan', 'material', 'termin', 'progres proyek'],
    focus: 'progres proyek, pemakaian material, biaya tenaga kerja, dan pembayaran termin',
    products: ['Semen', 'Besi Beton', 'Pasir Beton', 'Batu Split', 'Cat Bangunan'],
    categories: ['Material Struktur', 'Material Finishing', 'Tenaga Kerja', 'Sewa Alat'],
  },
  'Properti dan real estate': {
    signals: ['properti', 'real estate', 'perumahan', 'apartemen', 'unit', 'sewa'],
    focus: 'data unit properti, pemasaran, pembayaran pelanggan, dan pemeliharaan',
    products: ['Unit Rumah', 'Unit Apartemen', 'Ruko', 'Lahan Komersial', 'Jasa Pemeliharaan Gedung'],
    categories: ['Rumah', 'Apartemen', 'Ruko', 'Lahan'],
  },
  'Logistik dan ekspedisi': {
    signals: ['logistik', 'ekspedisi', 'pengiriman', 'paket', 'kurir', 'resi'],
    focus: 'penerimaan paket, status pengiriman, biaya ekspedisi, dan performa kurir',
    products: ['Paket Reguler', 'Paket Kilat', 'Pengiriman Kargo', 'Layanan Fulfillment', 'Biaya Asuransi Kirim'],
    categories: ['Reguler', 'Kilat', 'Kargo', 'Same Day'],
  },
  'Distribusi dan perdagangan': {
    signals: ['distribusi', 'perdagangan', 'distributor', 'grosir', 'retur barang', 'faktur'],
    focus: 'pemesanan pelanggan, stok distributor, pengiriman barang, faktur, dan retur',
    products: ['Barang Dagang A', 'Barang Dagang B', 'Produk Grosir', 'Barang Konsinyasi', 'Kemasan Kirim'],
    categories: ['Barang Grosir', 'Barang Retail', 'Konsinyasi', 'Retur'],
  },
  'Retail dan minimarket': {
    signals: ['retail', 'minimarket', 'kasir', 'struk', 'gerai', 'barang dagangan'],
    focus: 'transaksi kasir, stok gerai, penjualan per kategori, dan restock',
    products: ['Air Mineral', 'Mi Instan', 'Susu UHT', 'Sabun Mandi', 'Beras Kemasan'],
    categories: ['Makanan', 'Minuman', 'Kebutuhan Rumah Tangga', 'Perawatan Diri'],
  },
  'E-commerce': {
    signals: ['e-commerce', 'ecommerce', 'marketplace', 'pesanan online', 'checkout', 'fulfillment'],
    focus: 'pesanan marketplace, pembayaran, pemrosesan pesanan, pengiriman, dan retur',
    products: ['Pesanan Marketplace', 'Produk Fashion Online', 'Aksesori Gadget', 'Produk Rumah Tangga', 'Biaya Layanan Platform'],
    categories: ['Pesanan Baru', 'Diproses', 'Dikirim', 'Retur'],
  },
  Perbankan: {
    signals: ['perbankan', 'bank', 'nasabah', 'rekening', 'kredit', 'transaksi perbankan'],
    focus: 'administrasi rekening/nasabah, transaksi, pengajuan kredit, dan rekonsiliasi',
    products: ['Tabungan', 'Giro', 'Deposito', 'Kredit Usaha', 'Kartu Debit'],
    categories: ['Tabungan', 'Giro', 'Deposito', 'Kredit'],
  },
  Leasing: {
    signals: ['leasing', 'pembiayaan', 'angsuran', 'kontrak pembiayaan', 'jatuh tempo'],
    focus: 'pengajuan pembiayaan, kontrak leasing, angsuran, jatuh tempo, dan tunggakan',
    products: ['Pembiayaan Motor', 'Pembiayaan Mobil', 'Pembiayaan Alat Berat', 'Asuransi Pembiayaan', 'Administrasi Kontrak'],
    categories: ['Pembiayaan Motor', 'Pembiayaan Mobil', 'Alat Berat', 'Multiguna'],
  },
  Asuransi: {
    signals: ['asuransi', 'polis', 'premi', 'klaim', 'tertanggung', 'underwriting'],
    focus: 'administrasi polis, pembayaran premi, data tertanggung, dan pemrosesan klaim',
    products: ['Polis Kendaraan', 'Polis Kesehatan', 'Polis Properti', 'Premi Asuransi', 'Klaim Asuransi'],
    categories: ['Kendaraan', 'Kesehatan', 'Properti', 'Perjalanan'],
  },
  'Akuntansi dan keuangan': {
    signals: ['akuntansi', 'keuangan', 'jurnal', 'invoice', 'pembukuan', 'rekonsiliasi'],
    focus: 'pencatatan jurnal, invoice, pembayaran, rekonsiliasi, dan laporan biaya',
    products: ['Invoice Penjualan', 'Invoice Pembelian', 'Bukti Kas Masuk', 'Bukti Kas Keluar', 'Jurnal Umum'],
    categories: ['Pendapatan', 'Beban Operasional', 'Aset', 'Kewajiban'],
  },
  'Kesehatan: rumah sakit, klinik, apotek': {
    signals: ['kesehatan', 'rumah sakit', 'klinik', 'apotek', 'pasien', 'obat', 'farmasi'],
    focus: 'administrasi pasien, stok obat/alat kesehatan, layanan, dan penagihan',
    products: ['Paracetamol', 'Amoxicillin', 'Alat Suntik', 'Masker Medis', 'Vitamin'],
    categories: ['Obat', 'Alat Kesehatan', 'Rawat Jalan', 'Rawat Inap'],
  },
  'Pendidikan: sekolah dan kampus': {
    signals: ['pendidikan', 'sekolah', 'kampus', 'siswa', 'mahasiswa', 'akademik', 'pembayaran spp'],
    focus: 'data siswa/mahasiswa, administrasi akademik, pembayaran, dan kehadiran',
    products: ['Buku Pelajaran', 'Alat Tulis Siswa', 'Seragam Sekolah', 'Modul Kuliah', 'Perlengkapan Laboratorium'],
    categories: ['Akademik', 'Administrasi Siswa', 'Pembayaran', 'Sarana Pendidikan'],
  },
  'Pemerintahan dan kantor dinas': {
    signals: ['pemerintahan', 'kantor dinas', 'dinas', 'layanan publik', 'surat dinas', 'anggaran dinas'],
    focus: 'administrasi layanan publik, surat dinas, realisasi anggaran, dan inventaris aset',
    products: ['Surat Dinas', 'Dokumen Layanan Publik', 'Perlengkapan Kantor', 'Aset Inventaris', 'Berkas Permohonan'],
    categories: ['Layanan Publik', 'Administrasi Surat', 'Anggaran', 'Inventaris'],
  },
  'Perhotelan dan pariwisata': {
    signals: ['perhotelan', 'hotel', 'pariwisata', 'reservasi', 'tamu', 'kamar'],
    focus: 'reservasi, tingkat hunian, data tamu, layanan hotel, dan paket wisata',
    products: ['Kamar Standard', 'Kamar Deluxe', 'Paket Wisata', 'Layanan Laundry', 'Sarapan Tamu'],
    categories: ['Kamar', 'Reservasi', 'Paket Wisata', 'Layanan Hotel'],
  },
  'Restoran dan kafe (F&B)': {
    signals: ['restoran', 'kafe', 'f&b', 'makanan', 'minuman', 'pesanan meja', 'bahan makanan'],
    focus: 'pesanan menu, transaksi kasir, stok bahan makanan, dan biaya operasional',
    products: ['Nasi Goreng', 'Kopi Susu', 'Ayam Bakar', 'Teh Lemon', 'Bahan Baku Dapur'],
    categories: ['Makanan', 'Minuman', 'Bahan Baku', 'Layanan'],
  },
  Telekomunikasi: {
    signals: ['telekomunikasi', 'telekom', 'paket data', 'pulsa', 'pelanggan seluler', 'jaringan'],
    focus: 'aktivasi pelanggan, paket data/pulsa, pembayaran, dan gangguan layanan',
    products: ['Paket Data 10 GB', 'Paket Telepon', 'Pulsa Elektronik', 'Internet Fiber', 'Modem Router'],
    categories: ['Paket Data', 'Telepon', 'Internet', 'Perangkat'],
  },
  'Energi dan listrik': {
    signals: ['energi', 'listrik', 'kwh', 'meter', 'kelistrikan', 'pembangkit'],
    focus: 'data meter/pemakaian kWh, tagihan, pemeliharaan, dan gangguan jaringan',
    products: ['Token Listrik', 'Meter kWh', 'Kabel Listrik', 'Panel Distribusi', 'Jasa Pemeliharaan Jaringan'],
    categories: ['Pemakaian kWh', 'Tagihan', 'Perangkat Listrik', 'Pemeliharaan'],
  },
  'Percetakan dan advertising': {
    signals: ['percetakan', 'advertising', 'spanduk', 'brosur', 'cetak', 'materi promosi'],
    focus: 'order cetak, bahan cetak, jadwal produksi, biaya proyek, dan pengiriman materi promosi',
    products: ['Cetak Brosur', 'Spanduk', 'Kartu Nama', 'Poster Promosi', 'Stiker Label'],
    categories: ['Digital Printing', 'Offset Printing', 'Media Promosi', 'Desain'],
  },
  'Konsultan dan jasa profesional': {
    signals: ['konsultan', 'jasa profesional', 'konsultasi', 'proyek klien', 'jam konsultasi', 'deliverable'],
    focus: 'proyek klien, pencatatan jam kerja, deliverable, invoice jasa, dan biaya proyek',
    products: ['Jasa Konsultasi', 'Analisis Data', 'Laporan Kajian', 'Pendampingan Proyek', 'Pelatihan Klien'],
    categories: ['Konsultasi', 'Analisis', 'Pendampingan', 'Pelatihan'],
  },
};

export function getIndustryColumnValues(columnName: string, industry: Industry | undefined): string[] | undefined {
  if (!industry || industry === 'Acak') return undefined;
  if (/(^|[_\s])(kode|id|sku|no|nomor)([_\s]|$)|^(kode|id|sku|no|nomor)/i.test(columnName)) return undefined;
  const profile = INDUSTRY_PROFILES[industry];
  if (/kategori|kelompok|jenis[_\s-]?(barang|produk|komoditas|layanan)|tipe[_\s-]?(barang|produk)/i.test(columnName)) {
    return profile.categories;
  }
  if (/produk|barang|komoditas|komoditi|item|material|nama[_\s-]?menu|layanan|jasa|komponen|hasil[_\s-]?panen/i.test(columnName)) {
    return profile.products;
  }
  return undefined;
}

export const ROLE_PROFILES: Record<string, { label: string; description: string; signals: string[] }> = Object.fromEntries(
  ADMIN_ROLES.map((role) => [role.id, {
    label: role.label,
    description: role.desc,
    signals: ({
      'Penjualan': ['penjualan', 'order', 'transaksi', 'omzet', 'pelanggan', 'piutang'],
      'Inventory/Gudang': ['stok', 'persediaan', 'barang masuk', 'barang keluar', 'gudang', 'opname'],
      'HRD/Absensi': ['pegawai', 'karyawan', 'kehadiran', 'absensi', 'cuti', 'lembur'],
      'Keuangan/Kasir': ['kas', 'keuangan', 'pembayaran', 'pengeluaran', 'anggaran', 'rekonsiliasi'],
      'Pengadaan': ['pengadaan', 'pembelian', 'vendor', 'pemasok', 'purchase order'],
      'Sekretaris/Surat': ['surat', 'agenda', 'dokumen', 'disposisi', 'jadwal', 'arsip'],
      'MBG': ['laporan', 'kinerja', 'keuangan', 'operasional', 'grup', 'kpi'],
    } as Record<string, string[]>)[role.id] ?? [role.label.toLocaleLowerCase('id')],
  }]),
) as Record<string, { label: string; description: string; signals: string[] }>;

const MULTI_PROCESS_INDUSTRIES = new Set<Industry>([
  'Kelapa sawit',
  'Pertambangan batu bara',
  'Perkebunan',
  'Perikanan',
  'Peternakan',
  'Pertanian dan pangan',
  'Kehutanan dan kayu',
  'Manufaktur',
  'Konstruksi',
  'Logistik dan ekspedisi',
  'Distribusi dan perdagangan',
  'Retail dan minimarket',
  'E-commerce',
  'Perbankan',
  'Leasing',
  'Asuransi',
  'Kesehatan: rumah sakit, klinik, apotek',
  'Energi dan listrik',
]);

export function getRecommendedTaskCount(level: Level, industry: Industry): number {
  if (level === 'advance' || level === 'portfolio') return 6;
  if (level === 'easy') return MULTI_PROCESS_INDUSTRIES.has(industry) ? 5 : 4;
  return MULTI_PROCESS_INDUSTRIES.has(industry) ? 6 : 5;
}

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
