# Audit Generate Groq

## Perbaikan alur generate (2026-11)

- Klik baru selalu membuat seed UUID server yang berbeda; seed tidak lagi dapat dipakai ulang dari payload generate. Dataset Faker tetap deterministik terhadap seed agar tautan kasus yang tersimpan bisa dibagikan.
- Tema/angle dipilih dari daftar khusus role, dan hingga tujuh tema terakhir dari riwayat lokal dikirim untuk mencegah pengulangan.
- Route generate menetapkan `force-dynamic`, `revalidate = 0`, dan `Cache-Control: no-store`; fetch browser memakai `cache: 'no-store'`.
- Semua panggilan pembuatan kasus, kunci, dan regenerate meminta JSON mode. Field struktural yang wajib hilang ditolak; tugas/rumus dummy tidak dibuat untuk menutupi respons AI yang tidak lengkap.
- Generate semua level kini berjalan dalam dua tahap serial: soal/dataset, lalu formula clues dan kunci jawaban. String diminta satu baris dan di-escape; formula jawaban dikirim tanpa `=` dan aplikasi menambahkan awalan setelah validasi.
- Respons tahap kedua menormalisasi wrapper `data`/`result` dan alias formula-clue sebelum validasi. Bila schema clue gagal, log server mencatat output model mentah, key respons, dan rincian issue Zod; prompt memberi contoh bentuk `formulas`/`answerKey` yang wajib.
- Jika Groq menolak JSON mode dengan HTTP 400 dan `failed_generation`, server mencatat output mentah, pesan parse diagnostik, panjang output, dan max token. Akar insiden terdahulu belum dapat dipastikan tanpa `failed_generation` dari log produksi; output tanpa penutup object mengarah ke truncation, sedangkan kegagalan parse di tengah string/escape mengarah ke JSON tidak ter-escape.
- Error khusus 400 JSON-validation mencoba ulang satu kali dengan instruksi “Output sebelumnya JSON tidak valid, ulangi dengan JSON valid saja”; 429 tidak pernah diulang. Respons JSON berisi teks tambahan dicoba parse langsung lalu dengan ekstraksi object pertama sampai terakhir, dan hasilnya divalidasi dengan Zod.
- Kasus lama dihapus dari tampilan ketika generate dimulai. Error HTTP 429, error provider, parse JSON, dan schema tampil di UI. Loading state dan key seed memaksa tampilan hasil baru di-mount ulang.
- Fallback model yang dikonfigurasi pada alur Generate hanya dicoba untuk HTTP 5xx; respons 429 tidak memicu fallback atau retry. Error lain tidak mengganti model secara diam-diam. Jika fallback tidak dikonfigurasi, error asli ditampilkan.
- Log `[generate]` di browser dan server berisi request ID, pilihan role/industri/level, jumlah tema terakhir, seed, tema terpilih, judul, dan jumlah tugas. Jangan memasukkan API key atau isi prompt ke log.
- Model default sekarang `llama-3.1-8b-instant`; `GROQ_MODEL` dapat memilih model lain. Perbaikan validasi dibatasi satu retry, dan batas token output diturunkan lagi; detail angka aktif ada di `src/shared/generation-config.ts`.
- Jeda 5 detik di server dan cooldown sukses di UI dihapus. Batas aplikasi 15 permintaan Generate valid/menit tetap ada, tetapi memakai `APP_RATE_LIMITED` agar tidak tertukar dengan 429 Groq (`AI_RATE_LIMITED`).
- Untuk 429 Groq, log server menyertakan status, `Retry-After`, dan seluruh header `x-ratelimit-*`. UI countdown hanya memakai `Retry-After` atau reset header yang tersedia; tidak ada lagi fallback 30 detik yang menyesatkan.
- Sukses normal semua level memakai dua panggilan Groq serial. Tanpa fallback, setiap tahap dapat sekali repair; maksimal empat panggilan provider per Generate. Fallback yang dikonfigurasi dapat menambah satu panggilan serial per tahap hanya pada 5xx, tidak pada 429. Advance mempertahankan soal tervalidasi jika tahap formula gagal, agar dapat dicoba ulang.
- Batas `max_tokens` aktif: Easy 2.000 (repair 2.400, formula+kunci 1.200), Middle 2.400 (repair 2.800, formula+kunci 1.600), Advance 2.400 (repair 2.800; tahap soal 2.200 dan formula+kunci 1.800).

## Baseline kode sebelum optimasi (historis)

