import { normalizeExcelFormulaLocale } from '@/shared/excel-formula-locale';

export interface FormulaConditionItem {
  param: string;        // e.g. "rentang_kondisi_1" or "kondisi_logika_uji"
  actualValue: string;  // e.g. "D2:D181" or "F2>=500000"
  role: string;         // e.g. "Rentang Pengecekan Syarat"
  explanation: string;  // e.g. "Kolom tempat Excel memeriksa apakah syarat terpenuhi"
}

export interface FormulaBreakdown {
  reason: string;
  pattern: string;             // Blueprint: e.g. "=SUMIFS(rentang_jumlah; rentang_kondisi_1; kondisi_1)"
  patternDescription: string;  // Brief explanation of the blueprint
  conditions: FormulaConditionItem[];
  argumentsHelp: {
    term: string;
    label: string;
    explanation: string;
    badgeColor?: string;
  }[];
}

/**
 * Splits formula arguments inside parentheses by semicolon ';', respecting nested parentheses and quotes.
 */
function extractArguments(innerArgs: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;

  for (let i = 0; i < innerArgs.length; i++) {
    const char = innerArgs[i];

    if (char === '"' && (i === 0 || innerArgs[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
      current += char;
    } else if (!inQuotes && (char === '(' || char === '[')) {
      depth++;
      current += char;
    } else if (!inQuotes && (char === ')' || char === ']')) {
      depth--;
      current += char;
    } else if (!inQuotes && depth === 0 && char === ';') {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Analyzes an Excel formula and generates:
 * 1. Blueprint syntax pattern (e.g. SUMIFS(rentang_jumlah; rentang_kondisi_1; kondisi_1))
 * 2. Step-by-step condition breakdown mapping each parameter to its actual value & role
 * 3. Deep arguments help ($ lock, 0/FALSE exact match, semicolon, text quotes)
 */
export function analyzeFormula(rawFormula: string): FormulaBreakdown {
  const formula = normalizeExcelFormulaLocale(rawFormula).trim();
  const formulaUpper = formula.toUpperCase();

  let reason = 'Formula ini digunakan untuk menghitung dan merekap data sesuai instruksi tugas.';
  let pattern = '';
  let patternDescription = '';
  const conditions: FormulaConditionItem[] = [];
  const argumentsHelp: {
    term: string;
    label: string;
    explanation: string;
    badgeColor?: string;
  }[] = [];

  // Helper to extract inside parens of a function
  const getInner = (fnName: string): string => {
    const startIdx = formulaUpper.indexOf(fnName + '(');
    if (startIdx === -1) return '';
    const openParen = startIdx + fnName.length;
    let depth = 0;
    let endIdx = -1;
    let inQuotes = false;
    for (let i = openParen; i < formula.length; i++) {
      if (formula[i] === '"') inQuotes = !inQuotes;
      else if (!inQuotes && formula[i] === '(') depth++;
      else if (!inQuotes && formula[i] === ')') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    return endIdx !== -1 ? formula.substring(openParen + 1, endIdx) : '';
  };

  // --- 0. SUM(IF(...; 1; 0)) -> Array Counter Pattern ---
  if (formulaUpper.includes('SUM(IF(') || /SUM\s*\(\s*IF\s*\(/.test(formulaUpper)) {
    reason =
      'Menggunakan teknik Array Counter (kombinasi SUM + IF) untuk menghitung banyaknya baris yang memenuhi syarat tertentu dengan mengubah hasil logika (TRUE/FALSE) menjadi angka 1 dan 0.';
    pattern = '=SUM( IF( kondisi_syarat ; 1 ; 0 ) )';
    patternDescription =
      'Setiap baris diuji: jika kondisi bernilai BENAR (TRUE), IF memberi angka 1. Jika SALAH (FALSE), IF memberi angka 0. Kemudian SUM menjumlahkan semua angka 1 tersebut sehingga kita mendapatkan total baris yang lolos kriteria.';

    const ifInner = getInner('IF');
    const rawArgs = extractArguments(ifInner);
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'kondisi_syarat (logical_test)',
        actualValue: rawArgs[0] || '',
        role: 'Syarat yang Diuji pada Tiap Baris',
        explanation: `Excel mengecek baris demi baris: apakah sel bernilai ${rawArgs[0] || ''}? Baris yang cocok menghasilkan Benar (TRUE), yang tidak cocok menghasilkan Salah (FALSE).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'nilai_jika_benar (angka 1)',
        actualValue: rawArgs[1] || '1',
        role: 'Dihitung 1 Kali (+1)',
        explanation: 'Fungsi angka 1: Jika baris tersebut memenuhi syarat, berikan angka 1 agar saat di-SUM baris ini terhitung 1 kali.',
      });
    }
    if (rawArgs.length > 2) {
      conditions.push({
        param: 'nilai_jika_salah (angka 0)',
        actualValue: rawArgs[2] || '0',
        role: 'Diabaikan / Tidak Dihitung (+0)',
        explanation: 'Fungsi angka 0: Jika baris tersebut TIDAK memenuhi syarat, berikan angka 0 agar tidak menambah jumlah saat dijumlahkan.',
      });
    }
  }

  // --- 1. SUMIFS ---
  else if (formulaUpper.includes('SUMIFS')) {
    reason =
      'Menggunakan fungsi SUMIFS karena kita perlu menjumlahkan angka berdasarkan satu atau beberapa kriteria spesifik secara bersamaan.';
    pattern = '=SUMIFS( rentang_angka_dijumlahkan ; rentang_kondisi_1 ; kondisi_1 ; [rentang_kondisi_2 ; kondisi_2] ; ... )';
    patternDescription =
      'Rumus ini mencari baris yang memenuhi kondisi/syarat tertentu, lalu menjumlahkan angka pada baris tersebut.';

    const rawArgs = extractArguments(getInner('SUMIFS'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'rentang_angka_dijumlahkan (sum_range)',
        actualValue: rawArgs[0] || 'Rentang Angka',
        role: 'Target Angka yang Dijumlahkan',
        explanation: `Kolom angka yang akan dihitung totalnya jika semua kondisi di sampingnya terpenuhi (${rawArgs[0] || ''}).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'rentang_kondisi_1 (criteria_range1)',
        actualValue: rawArgs[1] || 'Rentang Syarat 1',
        role: 'Kolom Pengecekan Syarat 1',
        explanation: `Kolom tempat Excel memeriksa apakah baris tersebut sesuai dengan kriteria yang diinginkan (${rawArgs[1] || ''}).`,
      });
    }
    if (rawArgs.length > 2) {
      conditions.push({
        param: 'kondisi_1 (criteria1)',
        actualValue: rawArgs[2] || 'Syarat 1',
        role: 'Syarat / Kondisi yang Harus Terpenuhi',
        explanation: `Nilai syarat yang wajib cocok pada rentang kondisi 1 (${rawArgs[2] || ''}). Baris yang tidak cocok akan diabaikan.`,
      });
    }
    if (rawArgs.length > 3) {
      conditions.push({
        param: 'rentang_kondisi_2 (criteria_range2)',
        actualValue: rawArgs[3] || 'Rentang Syarat 2',
        role: 'Kolom Pengecekan Syarat 2',
        explanation: `Kolom kedua untuk pengecekan syarat tambahan (${rawArgs[3] || ''}).`,
      });
    }
    if (rawArgs.length > 4) {
      conditions.push({
        param: 'kondisi_2 (criteria2)',
        actualValue: rawArgs[4] || 'Syarat 2',
        role: 'Syarat / Kondisi Tambahan',
        explanation: `Syarat kedua yang juga wajib terpenuhi (${rawArgs[4] || ''}).`,
      });
    }
  }

  // --- 2. SUMIF (Single) ---
  else if (formulaUpper.includes('SUMIF(') && !formulaUpper.includes('SUMIFS')) {
    reason =
      'Menggunakan fungsi SUMIF untuk menjumlahkan nilai pada baris-baris yang memenuhi satu kriteria tertentu.';
    pattern = '=SUMIF( rentang_kondisi ; kondisi_syarat ; [rentang_angka_dijumlahkan] )';
    patternDescription =
      'Memeriksa kolom rentang_kondisi: jika baris tersebut cocok dengan kondisi_syarat, maka angka di rentang_angka_dijumlahkan akan ditambahkan.';

    const rawArgs = extractArguments(getInner('SUMIF'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'rentang_kondisi (range)',
        actualValue: rawArgs[0] || '',
        role: 'Kolom Pengecekan Syarat',
        explanation: `Kolom data tempat Excel memeriksa apakah syarat terpenuhi (${rawArgs[0] || ''}).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'kondisi_syarat (criteria)',
        actualValue: rawArgs[1] || '',
        role: 'Syarat yang Dicari',
        explanation: `Hanya baris yang bernilai sama persis dengan ${rawArgs[1] || ''} yang akan dijumlahkan.`,
      });
    }
    if (rawArgs.length > 2) {
      conditions.push({
        param: 'rentang_angka_dijumlahkan (sum_range)',
        actualValue: rawArgs[2] || '',
        role: 'Kolom Angka Target',
        explanation: `Kolom angka yang akan dijumlahkan (${rawArgs[2] || ''}).`,
      });
    }
  }

  // --- 3. COUNTIFS ---
  else if (formulaUpper.includes('COUNTIFS')) {
    reason =
      'Menggunakan fungsi COUNTIFS untuk menghitung banyaknya transaksi atau baris data yang memenuhi satu atau beberapa syarat sekaligus.';
    pattern = '=COUNTIFS( rentang_kondisi_1 ; kondisi_1 ; [rentang_kondisi_2 ; kondisi_2] ; ... )';
    patternDescription =
      'Menghitung jumlah baris (frekuensi) jika dan hanya jika seluruh kondisi yang diberikan terpenuhi.';

    const rawArgs = extractArguments(getInner('COUNTIFS'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'rentang_kondisi_1 (criteria_range1)',
        actualValue: rawArgs[0] || '',
        role: 'Kolom Pengecekan Kondisi 1',
        explanation: `Kolom tempat memeriksa kriteria pertama (${rawArgs[0] || ''}).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'kondisi_1 (criteria1)',
        actualValue: rawArgs[1] || '',
        role: 'Syarat Kondisi 1',
        explanation: `Syarat pertama yang harus cocok (${rawArgs[1] || ''}).`,
      });
    }
    if (rawArgs.length > 2) {
      conditions.push({
        param: 'rentang_kondisi_2 (criteria_range2)',
        actualValue: rawArgs[2] || '',
        role: 'Kolom Pengecekan Kondisi 2',
        explanation: `Kolom tempat memeriksa kriteria kedua (${rawArgs[2] || ''}).`,
      });
    }
    if (rawArgs.length > 3) {
      conditions.push({
        param: 'kondisi_2 (criteria2)',
        actualValue: rawArgs[3] || '',
        role: 'Syarat Kondisi 2',
        explanation: `Syarat kedua yang juga harus cocok (${rawArgs[3] || ''}).`,
      });
    }
  }

  // --- 4. COUNTIF ---
  else if (formulaUpper.includes('COUNTIF(') && !formulaUpper.includes('COUNTIFS')) {
    reason = 'Menggunakan fungsi COUNTIF untuk menghitung jumlah baris data yang memenuhi satu syarat tertentu.';
    pattern = '=COUNTIF( rentang_data ; kondisi_syarat )';
    patternDescription = 'Menghitung berapa kali nilai kondisi_syarat muncul di dalam rentang_data.';

    const rawArgs = extractArguments(getInner('COUNTIF'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'rentang_data (range)',
        actualValue: rawArgs[0] || '',
        role: 'Area Data yang Dihitung',
        explanation: `Rentang sel yang diperiksa (${rawArgs[0] || ''}).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'kondisi_syarat (criteria)',
        actualValue: rawArgs[1] || '',
        role: 'Kriteria / Syarat Pencarian',
        explanation: `Kondisi atau teks yang dihitung kemunculannya (${rawArgs[1] || ''}).`,
      });
    }
  }

  // --- 5. VLOOKUP ---
  else if (formulaUpper.includes('VLOOKUP')) {
    reason =
      'Menggunakan fungsi VLOOKUP karena kita perlu mencari (lookup) data dari tabel referensi secara vertikal berdasarkan suatu nilai kunci (misalnya Kode Barang atau ID Karyawan).';
    pattern = '=VLOOKUP( nilai_kunci_dicari ; tabel_referensi ; nomor_kolom_ambil ; tipe_pencarian_0 )';
    patternDescription =
      'Mencocokkan nilai kunci di kolom paling kiri tabel referensi, lalu mengambil data dari kolom ke-N di baris yang sama.';

    const rawArgs = extractArguments(getInner('VLOOKUP'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'nilai_kunci_dicari (lookup_value)',
        actualValue: rawArgs[0] || '',
        role: 'Kunci Pencarian',
        explanation: `Nilai acuan yang dicari pada tabel master (misal kode barang atau ID di baris aktif: ${rawArgs[0] || ''}).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'tabel_referensi (table_array)',
        actualValue: rawArgs[1] || '',
        role: 'Tabel Master Sumber Data',
        explanation: `Area tabel master tempat data berada (${rawArgs[1] || ''}). Area ini dikunci tanda $ agar tidak bergeser saat ditarik ke bawah.`,
      });
    }
    if (rawArgs.length > 2) {
      conditions.push({
        param: 'nomor_kolom_ambil (col_index_num)',
        actualValue: rawArgs[2] || '',
        role: 'Nomor Urutan Kolom',
        explanation: `Kolom ke-${rawArgs[2] || ''} dari tabel master yang nilainya ingin kita ambil dan tampilkan.`,
      });
    }
    if (rawArgs.length > 3) {
      conditions.push({
        param: 'tipe_pencarian (range_lookup)',
        actualValue: rawArgs[3] || '0',
        role: 'Tipe Kecocokan (Exact Match)',
        explanation:
          'Kenapa bernilai 0 / FALSE? Ini syarat wajib Exact Match agar Excel hanya mencocokkan data yang kodenya persis 100%. Jika 1 / TRUE, Excel bisa salah menarik data barang lain!',
      });
    }
  }

  // --- 6. XLOOKUP ---
  else if (formulaUpper.includes('XLOOKUP')) {
    reason =
      'Menggunakan fungsi XLOOKUP (fitur modern Excel) untuk mencari data secara fleksibel ke segala arah tanpa perlu nomor kolom statis.';
    pattern = '=XLOOKUP( nilai_dicari ; rentang_kunci_sumber ; rentang_hasil_ambil ; [jika_tidak_ketemu] ; [mode_cocok] )';
    patternDescription =
      'Mencari nilai_dicari di kolom sumber, lalu langsung mengembalikan nilai dari baris yang sama di kolom hasil.';

    const rawArgs = extractArguments(getInner('XLOOKUP'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'nilai_dicari (lookup_value)',
        actualValue: rawArgs[0] || '',
        role: 'Kunci yang Dicari',
        explanation: `Nilai yang ingin dicocokkan (${rawArgs[0] || ''}).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'rentang_kunci_sumber (lookup_array)',
        actualValue: rawArgs[1] || '',
        role: 'Kolom Tempat Mencari Kunci',
        explanation: `Kolom pada tabel master tempat kode dicocokkan (${rawArgs[1] || ''}).`,
      });
    }
    if (rawArgs.length > 2) {
      conditions.push({
        param: 'rentang_hasil_ambil (return_array)',
        actualValue: rawArgs[2] || '',
        role: 'Kolom Hasil yang Diambil',
        explanation: `Kolom yang nilainya ingin kita dapatkan (${rawArgs[2] || ''}).`,
      });
    }
    if (rawArgs.length > 3) {
      conditions.push({
        param: 'jika_tidak_ketemu (if_not_found)',
        actualValue: rawArgs[3] || '',
        role: 'Hasil Cadangan bila Error',
        explanation: `Teks yang keluar bila kode tidak ada (${rawArgs[3] || ''}).`,
      });
    }
  }

  // --- 7. INDEX - MATCH ---
  else if (formulaUpper.includes('INDEX') && formulaUpper.includes('MATCH')) {
    reason =
      'Menggunakan kombinasi INDEX & MATCH karena metode ini paling fleksibel: bisa mengambil kolom di sebelah kiri, lookup 2 arah (baris & kolom), serta multi-kriteria.';
    pattern = '=INDEX( rentang_hasil ; MATCH( nilai_dicari ; rentang_pencarian ; 0 ) )';
    patternDescription =
      'MATCH mencari nomor baris tempat nilai_dicari berada (dengan syarat 0 = Exact Match), lalu INDEX mengambil isi sel pada nomor baris tersebut di rentang_hasil.';

    const indexArgs = extractArguments(getInner('INDEX'));
    const matchArgs = extractArguments(getInner('MATCH'));

    if (indexArgs.length > 0) {
      conditions.push({
        param: 'rentang_hasil (array target INDEX)',
        actualValue: indexArgs[0] || '',
        role: 'Kolom Target yang Ingin Diambil',
        explanation: `Kolom data tempat nilai hasil yang ingin ditampilkan (${indexArgs[0] || ''}).`,
      });
    }
    if (matchArgs.length > 0) {
      conditions.push({
        param: 'nilai_dicari (lookup_value MATCH)',
        actualValue: matchArgs[0] || '',
        role: 'Kunci Pencarian Baris',
        explanation: `Kunci acuan yang dicari posisinya (${matchArgs[0] || ''}).`,
      });
    }
    if (matchArgs.length > 1) {
      conditions.push({
        param: 'rentang_pencarian (lookup_array MATCH)',
        actualValue: matchArgs[1] || '',
        role: 'Kolom Tempat Mencari Baris',
        explanation: `Kolom tempat Excel mencocokkan kunci pencarian (${matchArgs[1] || ''}).`,
      });
    }
    if (matchArgs.length > 2) {
      conditions.push({
        param: 'tipe_cocok (match_type MATCH)',
        actualValue: matchArgs[2] || '0',
        role: 'Exact Match (Persis Sama)',
        explanation: 'Angka 0 wajib digunakan agar pencarian baris persis sama 100%, bukan tebakan terdekat.',
      });
    }
  }

  // --- 8. IF ---
  else if (formulaUpper.includes('IF(') || formulaUpper.startsWith('=IF(')) {
    reason =
      'Menggunakan fungsi logika IF untuk menguji suatu kondisi: menghasilkan nilai A jika syarat terpenuhi (True), atau nilai B jika syarat tidak terpenuhi (False).';
    pattern = '=IF( kondisi_logika_uji ; nilai_jika_kondisi_benar ; [nilai_jika_kondisi_salah] )';
    patternDescription =
      'Mengecek apakah kondisi_logika_uji terpenuhi. Jika Benar menghasilkan argumen ke-2, jika Salah menghasilkan argumen ke-3.';

    const rawArgs = extractArguments(getInner('IF'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'kondisi_logika_uji (logical_test)',
        actualValue: rawArgs[0] || '',
        role: 'Syarat / Kondisi yang Dicek',
        explanation: `Kondisi perbandingan yang diuji oleh Excel (misal ${rawArgs[0] || ''}). Menghasilkan nilai Benar (TRUE) atau Salah (FALSE).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'nilai_jika_benar (value_if_true)',
        actualValue: rawArgs[1] || '',
        role: 'Hasil Jika Syarat Terpenuhi',
        explanation: `Nilai atau teks yang akan keluar jika kondisi di atas bernilai BENAR (${rawArgs[1] || ''}).`,
      });
    }
    if (rawArgs.length > 2) {
      conditions.push({
        param: 'nilai_jika_salah (value_if_false)',
        actualValue: rawArgs[2] || '',
        role: 'Hasil Jika Syarat Tidak Terpenuhi',
        explanation: `Nilai atau teks cadangan bila kondisi bernilai SALAH (${rawArgs[2] || ''}).`,
      });
    }
  }

  // --- 9. Basic SUM (Tanpa Syarat) ---
  else if (formulaUpper.includes('SUM(') && !formulaUpper.includes('SUMIF') && !formulaUpper.includes('SUMPRODUCT')) {
    reason = 'Menggunakan fungsi SUM untuk menjumlahkan sekumpulan angka pada suatu rentang kolom secara menyeluruh dan efisien.';
    pattern = '=SUM( rentang_awal:rentang_akhir )';
    patternDescription = 'Menjumlahkan seluruh angka dari baris awal sampai baris akhir tanpa syarat kriteria.';

    const rawArgs = extractArguments(getInner('SUM'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'rentang_sel_angka',
        actualValue: rawArgs[0] || '',
        role: 'Rentang Angka yang Ditotalkan',
        explanation: `Menghitung total dari sel ${rawArgs[0] || ''}. SUM otomatis mengabaikan teks jika ada sel kosong.`,
      });
    }
  }

  // --- 10. AVERAGE ---
  else if (formulaUpper.includes('AVERAGE')) {
    reason = 'Menggunakan fungsi AVERAGE untuk menghitung nilai rata-rata dari data transaksi pada kolom yang ditentukan.';
    pattern = '=AVERAGE( rentang_sel_angka )';
    patternDescription = 'Menjumlahkan seluruh angka pada rentang sel lalu membaginya dengan total baris data yang berisi angka.';

    const rawArgs = extractArguments(getInner('AVERAGE'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'rentang_sel_angka',
        actualValue: rawArgs[0] || '',
        role: 'Rentang Angka yang Dirata-ratakan',
        explanation: `Menghitung rata-rata dari data pada sel ${rawArgs[0] || ''}.`,
      });
    }
  }

  // --- 11. MAX / MIN ---
  else if (formulaUpper.includes('MAX') || formulaUpper.includes('MIN')) {
    reason = 'Menggunakan fungsi MAX atau MIN untuk mendeteksi nilai transaksi tertinggi dan terendah dari sekumpulan data.';
    pattern = '=MAX( rentang ) / =MIN( rentang )';
    patternDescription = 'Memindai seluruh baris pada rentang kolom dan mengambil angka paling besar atau paling kecil.';

    const rawArgs = extractArguments(getInner('MAX') || getInner('MIN'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'rentang_angka',
        actualValue: rawArgs[0] || '',
        role: 'Rentang Pemindaian Nilai Ekstrem',
        explanation: `Mencari nilai tertinggi atau terendah di rentang ${rawArgs[0] || ''}.`,
      });
    }
  }

  // --- 12. Arithmetic Multiplication (=D2*E2) ---
  else if (formula.includes('*') || formula.includes('+') || formula.includes('-') || formula.includes('/')) {
    reason = 'Menggunakan operasi aritmatika langsung antar-sel untuk perhitungan baris demi baris (misal Qty dikali Harga).';
    pattern = '= sel_kuantitas * sel_harga_satuan';
    patternDescription = 'Mengalikan atau mengkalkulasi dua nilai sel pada baris aktif yang sama.';

    const parts = formula.replace(/^=/, '').split(/([*+/\\-])/);
    if (parts.length >= 3) {
      conditions.push({
        param: 'sel_nilai_pertama',
        actualValue: parts[0]?.trim() || '',
        role: 'Faktor Pengali 1',
        explanation: `Sel data pertama pada baris aktif (${parts[0]?.trim() || ''}).`,
      });
      conditions.push({
        param: 'operator_matematika',
        actualValue: parts[1]?.trim() || '*',
        role: 'Operasi Perhitungan',
        explanation: `Tanda ${parts[1]?.trim() || '*'} untuk melakukan kalkulasi langsung antar-sel.`,
      });
      conditions.push({
        param: 'sel_nilai_kedua',
        actualValue: parts[2]?.trim() || '',
        role: 'Faktor Pengali 2',
        explanation: `Sel data kedua pada baris aktif (${parts[2]?.trim() || ''}).`,
      });
    }
  }

  // --- 13. Manipulasi Teks (TRIM / LEFT / RIGHT / MID) ---
  else if (formulaUpper.includes('TRIM') || formulaUpper.includes('LEFT') || formulaUpper.includes('RIGHT') || formulaUpper.includes('MID')) {
    reason = 'Menggunakan fungsi teks untuk membersihkan spasi tersembunyi atau memotong kode dokumen.';
    pattern = '=TRIM( sel_teks ) atau =LEFT( sel_teks ; jumlah_karakter )';
    patternDescription = 'Memproses string teks untuk menghasilkan format yang baku dan bersih.';

    const rawArgs = extractArguments(getInner('TRIM') || getInner('LEFT') || getInner('RIGHT') || getInner('MID'));
    if (rawArgs.length > 0) {
      conditions.push({
        param: 'sel_teks_sumber',
        actualValue: rawArgs[0] || '',
        role: 'Sel Teks yang Diproses',
        explanation: `Teks sumber yang akan dibersihkan atau dipotong (${rawArgs[0] || ''}).`,
      });
    }
    if (rawArgs.length > 1) {
      conditions.push({
        param: 'jumlah_karakter',
        actualValue: rawArgs[1] || '',
        role: 'Berapa Karakter yang Diambil',
        explanation: `Jumlah karakter yang dipotong (${rawArgs[1] || ''}).`,
      });
    }
  }

  // --- 2. Check general arguments breakdown ---

  // Check for '0' or 'FALSE' (Range Lookup / Match Type)
  if (
    /;\s*0\s*\)/.test(formulaUpper) ||
    /;\s*FALSE\s*\)/i.test(formulaUpper) ||
    /;\s*0\s*;/.test(formulaUpper) ||
    /;\s*FALSE\s*;/i.test(formulaUpper)
  ) {
    argumentsHelp.push({
      term: 'Angka 0 / FALSE',
      label: 'Exact Match (Pencarian Tepat)',
      explanation:
        'Kenapa harus 0 atau FALSE? Parameter ini memerintahkan Excel melakukan pencarian PERSIS SAMA (Exact Match). Jika tidak diisi atau diisi 1 (TRUE), Excel akan menganggap data diurutkan dan mencari nilai aproksimasi terdekat, yang berisiko menarik data barang/harga yang salah!',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200',
    });
  }

  // Check for '1;0' or '1; 0' (Boolean Counter Pattern in IF or SUM)
  if (/;\s*1\s*;\s*0\s*\)/.test(formulaUpper) || /;\s*1\s*;\s*0\s*;/.test(formulaUpper)) {
    argumentsHelp.push({
      term: 'Angka 1 dan 0 (pada IF)',
      label: 'Konversi Logika ke Hitungan (Counter Boolean)',
      explanation:
        'Fungsi angka 1 dan 0: Fungsi SUM hanya bisa menjumlahkan angka, bukan teks Benar/Salah (TRUE/FALSE). Angka 1 berarti "beri nilai 1 jika syarat terpenuhi (hitung 1 kali)". Angka 0 berarti "beri nilai 0 jika syarat gagal (abaikan / jangan hitung)". Kapan digunakannya? Digunakan saat ingin menghitung jumlah baris/transaksi yang lolos kriteria menggunakan rumus SUM(IF(...;1;0)) atau SUMPRODUCT.',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200',
    });
  }

  // Check for '$' Absolute References
  if (formula.includes('$')) {
    argumentsHelp.push({
      term: 'Simbol $ (Dollar)',
      label: 'Absolute Reference (Kunci Sel/Rentang)',
      explanation:
        'Kenapa ada tanda $ (misal $A$2:$C$50)? Tanda $ berfungsi mengunci baris dan kolom agar saat rumus di-copy atau di-autofill ke bawah, posisi tabel referensi tetap diam di tempatnya dan tidak ikut bergeser.',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200',
    });
  }

  // Check for Semicolon ';' regional delimiter
  if (formula.includes(';')) {
    argumentsHelp.push({
      term: 'Titik Koma (;)',
      label: 'Pemisah Argumen Excel Indonesia',
      explanation:
        'Format regional Indonesia menggunakan titik koma (;) untuk memisahkan argumen rumus dan koma (,) untuk desimal. Jika Anda menggunakan Windows/Excel versi regional US (English), ganti titik koma menjadi koma biasa (,).',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200',
    });
  }

  // Check for String literals / Quotes
  if (/"[^"]*"/.test(formula)) {
    const matched = formula.match(/"([^"]*)"/);
    const sample = matched ? `"${matched[1]}"` : '"..."';
    argumentsHelp.push({
      term: sample,
      label: 'Teks Kriteria / Label Output',
      explanation:
        `Teks di dalam rumus selalu diapit tanda kutip ganda ("..."). Ini memberi tahu Excel bahwa ${sample} adalah nilai teks murni, bukan nama sel atau nama fungsi.`,
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200',
    });
  }

  // Check for IFERROR fallback
  if (formulaUpper.includes('IFERROR')) {
    argumentsHelp.push({
      term: 'Pesan Cadangan IFERROR',
      label: 'Error Handling',
      explanation:
        'Argumen kedua IFERROR adalah nilai yang akan ditampilkan bila rumus menghasilkan error (misal kode tidak ditemukan di master data). Tujuannya agar laporan tidak memunculkan tulisan #N/A yang membingungkan atasan.',
      badgeColor: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200',
    });
  }

  return {
    reason,
    pattern,
    patternDescription,
    conditions,
    argumentsHelp,
  };
}
