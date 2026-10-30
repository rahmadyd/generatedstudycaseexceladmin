'use client';

import React from 'react';
import { X, History, Trash2, ArrowRight, Calendar, Tag } from 'lucide-react';
import { CaseStudy } from '@/shared/schema';
import { LEVEL_CONFIG, ROLE_PROFILES } from '@/shared/constants';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: CaseStudy[];
  onSelectCase: (caseStudy: CaseStudy) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelectCase,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-700 dark:text-emerald-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Riwayat Studi Kasus
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Studi kasus yang pernah digenerate di browser ini ({history.length} tersimpan)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 my-4 space-y-3 pr-1">
          {history.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
              Belum ada riwayat studi kasus tersimpan. Coba generate soal baru terlebih dahulu!
            </div>
          ) : (
            history.map((c, index) => {
              const levelCfg = LEVEL_CONFIG[c.level];
              const dateStr = c.createdAt
                ? new Date(c.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Sebelumnya';

              return (
                <div
                  key={c.id || c.seed || index}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-gray-50/50 dark:bg-gray-900/40 transition group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${levelCfg.badgeColor}`}
                      >
                        {levelCfg.label}
                      </span>
                      <span className="flex items-center space-x-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <Tag className="w-3 h-3" />
                        <span>{ROLE_PROFILES[c.role]?.label ?? c.role}</span>
                      </span>
                      <span className="flex items-center space-x-1 text-[11px] text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>{dateStr}</span>
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                      {c.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      seed: {c.seed} | {c.tasks?.length || 0} tugas | {c.dataset?.sheetName}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onSelectCase(c);
                      onClose();
                    }}
                    className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 transition shadow-sm group-hover:border-emerald-500"
                  >
                    <span>Buka Soal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          {history.length > 0 ? (
            <button
              onClick={onClearHistory}
              className="flex items-center space-x-1 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Riwayat</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
