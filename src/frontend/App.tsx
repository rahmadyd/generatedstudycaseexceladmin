'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { GenerateForm } from './components/GenerateForm';
import { StickyNav } from './components/StickyNav';
import { CaseHeader } from './components/CaseHeader';
import { ScenarioSection } from './components/ScenarioSection';
import { DatasetSection } from './components/DatasetSection';
import { TasksSection } from './components/TasksSection';
import { FormulaClues } from './components/FormulaClues';
import { AnswerKeySection } from './components/AnswerKeySection';
import { PortfolioSection } from './components/PortfolioSection';
import { PDFExportSection } from './components/PDFExportSection';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';

import { CaseStudy, GenerateRequest, Level } from '@/shared/schema';
import { FALLBACK_CASES } from '@/backend/fallbacks';
import { generateDatasetRows } from './utils/dataset-generator';
import {
  getCustomApiKey,
  getSavedCasesHistory,
  getSavedSettings,
  getTaskProgress,
  safeSetStorage,
  saveCaseToHistory,
  saveCustomApiKey,
  saveLastSettings,
  saveTaskProgress,
} from './utils/storage';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [caseStudy, setCaseStudy] = useState<CaseStudy>(FALLBACK_CASES.middle);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [regeneratingTaskNo, setRegeneratingTaskNo] = useState<number | null>(null);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<CaseStudy[]>([]);
  const [customApiKey, setCustomApiKey] = useState<string>('');

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

    // 2. BYOK Key
    const savedKey = getCustomApiKey();
    setCustomApiKey(savedKey);

    // 3. History
    const savedHistory = getSavedCasesHistory();
    setHistoryList(savedHistory);

    // 4. URL Params check (?seed=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSeed = params.get('seed');
      const urlLevel = (params.get('level') as Level) || null;
      const urlRole = params.get('role') || null;

      if (urlSeed) {
        // If matches history item
        const existing = savedHistory.find((c) => c.seed === urlSeed);
        if (existing) {
          setCaseStudy(existing);
          setCompletedTasks(getTaskProgress(existing.seed));
          return;
        }

        // Else generate with that seed
        handleGenerate({
          level: urlLevel || 'middle',
          role: urlRole || 'Penjualan',
          excelVersion: 'Microsoft 365',
          taskCount: 5,
          seed: urlSeed,
        });
        return;
      }
    }

    // Default: use last history if available, else fallback
    if (savedHistory.length > 0) {
      const latest = savedHistory[0];
      setCaseStudy(latest);
      setCompletedTasks(getTaskProgress(latest.seed));
    }
  }, []);

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
    setIsLoading(true);
    setErrorMsg(null);

    // Save form settings
    saveLastSettings({
      level: req.level,
      role: req.role,
      excelVersion: req.excelVersion,
      taskCount: req.taskCount || 5,
    });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customApiKey ? { 'x-groq-api-key': customApiKey } : {}),
        },
        body: JSON.stringify({
          ...req,
          customApiKey: customApiKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghasilkan studi kasus.');
      }

      const newCase: CaseStudy = data.caseStudy;
      setCaseStudy(newCase);
      setCompletedTasks([]);
      saveTaskProgress(newCase.seed, []);
      saveCaseToHistory(newCase);
      setHistoryList(getSavedCasesHistory());

      // Update URL query seed seamlessly
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('seed', newCase.seed);
        window.history.replaceState({}, '', url.toString());
      }
    } catch (err) {
      console.error('Error generating case:', err);
      setErrorMsg((err as Error).message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateTask = async (taskNo: number) => {
    setRegeneratingTaskNo(taskNo);
    try {
      const res = await fetch('/api/regenerate-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customApiKey ? { 'x-groq-api-key': customApiKey } : {}),
        },
        body: JSON.stringify({
          caseStudy,
          taskNo,
          customApiKey: customApiKey || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
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
    setCaseStudy(selected);
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

  const handleSaveApiKey = (key: string) => {
    saveCustomApiKey(key);
    setCustomApiKey(key);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200">
      {/* Navbar */}
      <Navbar
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasCustomApiKey={Boolean(customApiKey)}
      />

      {/* Sticky Navigation (SPEC Section 3) */}
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

        {/* 1. Form generate: level, bidang admin, versi Excel, [Generate Soal] */}
        <GenerateForm
          onGenerate={handleGenerate}
          isLoading={isLoading}
          initialLevel={caseStudy.level}
          initialRole={caseStudy.role}
          initialExcelVersion={caseStudy.excelVersion}
        />

        {/* 2. Judul + badge level + timer */}
        <CaseHeader caseStudy={caseStudy} />

        {/* 3. Skenario */}
        <ScenarioSection caseStudy={caseStudy} />

        {/* 4. Dataset: preview 5 baris, [Download XLSX] [Download CSV] */}
        <DatasetSection caseStudy={caseStudy} datasetRows={datasetRows} />

        {/* 5. Daftar tugas (checklist) */}
        <TasksSection
          caseStudy={caseStudy}
          completedTasks={completedTasks}
          onToggleTask={handleToggleTask}
          onRegenerateTask={handleRegenerateTask}
          regeneratingTaskNo={regeneratingTaskNo}
        />

        {/* 6. Clue rumus: Disarankan / Boleh / Dilarang */}
        <FormulaClues formulas={caseStudy.formulas} />

        {/* Mode Portofolio Brief & Rubrik (Khusus Level Portofolio) */}
        {caseStudy.level === 'portfolio' && (
          <PortfolioSection
            portfolioBrief={caseStudy.portfolioBrief}
            rubric={caseStudy.rubric}
          />
        )}

        {/* 7. Kunci jawaban (disembunyikan) */}
        <AnswerKeySection answerKey={caseStudy.answerKey} />

        {/* 8. [Download Soal PDF] [Download Kunci Jawaban PDF] <- PALING BAWAH SESUAI SPEC! */}
        <PDFExportSection caseStudy={caseStudy} datasetRows={datasetRows} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>
          Generator Studi Kasus Excel Admin &copy; 2026. Ditenagai oleh AI Llama-3.3-70B & Faker.js. Siap dideploy ke Vercel.
        </p>
      </footer>

      {/* Modals */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={historyList}
        onSelectCase={handleSelectCaseFromHistory}
        onClearHistory={handleClearHistory}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentApiKey={customApiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
}
