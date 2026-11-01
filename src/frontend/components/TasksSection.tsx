'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckSquare,
  Square,
  RefreshCw,
  Target,
  HelpCircle,
  Trophy,
  Copy,
  Check,
  KeyRound,
  Eye,
  EyeOff,
  Terminal,
  Lightbulb,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { CaseStudy, Task } from '@/shared/schema';
import { normalizeExcelFormulaLocale } from '@/shared/excel-formula-locale';
import { analyzeFormula } from '../utils/formula-explainer';

interface TasksSectionProps {
  caseStudy: CaseStudy;
  completedTasks: number[];
  onToggleTask: (taskNo: number) => void;
  onRegenerateTask: (taskNo: number) => Promise<void>;
  regeneratingTaskNo: number | null;
  regenerateRetryAfterSeconds: number;
}

export const TasksSection: React.FC<TasksSectionProps> = ({
  caseStudy,
  completedTasks,
  onToggleTask,
  onRegenerateTask,
  regeneratingTaskNo,
  regenerateRetryAfterSeconds,
}) => {
  const [copiedTask, setCopiedTask] = useState<number | null>(null);
  const [copiedFormulaTask, setCopiedFormulaTask] = useState<number | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<number[]>([]);

  const total = caseStudy.tasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const handleCheck = (taskNo: number) => {
    onToggleTask(taskNo);
    const willBeComplete = !completedTasks.includes(taskNo) && completedCount + 1 === total;
    if (willBeComplete) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    }
  };

  const handleCopyInstruction = (task: Task) => {
    navigator.clipboard.writeText(`Tugas #${task.no}: ${task.instruction}`);
    setCopiedTask(task.no);
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const handleCopyFormula = (taskNo: number, formula: string) => {
    navigator.clipboard.writeText(formula);
    setCopiedFormulaTask(taskNo);
    setTimeout(() => setCopiedFormulaTask(null), 2000);
  };

  const toggleRevealKey = (taskNo: number) => {
    setRevealedKeys((prev) =>
      prev.includes(taskNo) ? prev.filter((n) => n !== taskNo) : [...prev, taskNo]
    );
  };

  const toggleAllKeys = () => {
    if (revealedKeys.length === total) {
      setRevealedKeys([]);
    } else {
      setRevealedKeys(caseStudy.tasks.map((t) => t.no));
    }
  };

  return (
    <section id="tugas" className="scroll-mt-32">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-700 dark:text-emerald-300">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                4. Daftar Tugas, Target & Kunci Jawaban
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Kerjakan tugas langsung di Excel. Buka kunci jawaban di bawah tiap tugas untuk melihat rumus dan bedah penjelasannya.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Toggle All Keys button */}
            <button
              type="button"
              onClick={toggleAllKeys}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition"
              title="Buka atau sembunyikan semua kunci jawaban sekaligus"
            >
              {revealedKeys.length === total ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Tutup Semua Kunci</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Buka Semua Kunci</span>
                </>
              )}
            </button>

            {/* Progress bar pill */}
            <div className="bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 min-w-[180px]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {completedCount}/{total} Selesai
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Completion Trophy Card */}
        {progressPercent === 100 && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center space-x-3 text-emerald-900 dark:text-emerald-200">
            <div className="p-2 bg-emerald-500 text-white rounded-lg">
              <Trophy className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Luar Biasa! Semua Tugas Selesai</h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Anda telah menyelesaikan seluruh skenario tugas admin ini. Cocokkan hasil perhitungan dengan Kunci Jawaban di setiap tugas.
              </p>
            </div>
          </div>
        )}

        {/* Task Cards List */}
        <div className="space-y-5">
          {regenerateRetryAfterSeconds > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Batas penggunaan AI tercapai. Coba ganti tugas lagi dalam {regenerateRetryAfterSeconds} detik.
            </div>
          )}
          {caseStudy.tasks.map((task) => {
            const isCompleted = completedTasks.includes(task.no);
            const isRegenerating = regeneratingTaskNo === task.no;
            const isKeyOpen = revealedKeys.includes(task.no);
            const answerItem = caseStudy.answerKey.find((a) => a.task === task.no);
            const normalizedFormula = answerItem ? normalizeExcelFormulaLocale(answerItem.formula) : '';
            const breakdown = answerItem ? analyzeFormula(answerItem.formula) : null;

            return (
              <div
                key={task.no}
                className={`p-4 sm:p-5 rounded-xl border transition-all ${
                  isCompleted
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/15'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Checkbox & Instruction */}
                  <div className="flex items-start space-x-3 flex-1">
                    <button
                      type="button"
                      onClick={() => handleCheck(task.no)}
                      className="mt-0.5 text-gray-400 hover:text-emerald-600 transition flex-shrink-0"
                      title={isCompleted ? 'Tandai belum selesai' : 'Tandai selesai'}
                    >
                      {isCompleted ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          Tugas #{task.no}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyInstruction(task)}
                          className="text-gray-400 hover:text-emerald-600 p-1"
                          title="Salin instruksi tugas"
                        >
                          {copiedTask === task.no ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <p
                        className={`text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-relaxed ${
                          isCompleted ? 'line-through text-gray-500 dark:text-gray-400' : ''
                        }`}
                      >
                        {task.instruction}
                      </p>

                      {/* Hint & Target Result */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        {task.hint && (
                          <div className="flex items-start space-x-1.5 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/60">
                            <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Petunjuk: </span>
                              <span>{task.hint}</span>
                            </div>
                          </div>
                        )}

                        {task.targetResult && (
                          <div className="flex items-start space-x-1.5 text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800/60">
                            <Target className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-blue-900 dark:text-blue-200">
                                Target Mandiri:{' '}
                              </span>
                              <span>{task.targetResult}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Regenerate Single Task Button */}
                  <button
                    type="button"
                    onClick={() => onRegenerateTask(task.no)}
                    disabled={regeneratingTaskNo !== null || regenerateRetryAfterSeconds > 0}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-emerald-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700 transition flex-shrink-0"
                    title={`Generate ulang tugas #${task.no} saja tanpa mereset soal lain`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-emerald-600' : ''}`} />
                    <span className="hidden sm:inline">
                      {isRegenerating
                        ? 'Mengganti...'
                        : regenerateRetryAfterSeconds > 0
                          ? `Tunggu ${regenerateRetryAfterSeconds} detik`
                          : 'Ganti Tugas Ini'}
                    </span>
                  </button>
                </div>

                {/* Inline Answer Key & Formula Breakdown Toggle */}
                {answerItem && (
                  <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                    <button
                      type="button"
                      onClick={() => toggleRevealKey(task.no)}
                      className="flex items-center space-x-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition"
                    >
                      {isKeyOpen ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Sembunyikan Kunci &amp; Bedah Rumus</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Lihat Kunci Jawaban &amp; Bedah Rumus</span>
                        </>
                      )}
                    </button>

                    {/* Revealed Answer Key Details */}
                    {isKeyOpen && (
                      <div className="mt-3 p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-xl space-y-3 animate-fadeIn">
                        {/* Formula Bar with Copy */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1">
                            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                            <span>Kunci Rumus Excel:</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyFormula(task.no, normalizedFormula)}
                            className="flex items-center space-x-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                            title="Salin formula ke clipboard"
                          >
                            {copiedFormulaTask === task.no ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Salin Rumus</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Monospace Code Box */}
                        <div className="flex items-center space-x-2 bg-gray-900 text-emerald-400 px-3.5 py-2.5 rounded-lg font-mono text-xs sm:text-sm overflow-x-auto border border-gray-800">
                          <Terminal className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <code>{normalizedFormula}</code>
                        </div>

                        {/* Pola / Blueprint & Bedah Kondisi Rumus */}
                        {breakdown?.pattern && (
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800/80 space-y-2.5 shadow-sm">
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              <Layers className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span>Pola Struktur Rumus &amp; Kondisi:</span>
                            </div>

                            {/* Blueprint Syntax Box */}
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/50">
                              <code className="text-xs font-mono font-semibold text-emerald-900 dark:text-emerald-200 block break-words">
                                {breakdown.pattern}
                              </code>
                              {breakdown.patternDescription && (
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
                                  {breakdown.patternDescription}
                                </p>
                              )}
                            </div>

                            {/* Detail Tiap Kondisi / Parameter */}
                            {breakdown.conditions.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block">
                                  Penerapan kondisi pada rumus ini:
                                </span>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {breakdown.conditions.map((cond, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/60 text-xs"
                                    >
                                      <div className="flex items-center space-x-1 sm:w-48 flex-shrink-0">
                                        <ArrowRight className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                        <code className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-mono text-[11px] font-bold">
                                          {cond.actualValue}
                                        </code>
                                      </div>
                                      <div className="flex-1">
                                        <span className="font-semibold text-gray-900 dark:text-white mr-1.5">
                                          ({cond.role}):
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-300 text-[11px]">
                                          {cond.explanation}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Alasan Pemilihan Rumus */}
                        {breakdown?.reason && (
                          <div className="flex items-start space-x-2 text-xs text-gray-700 dark:text-gray-300 bg-white/70 dark:bg-gray-800/70 p-2.5 rounded-lg border border-amber-100 dark:border-gray-700">
                            <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-amber-900 dark:text-amber-200">
                                Mengapa memakai rumus ini?{' '}
                              </span>
                              <span>{breakdown.reason}</span>
                            </div>
                          </div>
                        )}

                        {/* Contextual Explanation from AI */}
                        {answerItem.explanation && (
                          <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed pl-1">
                            <span className="font-bold text-gray-900 dark:text-white">
                              Penjelasan Logika Soal:{' '}
                            </span>
                            <span>{answerItem.explanation}</span>
                          </div>
                        )}

                        {/* Bedah Komponen & Argumen Rumus (e.g. Kenapa 0 / FALSE, Kenapa $, Kenapa ;) */}
                        {breakdown && breakdown.argumentsHelp.length > 0 && (
                          <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 space-y-2">
                            <span className="text-[11px] font-bold text-amber-950 dark:text-amber-200 flex items-center space-x-1">
                              <Info className="w-3.5 h-3.5 text-blue-600" />
                              <span>Bedah Bagian &amp; Argumen Rumus:</span>
                            </span>

                            <div className="grid grid-cols-1 gap-2">
                              {breakdown.argumentsHelp.map((arg, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs space-y-1"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${
                                        arg.badgeColor || 'bg-gray-100 text-gray-800 border-gray-300'
                                      }`}
                                    >
                                      {arg.term}
                                    </span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                      {arg.label}
                                    </span>
                                  </div>
                                  <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed pl-0.5">
                                    {arg.explanation}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
