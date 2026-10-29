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
} from 'lucide-react';
import { CaseStudy, Task } from '@/shared/schema';

interface TasksSectionProps {
  caseStudy: CaseStudy;
  completedTasks: number[];
  onToggleTask: (taskNo: number) => void;
  onRegenerateTask: (taskNo: number) => Promise<void>;
  regeneratingTaskNo: number | null;
}

export const TasksSection: React.FC<TasksSectionProps> = ({
  caseStudy,
  completedTasks,
  onToggleTask,
  onRegenerateTask,
  regeneratingTaskNo,
}) => {
  const [copiedTask, setCopiedTask] = useState<number | null>(null);

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

  return (
    <section id="tugas" className="scroll-mt-32">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-700 dark:text-emerald-300">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                4. Daftar Tugas & Target Output
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Centang setiap instruksi yang telah berhasil dikerjakan di Excel.
              </p>
            </div>
          </div>

          {/* Progress bar pill */}
          <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700 min-w-[220px]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {completedCount} dari {total} tugas selesai
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {progressPercent}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
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
                Anda telah menyelesaikan seluruh skenario tugas admin ini. Cocokkan hasil perhitungan dengan Kunci Jawaban di bawah.
              </p>
            </div>
          </div>
        )}

        {/* Task Cards List */}
        <div className="space-y-4">
          {caseStudy.tasks.map((task) => {
            const isCompleted = completedTasks.includes(task.no);
            const isRegenerating = regeneratingTaskNo === task.no;

            return (
              <div
                key={task.no}
                className={`p-4 sm:p-5 rounded-xl border transition-all ${
                  isCompleted
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/15'
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
                    disabled={isRegenerating}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-emerald-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700 transition flex-shrink-0"
                    title={`Generate ulang tugas #${task.no} saja tanpa mereset soal lain`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-emerald-600' : ''}`} />
                    <span className="hidden sm:inline">
                      {isRegenerating ? 'Mengganti...' : 'Ganti Tugas Ini'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
