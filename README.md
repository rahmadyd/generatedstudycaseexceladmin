# Generator Studi Kasus Excel (Bidang Admin)

Aplikasi web modern untuk latihan dan simulasi tugas Microsoft Excel bidang administrasi perkantoran. Soal studi kasus digenerate secara dinamis melalui **Groq API**, dataset realistis dibangkitkan secara deterministik oleh kode (**Faker.js + PRNG Seed**), dan hasilnya dapat diunduh langsung sebagai file **XLSX**, **CSV**, dan **PDF**.

Aplikasi ini didesain modular dengan **pemisahan tegas antara Frontend dan Backend**, serta siap dideploy langsung ke **Vercel** dengan konfigurasi serverless.

---

## 🚀 Fitur Utama

1. **Pilihan 3 Tingkat Kesulitan (Level)**:
   - **Easy**: SUM, AVERAGE, COUNT, MIN, MAX, IF dasar, formatting, sort & filter.
   - **Middle**: VLOOKUP / XLOOKUP, SUMIF(S), COUNTIF(S), IFERROR, TEXT, TRIM, LEFT/RIGHT/MID, Data Validation.
   - **Advance**: INDEX-MATCH multi-kriteria, SUMPRODUCT, Pivot Table dinamis, Conditional Formatting rumus, Named Range, Nested IF/IFS.

2. **6 Pilihan Bidang Administrasi**:
   - Admin Penjualan
   - Admin Inventory & Gudang
   - Admin HRD & Absensi
   - Admin Keuangan & Kasir
   - Admin Pengadaan / Purchasing
   - Sekretaris & Administrasi Surat

3. **Kompatibilitas Versi Excel**:
   - **Microsoft 365**: Mendukung fungsi modern (XLOOKUP, FILTER, UNIQUE, dsb).
   - **Excel 2016 / 2019**: Memfilter dan melarang fungsi eksklusif 365 (menjamin rumus selalu dapat dijalankan pada versi legacy).

4. **Generator Dataset Deterministik & Data Traps**:
   - Dataset dibuat secara instan di browser berbasis **Seed**.
   - Menyisipkan **Data Traps** (jebakan data kotor) untuk level Middle ke atas (spasi tersembunyi, tanggal bertipe teks, angka tersimpan sebagai teks, duplikasi baris, sel kosong).
   - Preview tabel 5 baris pertama dengan fitur salin nama kolom dalam satu klik.
   - Download langsung sebagai file `.xlsx` dan `.csv` via SheetJS.

5. **Pemeriksaan Rumus Otomatis**:
   - Memvalidasi agar `answerKey` tidak pernah melanggar daftar formula `forbidden`.
   - Menggunakan format formula Excel Indonesia pada kunci jawaban: titik koma (`;`) sebagai pemisah argumen dan koma (`,`) untuk desimal, dengan nama fungsi berbahasa Inggris.

6. **Checklist Tugas & Progress Tracker**:
   - Interaktif centang tugas dengan indikator progress bar ("3 dari 6 tugas selesai").
   - Efek perayaan konfeti saat seluruh tugas terselesaikan.
   - Tombol **"Ganti Tugas Ini"** untuk meregenerate satu nomor tugas saja tanpa membuat ulang seluruh studi kasus.
   - Panduan rumus admin dapat dibuka dari header, berisi kategori, kegunaan, dan contoh rumus dengan format Indonesia.

7. **Export Dokumen PDF Standar A4**:
   - **PDF Soal**: Judul, skenario, tabel tugas + target mandiri, aturan rumus, dan preview dataset 5 baris.
   - **PDF Kunci Jawaban**: Terpisah untuk menjaga independensi latihan.
   - Tombol unduh PDF diletakkan di bagian paling bawah halaman sesuai spesifikasi.

8. **Timer Pengerjaan & Berbagi Seed URL**:
   - Stopwatch pengerjaan (Mulai, Jeda, Reset).
   - Berbagi soal via URL parameter `?seed=...` sehingga soal dan dataset identik untuk latihan kelompok atau evaluasi rekrutmen.

