import { CaseStudy, Level, ExcelVersion, FormulaStyle } from '@/shared/schema';

const STORAGE_KEYS = {
  HISTORY: 'excel_admin_cases_history',
  SETTINGS: 'excel_admin_last_settings',
  BYOK_KEY: 'excel_admin_byok_groq_key',
  THEME: 'excel_admin_theme',
  TASK_PROGRESS: 'excel_admin_task_progress',
};

export interface SavedSettings {
  level: Level;
  role: string;
  excelVersion: ExcelVersion;
  taskCount: number;
  formulaStyle: FormulaStyle;
  structuredReferenceAt: boolean;
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
  return safeGetStorage<CaseStudy[]>(STORAGE_KEYS.HISTORY, []);
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
    level: 'middle',
    role: 'Penjualan',
    excelVersion: 'Microsoft 365',
    taskCount: 5,
    formulaStyle: 'classic',
    structuredReferenceAt: true,
  };
  return { ...defaults, ...safeGetStorage<Partial<SavedSettings>>(STORAGE_KEYS.SETTINGS, {}) };
}

export function saveLastSettings(settings: SavedSettings): void {
  safeSetStorage(STORAGE_KEYS.SETTINGS, settings);
}

// BYOK Key
export function getCustomApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEYS.BYOK_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCustomApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key.trim()) {
      window.localStorage.setItem(STORAGE_KEYS.BYOK_KEY, key.trim());
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.BYOK_KEY);
    }
  } catch (err) {
    console.warn('Error saving API Key:', err);
  }
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
