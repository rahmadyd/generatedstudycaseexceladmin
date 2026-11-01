import type { Level } from './schema';

export interface GenerationLevelConfig {
  maxTokens: number;
  repairMaxTokens: number;
  regenerateMaxTokens: number;
  stagedCaseMaxTokens?: number;
  stagedAnswerKeyMaxTokens?: number;
  minTasks: number;
  maxTasks: number;
  defaultTasks: number;
  taskCountOptions: number[];
  explanationMaxChars: number;
  hintMaxChars: number;
}

export const GENERATION_CONFIG: Record<Level, GenerationLevelConfig> = {
  easy: {
    maxTokens: 2200,
    repairMaxTokens: 3400,
    regenerateMaxTokens: 800,
    minTasks: 3,
    maxTasks: 4,
    defaultTasks: 4,
    taskCountOptions: [3, 4],
    explanationMaxChars: 220,
    hintMaxChars: 140,
  },
  middle: {
    maxTokens: 2800,
    repairMaxTokens: 4000,
    regenerateMaxTokens: 1000,
    minTasks: 4,
    maxTasks: 5,
    defaultTasks: 5,
    taskCountOptions: [4, 5],
    explanationMaxChars: 260,
    hintMaxChars: 160,
  },
  advance: {
    maxTokens: 2800,
    repairMaxTokens: 4000,
    regenerateMaxTokens: 1200,
    stagedCaseMaxTokens: 2600,
    stagedAnswerKeyMaxTokens: 1200,
    minTasks: 4,
    maxTasks: 5,
    defaultTasks: 5,
    taskCountOptions: [4, 5],
    explanationMaxChars: 300,
    hintMaxChars: 180,
  },
};

export function getTaskCountOptions(level: Level): number[] {
  return GENERATION_CONFIG[level].taskCountOptions;
}

export const GENERATION_REPAIR_ATTEMPTS = 2;
export const GENERATION_RATE_LIMIT_REQUESTS = 15;
export const REGENERATE_RATE_LIMIT_REQUESTS = 20;
export const ANSWER_KEY_RATE_LIMIT_REQUESTS = 20;
export const GENERATION_RATE_LIMIT_WINDOW_MS = 60_000;
export const GENERATION_MIN_INTERVAL_MS = 5_000;
export const GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS = 30;
export const GENERATION_GUARD_STATE_RETENTION_MS = 600_000;
export const GENERATION_SUCCESS_COOLDOWN_SECONDS = GENERATION_MIN_INTERVAL_MS / 1000;