9. **Integrasi Groq API**:
   - Generate menggunakan hanya `GROQ_API_KEY` dari environment variable server.
   - API key tidak dikirim dari browser atau disimpan di `localStorage`; OpenAI tidak digunakan sebagai fallback.
   - Model default `openai/gpt-oss-120b`; model utama dan cadangan dapat diatur melalui `GROQ_MODEL` dan `GROQ_FALLBACK_MODEL`.
   - Jumlah tugas dibatasi sesuai level agar respons lebih ringkas: Easy 3–4, Middle 4–5, Advance 4–5.
   - Generate Advance dipisah menjadi tahap kasus dan kunci jawaban. Jika tahap kunci gagal, kasus yang sudah berhasil dibuat tetap dapat digunakan dan kunci dapat dicoba ulang.
   - Skenario, instruksi tugas, skema dataset, dan kunci jawaban dibuat oleh Groq. Jika respons tidak valid atau tidak selaras dengan role/industri/rumus, aplikasi mengirim ulang prompt koreksi ke AI maksimal dua kali; tidak mengganti kasus dengan template lokal. Jika kuota Groq habis, aplikasi menampilkan error 429.
   - Log pemakaian Groq memuat timestamp UTC. Ekspor log JSONL dari Vercel dapat diringkas per tanggal/level dengan `npm run report:groq -- <path-log-jsonl>`; laporan memuat rata-rata token, kegagalan panggilan provider, dan jumlah 429 tanpa database tambahan.

---

## 📂 Struktur Arsitektur & Pemisahan Kode

Proyek ini memisahkan secara eksplisit antara direktori **Backend**, **Frontend**, dan **Shared**:

```
generatedstudycaseexceladmin/
├── prompts/                         # Template Prompt AI Terpisah
│   ├── generate-case.md             # Template studi kasus lengkap dengan parameter acak
│   └── regenerate-task.md           # Template penggantian tugas tunggal
├── src/
│   ├── backend/                     # BACKEND (Serverless Logic & Service Layer)
│   │   ├── groq.ts                  # Klien Groq API (Llama 3.3 70B, retry handling)
│   │   ├── prompts.ts               # Compiler prompt & randomizer konteks bisnis
│   │   ├── validator.ts             # Validasi Zod & verifikasi aturan rumus forbidden
│   │   ├── rate-limit.ts            # Rate limiter berbasis IP memory
│   │   ├── task-service.ts          # Layanan orkestrasi studi kasus & regenerasi tugas
│   │
│   ├── frontend/                    # FRONTEND (UI Components, Hooks, Client Utilities)
│   │   ├── components/              # Komponen antarmuka pengguna
│   │   │   ├── Navbar.tsx           # Brand, panduan rumus, riwayat, dark mode toggle
│   │   │   ├── GenerateForm.tsx     # Form pemilihan level, role, versi excel, seed
│   │   │   ├── StickyNav.tsx        # Navigasi melayang lintas bagian dokumen
│   │   │   ├── CaseHeader.tsx       # Judul, badge level, timer pengerjaan, share URL
│   │   │   ├── ScenarioSection.tsx  # Kartu skenario kasus admin
│   │   │   ├── DatasetSection.tsx   # Preview 5 baris, download XLSX & CSV
│   │   │   ├── TasksSection.tsx     # Checklist tugas, progress bar, ganti tugas N
│   │   │   ├── FormulaClues.tsx     # Clue rumus: Disarankan / Boleh / Dilarang
│   │   │   ├── AnswerKeySection.tsx # Kunci jawaban akordeon tersembunyi
│   │   │   ├── PDFExportSection.tsx # Download PDF Soal & Kunci (posisi paling bawah)
│   │   │   ├── HistoryModal.tsx     # Modal riwayat soal tersimpan
│   │   └── utils/                   # Utilitas client-side
│   │       ├── dataset-generator.ts # Generator baris dataset (Faker + PRNG + traps)
│   │       ├── export-xlsx.ts       # Generator XLSX & CSV (SheetJS)
│   │       ├── export-pdf.ts        # Generator PDF Soal & Kunci (jsPDF + autoTable)
│   │       └── storage.ts           # Safe localStorage wrapper dengan error-handling
│   │
│   ├── shared/                      # SHARED (Tipe data, Zod schema & Konstanta)
│   │   ├── schema.ts                # Zod schemas untuk CaseStudy, Task, Dataset
│   │   └── constants.ts             # Konfigurasi level, role, dan formula excel
│   │
│   └── app/                         # NEXT.JS APP ROUTER (Integrasi Vercel)
│       ├── api/                     # Serverless Function Endpoints
│       │   ├── generate/route.ts    # POST /api/generate
│       │   ├── generate-missing-content/route.ts # Retry kunci/brief/rubrik
│       │   └── regenerate-task/route.ts # POST /api/regenerate-task
│       ├── layout.tsx               # Root HTML & styling metadata
│       ├── page.tsx                 # Entry page merender src/frontend/App.tsx
│       └── globals.css              # Tailwind directives & CSS cetak (@media print)
│
├── vercel.json                      # Konfigurasi deployment Vercel
├── package.json
└── tsconfig.json
```