- Sebelum fase 2, satu klik dapat menjalankan sampai tiga percobaan validasi; error 400 tertentu juga dapat menambah panggilan provider untuk retry format JSON.
- Dengan kondisi tersebut, batas historis adalah sampai enam panggilan provider untuk model utama saja, atau sembilan jika model fallback berbeda dan seluruh respons memicu retry format JSON.
- Angka-angka tersebut adalah baseline historis, bukan batas kode sekarang. Lihat bagian “Resilience fase 2”.

## Konfigurasi kode setelah fase 1 (catatan historis)

- Batas output saat fase 1: Easy 1.200, Middle 1.800, Advance 2.500 token.
- Batas output regenerate saat fase 1: Easy 800, Middle 1.000, Advance 1.200 token.
- Jumlah tugas: Easy 3–4, Middle 4–5, Advance 4–5.
- Model utama: `GROQ_MODEL`, default `openai/gpt-oss-120b`. Dibaca pada `src/backend/ai-client.ts`.
- Model fallback: `GROQ_FALLBACK_MODEL`, default sama dengan model utama. Fallback hanya aktif jika nilainya berbeda.
- API key: hanya `GROQ_API_KEY` dari environment server. Key tidak dicatat dalam log.
- Batas API internal generate: 15 request/menit per IP; regenerate: 20 request/menit per IP. Guard tambahan membatasi tiap klien satu request setiap 5 detik pada instance yang sama. Ini bukan limit kuota Groq dan state-nya tidak dibagi antar-instance Vercel.

## Audit limit, error, dan penggunaan key (2026-11)

- Pesan “Batas penggunaan AI tercapai. Coba lagi setelah batas Groq direset” berasal dari catch HTTP 429 provider Groq; limiter aplikasi memakai pesan berbeda. Pesan lama menyembunyikan header dan memakai countdown fallback 30 detik saat `Retry-After` kosong.
- Key hanya dibaca server melalui `process.env.GROQ_API_KEY`; key browser BYOK lama dibersihkan, dan tidak ada key yang di-hardcode pada kode aplikasi. `/api/health` hanya memastikan variabel tersedia, bukan memvalidasi key atau kuota.
- Status 401, 429, 5xx, dan output JSON tidak valid dipetakan ke pesan/kode UI terpisah. Penggantian key yang menghasilkan 429 perlu diperiksa pada quota/usage Groq; untuk Vercel, pastikan environment yang benar dan redeploy.

## Instrumentasi

Setiap respons provider mencatat JSON log `groq_completion` di log fungsi server:

- `requestId`, `level`, `callNumber` (percobaan AI di service), `providerCallNumber` (panggilan provider di dalam percobaan), `model`, dan status HTTP.
- Untuk respons sukses: object `usage` berisi `prompt_tokens`, `completion_tokens`, dan `total_tokens`, jika dikirim oleh Groq.
- Untuk respons gagal: pesan error Groq, `retry-after`, dan seluruh header `x-ratelimit-*` bila tersedia.

Jangan menambahkan API key, header Authorization, atau isi prompt ke log.

## Baseline token

**Belum tersedia saat audit kode.** Pengukuran membutuhkan permintaan nyata setelah instrumentasi ini dideploy ke Vercel. Setelah itu, salin nilai `usage.total_tokens` per request dari Vercel Function Logs untuk mencatat rata-rata Easy sebelum optimasi token. Jangan menganggap angka `max_tokens` sebagai pemakaian aktual.

## Optimasi fase 1 (catatan historis)

- Batas output konfigurasi saat fase ini: Easy 1.200, Middle 1.800, Advance 2.500 token.
- Jumlah tugas: Easy 3–4, Middle 4–5, Advance 4–5.
- Hint dan penjelasan kunci dibatasi panjangnya lewat `src/shared/generation-config.ts`; prompt dipadatkan dan schema keluaran dibuat ringkas.
- Model default sekarang `openai/gpt-oss-120b`; model reasoning menerima `reasoning_effort: low`. `GROQ_MODEL` tetap dapat menimpa model default.
- Pengukuran aktual sebelum/sesudah tetap pending sampai log token produksi tersedia. Batas `max_tokens` adalah batas keluaran, bukan token aktual yang digunakan.

## Resilience fase 2 (perilaku historis sebelum audit limit)

