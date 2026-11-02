# Panduan Aplikasi Excel Admin Studio

## Gambaran Umum

Excel Admin Studio adalah aplikasi web untuk membuat latihan studi kasus Microsoft Excel yang relevan dengan pekerjaan administrasi. Pengguna memilih level, jenis pekerjaan admin, industri, versi Excel, dan opsi latihan; aplikasi meminta Groq membuat soal dan dataset terlebih dahulu, lalu meminta clue formula dan kunci jawaban.

Dataset dibuat oleh aplikasi berdasarkan skema kasus dan seed, bukan dihasilkan oleh model AI. Dengan seed yang sama, baris dataset dapat dibuat kembali secara konsisten di browser.

## Fitur Utama

### Level latihan

- **Easy** — rumus dasar, logika sederhana, pengurutan, dan filter.
- **Middle** — rekap bersyarat, lookup, manipulasi teks, serta validasi data.
- **Advance** — rumus multi-kriteria, analisis data, Pivot Table, dan pemformatan bersyarat.
Pembuatan soal dan dataset dipisahkan dari clue formula dan kunci jawaban dalam dua panggilan berurutan pada semua level agar setiap respons JSON lebih ringkas.

Rumus yang disarankan dan dilarang disesuaikan dengan level. Pengguna juga dapat memilih target kompatibilitas Microsoft 365 atau Excel 2016/2019.

### Pekerjaan dan industri

Latihan dapat disesuaikan untuk pekerjaan seperti admin penjualan, gudang/inventory, HRD/absensi, keuangan/kasir, pengadaan, sekretariat, dan operasional. Pilihan industri menentukan konteks perusahaan dan jenis data yang digunakan.

### Tugas dan kunci jawaban

Setiap tugas berisi instruksi, petunjuk, dan target hasil. Kunci jawaban dapat dibuka per tugas atau sekaligus. Progress tugas tersimpan di browser. Jika satu tugas tidak sesuai, pengguna dapat meminta aplikasi membuat ulang tugas itu tanpa mengganti seluruh kasus.

Sebelum kasus AI digunakan, aplikasi memeriksa struktur dan keselarasan tugas dengan kunci, termasuk beberapa kriteria, kolom yang disebut, fungsi yang dilarang, dan referensi sheet yang tidak tersedia. Pemeriksaan otomatis membantu mengurangi ketidaksesuaian, tetapi hasil tetap sebaiknya diperiksa sebelum dipakai sebagai materi penilaian.

Jika tahap kunci jawaban gagal, skenario, dataset, dan tugas yang sudah berhasil dibuat tetap ditampilkan dan disimpan di riwayat. Kunci yang belum tersedia ditandai pada halaman tugas; gunakan tombol **Coba lengkapi sekarang** untuk mengulang bagian tersebut saja.

### Dataset dan unduhan

Dataset ditampilkan sebagai preview dan dapat diunduh sebagai:

- Excel (`.xlsx`)
- CSV (`.csv`)
- PDF soal dan PDF kunci jawaban secara terpisah

Beberapa kasus juga dapat memasukkan data trap untuk latihan membersihkan data, misalnya spasi tambahan atau angka yang tersimpan sebagai teks.

### Riwayat dan berbagi

Kasus yang berhasil dibuat tersimpan di riwayat browser. Pengguna dapat membuka kembali kasus dari riwayat dan membagikan tautan berbasis seed. Tautan seed dapat memulihkan kasus yang sudah ada di riwayat lokal. Jika kasusnya tidak tersedia, aplikasi tidak membuat kasus baru secara otomatis; pengguna tetap perlu menekan tombol **Generate**.

## Cara Menggunakan

1. Buka aplikasi dan pilih level latihan.
2. Pilih pekerjaan admin dan industri yang diinginkan.
3. Pilih versi Excel dan, bila perlu, buka opsi tambahan untuk format rumus.
4. Tekan **Generate Soal Studi Kasus** untuk membuat kasus. Membuka atau me-refresh halaman tidak mengirim permintaan generate.
5. Pelajari skenario dan dataset, lalu unduh dataset bila ingin mengerjakan di Excel.
6. Selesaikan tugas dan tandai progress. Buka kunci jawaban setelah mencoba sendiri.
7. Unduh PDF soal dan kunci bila membutuhkan dokumen untuk dicetak atau dibagikan.

