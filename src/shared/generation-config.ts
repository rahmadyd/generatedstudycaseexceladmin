import type { Level } from './schema';

export interface GenerationLevelConfig {
  maxTokens: number;
  regenerateMaxTokens: number;
  minTasks: number;
  maxTasks: number;
  defaultTasks: number;
  taskCountOptions: number[];
  explanationMaxChars: number;
  hintMaxChars: number;
}

export const GENERATION_CONFIG: Record<Level, GenerationLevelConfig> = {
  easy: {
    maxTokens: 1200,
    regenerateMaxTokens: 800,
    minTasks: 3,
    maxTasks: 4,
    defaultTasks: 4,
    taskCountOptions: [3, 4],
    explanationMaxChars: 220,
    hintMaxChars: 140,
  },
  middle: {
    maxTokens: 1800,
    regenerateMaxTokens: 1000,
    minTasks: 4,
    maxTasks: 5,
    defaultTasks: 5,
    taskCountOptions: [4, 5],
    explanationMaxChars: 260,
    hintMaxChars: 160,
  },
  advance: {
    maxTokens: 2500,
    regenerateMaxTokens: 1200,
    minTasks: 4,
    maxTasks: 5,
    defaultTasks: 5,
    taskCountOptions: [4, 5],
    explanationMaxChars: 300,
    hintMaxChars: 180,
  },
  portfolio: {
    maxTokens: 7500,
    regenerateMaxTokens: 1800,
    minTasks: 5,
    maxTasks: 20,
    defaultTasks: 6,
    taskCountOptions: [5, 6, 8, 10, 15, 20],
    explanationMaxChars: 500,
    hintMaxChars: 220,
  },
};

export function getTaskCountOptions(level: Level): number[] {
  return GENERATION_CONFIG[level].taskCountOptions;
}

export const GENERATION_REPAIR_ATTEMPTS = 1;
export const GENERATION_RATE_LIMIT_REQUESTS = 15;
export const REGENERATE_RATE_LIMIT_REQUESTS = 20;
export const GENERATION_RATE_LIMIT_WINDOW_MS = 60_000;
export const GENERATION_MIN_INTERVAL_MS = 5_000;
export const GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS = 30;
export const GENERATION_GUARD_STATE_RETENTION_MS = 600_000;
export const GENERATION_SUCCESS_COOLDOWN_SECONDS = GENERATION_MIN_INTERVAL_MS / 1000;
