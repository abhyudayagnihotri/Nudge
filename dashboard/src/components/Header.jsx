import React from 'react';
import { ShieldCheck, Download, RefreshCw, Radio } from 'lucide-react';
import { isExtensionAvailable } from '../services/extensionApi';

export default function Header({ onRefresh, onExport, isRefreshing }) {
  const isExtension = isExtensionAvailable();

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-500/20">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Nudge</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                Phase 1–4 Core
              </span>
            </div>
            <p className="text-xs text-slate-400">
              AI-Powered Doomscrolling Detection & Digital Wellness Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border bg-slate-800/80 border-slate-700">
            <Radio className={`w-3.5 h-3.5 ${isExtension ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span className={isExtension ? 'text-emerald-300' : 'text-amber-300'}>
              {isExtension ? 'Extension Connected' : 'Standalone Preview'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Refresh latest telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/30 transition"
            title="Export session dataset as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            Export Dataset
          </button>
        </div>
      </div>
    </header>
  );
}