## Cara Kerja AI dan API Key

- Aplikasi mengirim permintaan generate dari server ke endpoint Groq.
- Provider menggunakan environment variable server **`GROQ_API_KEY`**. API key tidak perlu dimasukkan di browser.
- Pengaturan API key browser yang lama sudah dihapus; saat aplikasi dibuka, key lama yang tersimpan di `localStorage` dibersihkan.
- Soal, schema dataset, clue formula, dan kunci jawaban dihasilkan oleh AI dalam dua tahap berurutan. Aplikasi tidak memakai bank kasus atau template lokal sebagai hasil generate pengganti. Jika AI tetap menghasilkan output yang tidak valid/tidak selaras setelah satu kali perbaikan, aplikasi menampilkan error.
- Baris-baris dataset diisi secara deterministik di browser berdasarkan schema kolom dari AI dan seed kasus; setiap klik generate baru mendapat seed UUID unik, sedangkan seed yang dibagikan tetap menghasilkan dataset yang sama.
- Tema kasus dipilih dari daftar yang sesuai dengan bidang admin dan dibandingkan dengan tema pada riwayat lokal terbaru untuk mengurangi pengulangan.
- Endpoint generate POST memakai `force-dynamic`, `revalidate = 0`, dan cache browser `no-store`.
- Respons AI diminta dalam JSON mode; JSON diekstrak langsung atau dari batas object pertama/terakhir, lalu divalidasi dengan Zod. Field wajib yang hilang ditolak, bukan diisi dengan tugas/rumus placeholder. Error 400 JSON-validation, 401, 429, 5xx, dan parse JSON dibedakan di UI. Kasus lama dibersihkan saat generate dimulai.
- Prompt meminta output strict JSON tanpa Markdown, string satu baris yang di-escape, dan formula jawaban tanpa `=`; aplikasi menambahkan `=` setelah validasi.
- Model utama default adalah `llama-3.1-8b-instant`; model dapat dikonfigurasi melalui `GROQ_MODEL`.
- `GROQ_FALLBACK_MODEL` dapat digunakan untuk menentukan model alternatif Groq. Sebaiknya berbeda dari model utama; jika tidak disetel, fallback dinonaktifkan.
- Model dengan nama `gpt-oss` dikirim dengan `reasoning_effort: low`.
- Jumlah tugas dibatasi per level untuk mengurangi ukuran respons: Easy 3–4, Middle 4–5, Advance 4–5.
- OpenAI tidak digunakan sebagai provider atau fallback.
- Untuk alur Generate, fallback model yang berbeda hanya dicoba satu kali pada respons 5xx; respons 429 langsung ditampilkan tanpa retry/fallback. Endpoint AI lain dapat memakai kebijakan fallback masing-masing. Jika fallback dijalankan tetapi tetap gagal, error ditampilkan.
- Error 401 (key ditolak), 429 dari Groq (kuota/rate limit), 5xx (gangguan provider), dan JSON tidak valid memiliki pesan UI berbeda. Untuk 429, server mencatat status, `Retry-After`, dan header `x-ratelimit-*`; countdown hanya memakai estimasi reset dari header provider, bukan angka fallback.
- 429 dari perlindungan aplikasi diberi pesan dan kode `APP_RATE_LIMITED`, terpisah dari `AI_RATE_LIMITED` milik Groq. Batas aplikasi adalah 15 permintaan Generate valid per menit per IP pada instance server; tidak ada jeda 5 detik atau cooldown UI setelah Generate sukses.
- Untuk semua level, kegagalan generate ditampilkan di aplikasi. Jika kasus Advance berhasil dibuat tetapi tahap kunci gagal, kasus tetap tersedia dan kuncinya dapat dicoba ulang.
- Jika JSON, schema, atau keselarasan rumus/role/industri gagal, prompt diperbaiki berdasarkan error dan dikirim ulang ke Groq maksimal satu kali. Jika tetap gagal, error ditampilkan dan tidak ada kasus lokal yang disajikan. Tombol juga memiliki guard klik ganda.
- Kunci PDF tetap dapat diunduh meski sebagian kunci belum tersedia; baris terkait diberi penanda **Kunci jawaban belum tersedia**.
- Endpoint `/api/health` hanya melaporkan apakah `GROQ_API_KEY` tersedia di deployment; endpoint tersebut tidak menguji validitas key, kuota, atau akses ke model.

