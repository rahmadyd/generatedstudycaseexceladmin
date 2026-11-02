import {
  CaseStudy,
  CaseStudySchema,
  Level,
  LevelEnum,
  ExcelVersion,
  FormulaStyle,
  Industry,
  TaskCountMode,
} from '@/shared/schema';
import { GENERATION_CONFIG } from '@/shared/generation-config';

const STORAGE_KEYS = {
  HISTORY: 'excel_admin_cases_history',
  SETTINGS: 'excel_admin_last_settings',
  THEME: 'excel_admin_theme',
  TASK_PROGRESS: 'excel_admin_task_progress',
};

export function removeLegacyBrowserApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('excel_admin_byok_groq_key');
  } catch (error) {
    console.warn('Unable to remove the obsolete browser API key setting:', error);
  }
}

export interface SavedSettings {
  level: Level;
  role: string;
  excelVersion: ExcelVersion;
  taskCount: number;
  formulaStyle: FormulaStyle;
  structuredReferenceAt: boolean;
  industry: Industry;
  taskCountMode: TaskCountMode;
}

export function safeGetStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    console.warn(`Error reading localStorage for key ${key}:`, err);
    return fallback;
  }
}

export function safeSetStorage<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Error writing to localStorage for key ${key}:`, err);
    return false;
  }
}

// Case History
export function getSavedCasesHistory(): CaseStudy[] {
  const saved = safeGetStorage<unknown>(STORAGE_KEYS.HISTORY, []);
  if (!Array.isArray(saved)) {
    console.warn('Saved case history is not an array; ignoring stored history.');
    return [];
  }

  const history = saved.flatMap((item) => {
    if (
      typeof item === 'object' &&
      item !== null &&
      'source' in item &&
      item.source === 'bank'
    ) {
      return [];
    }
    const parsed = CaseStudySchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  if (history.length !== saved.length) {
    console.info('Removed saved cases that no longer match the supported case schema.');
    safeSetStorage(STORAGE_KEYS.HISTORY, history);
  }
  return history;
}

export function saveCaseToHistory(caseStudy: CaseStudy): void {
  const history = getSavedCasesHistory();
  // Filter out any case with exact same seed or id, then prepend
  const filtered = history.filter((c) => c.seed !== caseStudy.seed && c.id !== caseStudy.id);
  const updated = [caseStudy, ...filtered].slice(0, 20); // Keep last 20
  safeSetStorage(STORAGE_KEYS.HISTORY, updated);
}

// Settings
export function getSavedSettings(): SavedSettings {
  const defaults: SavedSettings = {
    level: 'easy',
    role: 'Penjualan',
    excelVersion: 'Microsoft 365',
    taskCount: GENERATION_CONFIG.easy.defaultTasks,
    formulaStyle: 'classic',
    structuredReferenceAt: true,
    industry: 'Acak',
    taskCountMode: 'manual',
  };
  const saved = safeGetStorage<Partial<SavedSettings>>(STORAGE_KEYS.SETTINGS, {});
  const merged = { ...defaults, ...saved };
  const levelResult = LevelEnum.safeParse(merged.level);
  if (!levelResult.success) {
    merged.level = defaults.level;
    merged.taskCount = defaults.taskCount;
  } else {
    merged.level = levelResult.data;
  }
  if (!GENERATION_CONFIG[merged.level].taskCountOptions.includes(merged.taskCount)) {
    merged.taskCount = GENERATION_CONFIG[merged.level].defaultTasks;
  }
  return merged;
}

export function saveLastSettings(settings: SavedSettings): void {
  safeSetStorage(STORAGE_KEYS.SETTINGS, settings);
}

// Task Checklist Progress
export function getTaskProgress(caseSeed: string): number[] {
  const allProgress = safeGetStorage<Record<string, number[]>>(STORAGE_KEYS.TASK_PROGRESS, {});
  return allProgress[caseSeed] || [];
}

export function saveTaskProgress(caseSeed: string, completedTaskNos: number[]): void {
  const allProgress = safeGetStorage<Record<string, number[]>>(STORAGE_KEYS.TASK_PROGRESS, {});
  allProgress[caseSeed] = completedTaskNos;
  safeSetStorage(STORAGE_KEYS.TASK_PROGRESS, allProgress);
}
