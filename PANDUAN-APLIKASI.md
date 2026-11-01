# Panduan Aplikasi Excel Admin Studio

## Gambaran Umum

Excel Admin Studio adalah aplikasi web untuk membuat latihan studi kasus Microsoft Excel yang relevan dengan pekerjaan administrasi. Pengguna memilih level, jenis pekerjaan admin, industri, versi Excel, dan opsi latihan; aplikasi kemudian meminta Groq membuat skenario, tugas, petunjuk, target, serta kunci jawaban.

Dataset dibuat oleh aplikasi berdasarkan skema kasus dan seed, bukan dihasilkan oleh model AI. Dengan seed yang sama, baris dataset dapat dibuat kembali secara konsisten di browser.

## Fitur Utama

### Level latihan

- **Easy** — rumus dasar, logika sederhana, pengurutan, dan filter.
- **Middle** — rekap bersyarat, lookup, manipulasi teks, serta validasi data.
- **Advance** — rumus multi-kriteria, analisis data, Pivot Table, dan pemformatan bersyarat.
- **Portfolio** — tantangan lebih menyeluruh yang dapat mencakup brief klien, deliverable, rubrik, dan dashboard.

Rumus yang disarankan dan dilarang disesuaikan dengan level. Pengguna juga dapat memilih target kompatibilitas Microsoft 365 atau Excel 2016/2019.

### Pekerjaan dan industri

Latihan dapat disesuaikan untuk pekerjaan seperti admin penjualan, gudang/inventory, HRD/absensi, keuangan/kasir, pengadaan, sekretariat, dan operasional. Pilihan industri menentukan konteks perusahaan dan jenis data yang digunakan.

### Tugas dan kunci jawaban

Setiap tugas berisi instruksi, petunjuk, dan target hasil. Kunci jawaban dapat dibuka per tugas atau sekaligus. Progress tugas tersimpan di browser. Jika satu tugas tidak sesuai, pengguna dapat meminta aplikasi membuat ulang tugas itu tanpa mengganti seluruh kasus.

Sebelum kasus AI digunakan, aplikasi memeriksa struktur dan keselarasan tugas dengan kunci, termasuk beberapa kriteria, kolom yang disebut, fungsi yang dilarang, dan referensi sheet yang tidak tersedia. Pemeriksaan otomatis membantu mengurangi ketidaksesuaian, tetapi hasil tetap sebaiknya diperiksa sebelum dipakai sebagai materi penilaian.

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
- Model utama default adalah `openai/gpt-oss-120b`; model dapat dikonfigurasi melalui `GROQ_MODEL`.
- `GROQ_FALLBACK_MODEL` dapat digunakan untuk menentukan model alternatif Groq. Sebaiknya berbeda dari model utama; jika tidak disetel, fallback dinonaktifkan.
- Model dengan nama `gpt-oss` dikirim dengan `reasoning_effort: low`.
- Jumlah tugas dibatasi per level untuk mengurangi ukuran respons: Easy 3–4, Middle 4–5, Advance 4–5. Portfolio masih memakai batas yang lebih besar.
- OpenAI tidak digunakan sebagai provider atau fallback.
- Jika Groq mengembalikan error 429, permintaan tidak diulang otomatis oleh layanan generate. Artinya, pengguna perlu mengikuti alasan atau waktu reset yang diberikan Groq dan memeriksa penggunaan/limit di akun Groq.
- Jika model utama mendapat 429 dan `GROQ_FALLBACK_MODEL` berbeda, aplikasi mencoba model cadangan satu kali. Saat 429 terakhir terjadi, API mengirim countdown dan tombol generate/regenerate dinonaktifkan sementara.
- Respons yang gagal validasi hanya diperbaiki maksimal satu kali. Tombol juga memiliki guard klik ganda dan server membatasi permintaan beruntun per IP pada instance yang sama.
- Endpoint `/api/health` hanya melaporkan apakah `GROQ_API_KEY` tersedia di deployment; endpoint tersebut tidak menguji validitas key, kuota, atau akses ke model.

### Menyiapkan Groq di Vercel

1. Buka **Vercel → Project → Settings → Environment Variables**.
2. Tambahkan variabel bernama `GROQ_API_KEY` dengan API key dari Groq.
3. Pilih environment yang digunakan, misalnya **Production** atau **Preview**.
4. Simpan perubahan dan redeploy agar deployment baru membaca nilai tersebut.
5. Buka `/api/health` pada domain aplikasi. `ready: true` berarti variabel tersedia, bukan berarti kuota API masih ada.
6. Jika generate tetap gagal dengan 429, periksa detail error serta Usage/Limits dan status model di Groq Console.

Jangan membagikan API key melalui chat, screenshot, atau repositori publik. Jika key pernah terekspos, cabut key tersebut di Groq dan buat key baru.

## Menjalankan Secara Lokal

Prasyarat: Node.js dan npm.

1. Pasang dependensi:

   ```bash
   npm install
   ```

2. Buat file `.env.local` di root proyek dan isi:

   ```env
   GROQ_API_KEY=gsk_...
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
