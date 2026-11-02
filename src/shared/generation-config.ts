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
    maxTokens: 2000,
    repairMaxTokens: 2400,
    regenerateMaxTokens: 800,
    stagedAnswerKeyMaxTokens: 1200,
    minTasks: 3,
    maxTasks: 4,
    defaultTasks: 4,
    taskCountOptions: [3, 4],
    explanationMaxChars: 220,
    hintMaxChars: 140,
  },
  middle: {
    maxTokens: 2400,
    repairMaxTokens: 2800,
    regenerateMaxTokens: 1000,
    stagedAnswerKeyMaxTokens: 1600,
    minTasks: 4,
    maxTasks: 5,
    defaultTasks: 5,
    taskCountOptions: [4, 5],
    explanationMaxChars: 260,
    hintMaxChars: 160,
  },
  advance: {
    maxTokens: 2400,
    repairMaxTokens: 2800,
    regenerateMaxTokens: 1200,
    stagedCaseMaxTokens: 2200,
    stagedAnswerKeyMaxTokens: 1800,
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

export const GENERATION_REPAIR_ATTEMPTS = 1;
export const GENERATION_RATE_LIMIT_REQUESTS = 15;
export const REGENERATE_RATE_LIMIT_REQUESTS = 20;
export const ANSWER_KEY_RATE_LIMIT_REQUESTS = 20;
export const GENERATION_RATE_LIMIT_WINDOW_MS = 60_000;
