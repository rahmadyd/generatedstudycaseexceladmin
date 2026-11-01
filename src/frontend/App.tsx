'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { GenerateForm } from './components/GenerateForm';
import { StickyNav } from './components/StickyNav';
import { CaseHeader } from './components/CaseHeader';
import { ScenarioSection } from './components/ScenarioSection';
import { DatasetSection } from './components/DatasetSection';
import { TasksSection } from './components/TasksSection';
import { FormulaClues } from './components/FormulaClues';
import { PDFExportSection } from './components/PDFExportSection';
import { HistoryModal } from './components/HistoryModal';

import { CaseStudy, GenerateRequest } from '@/shared/schema';
import { FALLBACK_CASES } from '@/backend/fallbacks';
import { getTaskAnswerAlignmentIssues } from '@/backend/validator';
import { GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS } from '@/shared/generation-config';
import { generateDatasetRows } from './utils/dataset-generator';
import {
  SavedSettings,
  getSavedCasesHistory,
  getSavedSettings,
  getTaskProgress,
  safeSetStorage,
  saveCaseToHistory,
  saveLastSettings,
  saveTaskProgress,
} from './utils/storage';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [caseStudy, setCaseStudy] = useState<CaseStudy>(FALLBACK_CASES.easy);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [regeneratingTaskNo, setRegeneratingTaskNo] = useState<number | null>(null);
  const [regenerateRetryAfterSeconds, setRegenerateRetryAfterSeconds] = useState(0);
  const [isCompletingMissingContent, setIsCompletingMissingContent] = useState(false);
  const [missingContentRetryAfterSeconds, setMissingContentRetryAfterSeconds] = useState(0);
  const [missingContentError, setMissingContentError] = useState<string | null>(null);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<CaseStudy[]>([]);
  const [generatorSettings, setGeneratorSettings] = useState<SavedSettings>(() => getSavedSettings());
  const generateInFlightRef = useRef(false);
  const regenerateInFlightRef = useRef(false);
  const missingContentInFlightRef = useRef(false);

  // Theme
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Initial load from storage and URL query params
  useEffect(() => {
    // 1. Theme
    if (typeof window !== 'undefined') {
      const isDark =
        localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    // 2. History
    const savedHistory = getSavedCasesHistory();
    setHistoryList(savedHistory);
    setGeneratorSettings(getSavedSettings());

    // 3. URL Params check (?seed=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSeed = params.get('seed');

      if (urlSeed) {
        const existing = savedHistory.find((c) => c.seed === urlSeed);
        if (existing && getTaskAnswerAlignmentIssues(existing).length === 0) {
          setCaseStudy(existing);
          setCompletedTasks(getTaskProgress(existing.seed));
          return;
        }
      }
    }

    // Default: use last history if available, else fallback
    if (savedHistory.length > 0) {
      const latest = savedHistory.find((savedCase) =>
        getTaskAnswerAlignmentIssues(savedCase).length === 0,
      );
      if (!latest) {
        setErrorMsg('Kasus yang tersimpan dari versi sebelumnya tidak lolos pemeriksaan keselarasan tugas dan kunci. Silakan buat kasus baru.');
        return;
      }
      setCaseStudy(latest);
      setCompletedTasks(getTaskProgress(latest.seed));
    }
  }, []);

  useEffect(() => {
    if (regenerateRetryAfterSeconds <= 0) return;
    const timer = setTimeout(
      () => setRegenerateRetryAfterSeconds((remaining) => remaining - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [regenerateRetryAfterSeconds]);

  useEffect(() => {
    if (missingContentRetryAfterSeconds <= 0) return;
    const timer = setTimeout(
      () => setMissingContentRetryAfterSeconds((remaining) => remaining - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [missingContentRetryAfterSeconds]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      safeSetStorage('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      safeSetStorage('theme', 'light');
    }
  };

  // Re-generate dataset rows when caseStudy or seed changes
  const datasetRows = useMemo(() => {
    return generateDatasetRows(caseStudy);
  }, [caseStudy]);

  const handleGenerate = async (req: GenerateRequest) => {
    if (generateInFlightRef.current) return;
    generateInFlightRef.current = true;
    setIsLoading(true);
    setErrorMsg(null);

    // Save form settings
    const nextSettings: SavedSettings = {
      level: req.level,
      role: req.role,
      excelVersion: req.excelVersion,
      taskCount: req.taskCount || 5,
      formulaStyle: req.formulaStyle ?? 'classic',
      structuredReferenceAt: req.structuredReferenceAt ?? true,
      industry: req.industry ?? 'Acak',
      taskCountMode: req.taskCountMode ?? 'auto',
    };
    saveLastSettings(nextSettings);
    setGeneratorSettings(nextSettings);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'RATE_LIMITED') {
          return {
            retryAfterSeconds:
              Number(data.retryAfterSeconds) || GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS,
          };
        }
        throw new Error(data.error || 'Gagal menghasilkan studi kasus.');
      }

      const newCase: CaseStudy = data.caseStudy;
      setCaseStudy(newCase);
      setMissingContentRetryAfterSeconds(0);
      setMissingContentError(
        newCase.answerKeyStatus === 'pending'
          ? 'Kasus berhasil dibuat, tetapi sebagian materi belum berhasil dilengkapi.'
          : null,
      );
      setCompletedTasks([]);
      saveTaskProgress(newCase.seed, []);
      saveCaseToHistory(newCase);
      setHistoryList(getSavedCasesHistory());

      // Update URL query seed seamlessly
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('seed', newCase.seed);
        url.searchParams.set('level', newCase.level);
        url.searchParams.set('role', newCase.role);
        url.searchParams.set('excelVersion', newCase.excelVersion);
        if (newCase.industry) url.searchParams.set('industry', newCase.industry);
        if (newCase.formulaStyle) url.searchParams.set('formulaStyle', newCase.formulaStyle);
        if (newCase.structuredReferenceAt !== undefined) {
          url.searchParams.set('structuredReferenceAt', String(newCase.structuredReferenceAt));
        }
        if (newCase.taskCountMode) url.searchParams.set('taskCountMode', newCase.taskCountMode);
        if (newCase.taskCount !== undefined) url.searchParams.set('taskCount', String(newCase.taskCount));
        window.history.replaceState({}, '', url.toString());
      }
      if (newCase.answerKeyStatus === 'pending') {
        await handleRetryMissingContent(newCase);
      }
      return;
    } catch (err) {
      console.error('Error generating case:', err);
      setErrorMsg((err as Error).message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
      generateInFlightRef.current = false;
    }
  };

  const handleRetryMissingContent = async (caseToComplete: CaseStudy = caseStudy) => {
    if (missingContentInFlightRef.current || missingContentRetryAfterSeconds > 0) return;
    missingContentInFlightRef.current = true;
    setIsCompletingMissingContent(true);
    setMissingContentError(null);
    try {
      const res = await fetch('/api/generate-missing-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseStudy: caseToComplete }),
      });
      const data = await res.json();
      const updatedCase: CaseStudy | undefined = data.caseStudy;
      if (updatedCase) {
        setCaseStudy(updatedCase);
        saveCaseToHistory(updatedCase);
        setHistoryList(getSavedCasesHistory());
      }
      if (!res.ok) {
        if (data.code === 'RATE_LIMITED') {
          const retryAfterSeconds =
            Number(data.retryAfterSeconds) || GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS;
          setMissingContentRetryAfterSeconds(Math.max(1, retryAfterSeconds));
          setMissingContentError(data.error || 'Batas penggunaan AI tercapai.');
          return;
        }
        throw new Error(data.error || 'Gagal melengkapi kunci jawaban.');
      }

      if (!updatedCase) throw new Error('Respons server tidak menyertakan studi kasus.');
      setMissingContentRetryAfterSeconds(0);
      setMissingContentError(
        updatedCase.answerKeyStatus === 'pending'
          ? 'Sebagian materi masih belum tersedia. Silakan coba lagi.'
          : null,
      );
    } catch (err) {
      console.error('Error completing staged case content:', err);
      setMissingContentError((err as Error).message || 'Gagal melengkapi materi.');
    } finally {
      setIsCompletingMissingContent(false);
      missingContentInFlightRef.current = false;
    }
  };

  const handleRegenerateTask = async (taskNo: number) => {
    if (regenerateInFlightRef.current) return;
    regenerateInFlightRef.current = true;
    setRegeneratingTaskNo(taskNo);
    try {
      const res = await fetch('/api/regenerate-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseStudy, taskNo }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'RATE_LIMITED') {
          const retryAfterSeconds =
            Number(data.retryAfterSeconds) || GENERATION_RETRY_COUNTDOWN_FALLBACK_SECONDS;
          setRegenerateRetryAfterSeconds(Math.max(1, retryAfterSeconds));
          return;
        }
        throw new Error(data.error || `Gagal meregenerate tugas #${taskNo}`);
      }

      const updatedCase: CaseStudy = data.caseStudy;
      setCaseStudy(updatedCase);
      saveCaseToHistory(updatedCase);
      setHistoryList(getSavedCasesHistory());

      // Uncheck task if it was completed
      const newCompleted = completedTasks.filter((n) => n !== taskNo);
      setCompletedTasks(newCompleted);
      saveTaskProgress(caseStudy.seed, newCompleted);
    } catch (err) {
      console.error('Error regenerating task:', err);
      alert((err as Error).message);
    } finally {
      setRegeneratingTaskNo(null);
      regenerateInFlightRef.current = false;
    }
  };

  const handleToggleTask = (taskNo: number) => {
    const next = completedTasks.includes(taskNo)
      ? completedTasks.filter((n) => n !== taskNo)
      : [...completedTasks, taskNo];

    setCompletedTasks(next);
    saveTaskProgress(caseStudy.seed, next);
  };

  const handleSelectCaseFromHistory = (selected: CaseStudy) => {
    if (getTaskAnswerAlignmentIssues(selected).length > 0) {
      setErrorMsg('Kasus riwayat ini tidak lolos pemeriksaan keselarasan tugas dan kunci. Buat kasus baru untuk mendapatkan kunci yang sudah diperiksa.');
      setIsHistoryOpen(false);
      return;
    }
    setCaseStudy(selected);
    setMissingContentError(null);
    setMissingContentRetryAfterSeconds(0);
    const progress = getTaskProgress(selected.seed);
    setCompletedTasks(progress);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('seed', selected.seed);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleClearHistory = () => {
    safeSetStorage('excel_admin_cases_history', []);
    setHistoryList([]);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200">
      {/* Navbar */}
      <Navbar
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Sticky Navigation */}
      <StickyNav
        completedCount={completedTasks.length}
        totalTasks={caseStudy.tasks.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Error Alert (if any) */}
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-2xl flex items-start space-x-3 text-red-800 dark:text-red-200">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Gagal Generate: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* 1. Form generate */}
        <GenerateForm
          onGenerate={handleGenerate}
          isLoading={isLoading}
          initialLevel={caseStudy.level}
          initialRole={caseStudy.role}
          initialExcelVersion={caseStudy.excelVersion}
          initialFormulaStyle={generatorSettings.formulaStyle}
          initialStructuredReferenceAt={generatorSettings.structuredReferenceAt}
          initialIndustry={generatorSettings.industry}
          initialTaskCount={generatorSettings.taskCount}
          initialTaskCountMode={generatorSettings.taskCountMode}
        />

        {/* 2. Judul + badge level + timer */}
        <CaseHeader caseStudy={caseStudy} />

        {/* 3. Skenario */}
        <ScenarioSection caseStudy={caseStudy} />

        {/* 4. Dataset */}
        <DatasetSection caseStudy={caseStudy} datasetRows={datasetRows} />

        {/* 5. Daftar tugas & Kunci Jawaban */}
        <TasksSection
          caseStudy={caseStudy}
          completedTasks={completedTasks}
          onToggleTask={handleToggleTask}
          onRegenerateTask={handleRegenerateTask}
          regeneratingTaskNo={regeneratingTaskNo}
          regenerateRetryAfterSeconds={regenerateRetryAfterSeconds}
          onRetryMissingContent={handleRetryMissingContent}
          isCompletingMissingContent={isCompletingMissingContent}
          missingContentRetryAfterSeconds={missingContentRetryAfterSeconds}
          missingContentError={missingContentError}
        />

        {/* 6. Clue rumus */}
        <FormulaClues formulas={caseStudy.formulas} />

        {/* 7. Export PDF */}
        <PDFExportSection caseStudy={caseStudy} datasetRows={datasetRows} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>
          Generator Studi Kasus Excel Admin &copy; 2026. Ditenagai oleh Groq AI. Siap dideploy ke Vercel.
        </p>
      </footer>

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={historyList}
        onSelectCase={handleSelectCaseFromHistory}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