- Validasi/format dapat memicu maksimal satu repair, sehingga jalur satu-tahap (Easy/Middle) memiliki paling banyak dua percobaan generate utama.
- Mode JSON dimatikan pada fase historis ini; pada perbaikan alur generate terbaru, JSON mode diaktifkan untuk semua panggilan pembuatan konten.
- Fallback 429 saja adalah perilaku historis; perbaikan terbaru juga mencoba fallback yang dikonfigurasi untuk respons 5xx.
- API mengembalikan `code: RATE_LIMITED` dan `retryAfterSeconds`; UI menampilkan countdown dan menonaktifkan tombol sementara.
- Guard in-memory membatasi permintaan per klien ke satu setiap 5 detik pada instance yang sama. Vercel serverless dapat memakai instance berbeda, sehingga guard ini bukan limiter global.
- Regenerate tugas memakai format error, countdown, guard, dan fallback 429 yang sama.

## Generate bertahap fase 3 (catatan historis)

- Advance: tahap kasus/tugas maksimal 1.800 token, lalu tahap kunci maksimal 700 token saat fase ini.
- Portfolio pernah memakai tahap brief dan rubrik terpisah, tetapi level Portfolio kemudian dihapus.
- Kegagalan tahap kunci setelah skenario/tugas berhasil tidak membuang kasus. Status `answerKeyStatus` menandai bagian yang belum lengkap; tombol retry memanggil `POST /api/generate-missing-content`.
- Untuk retry manual, jika tahap berikutnya gagal setelah tahap sebelumnya berhasil, response error tetap menyertakan kasus parsial. Frontend menyimpan hasil parsial itu sebelum menampilkan countdown/error.
- Kunci jawaban yang belum tersedia tidak dianggap sebagai ketidakselarasan fatal saat memuat riwayat; kunci yang sudah ada tetap divalidasi. PDF kunci menampilkan teks penanda pada baris yang belum memiliki kunci.
- Pipeline bertahap menambah jumlah panggilan normal untuk Advance dibanding Easy/Middle. Setiap tahap tetap memiliki batas token sendiri dan fallback 429 paling banyak satu percobaan ke model berbeda.

## Bank kasus cadangan fase 4 (sudah dinonaktifkan)

- Implementasi bank statis fase ini sudah dihapus. Semua generate kasus harus berhasil dari Groq; tidak ada template kasus lokal sebagai pengganti respons AI.
- Jika kuota Groq habis, endpoint mengembalikan error 429 agar sumber hasil tetap transparan.

## Pemantauan fase 5

- Event `groq_completion` kini menyertakan timestamp ISO UTC. Kegagalan transport juga dicatat sebagai event dengan `status: null`; tidak ada API key, header Authorization, atau isi prompt di event.
- `npm run report:groq -- <path-log-jsonl>` merangkum panggilan provider per hari UTC dan level: rata-rata `usage.total_tokens`, jumlah respons gagal, tingkat gagal, dan jumlah 429.
- Tingkat gagal dihitung per panggilan provider (non-2xx atau transport), bukan per klik pengguna. Rata-rata token menghitung respons yang menyertakan token aktual; `max_tokens` bukan pemakaian aktual.
- Laporan bersifat lokal dan dihitung dari file log JSONL yang diekspor pengguna dari Vercel. Tidak ada agregasi lintas instance atau penyimpanan/dashboard persisten.
- **Belum ada metrik produksi yang dicatat di dokumen ini.** Angka hanya dapat dihitung setelah versi dengan timestamp dideploy dan log pemakaian tersedia.

## Perbaikan keluaran JSON dan level

- Batas output dinaikkan agar cukup untuk schema kasus: Easy 2.200, Middle 2.800, Advance 2.600 untuk tahap kasus dan 1.200 untuk tahap kunci.
- Jika Groq menyatakan output terpotong (`finish_reason: length`) atau respons gagal diparse sebagai JSON, generate mencoba ulang maksimal dua kali dengan instruksi JSON ringkas dan batas token perbaikan lebih besar.
- Level Portfolio dihapus dari schema, form, fallback, bank kasus, prompt, dan export. Kasus Portfolio lama di riwayat browser dibuang saat riwayat dimuat; pilihan level tersimpan yang lama kembali ke Easy.
- Jika schema atau pemeriksaan keselarasan role/industri/tugas/rumus gagal, aplikasi kini menyertakan daftar masalah dan peta kolom pada prompt perbaikan, lalu meminta Groq membuat ulang kasus sampai dua kali. Tidak ada fallback ke kasus statis lokal; bila semua percobaan gagal, error validasi ditampilkan.
- Semua prompt generate, prompt fallback serverless, prompt kunci bertahap, dan prompt regenerate sekarang menjelaskan format metadata dataset dengan tipe yang konsisten. Server menormalisasi range angka/tanggal yang valid dan mengabaikan metadata range opsional yang salah tipe sebelum validasi; range tanggal harus ISO valid dan semua range harus berurutan.
- Halaman baru tidak menampilkan contoh studi kasus lokal. Baris data dataset tetap dibangkitkan secara deterministik di browser dari skema dataset yang dihasilkan AI.

