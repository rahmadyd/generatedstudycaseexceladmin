import { CaseStudy, Level } from '../shared/schema';

export const FALLBACK_CASES: Record<Level, CaseStudy> = {
  easy: {
    id: 'fallback-easy-penjualan',
    seed: 'seed-easy-atk-2026',
    createdAt: new Date().toISOString(),
    title: 'Rekap Penjualan Harian Toko ATK Sejahtera',
    level: 'easy',
    role: 'Admin Penjualan',
    excelVersion: 'Microsoft 365',
    scenario:
      'Kamu bekerja sebagai Admin Penjualan di PT Mitra Sentosa Sejahtera (Toko ATK & Alat Kantor). Setiap sore, manajer operasional meminta laporan rekapitulasi harian untuk melihat performa transaksi kasir, total omset per kategori, dan item dengan penjualan terendah maupun tertinggi untuk persiapan restock esok hari.',
    tasks: [
      {
        no: 1,
        instruction: 'Hitung subtotal pendapatan tiap transaksi (Qty dikali Harga Satuan).',
        hint: 'Gunakan perkalian sel =D2*E2 di kolom Subtotal.',
        targetResult: 'Total omset keseluruhan berkisar Rp 24.500.000 - Rp 30.000.000.',
      },
      {
        no: 2,
        instruction: 'Hitung Total Keseluruhan Omset Penjualan menggunakan fungsi SUM pada kolom Subtotal.',
        hint: 'Gunakan rumus =SUM(F2:F151).',
        targetResult: 'Satu nilai total penjualan di sel rekapitulasi.',
      },
      {
        no: 3,
        instruction: 'Hitung Rata-rata Pembelian per Transaksi menggunakan rumus AVERAGE.',
        hint: 'Gunakan formula =AVERAGE(F2:F151).',
        targetResult: 'Rata-rata berkisar antara Rp 150.000 - Rp 250.000.',
      },
      {
        no: 4,
        instruction: 'Temukan nilai transaksi terbesar (MAX) dan transaksi terkecil (MIN).',
        hint: 'Gunakan rumus =MAX(...) dan =MIN(...).',
        targetResult: 'Transaksi min > Rp 10.000 dan max < Rp 2.500.000.',
      },
      {
        no: 5,
        instruction: 'Beri status Diskon menggunakan fungsi IF: jika Subtotal >= Rp 500.000 maka "Dapat Voucher 10%", jika tidak maka "Non-Voucher".',
        hint: '=IF(F2>=500000, "Dapat Voucher 10%", "Non-Voucher")',
        targetResult: 'Kolom Bonus terisi teks sesuai ketentuan tanpa ada error formula.',
      },
    ],
    dataTraps: [],
    formulas: {
      recommended: ['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX', 'IF'],
      allowed: ['COUNTA', 'SUMIF'],
      forbidden: ['VLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'Pivot Table', 'Macro/VBA'],
    },
    dataset: {
      sheetName: 'Data_Penjualan_ATK',
      rows: 150,
      columns: [
        { name: 'No_Transaksi', type: 'text' },
        { name: 'Tanggal', type: 'date', range: ['2026-01-01', '2026-03-31'] },
        { name: 'Kategori_Produk', type: 'enum', values: ['Kertas & Buku', 'Alat Tulis', 'Tinta & Toner', 'Peralatan Arsip'] },
        { name: 'Qty', type: 'int', range: [1, 25] },
        { name: 'Harga_Satuan', type: 'currency', range: [15000, 250000] },
      ],
    },
    answerKey: [
      { task: 1, formula: '=D2*E2', explanation: 'Mengalikan sel kuantitas dengan harga satuan pada baris aktif.' },
      { task: 2, formula: '=SUM(F2:F151)', explanation: 'Menjumlahkan seluruh baris kolom Subtotal untuk mendapatkan total omset.' },
      { task: 3, formula: '=AVERAGE(F2:F151)', explanation: 'Menghitung rata-rata nilai transaksi belanja pelanggan.' },
      { task: 4, formula: '=MAX(F2:F151) dan =MIN(F2:F151)', explanation: 'Mencari transaksi terbesar dan terkecil di kolom Subtotal.' },
      { task: 5, formula: '=IF(F2>=500000, "Dapat Voucher 10%", "Non-Voucher")', explanation: 'Fungsi logika IF memeriksa kondisi batas minimum pembelanjaan.' },
    ],
  },
  middle: {
    id: 'fallback-middle-inventory',
    seed: 'seed-mid-gudang-2026',
    createdAt: new Date().toISOString(),
    title: 'Audit Mutasi Stok & Rekonsiliasi Gudang Pusat',
    level: 'middle',
    role: 'Admin Inventory/Gudang',
    excelVersion: 'Microsoft 365',
    scenario:
      'Sebagai Admin Inventory di CV Cahaya Logistik Nusantara, kamu menerima data mutasi barang gudang selama periode audit. Data hasil ekspor ERP memiliki beberapa ketidaksempurnaan format (spasi ekstra, data tanggal teks). Kamu diminta melakukan lookup master produk, menghitung total barang keluar per kategori secara bersyarat, dan menandai barang yang stoknya di bawah reorder point.',
    tasks: [
      {
        no: 1,
        instruction: 'Bersihkan kolom Kode_Barang yang memiliki spasi ekstra menggunakan rumus TRIM.',
        hint: 'Buat kolom bantuan =TRIM(B2).',
        targetResult: 'Semua kode barang standar 5 karakter tanpa spasi pembuka/penutup.',
      },
      {
        no: 2,
        instruction: 'Tarik Nama_Barang dan Harga_Satuan dari sheet Master_Barang menggunakan VLOOKUP atau XLOOKUP yang dibungkus IFERROR.',
        hint: '=IFERROR(VLOOKUP(TRIM(B2), Master_Barang!$A$2:$C$50, 2, FALSE), "Tidak Ditemukan")',
        targetResult: 'Semua baris terisi nama produk secara akurat.',
      },
      {
        no: 3,
        instruction: 'Hitung total kuantitas barang keluar untuk kategori "Elektronik" menggunakan formula SUMIFS.',
        hint: '=SUMIFS(Qty_Keluar, Kategori, "Elektronik")',
        targetResult: 'Total angka unit barang keluar kategori Elektronik terverifikasi.',
      },
      {
        no: 4,
        instruction: 'Hitung frekuensi transaksi pengiriman yang terjadi pada shift malam dengan COUNTIFS.',
        hint: '=COUNTIFS(Shift, "Malam", Status, "Selesai")',
        targetResult: 'Jumlah transaksi shift malam selesai.',
      },
      {
        no: 5,
        instruction: 'Ekstrak kode gudang cabang (3 huruf awal dari Nomor PO) menggunakan fungsi LEFT.',
        hint: '=LEFT(A2, 3)',
        targetResult: 'Kode cabang seperti GDK, SBY, BDG terekstrak rapi.',
      },
    ],
    dataTraps: [
      'Terdapat spasi berlebih pada kode barang (contoh: " ATK01 ")',
      'Format tanggal beberapa baris tersimpan sebagai teks miring',
      'Nilai kuantitas pada 3 baris berupa angka dalam format string',
    ],
    formulas: {
      recommended: ['VLOOKUP', 'XLOOKUP', 'SUMIFS', 'COUNTIFS', 'IFERROR', 'TRIM', 'LEFT'],
      allowed: ['INDEX', 'MATCH', 'TEXT'],
      forbidden: ['Pivot Table', 'Macro/VBA'],
    },
    dataset: {
      sheetName: 'Mutasi_Stok_Gudang',
      rows: 180,
      columns: [
        { name: 'Nomor_PO', type: 'text' },
        { name: 'Kode_Barang', type: 'enum', values: ['ELK01', 'ELK02', 'FMD01', 'FMD02', 'MKN01'] },
        { name: 'Tanggal_Kirim', type: 'date', range: ['2026-02-01', '2026-04-30'] },
        { name: 'Kategori', type: 'enum', values: ['Elektronik', 'Farmasi', 'Makanan', 'Otomotif'] },
        { name: 'Qty_Keluar', type: 'int', range: [5, 120] },
        { name: 'Shift', type: 'enum', values: ['Pagi', 'Siang', 'Malam'] },
      ],
    },
    answerKey: [
      { task: 1, formula: '=TRIM(B2)', explanation: 'Menghilangkan whitespace tak kasat mata di awal dan akhir teks kode barang.' },
      { task: 2, formula: '=IFERROR(VLOOKUP(TRIM(B2), Master_Barang!$A$2:$C$50, 2, FALSE), "Tidak Ada")', explanation: 'Lookup aman dengan proteksi pesan error bila kode tidak terdaftar.' },
      { task: 3, formula: '=SUMIFS(E2:E181, D2:D181, "Elektronik")', explanation: 'Menjumlahkan Qty_Keluar hanya jika kolom Kategori bernilai Elektronik.' },
      { task: 4, formula: '=COUNTIFS(F2:F181, "Malam")', explanation: 'Menghitung total baris transaksi yang dijalankan pada shift malam.' },
      { task: 5, formula: '=LEFT(A2, 3)', explanation: 'Mengambil 3 karakter pertama dari string Nomor PO.' },
    ],
  },
  advance: {
    id: 'fallback-advance-keuangan',
    seed: 'seed-adv-keuangan-2026',
    createdAt: new Date().toISOString(),
    title: 'Rekonsiliasi Kas Operasional & Matriks Budget Variance',
    level: 'advance',
    role: 'Admin Keuangan/Kasir',
    excelVersion: 'Microsoft 365',
    scenario:
      'Sebagai Senior Admin Keuangan di PT Mega Prima Medika, Anda bertugas menyusun matriks variance anggaran operasional Q1 2026. Anda harus menghubungkan data transaksi pengeluaran aktual dengan plafon anggaran multi-departemen tanpa menggunakan hardcoding, membuat aturan Conditional Formatting otomatis untuk mendeteksi pembengkakan biaya, serta menyajikan rekap Pivot Table.',
    tasks: [
      {
        no: 1,
        instruction: 'Tarik plafon anggaran berdasarkan kombinasi Kode Departemen dan Akun Pengeluaran menggunakan formula INDEX-MATCH 2 arah atau INDEX(..., MATCH(1, (range1=crit1)*(range2=crit2), 0)).',
        hint: 'Gunakan INDEX dengan MATCH array multi-kriteria.',
        targetResult: 'Plafon anggaran terhubung otomatis sesuai sheet Budget_Master.',
      },
      {
        no: 2,
        instruction: 'Hitung total realisasi belanja departemen Keuangan dengan metode SUMPRODUCT berbobot status verifikasi.',
        hint: '=SUMPRODUCT((Departemen="Keuangan")*(Status="Approved")*(Nominal))',
        targetResult: 'Total realisasi belanja yang telah terverifikasi.',
      },
      {
        no: 3,
        instruction: 'Hitung selisih Variance (Anggaran - Realisasi) dan tentukan status efisiensi dengan formula IFS: Jika Variance < 0 "Over Budget", Jika Variance = 0 "On Track", Jika Variance > 0 "Surplus".',
        hint: '=IFS(Variance<0, "Over Budget", Variance=0, "On Track", Variance>0, "Surplus")',
        targetResult: 'Status anggaran terisi otomatis.',
      },
      {
        no: 4,
        instruction: 'Terapkan aturan Conditional Formatting dengan rumus untuk menyorot seluruh baris transaksi yang statusnya "Over Budget" dengan highlight merah muda terang.',
        hint: 'Aturan rumus: =$H2="Over Budget", terapkan ke =$A$2:$H$200.',
        targetResult: 'Baris defisit tersorot dinamis saat data berubah.',
      },
      {
        no: 5,
        instruction: 'Susun Pivot Table dinamis yang mengelompokkan realisasi belanja per kuartal dan departemen, dilengkapi Slicer filter Status Verifikasi.',
        hint: 'Insert Pivot Table -> Rows: Departemen, Columns: Bulan, Values: Sum of Nominal.',
        targetResult: 'Tabel pivot interaktif siap presentasi manajemen.',
      },
    ],
    dataTraps: [
      'Sel kosong pada tanggal persetujuan kasir (belum diverifikasi)',
      'Nama departemen dengan variasi kapitalisasi (contoh: "HRD" vs "hrd ")',
      'Format angka nominal transaksi diselingi separator desimal campuran',
    ],
    formulas: {
      recommended: ['INDEX-MATCH', 'SUMPRODUCT', 'IFS', 'Pivot Table', 'Conditional Formatting Rumus', 'Named Range'],
      allowed: ['XLOOKUP', 'SUMIFS', 'FILTER'],
      forbidden: ['Macro/VBA'],
    },
    dataset: {
      sheetName: 'Realisasi_Beban_Kas',
      rows: 200,
      columns: [
        { name: 'Voucher_ID', type: 'text' },
        { name: 'Tanggal', type: 'date', range: ['2026-01-01', '2026-03-31'] },
        { name: 'Departemen', type: 'enum', values: ['Keuangan', 'Operasional', 'Pemasaran', 'IT', 'SDM'] },
        { name: 'Kode_Akun', type: 'enum', values: ['AK-501', 'AK-502', 'AK-503', 'AK-504'] },
        { name: 'Nominal', type: 'currency', range: [100000, 15000000] },
        { name: 'Status', type: 'enum', values: ['Approved', 'Pending', 'Rejected'] },
      ],
    },
    answerKey: [
      { task: 1, formula: '=INDEX(Budget_Master!$C$2:$C$20, MATCH(1, (Budget_Master!$A$2:$A$20=C2)*(Budget_Master!$B$2:$B$20=D2), 0))', explanation: 'Pencarian dua kriteria baris dan kolom tanpa kolom pembantu.' },
      { task: 2, formula: '=SUMPRODUCT((C2:C201="Keuangan")*(F2:F201="Approved")*(E2:E201))', explanation: 'Kalkulasi cepat perkalian array logika dengan array nominal.' },
      { task: 3, formula: '=IFS(G2<0, "Over Budget", G2=0, "On Track", G2>0, "Surplus")', explanation: 'Evaluasi kondisi bertingkat secara ringkas.' },
      { task: 4, formula: 'Formula Rule: =$H2="Over Budget" pada range =$A$2:$H$201', explanation: 'Kuncian tanda dollar kolom $H memastikan seluruh baris terwarnai seragam.' },
      { task: 5, formula: 'Pivot Table: Departemen di Rows, Bulan di Columns, Sum(Nominal) di Values + Slicer Status', explanation: 'Ringkasan multi-dimensi untuk pelaporan finansial eksekutif.' },
    ],
  },
  portfolio: {
    id: 'fallback-portfolio-eksekutif',
    seed: 'seed-port-enterprise-2026',
    createdAt: new Date().toISOString(),
    title: 'Enterprise Operations & Financial Performance Dashboard System',
    level: 'portfolio',
    role: 'Admin Keuangan/Kasir',
    excelVersion: 'Microsoft 365',
    scenario:
      'Direktur Operasional PT Sukses Makmur Abadi meminta kamu merancang sistem reporting Excel tingkat korporat yang siap dijadikan bukti keahlian tingkat lanjut (portofolio kerja). Proyek ini menuntut pembersihan data mentah ekspor, pemodelan tabel relasional antar-sheet, pembuatan KPI metrics otomatis, interactive slicers, dan dokumentasi README berstandar konsultan.',
    tasks: [
      {
        no: 1,
        instruction: 'Rancang arsitektur workbook 4 sheet terstruktur: [01_README], [02_RAW_DATA], [03_CALC_ENGINE], [04_EXECUTIVE_DASHBOARD].',
        hint: 'Susun navigasi antarsheet dengan hyperlink formula.',
        targetResult: 'Struktur workbook profesional, rapi, dan terkunci proteksi formula.',
      },
      {
        no: 2,
        instruction: 'Bangun pipa pembersihan data (Data Cleansing) untuk menangani tanggal teks, trailing spaces, dan duplicate entry.',
        hint: 'Kombinasikan TRIM, DATEVALUE, dan fungsi UNIQUE.',
        targetResult: 'Sheet data bersih bebas duplikasi dan kesalahan formatting.',
      },
      {
        no: 3,
        instruction: 'Hitung KPI Utama: Total Revenue Q1, Gross Profit Margin, Rata-rata Days to Pay, dan Persentase Klaim Tertagih.',
        hint: 'Gunakan dynamic named ranges dan formula analitis.',
        targetResult: '4 kartu skor (scorecards) KPI dengan indikator arah pertumbuhan.',
      },
      {
        no: 4,
        instruction: 'Buat Interactive Executive Dashboard dengan 2 Pivot Charts, 1 Dynamic Table, dan 3 Slicers terhubung (Tahun, Wilayah, Kategori).',
        hint: 'Hubungkan Slicer ke beberapa pivot table via Report Connections.',
        targetResult: 'Dashboard merespon interaktif saat slicer diklik.',
      },
      {
        no: 5,
        instruction: 'Tuliskan dokumentasi komprehensif pada sheet README berisi data dictionary, asumsi bisnis, metodologi rumus, dan petunjuk pemakaian pengguna.',
        hint: 'Tuliskan instruksi user-friendly bagi pihak manajemen.',
        targetResult: 'Dokumentasi portofolio siap dinilai oleh recruiter.',
      },
    ],
    dataTraps: [
      'Data transaksi terduplikasi sebanyak 5 baris',
      'Format angka Rp dengan tanda titik dan koma yang tertukar pada file CSV',
      'Nilai status transaksi tidak seragam (contoh: "LUNAS", "Lunas ", "lunas")',
    ],
    formulas: {
      recommended: ['Multi-sheet modeling', 'Interactive Dashboard (Pivot + Slicer + Chart)', 'Dynamic Formulas', 'Data Cleansing Pipeline'],
      allowed: ['XLOOKUP', 'SUMPRODUCT', 'INDEX-MATCH', 'LET'],
      forbidden: ['Hardcoded calculated values', 'Unformatted raw numbers'],
    },
    dataset: {
      sheetName: 'Enterprise_Transactions',
      rows: 250,
      columns: [
        { name: 'Invoice_No', type: 'text' },
        { name: 'Tanggal', type: 'date', range: ['2026-01-01', '2026-03-31'] },
        { name: 'Wilayah', type: 'enum', values: ['Jabodetabek', 'Jawa Barat', 'Jawa Timur', 'Sumatera', 'Bali-Nusra'] },
        { name: 'Kategori_Layanan', type: 'enum', values: ['B2B Enterprise', 'Konsinyasi Retail', 'Ekspor', 'Pemerintah'] },
        { name: 'Nilai_Bruto', type: 'currency', range: [5000000, 75000000] },
        { name: 'Biaya_Operasional', type: 'currency', range: [1000000, 25000000] },
        { name: 'Status_Bayar', type: 'enum', values: ['Lunas', 'Jatuh Tempo', 'Dalam Proses'] },
      ],
    },
    answerKey: [
      { task: 1, formula: 'Hyperlink Sheet Formula: =HYPERLINK("#\'04_EXECUTIVE_DASHBOARD\'!A1", "Go to Dashboard")', explanation: 'Membangun arsitektur navigasi profesional antar sheet kerja.' },
      { task: 2, formula: '=TRIM(CLEAN(SUBSTITUTE(A2, CHAR(160), " ")))', explanation: 'Formula data cleansing standar enterprise untuk membersihkan karakter non-breaking.' },
      { task: 3, formula: '=SUM(E2:E251) dan =SUM(E2:E251-F2:F251)/SUM(E2:E251)', explanation: 'Menghitung total pendapatan dan persentase Gross Profit Margin.' },
      { task: 4, formula: 'Pivot Table Slicer Connection Settings -> Check all Pivot Tables in Report Connections', explanation: 'Menghubungkan satu filter slicer ke seluruh visualisasi dashboard secara simultan.' },
      { task: 5, formula: 'Markdown/README documentation cell standard', explanation: 'Dokumentasi struktural portofolio untuk presentasi klien atau hiring manager.' },
    ],
    rubric: [
      'Ketepatan Hasil: Seluruh perhitungan kalkulasi omset, margin, dan rekonsiliasi 100% akurat tanpa error formula.',
      'Kerapian Format: Palet warna korporat yang konsisten, format ribuan/rupiah jelas, gridline bersih, dan penataan visual hierarchy.',
      'Integritas Data: Semua data trap (duplikat, spasi tersembunyi, inkonsistensi teks) berhasil dibersihkan di pipeline data.',
      'Kejelasan Dokumentasi: Lembar README menyertakan kamus data, panduan pemeliharaan rumus, dan riwayat revisi.',
    ],
    portfolioBrief: {
      clientBrief:
        'Klien adalah Managing Director sebuah perusahaan distribusi nasional yang membutuhkan single source of truth untuk memonitor performa operasional 5 wilayah regional. Dashboard harus dapat digunakan oleh non-technical managers dengan filter intuitif.',
      deliverables: [
        'File Workbook Excel (.xlsx) 4 sheets dengan nama sheet standar baku',
        'Executive Summary Dashboard interaktif dengan 3 slicer utama',
        'Laporan analisis temuan anomali biaya operasional dalam bentuk PDF',
        'File README.md yang merinci metodologi dan penjelasan rumus teknis',
      ],
      readmeTemplate: `# Portofolio: Enterprise Operations & Financial Performance Dashboard

## Ringkasan Eksekutif
Dashboard ini dirancang untuk memberikan visibilitas real-time terhadap performa pendapatan, efisiensi beban operasional, dan kepatuhan pembayaran antar cabang.

## Arsitektur Workbook
- **01_README**: Dokumentasi, changelog, dan navigasi menu
- **02_RAW_DATA**: Data mentah hasil ekspor sistem (terproteksi)
- **03_CLEAN_CALC**: Sheet pembersihan data dan tabel kalkulasi pivot helper
- **04_DASHBOARD**: Lembar visualisasi eksekutif interaktif

## Rumus Kunci yang Digunakan
1. Pembersihan Data: \`=TRIM()\`, \`=TEXT()\`, \`=UNIQUE()\`
2. Perhitungan Agregasi: \`=SUMPRODUCT()\`, \`=INDEX-MATCH\`
3. Analisis Logika: \`=IFS()\`, \`=IFERROR()\`

## Cara Penggunaan
1. Buka sheet **04_DASHBOARD**
2. Gunakan Slicer Wilayah dan Status untuk memfilter visualisasi secara dinamis
3. Untuk memperbarui data baru, tempelkan data pada sheet **02_RAW_DATA** lalu klik *Data > Refresh All*
`,
    },
  },
};
