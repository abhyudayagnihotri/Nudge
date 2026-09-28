import React from 'react';
import { ShieldCheck, CheckCircle2, XCircle, HardDrive, Cpu, Lock } from 'lucide-react';

export default function PrivacyCard() {
  const notCollected = [
    'Typed keys, text, or passwords',
    'Page contents, DOM dumps, or screenshots',
    'Full URLs, search queries, or parameters',
    'Authentication tokens or cookies',
    'Form values, clipboard, or chats'
  ];

  const whatWeMeasure = [
    'Scroll kinematics (distance & velocity)',
    'Activity events (presence timestamps only)',
    'Video play & autoplay presence',
    'Normalized domain hostnames (e.g. youtube.com)',
    'Tab switches & idle intervals'
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Privacy & Local Processing Architecture</h3>
          <p className="text-xs text-slate-400">Zero telemetry leaves your browser. All computations remain local.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="flex items-center gap-1.5 text-rose-400 font-semibold mb-2">
            <XCircle className="w-4 h-4" />
            <span>Strictly Prohibited & Never Collected</span>
          </div>
          <ul className="space-y-1.5 text-slate-400">
            {notCollected.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-rose-500 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Behavioral Signals Tracked</span>
          </div>
          <ul className="space-y-1.5 text-slate-400">
            {whatWeMeasure.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
          <span>Storage: <strong className="text-slate-300">IndexedDB (nudgeDB)</strong> + <strong className="text-slate-300">chrome.storage.local</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span>Processing: <strong className="text-slate-300">Local Browser Service Worker</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cloud Transmissions: <strong className="text-emerald-400">0 KB (Zero)</strong></span>
        </div>
      </div>
    </div>
  );
}
