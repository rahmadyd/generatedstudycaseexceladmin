import type { Level } from './schema';

export interface GenerationLevelConfig {
  maxTokens: number;
  repairMaxTokens: number;
  regenerateMaxTokens: number;
  stagedCaseMaxTokens?: number;
  stagedAnswerKeyMaxTokens?: number;
  /**
   * Jumlah tugas per permintaan AI. Level Advanced memakai AI hanya untuk satu
   * batch tugas bergaya lanjutan; sisanya diisi template lokal deterministik.
   * Batch dijaga kecil agar output tidak terpotong (finish_reason "length") dan
   * total token per generate tetap di bawah kuota token per menit penyedia AI.
   * Easy & Middle tidak memakai ini karena seluruh tugasnya dibangun lokal.
   */
  taskBatchSize?: number;
  taskBatchMaxTokens?: number;
  minTasks: number;
  maxTasks: number;
  defaultTasks: number;
  taskCountOptions: number[];
  explanationMaxChars: number;
  hintMaxChars: number;
}

/** Bare minimum soal tes admin. Dipakai semua level. */
export const TARGET_TASK_COUNT = 20;

export const GENERATION_CONFIG: Record<Level, GenerationLevelConfig> = {
  easy: {
    maxTokens: 2000,
    repairMaxTokens: 2400,
    regenerateMaxTokens: 800,
    stagedAnswerKeyMaxTokens: 1200,
    minTasks: TARGET_TASK_COUNT,
    maxTasks: 25,
    defaultTasks: TARGET_TASK_COUNT,
    taskCountOptions: [TARGET_TASK_COUNT],
    explanationMaxChars: 220,
    hintMaxChars: 140,
  },
  middle: {
    maxTokens: 2400,
    repairMaxTokens: 2800,
    regenerateMaxTokens: 1000,
    stagedAnswerKeyMaxTokens: 1600,
    minTasks: TARGET_TASK_COUNT,
    maxTasks: 25,
    defaultTasks: TARGET_TASK_COUNT,
    taskCountOptions: [TARGET_TASK_COUNT],
    explanationMaxChars: 260,
    hintMaxChars: 160,
  },
  advance: {
    maxTokens: 2400,
    repairMaxTokens: 2800,
    regenerateMaxTokens: 1200,
    stagedCaseMaxTokens: 2200,
    stagedAnswerKeyMaxTokens: 1800,
    taskBatchSize: 5,
    taskBatchMaxTokens: 2000,
    minTasks: TARGET_TASK_COUNT,
    maxTasks: 25,
    defaultTasks: TARGET_TASK_COUNT,
    taskCountOptions: [TARGET_TASK_COUNT],
    explanationMaxChars: 300,
    hintMaxChars: 180,
  },
};

export function getTaskCountOptions(level: Level): number[] {
  return GENERATION_CONFIG[level].taskCountOptions;
}

export const GENERATION_REPAIR_ATTEMPTS = 1;
export const GENERATION_RATE_LIMIT_REQUESTS = 15;
export const REGENERATE_RATE_LIMIT_REQUESTS = 20;
export const ANSWER_KEY_RATE_LIMIT_REQUESTS = 20;
export const GENERATION_RATE_LIMIT_WINDOW_MS = 60_000;
