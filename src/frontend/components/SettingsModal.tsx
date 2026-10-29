'use client';

import React, { useState } from 'react';
import { X, Key, Eye, EyeOff, Save, CheckCircle, ExternalLink, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentApiKey,
  onSaveApiKey,
}) => {
  const [apiKey, setApiKey] = useState<string>(currentApiKey);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(apiKey.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    setApiKey('');
    onSaveApiKey('');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-100 dark:bg-amber-950/60 rounded-xl text-amber-600">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Pengaturan API Key AI
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Model: OpenAI ChatGPT (gpt-4o-mini)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 my-5">
          <div>
            <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
              OpenAI API Key (ChatGPT)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-proj-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Aman & Privat:</strong> Key disimpan di <code>localStorage</code> browser Anda atau diatur via environment variable <code>OPENAI_API_KEY</code> di Vercel.
              </span>
            </div>
            <div className="flex items-center space-x-1 pt-1 text-emerald-700 dark:text-emerald-400">
              <ExternalLink className="w-3.5 h-3.5" />
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold"
              >
                Dapatkan OpenAI API Key di platform.openai.com
              </a>
            </div>
            <p className="text-[11px] text-gray-400 pt-1">
              Catatan: Jika Anda memasukkan key Groq (awalan <code>gsk_</code>), sistem otomatis menggunakan Llama 3.3 70B.
            </p>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs flex items-center space-x-2 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan API Key berhasil disimpan!</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {apiKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Hapus Key
              </button>
            ) : (
              <span className="text-[11px] text-gray-400">
                Mode Standar: fallback offline aktif otomatis jika tanpa key
              </span>
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
