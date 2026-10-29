'use client';

import React, { useState } from 'react';
import { Sparkles, Sliders, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { Level, ExcelVersion, GenerateRequest } from '@/shared/schema';
import { ADMIN_ROLES, LEVEL_CONFIG } from '@/shared/constants';

interface GenerateFormProps {
  onGenerate: (req: GenerateRequest) => Promise<void>;
  isLoading: boolean;
  initialLevel?: Level;
  initialRole?: string;
  initialExcelVersion?: ExcelVersion;
}

export const GenerateForm: React.FC<GenerateFormProps> = ({
  onGenerate,
  isLoading,
  initialLevel = 'middle',
  initialRole = 'Penjualan',
  initialExcelVersion = 'Microsoft 365',
}) => {
  const [level, setLevel] = useState<Level>(initialLevel);
  const [role, setRole] = useState<string>(initialRole);
  const [excelVersion, setExcelVersion] = useState<ExcelVersion>(initialExcelVersion);
  const [taskCount, setTaskCount] = useState<number>(5);
  const [customSeed, setCustomSeed] = useState<string>('');
  const [cooldown, setCooldown] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || cooldown > 0) return;

    await onGenerate({
      level,
      role,
      excelVersion,
      taskCount,
      seed: customSeed.trim() || undefined,
    });

    // 5-second cooldown to avoid accidental spam
    setCooldown(5);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const currentLevelConfig = LEVEL_CONFIG[level];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700/60">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <span className="w-2.5 h-6 bg-emerald-600 rounded-full inline-block" />
            <span>1. Generator Studi Kasus Baru</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sesuaikan spesifikasi latihan admin sesuai target kompetensi yang diinginkan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-3 sm:mt-0 flex items-center space-x-1.5 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showAdvanced ? 'Tutup Opsi Tambahan' : 'Opsi Tambahan (Seed/Jumlah)'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Level selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Pilih Tingkat Kesulitan (Level)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(['easy', 'middle', 'advance', 'portfolio'] as Level[]).map((lvl) => {
              const cfg = LEVEL_CONFIG[lvl];
              const isSelected = level === lvl;
              return (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-600 ring-2 ring-emerald-600/30 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{cfg.label}</span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{cfg.description}</p>
                </button>
              );
            })}
          </div>
          {/* Level hint pill */}
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/50 flex items-start space-x-2">
            <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-gray-800 dark:text-gray-100">Fokus Rumus: </span>
              {currentLevelConfig.recommended.join(', ')}.
              {currentLevelConfig.forbidden.length > 0 && (
                <span className="text-red-600 dark:text-red-400 ml-1">
                  (Dilarang: {currentLevelConfig.forbidden.join(', ')})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Role & Excel Version */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bidang Admin */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
              Bidang Admin
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {ADMIN_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.desc})
                </option>
              ))}
            </select>
          </div>

          {/* Versi Excel */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
              Versi Excel Sasaran
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Microsoft 365', '2016/2019'] as ExcelVersion[]).map((ver) => (
                <button
                  type="button"
                  key={ver}
                  onClick={() => setExcelVersion(ver)}
                  className={`py-2 px-3 rounded-xl border text-xs sm:text-sm font-medium transition text-center ${
                    excelVersion === ver
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {ver}
                  {ver === '2016/2019' && (
                    <span className="block text-[10px] opacity-80">(Tanpa XLOOKUP)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Options Accordion */}
        {showAdvanced && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Jumlah Tugas
                </label>
                <select
                  value={taskCount}
                  onChange={(e) => setTaskCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                >
                  <option value={3}>3 Tugas (Cepat / Mini Case)</option>
                  <option value={4}>4 Tugas</option>
                  <option value={5}>5 Tugas (Standar)</option>
                  <option value={6}>6 Tugas (Mendalam)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Custom Seed (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: case-mar-01"
                  value={customSeed}
                  onChange={(e) => setCustomSeed(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                />
                <span className="text-[10px] text-gray-500">
                  Seed identik akan menghasilkan dataset & soal yang konsisten.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={isLoading || cooldown > 0}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-lg transition flex items-center justify-center space-x-2 ${
              isLoading || cooldown > 0
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-emerald-600/30'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>AI Sedang Merancang Studi Kasus...</span>
              </>
            ) : cooldown > 0 ? (
              <span>Tunggu {cooldown} detik sebelum generate ulang...</span>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-emerald-200" />
                <span>Generate Soal Studi Kasus</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