### Ringkasan log pemakaian

- Setiap respons Groq dicatat sebagai event `groq_completion` dengan timestamp UTC. Kegagalan transport juga dicatat; API key, header Authorization, dan isi prompt tidak dicatat.
- Untuk membuat ringkasan harian, ekspor log JSONL dari Vercel lalu jalankan `npm run report:groq -- "C:\path\to\vercel-groq-logs.jsonl"` di proyek lokal.
- Laporan menampilkan rata-rata token per level, tingkat gagal panggilan provider, serta jumlah respons 429 per hari UTC. Tingkat gagal menghitung respons non-2xx dan kegagalan transport; rata-rata token hanya menghitung respons dengan `usage.total_tokens`.
- Ringkasan dibuat dari file yang dipilih, tidak disimpan sebagai dashboard, dan tidak mengagregasi data lintas deployment secara otomatis. Tanpa timestamp, log dikelompokkan sebagai `tanpa-tanggal`.

### Menyiapkan Groq di Vercel

1. Buka **Vercel → Project → Settings → Environment Variables**.
2. Tambahkan variabel bernama `GROQ_API_KEY` dengan API key dari Groq.
3. Pilih environment yang digunakan, misalnya **Production** atau **Preview**.
4. Simpan perubahan dan redeploy agar deployment baru membaca nilai tersebut.
5. Buka `/api/health` pada domain aplikasi. `ready: true` berarti variabel tersedia, bukan berarti kuota API masih ada.
6. Jika generate tetap gagal dengan 429, periksa detail error serta Usage/Limits dan status model di Groq Console.
7. Untuk mengurangi pemakaian model utama, set `GROQ_MODEL`. Opsional: set `GROQ_FALLBACK_MODEL` ke model Groq yang berbeda agar fallback memiliki kuota per-model tersendiri.

Jangan membagikan API key melalui chat, screenshot, atau repositori publik. Jika key pernah terekspos, cabut key tersebut di Groq dan buat key baru.

## Menjalankan Secara Lokal

Prasyarat: Node.js dan npm.

1. Pasang dependensi:

   ```bash
   npm install
   ```

2. Buat file `.env.local` di root proyek dan isi:

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```

3. Jalankan aplikasi:

   ```bash
   npm run dev
   ```

4. Buka `http://localhost:3000`.

Untuk memeriksa build produksi:

```bash
npm run build
```

## Komponen Teknis

- **Frontend:** Next.js, React, dan Tailwind CSS.
- **Backend:** Next.js Route Handlers untuk generate dan regenerate tugas.
- **AI:** Groq Chat Completions API.
- **Validasi:** Zod schema dan pemeriksaan bisnis untuk kasus, tugas, serta kunci.
- **Dataset:** Faker.js dan generator deterministik berbasis seed.
- **Ekspor:** SheetJS untuk Excel/CSV dan jsPDF untuk dokumen PDF.
- **Penyimpanan browser:** riwayat kasus, preferensi tampilan, dan progress tugas menggunakan `localStorage`.

### Endpoint aplikasi

- `POST /api/generate` — membuat satu studi kasus baru.
- `POST /api/regenerate-task` — membuat ulang satu tugas dalam kasus yang ada.
- `GET /api/health` — memeriksa konfigurasi dasar `GROQ_API_KEY`.

## Catatan Batasan

- Dataset standar untuk satu kasus dibuat dari satu skema data sumber; sheet kunci jawaban pada file ekspor adalah dokumentasi, bukan tabel sumber kedua.
- Riwayat dan progress disimpan di browser pengguna, bukan disinkronkan antarakun atau perangkat.
- Batas kuota dan rate limit ditentukan oleh Groq dan akun yang memiliki API key.
- Generator AI memerlukan koneksi jaringan dan konfigurasi Groq yang valid. Kasus contoh bawaan dapat ditampilkan tanpa generate AI.
