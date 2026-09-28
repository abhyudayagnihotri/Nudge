import React, { useState, useEffect } from 'react';
import { Play, Pause, Activity, Globe, Zap, Video, Monitor } from 'lucide-react';

function formatTimer(ms) {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

export default function ActiveSessionCard({ activeSession }) {
  const [liveDuration, setLiveDuration] = useState(activeSession ? activeSession.durationMs : 0);

  useEffect(() => {
    if (!activeSession) return;

    setLiveDuration(activeSession.durationMs);

    const interval = setInterval(() => {
      setLiveDuration((prev) => prev + 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  if (!activeSession) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
        <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
        <p className="text-sm">No active session currently recorded in extension memory.</p>
        <p className="text-xs text-slate-400 mt-1">Open a web page and scroll or move mouse to initialize.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-0 pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
              Live Active Session
            </span>
            <span className="text-xs font-mono text-slate-400">({activeSession.sessionId.slice(0, 12)}...)</span>
          </div>
          <p className="text-xs text-slate-400">
            Started: {new Date(activeSession.startTime).toLocaleTimeString()} • In-memory + persisted to storage.local
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Duration</span>
            <span className="text-2xl font-mono font-bold text-sky-400">
              {formatTimer(liveDuration)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 block mb-1">Scroll Count</span>
          <span className="text-lg font-bold text-white">{activeSession.scrollCount.toLocaleString()}</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 block mb-1">Total Distance</span>
          <span className="text-lg font-bold text-emerald-400">
            {activeSession.totalScrollDistance.toLocaleString()} px
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 block mb-1">Avg Velocity</span>
          <span className="text-lg font-bold text-amber-400">
            {activeSession.averageScrollVelocity.toFixed(2)} px/ms
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 block mb-1">Max Velocity</span>
          <span className="text-lg font-bold text-rose-400">
            {activeSession.maxScrollVelocity.toFixed(2)} px/ms
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 block mb-1">Tab Switches</span>
          <span className="text-lg font-bold text-sky-400">{activeSession.tabSwitchCount}</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
          <span className="text-[11px] text-slate-400 block mb-1">Videos (Autoplay)</span>
          <span className="text-lg font-bold text-purple-400">
            {activeSession.videoPlayCount} ({activeSession.autoplayCount})
          </span>
        </div>
      </div>

      {activeSession.domains && activeSession.domains.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Active Contexts:</span>
          {activeSession.domains.map((dom, i) => (
            <span
              key={i}
              className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700"
            >
              {dom}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
