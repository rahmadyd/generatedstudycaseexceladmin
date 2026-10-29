# Generator Studi Kasus Excel (Bidang Admin & Portofolio)

Aplikasi web modern untuk latihan dan simulasi tugas Microsoft Excel bidang administrasi perkantoran. Soal studi kasus digenerate secara dinamis oleh AI (**OpenAI ChatGPT gpt-4o-mini**), dataset realistis dibangkitkan secara deterministik oleh kode (**Faker.js + PRNG Seed**), dan hasilnya dapat diunduh langsung sebagai file **XLSX**, **CSV**, dan **PDF**.

Aplikasi ini didesain modular dengan **pemisahan tegas antara Frontend dan Backend**, serta siap dideploy langsung ke **Vercel** dengan konfigurasi serverless.

---

## 🚀 Fitur Utama

1. **Pilihan 4 Tingkat Kesulitan (Level)**:
   - **Easy**: SUM, AVERAGE, COUNT, MIN, MAX, IF dasar, formatting, sort & filter.
   - **Middle**: VLOOKUP / XLOOKUP, SUMIF(S), COUNTIF(S), IFERROR, TEXT, TRIM, LEFT/RIGHT/MID, Data Validation.
   - **Advance**: INDEX-MATCH multi-kriteria, SUMPRODUCT, Pivot Table dinamis, Conditional Formatting rumus, Named Range, Nested IF/IFS.
   - **Portofolio**: Simulasi proyek profesional mencakup Brief Klien, Target Deliverables, Multi-sheet modeling, Rubrik Penilaian, dan Template README.md.

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

6. **Checklist Tugas & Progress Tracker**:
   - Interaktif centang tugas dengan indikator progress bar ("3 dari 6 tugas selesai").
   - Efek perayaan konfeti saat seluruh tugas terselesaikan.
   - Tombol **"Ganti Tugas Ini"** untuk meregenerate satu nomor tugas saja tanpa membuat ulang seluruh studi kasus.

7. **Export Dokumen PDF Standar A4**:
   - **PDF Soal**: Judul, skenario, tabel tugas + target mandiri, aturan rumus, dan preview dataset 5 baris.
   - **PDF Kunci Jawaban**: Terpisah untuk menjaga independensi latihan.
   - Tombol unduh PDF diletakkan di bagian paling bawah halaman sesuai spesifikasi.

8. **Timer Pengerjaan & Berbagi Seed URL**:
   - Stopwatch pengerjaan (Mulai, Jeda, Reset).
   - Berbagi soal via URL parameter `?seed=...` sehingga soal dan dataset identik untuk latihan kelompok atau evaluasi rekrutmen.

9. **Pilihan Kunci API Fleksibel**:
   - **Proxy Serverless**: Menggunakan `GROQ_API_KEY` di environment variable server (aman untuk deployment publik).
   - **BYOK (Bring Your Own Key)**: Pengguna dapat memasukkan Groq API Key pribadi di menu pengaturan lokal (`localStorage`).
   - **Offline Fallback Ready**: Dilengkapi preset studi kasus offline berkualitas tinggi jika tidak ada API key yang terkonfigurasi.

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
│   │   └── fallbacks.ts             # Template offline fallback untuk semua level
│   │
│   ├── frontend/                    # FRONTEND (UI Components, Hooks, Client Utilities)
│   │   ├── components/              # Komponen antarmuka pengguna
│   │   │   ├── Navbar.tsx           # Brand, API key modal trigger, dark mode toggle
│   │   │   ├── GenerateForm.tsx     # Form pemilihan level, role, versi excel, seed
│   │   │   ├── StickyNav.tsx        # Navigasi melayang lintas bagian dokumen
│   │   │   ├── CaseHeader.tsx       # Judul, badge level, timer pengerjaan, share URL
│   │   │   ├── ScenarioSection.tsx  # Kartu skenario kasus admin
│   │   │   ├── DatasetSection.tsx   # Preview 5 baris, download XLSX & CSV
│   │   │   ├── TasksSection.tsx     # Checklist tugas, progress bar, ganti tugas N
│   │   │   ├── FormulaClues.tsx     # Clue rumus: Disarankan / Boleh / Dilarang
│   │   │   ├── AnswerKeySection.tsx # Kunci jawaban akordeon tersembunyi
│   │   │   ├── PortfolioSection.tsx # Brief klien, deliverables, rubrik, README template
│   │   │   ├── PDFExportSection.tsx # Download PDF Soal & Kunci (posisi paling bawah)
│   │   │   ├── HistoryModal.tsx     # Modal riwayat soal tersimpan
│   │   │   └── SettingsModal.tsx    # Modal input BYOK Groq API Key
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

3. (Opsional) Salin file lingkungan dan isi API Key OpenAI (ChatGPT):
   ```bash
   cp .env.example .env.local
   ```
   Isi `OPENAI_API_KEY=sk-...` di `.env.local` jika ingin menggunakan server proxy default. Jika tidak diisi, Anda tetap dapat memasukkan API Key langsung di UI (tombol "API Key" di navbar) atau menikmati studi kasus fallback offline secara langsung.

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

### Opsi 1: Menggunakan Vercel CLI
```bash
npm install -g vercel
vercel
```
Jika diminta environment variables, tambahkan:
- Key: `OPENAI_API_KEY`
- Value: `<your_openai_api_key>` (opsional jika user menggunakan mode BYOK)

### Opsi 2: Menggunakan Git / GitHub Integration
1. Push repositori ini ke GitHub / GitLab.
2. Buka dashboard [Vercel](https://vercel.com/) dan klik **Add New Project**.
3. Import repositori ini.
4. Pada bagian **Environment Variables**, tambahkan:
   - `OPENAI_API_KEY`: Kunci API OpenAI dari [OpenAI Platform](https://platform.openai.com/api-keys)
5. Klik **Deploy**. Aplikasi akan live dalam hitungan detik.

---

## 🏆 Nilai Plus untuk Portofolio

Aplikasi ini mendemonstrasikan kapabilitas teknis end-to-end:
- **Full-Stack Separation**: Pemisahan modular antara serverless backend logic dan client-side presentation layer.
- **AI Structured JSON Enforcement**: Output AI dikontrol ketat melalui Zod runtime validation dengan automatic retry mechanism jika format tidak sesuai.
- **Formula Rule Engine**: Verifikasi internal untuk mencegah rumus terlarang (`forbidden`) maupun rumus versi modern pada versi Excel legacy.
- **Deterministic Data Synthesis**: Menghasilkan dataset ber-seed secara murni melalui kode sehingga link download selalu valid dan bebas halusinasi AI.
- **Client-Side Heavy Operations**: Pembuatan XLSX, CSV, dan PDF seluruhnya diproses di peramban pengguna untuk efisiensi beban komputasi server.
