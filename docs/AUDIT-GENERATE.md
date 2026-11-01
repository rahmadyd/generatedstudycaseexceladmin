# Audit Generate Groq

## Temuan kode saat audit

- Satu klik Generate frontend mengirim satu HTTP `POST /api/generate`.
- Endpoint meneruskan permintaan ke `generateCaseStudyService`.
- Jika hasil lolos validasi, service selesai setelah satu panggilan AI.
- Jika JSON, skema, atau pemeriksaan keselarasan gagal, service dapat mengulang proses sampai tiga kali total (dua retry setelah panggilan awal). Error `429` dan autentikasi langsung dihentikan.
- Setiap panggilan AI dapat memakai model fallback jika `GROQ_FALLBACK_MODEL` berbeda dari `GROQ_MODEL`. Default keduanya sama, sehingga fallback model tidak aktif secara default.
- Untuk setiap model, error Groq `400` dengan pesan `Failed to generate JSON` dapat memicu satu panggilan tambahan tanpa `response_format`.
- Dengan default model yang sama, batas teoritis saat seluruh output terus gagal pada format JSON adalah hingga enam panggilan provider dalam satu klik (dua panggilan per percobaan validasi, hingga tiga percobaan validasi). Jika model fallback berbeda dan semua respons memicu jalur retry tersebut, batas kode saat ini dapat mencapai sembilan panggilan provider.
- `POST /api/regenerate-task` normalnya melakukan satu panggilan AI; fallback model dan retry JSON dapat menambah panggilan provider.
- Rate limit internal `/api/generate` adalah 15 permintaan per menit per IP pada memori instance. Ini bukan limit kuota Groq dan tidak dibagi antar-instance Vercel.

## Parameter request

- `max_tokens` generate: 3.800 untuk kurang dari 10 tugas, 5.000 untuk 10–14 tugas, dan 7.500 untuk 15 tugas atau lebih. Nilai ditetapkan pada `src/backend/task-service.ts`.
- `temperature` generate: 0,65 pada percobaan pertama, bertambah 0,1 pada tiap retry validasi. Nilai ditetapkan pada `src/backend/task-service.ts`.
- Model utama: `GROQ_MODEL`, default `llama-3.3-70b-versatile`. Dibaca pada `src/backend/ai-client.ts`.
- Model fallback: `GROQ_FALLBACK_MODEL`, default sama dengan model utama. Fallback hanya aktif jika nilainya berbeda.
- API key: hanya `GROQ_API_KEY` dari environment server. Key tidak dicatat dalam log.

## Instrumentasi

Setiap respons provider mencatat satu JSON log `groq_completion` di log fungsi server:

- `requestId`, `level`, `callNumber` (percobaan AI di service), `providerCallNumber` (panggilan provider di dalam percobaan), `model`, dan status HTTP.
- Untuk respons sukses: `prompt_tokens`, `completion_tokens`, dan `total_tokens`, jika dikirim oleh Groq.
- Untuk respons gagal: pesan error Groq, `retry-after`, serta header remaining/reset request dan token bila tersedia.

Jangan menambahkan API key, header Authorization, atau isi prompt ke log.

## Baseline token

**Belum tersedia saat audit kode.** Pengukuran membutuhkan permintaan nyata setelah instrumentasi ini dideploy ke Vercel. Setelah itu, salin nilai `usage.total_tokens` per request dari Vercel Function Logs untuk mencatat rata-rata Easy sebelum optimasi token. Jangan menganggap angka `max_tokens` sebagai pemakaian aktual.

## Optimasi fase 1

- Batas output konfigurasi: Easy 1.200, Middle 1.800, Advance 2.500 token; Portfolio tetap 7.500 sementara menunggu pemecahan tahap.
- Jumlah tugas: Easy 3–4, Middle 4–5, Advance 4–5. Portfolio tetap dapat dipilih 5–20 tugas.
- Hint dan penjelasan kunci dibatasi panjangnya lewat `src/shared/generation-config.ts`; prompt dipadatkan dan schema keluaran dibuat ringkas.
- Model default sekarang `openai/gpt-oss-120b`; model reasoning menerima `reasoning_effort: low`. `GROQ_MODEL` tetap dapat menimpa model default.
- Pengukuran aktual sebelum/sesudah tetap pending sampai log token produksi tersedia. Batas `max_tokens` adalah batas keluaran, bukan token aktual yang digunakan.
