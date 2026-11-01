import { normalizeExcelFormulaLocale } from '@/shared/excel-formula-locale';

export interface FormulaBreakdown {
  reason: string;
  argumentsHelp: {
    term: string;
    label: string;
    explanation: string;
    badgeColor?: string;
  }[];
}

/**
 * Analyzes an Excel formula and generates detailed explanations for why it is used,
 * what each part/argument does, why '0' or 'FALSE' is used, why '$' is used, etc.
 */
export function analyzeFormula(rawFormula: string): FormulaBreakdown {
  const formula = normalizeExcelFormulaLocale(rawFormula).trim();
  const formulaUpper = formula.toUpperCase();

  const argumentsHelp: {
    term: string;
    label: string;
    explanation: string;
    badgeColor?: string;
  }[] = [];

  let reason = 'Formula ini digunakan untuk menghitung dan merekap data sesuai instruksi tugas.';

  // 1. Detect Main Formula & Reason
  if (formulaUpper.includes('VLOOKUP')) {
    reason =
      'Menggunakan fungsi VLOOKUP karena kita perlu mencari (lookup) data dari tabel referensi secara vertikal berdasarkan suatu nilai kunci (misalnya Kode Barang atau ID Karyawan).';
  } else if (formulaUpper.includes('XLOOKUP')) {
    reason =
      'Menggunakan fungsi XLOOKUP (fitur modern Excel) untuk mencari data secara dinamis ke segala arah tanpa memerlukan nomor urut kolom statis, serta memiliki error-handling bawaan.';
  } else if (formulaUpper.includes('INDEX') && formulaUpper.includes('MATCH')) {
    reason =
      'Menggunakan kombinasi INDEX & MATCH karena metode ini jauh lebih fleksibel dibanding VLOOKUP; mampu melakukan pencarian ke arah kiri, lookup 2 dimensi (baris & kolom), serta lookup multi-kriteria.';
  } else if (formulaUpper.includes('SUMIFS')) {
    reason =
      'Menggunakan fungsi SUMIFS karena kita perlu menjumlahkan angka berdasarkan satu atau beberapa kriteria spesifik secara bersamaan.';
  } else if (formulaUpper.includes('SUMIF')) {
    reason =
      'Menggunakan fungsi SUMIF untuk menjumlahkan nilai pada baris-baris yang memenuhi kriteria tertentu.';
  } else if (formulaUpper.includes('COUNTIFS')) {
    reason =
      'Menggunakan fungsi COUNTIFS untuk menghitung banyaknya transaksi atau baris data yang memenuhi satu atau beberapa syarat sekaligus.';
  } else if (formulaUpper.includes('COUNTIF')) {
    reason =
      'Menggunakan fungsi COUNTIF untuk menghitung jumlah frekuensi kemunculan data berdasarkan suatu kriteria.';
  } else if (formulaUpper.includes('IFERROR')) {
    reason =
      'Membungkus rumus dengan IFERROR sebagai proteksi error agar jika data tidak ditemukan (misal error #N/A atau #VALUE!), tampilan sel tetap rapi dan tidak merusak laporan.';
  } else if (formulaUpper.includes('IF(') || formulaUpper.startsWith('=IF(')) {
    reason =
      'Menggunakan fungsi logika IF untuk menguji kondisi tertentu dan menghasilkan keputusan/status yang berbeda tergantung apakah kondisi tersebut Benar (TRUE) atau Salah (FALSE).';
  } else if (formulaUpper.includes('TRIM')) {
    reason =
      'Menggunakan fungsi TRIM untuk membersihkan spasi tersembunyi (leading/trailing space) yang sering menyebabkan rumus pencarian gagal mengenali teks.';
  } else if (formulaUpper.includes('LEFT') || formulaUpper.includes('RIGHT') || formulaUpper.includes('MID')) {
    reason =
      'Menggunakan fungsi manipulasi teks untuk memotong dan mengekstrak sejumlah karakter tertentu dari kode atau nomor dokumen.';
  } else if (formulaUpper.includes('SUMPRODUCT')) {
    reason =
      'Menggunakan SUMPRODUCT untuk melakukan perkalian dan penjumlahan array sekaligus tanpa memerlukan rumus array Ctrl+Shift+Enter.';
  } else if (formulaUpper.includes('SUM')) {
    reason =
      'Menggunakan fungsi SUM untuk menjumlahkan sekumpulan angka pada suatu rentang kolom secara menyeluruh dan efisien.';
  } else if (formulaUpper.includes('AVERAGE')) {
    reason =
      'Menggunakan fungsi AVERAGE untuk menghitung nilai rata-rata dari data transaksi pada kolom yang ditentukan.';
  }

  // 2. Specific Breakdown of Components

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

  // Check for SUMIFS order
  if (formulaUpper.includes('SUMIFS')) {
    argumentsHelp.push({
      term: 'Urutan Argumen SUMIFS',
      label: 'Perbedaan SUMIF vs SUMIFS',
      explanation:
        'Hati-hati: Pada SUMIFS, rentang yang dijumlahkan (sum_range) berada di PALING DEPAN (argumen pertama), baru diikuti oleh rentang kriteria dan nilai kriterianya. Ini berkebalikan dengan SUMIF tunggal.',
      badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200',
    });
  }

  // Check for Structured Reference
  if (formula.includes('[') && formula.includes(']')) {
    argumentsHelp.push({
      term: 'Tanda Kurung Siku [...]',
      label: 'Structured Table Reference',
      explanation:
        'Rumus ini menggunakan gaya tabel terstruktur Excel (Excel Table / Ctrl+T). [@[Nama Kolom]] merujuk ke nilai di baris yang sama, sedangkan TabelData[Nama Kolom] merujuk ke seluruh kolom tabel.',
      badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200',
    });
  }

  return {
    reason,
    argumentsHelp,
  };
}