---

## 🛠️ Instalasi & Menjalankan Lokal

### Prasyarat
- Node.js versi 18 atau 20+
- npm atau pnpm

### Langkah Menjalankan:
1. Clone repositori atau buka direktori proyek:
   ```bash
   cd generatedstudycaseexceladmin
   ```

2. Pasang dependensi:
   ```bash
   npm install
   ```

3. Atur API key Groq di environment server:
   ```bash
   GROQ_API_KEY=gsk_...
   ```
   Untuk lokal, simpan pada `.env.local`. Untuk production, atur sebagai environment variable server di Vercel. Generate selalu menggunakan Groq dan tidak menerima API key dari browser atau fallback ke OpenAI maupun template kasus lokal.

4. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
   Buka peramban di `http://localhost:3000`.

5. Uji proses kompilasi produksi:
   ```bash
   npm run build
   ```

---

## ☁️ Panduan Deploy ke Vercel

Aplikasi ini 100% kompatibel dengan **Vercel Zero-Config Deployment**.

### Menggunakan Vercel
```bash
npm install -g vercel
vercel
```

Di project Vercel, buka **Settings → Environment Variables** dan tambahkan:
- Key: `GROQ_API_KEY`
- Value: API key dari Groq

Pilih environment yang digunakan (Production/Preview/Development), simpan, lalu redeploy agar variable diterapkan. Aplikasi hanya memakai `GROQ_API_KEY` server dan endpoint Groq.

Variabel model opsional:
- `GROQ_MODEL`: model utama; default `openai/gpt-oss-120b`.
- `GROQ_FALLBACK_MODEL`: model alternatif Groq. Sebaiknya berbeda dari model utama agar fallback punya kuota model tersendiri. Jika tidak disetel, fallback dinonaktifkan.

Model `gpt-oss` dikirim dengan `reasoning_effort: low`. Untuk model lain, parameter tersebut tidak dikirim.

### Ringkasan log pemakaian Groq

Ekspor log terstruktur `groq_completion` dari Vercel sebagai JSONL, lalu jalankan:

```bash
npm run report:groq -- "C:\path\to\vercel-groq-logs.jsonl"
```

Laporan dikelompokkan menurut tanggal UTC dan level. “Panggilan” berarti satu panggilan provider Groq (termasuk percobaan model fallback); “Gagal” adalah respons non-2xx atau kegagalan transport; rata-rata token hanya memakai respons yang menyertakan `usage.total_tokens`. Laporan berjalan lokal, tidak menyimpan log ke aplikasi, dan tidak mengirim API key.

---

## 🏆 Nilai Plus Teknis

Aplikasi ini mendemonstrasikan kapabilitas teknis end-to-end:
- **Full-Stack Separation**: Pemisahan modular antara serverless backend logic dan client-side presentation layer.
- **AI Structured JSON Enforcement**: Output AI dikontrol ketat melalui Zod runtime validation dengan automatic retry mechanism jika format tidak sesuai.
- **Formula Rule Engine**: Verifikasi internal untuk mencegah rumus terlarang (`forbidden`) maupun rumus versi modern pada versi Excel legacy.
- **Deterministic Data Synthesis**: Menghasilkan dataset ber-seed secara murni melalui kode sehingga link download selalu valid dan bebas halusinasi AI.
- **Client-Side Heavy Operations**: Pembuatan XLSX, CSV, dan PDF seluruhnya diproses di peramban pengguna untuk efisiensi beban komputasi server.
