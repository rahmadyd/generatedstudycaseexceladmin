'use client';

import React from 'react';
import { BookOpen, Database, CheckSquare, Lightbulb, KeyRound, Download } from 'lucide-react';

interface StickyNavProps {
  completedCount: number;
  totalTasks: number;
}

export const StickyNav: React.FC<StickyNavProps> = ({ completedCount, totalTasks }) => {
  const navItems = [
    { href: '#skenario', label: 'Skenario', icon: BookOpen },
    { href: '#dataset', label: 'Dataset', icon: Database },
    {
      href: '#tugas',
      label: `Tugas (${completedCount}/${totalTasks})`,
      icon: CheckSquare,
    },
    { href: '#clue', label: 'Clue Rumus', icon: Lightbulb },
    { href: '#kunci-jawaban', label: 'Kunci Jawaban', icon: KeyRound },
    { href: '#download-pdf', label: 'Download PDF', icon: Download },
  ];

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const elem = document.querySelector(href);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="sticky top-16 z-30 bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 shadow-sm backdrop-blur-md py-2 px-4 transition">
      <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar space-x-1 sm:space-x-2">
        <div className="flex items-center space-x-1 sm:space-x-2 min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => scrollTo(e, item.href)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>

        {/* Mini progress tracker */}
        <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-gray-200 dark:border-gray-700 flex-shrink-0">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Progress:</span>
          <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 transition-all duration-300"
              style={{
                width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0}%
          </span>
        </div>
      </div>
    </nav>
  );
};
