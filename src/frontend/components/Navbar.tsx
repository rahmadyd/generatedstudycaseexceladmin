'use client';

import React from 'react';
import { FileSpreadsheet, History, Moon, Sun } from 'lucide-react';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenHistory: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  onToggleDarkMode,
  onOpenHistory,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight">
                Excel Admin Studio
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                AI Generator
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Generator Studi Kasus Excel Bidang Admin &amp; Portofolio
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {/* History button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition"
            title="Lihat Riwayat Studi Kasus"
          >
            <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Riwayat</span>
          </button>

          {/* Dark Mode toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition"
            title={darkMode ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};
