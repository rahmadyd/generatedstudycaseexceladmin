import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Generator Studi Kasus Excel (Bidang Admin & Portofolio)',
  description:
    'Aplikasi web untuk latihan Excel bidang admin. Soal dibuat oleh AI (Groq), dataset dibangkitkan oleh kode (faker.js + seed), unduh XLSX/CSV dan PDF.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
