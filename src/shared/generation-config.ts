import type { Level } from './schema';

export interface GenerationLevelConfig {
  maxTokens: number;
  repairMaxTokens: number;
  regenerateMaxTokens: number;
  stagedCaseMaxTokens?: number;
  stagedAnswerKeyMaxTokens?: number;
  /**
   * Jumlah tugas per permintaan AI. Level Advanced menulis tugasnya lewat AI,
   * jadi tugas dipecah menjadi beberapa batch agar output tidak terpotong
   * (finish_reason "length"). Easy & Middle tidak memakai ini karena tugasnya
   * dibangun deterministik di server.
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
