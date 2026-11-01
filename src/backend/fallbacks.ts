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
        targetResult: 'Kolom Subtotal terisi nilai Qty dikalikan Harga_Satuan pada setiap baris.',
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
        targetResult: 'Rata-rata cocok dengan seluruh subtotal transaksi.',
      },
      {
        no: 4,
        instruction: 'Temukan nilai transaksi dengan Subtotal terbesar menggunakan fungsi MAX.',
        hint: 'Gunakan rumus =MAX(F2:F151) pada kolom Subtotal.',
        targetResult: 'Nilai maksimum sama dengan atau lebih besar dari seluruh nilai Subtotal lainnya.',
      },
      {
        no: 5,
        instruction: 'Beri status Diskon menggunakan fungsi IF: jika Subtotal >= Rp 500.000 maka "Dapat Voucher 10%", jika tidak maka "Non-Voucher".',
        hint: '=IF(F2>=500000; "Dapat Voucher 10%"; "Non-Voucher")',
        targetResult: 'Kolom Bonus terisi teks sesuai ketentuan tanpa ada error formula.',
      },
    ],
    dataTraps: [],
    formulas: {
      recommended: ['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX', 'IF'],
      allowed: ['COUNTA'],
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
      {
        task: 1,
        formula: '=D2*E2',
        explanation: 'Mengalikan sel Kuantitas (D2) dengan Harga Satuan (E2) pada baris aktif untuk menghitung Subtotal transaksi. Mengapa perkalian langsung? Karena pada baris tunggal, perkalian aritmatika dasar adalah metode paling cepat dan efisien tanpa perlu membebani komputasi.',
      },
      {
        task: 2,
        formula: '=SUM(F2:F151)',
        explanation: 'Menjumlahkan seluruh nilai pada rentang Subtotal (F2:F151). Mengapa menggunakan SUM dibanding penambahan manual (F2+F3+...)? Karena SUM secara otomatis mengabaikan teks jika ada sel kosong/rusak dan mampu mengkalkulasi ratusan baris sekaligus secara cepat.',
      },
      {
        task: 3,
        formula: '=AVERAGE(F2:F151)',
        explanation: 'Menghitung rata-rata nilai transaksi (basket size) pembeli. Fungsi AVERAGE otomatis menjumlahkan nilai pada rentang F2:F151 lalu membaginya dengan jumlah sel yang berisi angka.',
      },
      {
        task: 4,
        formula: '=MAX(F2:F151)',
        explanation: 'MAX memindai seluruh nilai Subtotal pada F2:F151 dan mengembalikan angka terbesar. Rentang tidak memasukkan header, sehingga teks judul kolom tidak mengganggu hasil.',
      },
      {
        task: 5,
        formula: '=IF(F2>=500000; "Dapat Voucher 10%"; "Non-Voucher")',
        explanation: 'Menggunakan fungsi logika IF dengan 3 argumen: (1) Tes Logika F2>=500000 untuk mengecek apakah belanjaan mencapai Rp 500.000; (2) Nilai jika Benar "Dapat Voucher 10%"; (3) Nilai jika Salah "Non-Voucher". Teks diapit petik ganda agar Excel mengenalinya sebagai string.',
      },
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
      'Sebagai Admin Inventory di CV Cahaya Logistik Nusantara, kamu menerima data mutasi barang gudang selama periode audit. Data hasil ekspor ERP memiliki beberapa ketidaksempurnaan format (spasi ekstra, data tanggal teks). Kamu diminta membersihkan kode barang, merekap kuantitas keluar per kategori dan shift, serta menjaga konsistensi input operasional.',
    tasks: [
      {
        no: 1,
        instruction: 'Bersihkan kolom Kode_Barang yang memiliki spasi ekstra menggunakan rumus TRIM.',
        hint: 'Buat kolom bantuan =TRIM(B2).',
        targetResult: 'Semua kode barang standar 5 karakter tanpa spasi pembuka/penutup.',
      },
      {
        no: 2,
        instruction: 'Atur validasi data pada kolom Shift agar hanya menerima Pagi, Siang, atau Malam.',
        hint: 'Pilih kolom Shift, lalu Data > Data Validation > List dengan sumber Pagi;Siang;Malam.',
        targetResult: 'Nilai Shift baru hanya dapat dipilih dari tiga opsi yang tersedia.',
      },
      {
        no: 3,
        instruction: 'Hitung total kuantitas barang keluar untuk kategori "Elektronik" menggunakan formula SUMIFS.',
        hint: '=SUMIFS(Qty_Keluar; Kategori; "Elektronik")',
        targetResult: 'Total angka unit barang keluar kategori Elektronik terverifikasi.',
      },
      {
        no: 4,
        instruction: 'Hitung jumlah transaksi pengiriman pada shift Malam menggunakan COUNTIF.',
        hint: '=COUNTIF(F2:F181; "Malam")',
        targetResult: 'Jumlah baris dengan Shift bernilai Malam tanpa syarat tambahan.',
      },
      {
        no: 5,
        instruction: 'Ekstrak tiga karakter awalan dokumen dari Nomor_PO menggunakan fungsi LEFT.',
        hint: '=LEFT(A2; 3)',
        targetResult: 'Setiap hasil menampilkan awalan PO- dari Nomor_PO.',
      },
    ],
    dataTraps: [
      'Terdapat spasi berlebih pada kode barang (contoh: " ATK01 ")',
      'Format tanggal beberapa baris tersimpan sebagai teks miring',
      'Nilai kuantitas pada 3 baris berupa angka dalam format string',
    ],
    formulas: {
      recommended: ['SUMIFS', 'COUNTIF', 'TRIM', 'LEFT', 'Data Validation'],
      allowed: ['SUMIF', 'COUNTIFS', 'TEXT', 'IFERROR'],
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
      {
        task: 1,
        formula: '=TRIM(B2)',
        explanation: 'Fungsi TRIM membersihkan spasi tak terlihat di awal dan akhir teks kode barang (leading/trailing space). Mengapa ini krusial bagi admin? Karena di Excel, teks " ELK01 " dan "ELK01" dianggap berbeda, sehingga rumus VLOOKUP akan gagal (#N/A) jika spasi kotor ini tidak dibersihkan terlebih dahulu.',
      },
      {
        task: 2,
        formula: 'Data Validation: Allow = List; Source = Pagi, Siang, Malam',
        explanation: 'Pilih seluruh sel data pada kolom Shift, buka Data > Data Validation, pilih Allow: List, lalu isi Source dengan Pagi;Siang;Malam. Validasi ini mencegah entri shift di luar tiga pilihan yang disediakan tanpa mengandalkan sheet master yang tidak tersedia pada dataset.',
      },
      {
        task: 3,
        formula: '=SUMIFS(E2:E181; D2:D181; "Elektronik")',
        explanation: 'Fungsi SUMIFS menjumlahkan nilai dengan syarat: Argumen 1 (E2:E181) adalah rentang angka yang dijumlahkan (Qty_Keluar); Argumen 2 (D2:D181) adalah rentang kriteria (Kategori); Argumen 3 ("Elektronik") adalah syarat teks yang dicari. Perhatikan urutan argumen SUMIFS: rentang jumlah selalu di awal!',
      },
      {
        task: 4,
        formula: '=COUNTIF(F2:F181; "Malam")',
        explanation: 'COUNTIF menerima dua argumen: F2:F181 adalah rentang kolom Shift yang diperiksa, sedangkan "Malam" adalah kriteria yang dihitung. Karena tugas hanya memiliki satu syarat, COUNTIF lebih tepat daripada COUNTIFS. Pastikan rentang mencakup semua 180 baris data dan tidak memasukkan header.',
      },
      {
        task: 5,
        formula: '=LEFT(A2; 3)',
        explanation: 'LEFT mengambil sejumlah karakter dari sisi kiri teks. A2 merujuk ke Nomor_PO pada baris aktif, sedangkan 3 mengambil awalan "PO-" dari format nomor yang dibuat dataset. Salin rumus ke bawah untuk menerapkan hasil pada setiap transaksi.',
      },
    ],
  },
  advance: {
    id: 'fallback-advance-keuangan',
    seed: 'seed-adv-keuangan-2026',
    createdAt: new Date().toISOString(),
    title: 'Analisis Pengeluaran Terverifikasi & Klasifikasi Risiko',
    level: 'advance',
    role: 'Admin Keuangan/Kasir',
    excelVersion: 'Microsoft 365',
    scenario:
      'Sebagai Senior Admin Keuangan di PT Mega Prima Medika, Anda bertugas menganalisis transaksi pengeluaran Q1 2026. Anda perlu menemukan transaksi terverifikasi dengan kriteria departemen dan status, menghitung total realisasi, mengklasifikasikan nilai transaksi untuk prioritas audit, menandai transaksi berisiko dengan Conditional Formatting, serta menyajikan rekap Pivot Table.',
    tasks: [
      {
        no: 1,
        instruction: 'Temukan nilai Nominal untuk transaksi pertama berstatus Approved pada departemen Keuangan menggunakan INDEX-MATCH dua kriteria.',
        hint: '=INDEX($E$2:$E$201; MATCH(1; ($C$2:$C$201="Keuangan")*($F$2:$F$201="Approved"); 0))',
        targetResult: 'Satu nilai Nominal dari baris pertama yang memenuhi kedua kriteria.',
      },
      {
        no: 2,
        instruction: 'Hitung total realisasi belanja departemen Keuangan dengan metode SUMPRODUCT berbobot status verifikasi.',
        hint: '=SUMPRODUCT((C2:C201="Keuangan")*(F2:F201="Approved")*(E2:E201))',
        targetResult: 'Total realisasi belanja yang telah terverifikasi.',
      },
      {
        no: 3,
        instruction: 'Klasifikasikan transaksi: Nominal minimal Rp10.000.000 berstatus "Butuh Audit", minimal Rp5.000.000 berstatus "Perlu Review", dan di bawahnya "Normal".',
        hint: '=IFS(E2>=10000000; "Butuh Audit"; E2>=5000000; "Perlu Review"; TRUE; "Normal")',
        targetResult: 'Setiap transaksi mendapatkan tepat satu status sesuai ambang Nominal.',
      },
      {
        no: 4,
        instruction: 'Terapkan Conditional Formatting untuk menyorot baris transaksi berstatus "Butuh Audit" pada kolom hasil G.',
        hint: 'Aturan rumus: =$G2="Butuh Audit", terapkan ke =$A$2:$G$201.',
        targetResult: 'Seluruh baris dengan status Butuh Audit tersorot dan baris lain tidak.',
      },
      {
        no: 5,
        instruction: 'Susun Pivot Table dinamis yang mengelompokkan realisasi belanja per kuartal dan departemen, dilengkapi Slicer filter Status.',
        hint: 'Insert Pivot Table -> Rows: Departemen, Columns: Tanggal (group by Quarters), Values: Sum of Nominal, Slicer: Status.',
        targetResult: 'Tabel pivot menampilkan total Nominal per Departemen dan kuartal, dengan filter Status.',
      },
    ],
    dataTraps: [
      'Spasi berlebih pada beberapa Voucher_ID',
      'Tanggal kirim bervariasi sebagai teks dengan pemisah garis miring',
      'Beberapa Nominal tersimpan sebagai teks dan terdapat dua baris duplikat',
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
      { task: 1, formula: '=INDEX($E$2:$E$201; MATCH(1; ($C$2:$C$201="Keuangan")*($F$2:$F$201="Approved"); 0))', explanation: 'INDEX mengembalikan nilai dari rentang Nominal E2:E201. MATCH mencari angka 1 pada hasil perkalian dua pemeriksaan logika: Departemen harus Keuangan dan Status harus Approved. Nilai 0 pada MATCH meminta pencocokan tepat, sehingga baris dengan hanya satu syarat cocok tidak akan terpilih. Di Excel 2016/2019, rumus array ini perlu dikonfirmasi dengan Ctrl+Shift+Enter.' },
      { task: 2, formula: '=SUMPRODUCT((C2:C201="Keuangan")*(F2:F201="Approved")*(E2:E201))', explanation: 'Kalkulasi cepat perkalian array logika dengan array nominal.' },
      { task: 3, formula: '=IFS(E2>=10000000; "Butuh Audit"; E2>=5000000; "Perlu Review"; TRUE; "Normal")', explanation: 'IFS mengevaluasi pasangan kondisi dan hasil dari kiri ke kanan. E2 adalah Nominal pada baris aktif; ambang tertinggi diperiksa lebih dahulu agar transaksi besar tidak lebih dulu masuk ke kategori yang lebih rendah. TRUE menjadi kondisi terakhir agar semua nilai lain berstatus Normal.' },
      { task: 4, formula: 'Formula Rule: =$G2="Butuh Audit" pada range =$A$2:$G$201', explanation: 'Conditional Formatting memeriksa kolom status G pada setiap baris. Tanda $ pada G mengunci kolom status, sedangkan nomor baris tetap relatif agar aturan mengikuti baris yang sedang diwarnai.' },
      { task: 5, formula: 'Pivot Table: Departemen di Rows, Bulan di Columns, Sum(Nominal) di Values + Slicer Status', explanation: 'Ringkasan multi-dimensi untuk pelaporan finansial eksekutif.' },
    ],
  },
};