## Integritas dataset: registry tipe tertutup + validasi wajib (2026-11)

Insiden: kolom `Jam_Masuk`/`Jam_Pulang` terisi kata Latin acak (fallback `faker.lorem` untuk kolom tak dikenal) dan kolom `Cuti` menyimpan angka sebagai teks. Perbaikan menyeluruh:

- **Registry tipe kolom tertutup** di `src/lib/column-types.ts`: `time`, `integer`, `decimal`, `currency`, `date`, `dateAfter`, `name`, `category`, `id`, `text`, `derived`. Skema dataset dari AI/template hanya boleh memakai tipe ini (divalidasi Zod). Tidak ada lagi tipe bebas.
- **Fallback teks acak dihapus.** `generateCellValue` tidak lagi punya jalur `faker.lorem`; kolom tak dikenal melempar `UnknownColumnTypeError` yang menyebut nama kolomnya (hard error, HTTP 422 `UNKNOWN_COLUMN_TYPE`).
- **Pemetaan nama kolom umum** (`COLUMN_NAME_RULES`) menjamin `Jam_Masuk`/`Jam_Pulang` → `time`, `Cuti` → `integer`, `Stok_Akhir` → `derived`, `Tanggal_Kedaluwarsa` → `dateAfter`, `Gudang`/`Kategori`/`Produk` → `category`, dll.
- **Faker locale `id_ID`** (`new Faker({ locale: [id_ID, en] })`) dengan seed unik per generate (`cyrb53`).
- **`validateDataset(dataset, rows)`** (`src/shared/dataset-validation.ts`) dijalankan sebelum dataset dipakai prompt, UI, atau export: tipe sel (angka harus `typeof number`, bukan string), format jam `HH:mm`, rentang numerik, tanggal ISO, aturan antar kolom (`Jam_Pulang > Jam_Masuk`, `Stok_Akhir = Stok_Awal + Stok_Masuk - Stok_Keluar`, `Tanggal_Kedaluwarsa > Tanggal`, kolom `derived`), kata lorem Latin, dan sel kosong tak sengaja.
- **Jebakan data (traps) tetap ada** sebagai tantangan, tetapi sekarang **terdeklarasi + deterministik** (`dataset.traps`). `validateDataset` hanya meloloskan penyimpangan yang benar-benar terdaftar sebagai jebakan; penyimpangan lain dianggap error.
- **Regenerate dengan seed baru maksimal 3×** (`buildValidatedDataset`, `DATASET_VALIDATION_MAX_ATTEMPTS`). Jika tetap gagal, `DatasetValidationError` (HTTP 422 `DATASET_VALIDATION_ERROR`) ditampilkan di UI. Dataset yang gagal validasi tidak pernah ditampilkan.
- **Satu sumber kebenaran:** prompt-repair, UI, export, dan perhitungan kunci jawaban memakai baris + kolom kanonik + seed yang sama (`buildDataset`/`buildValidatedDataset`).
- **Export CSV/XLSX** menulis sel bertipe: angka sebagai `number` (`t: 'n'`), tanggal sebagai `Date` (`t: 'd'`, format `yyyy-mm-dd`), jam konsisten `HH:mm`; sel jebakan yang terdeklarasi dibiarkan apa adanya.
- **Perbaikan bug** `columnTypeToCellKind`: kolom `derived` kini dipetakan ke sel `number` (sebelumnya keliru `text` sehingga validasi menolak `Stok_Akhir`).
- **Tes Vitest** (`npm test`, `tests/dataset-validation.test.ts`): matriks **300 seed** di semua level × industri × variasi skema → `validateDataset` selalu lolos dan tidak ada kata lorem; kolom tak dikenal gagal dengan pesan yang menyebut nama kolom; determinisme seed; dan `validateDataset` menolak angka-sebagai-teks serta lorem yang tidak dideklarasikan.

