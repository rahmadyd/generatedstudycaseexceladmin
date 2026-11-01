# Audit Generate Groq

## Baseline kode sebelum optimasi (historis)

- Sebelum fase 2, satu klik dapat menjalankan sampai tiga percobaan validasi; error 400 tertentu juga dapat menambah panggilan provider untuk retry format JSON.
- Dengan kondisi tersebut, batas historis adalah sampai enam panggilan provider untuk model utama saja, atau sembilan jika model fallback berbeda dan seluruh respons memicu retry format JSON.
- Angka-angka tersebut adalah baseline historis, bukan batas kode sekarang. Lihat bagian “Resilience fase 2”.

## Konfigurasi kode setelah fase 1

- Batas output generate: Easy 1.200, Middle 1.800, Advance 2.500, Portfolio 7.500 token.
- Batas output regenerate: Easy 800, Middle 1.000, Advance 1.200, Portfolio 1.800 token.
- Jumlah tugas: Easy 3–4, Middle 4–5, Advance 4–5, Portfolio 5–20.
- Model utama: `GROQ_MODEL`, default `openai/gpt-oss-120b`. Dibaca pada `src/backend/ai-client.ts`.
- Model fallback: `GROQ_FALLBACK_MODEL`, default sama dengan model utama. Fallback hanya aktif jika nilainya berbeda.
- API key: hanya `GROQ_API_KEY` dari environment server. Key tidak dicatat dalam log.
- Batas API internal generate: 15 request/menit per IP; regenerate: 20 request/menit per IP. Guard tambahan membatasi tiap klien satu request setiap 5 detik pada instance yang sama. Ini bukan limit kuota Groq dan state-nya tidak dibagi antar-instance Vercel.

## Instrumentasi

Setiap respons provider mencatat JSON log `groq_completion` di log fungsi server:

- `requestId`, `level`, `callNumber` (percobaan AI di service), `providerCallNumber` (panggilan provider di dalam percobaan), `model`, dan status HTTP.
- Untuk respons sukses: object `usage` berisi `prompt_tokens`, `completion_tokens`, dan `total_tokens`, jika dikirim oleh Groq.
- Untuk respons gagal: pesan error Groq, `retry-after`, serta header remaining/reset request dan token bila tersedia.

Jangan menambahkan API key, header Authorization, atau isi prompt ke log.

## Baseline token

**Belum tersedia saat audit kode.** Pengukuran membutuhkan permintaan nyata setelah instrumentasi ini dideploy ke Vercel. Setelah itu, salin nilai `usage.total_tokens` per request dari Vercel Function Logs untuk mencatat rata-rata Easy sebelum optimasi token. Jangan menganggap angka `max_tokens` sebagai pemakaian aktual.

## Optimasi fase 1

- Batas output konfigurasi: Easy 1.200, Middle 1.800, Advance 2.500 token; Portfolio 7.500 token sebagai total batas output yang kini dibagi ke tahap terpisah.
- Jumlah tugas: Easy 3–4, Middle 4–5, Advance 4–5. Portfolio tetap dapat dipilih 5–20 tugas.
- Hint dan penjelasan kunci dibatasi panjangnya lewat `src/shared/generation-config.ts`; prompt dipadatkan dan schema keluaran dibuat ringkas.
- Model default sekarang `openai/gpt-oss-120b`; model reasoning menerima `reasoning_effort: low`. `GROQ_MODEL` tetap dapat menimpa model default.
- Pengukuran aktual sebelum/sesudah tetap pending sampai log token produksi tersedia. Batas `max_tokens` adalah batas keluaran, bukan token aktual yang digunakan.

## Resilience fase 2

- Validasi/format dapat memicu maksimal satu repair, sehingga jalur satu-tahap (Easy/Middle) memiliki paling banyak dua percobaan generate utama.
- Mode JSON provider dimatikan secara default; prompt tetap meminta JSON dan hasilnya tetap melewati Zod serta pemeriksaan bisnis. Ini menghindari error `Failed to generate JSON` dan panggilan retry tambahan.
- Jika model utama mengembalikan 429, aplikasi mencoba satu kali dengan `GROQ_FALLBACK_MODEL` yang berbeda. Percobaan fallback tidak diulang pada repair.
- API mengembalikan `code: RATE_LIMITED` dan `retryAfterSeconds`; UI menampilkan countdown dan menonaktifkan tombol sementara.
- Guard in-memory membatasi permintaan per klien ke satu setiap 5 detik pada instance yang sama. Vercel serverless dapat memakai instance berbeda, sehingga guard ini bukan limiter global.
- Regenerate tugas memakai format error, countdown, guard, dan fallback 429 yang sama.

## Generate bertahap fase 3

- Advance: tahap kasus/tugas maksimal 1.800 token, lalu tahap kunci maksimal 700 token.
- Portfolio: tahap kasus/tugas 4.000 token, kunci 1.700, brief/deliverable 900, dan rubrik 900 token. Setiap batas berada di `src/shared/generation-config.ts`.
- Kegagalan tahap setelah skenario/tugas berhasil tidak membuang kasus. Status `answerKeyStatus`/`portfolioStatus` menandai bagian yang belum lengkap; tombol retry memanggil `POST /api/generate-missing-content` dan melanjutkan hanya tahap yang belum selesai.
- Untuk retry manual, jika tahap berikutnya gagal setelah tahap sebelumnya berhasil, response error tetap menyertakan kasus parsial. Frontend menyimpan hasil parsial itu sebelum menampilkan countdown/error.
- Kunci jawaban yang belum tersedia tidak dianggap sebagai ketidakselarasan fatal saat memuat riwayat; kunci yang sudah ada tetap divalidasi. PDF kunci menampilkan teks penanda pada baris yang belum memiliki kunci.
- Pipeline bertahap menambah jumlah panggilan normal untuk Advance/Portfolio dibanding Easy/Middle. Setiap tahap tetap memiliki batas token sendiri dan fallback 429 paling banyak satu percobaan ke model berbeda.
