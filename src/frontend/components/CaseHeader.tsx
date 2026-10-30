'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Share2, Check, Clock, ShieldCheck, Tag } from 'lucide-react';
import { CaseStudy } from '@/shared/schema';
import { LEVEL_CONFIG, ROLE_PROFILES } from '@/shared/constants';

interface CaseHeaderProps {
  caseStudy: CaseStudy;
}

export const CaseHeader: React.FC<CaseHeaderProps> = ({ caseStudy }) => {
  const [seconds, setSeconds] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else if (!isActive && seconds !== 0 && interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds]);

  // Reset timer if new caseStudy loaded
  useEffect(() => {
    setSeconds(0);
    setIsActive(true);
  }, [caseStudy.seed]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      const remMins = mins % 60;
      return `${String(hrs).padStart(2, '0')}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', caseStudy.seed);
    url.searchParams.set('level', caseStudy.level);
    url.searchParams.set('role', caseStudy.role);
    url.searchParams.set('excelVersion', caseStudy.excelVersion);
    if (caseStudy.industry) url.searchParams.set('industry', caseStudy.industry);
    if (caseStudy.formulaStyle) url.searchParams.set('formulaStyle', caseStudy.formulaStyle);
    if (caseStudy.structuredReferenceAt !== undefined) {
      url.searchParams.set('structuredReferenceAt', String(caseStudy.structuredReferenceAt));
    }
    if (caseStudy.taskCountMode) url.searchParams.set('taskCountMode', caseStudy.taskCountMode);
    if (caseStudy.taskCount !== undefined) url.searchParams.set('taskCount', String(caseStudy.taskCount));
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const levelCfg = LEVEL_CONFIG[caseStudy.level];
  const roleLabel = ROLE_PROFILES[caseStudy.role]?.label ?? caseStudy.role;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Title and badges */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Level badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${levelCfg.badgeColor}`}
            >
              Level: {levelCfg.label}
            </span>

            {/* Role badge */}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 flex items-center space-x-1">
              <Tag className="w-3 h-3 text-emerald-600" />
              <span>{roleLabel}</span>
            </span>

            {caseStudy.industry && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900">
                Industri: {caseStudy.industry}
              </span>
            )}

            {/* Excel version badge */}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>{caseStudy.excelVersion}</span>
            </span>

            {/* Seed badge */}
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              seed: {caseStudy.seed}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {caseStudy.title}
          </h1>
        </div>

        {/* Timer & Share Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Timer Widget */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <Clock className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span className="font-mono text-lg font-bold text-gray-900 dark:text-white min-w-[60px]">
              {formatTime(seconds)}
            </span>
            <div className="flex items-center space-x-1 border-l border-gray-300 dark:border-gray-700 pl-2">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className="p-1 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
                title={isActive ? 'Jeda Timer' : 'Lanjutkan Timer'}
              >
                {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSeconds(0);
                  setIsActive(false);
                }}
                className="p-1 text-gray-600 dark:text-gray-300 hover:text-red-500"
                title="Reset Timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Share Link with Seed */}
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition shadow-sm"
            title="Bagikan soal ini dengan link ber-seed"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600 font-bold">Link Tersalin!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-gray-500" />
                <span>Bagikan Seed Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
