import React, { useState } from 'react';
import { Trash2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export default function HistoricalSessionsTable({ sessions, onDeleteSession, onClearAllSessions }) {
  const [page, setPage] = useState(0);
  const pageSize = 8;

  if (!sessions || sessions.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <p className="text-sm font-medium text-slate-300">No completed sessions stored in IndexedDB.</p>
        <p className="text-xs text-slate-400 mt-1">
          When an active browsing session ends (after 60 seconds of inactivity), it is automatically committed here.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(sessions.length / pageSize);
  const displayedSessions = sessions.slice(page * pageSize, (page + 1) * pageSize);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all historical sessions from IndexedDB? (The currently active session will remain unaffected.)')) {
      onClearAllSessions();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Historical Sessions (IndexedDB)</h3>
          <p className="text-xs text-slate-400">
            {sessions.length} completed session{sessions.length === 1 ? '' : 's'} stored locally in nudgeDB.
          </p>
        </div>

        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition self-start sm:self-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear All History
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Session ID</th>
              <th className="py-3 px-4">Start Time</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Scrolls</th>
              <th className="py-3 px-4">Distance</th>
              <th className="py-3 px-4">Avg / Max Vel</th>
              <th className="py-3 px-4">Tabs</th>
              <th className="py-3 px-4">Videos (Auto)</th>
              <th className="py-3 px-4">Contexts</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {displayedSessions.map((session) => (
              <tr key={session.sessionId} className="hover:bg-slate-800/40 transition">
                <td className="py-3 px-4 font-mono text-[11px] text-indigo-300">
                  {session.sessionId.slice(0, 8)}...
                </td>
                <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                  {new Date(session.startTime).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </td>
                <td className="py-3 px-4 font-medium text-sky-400 whitespace-nowrap">
                  {formatDuration(session.durationMs)}
                </td>
                <td className="py-3 px-4">{session.scrollCount || 0}</td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {Math.round(session.totalScrollDistance || 0).toLocaleString()} px
                </td>
                <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                  <span className="text-amber-300">{(session.averageScrollVelocity || 0).toFixed(2)}</span>
                  <span className="text-slate-400"> / </span>
                  <span className="text-rose-400">{(session.maxScrollVelocity || 0).toFixed(2)}</span>
                </td>
                <td className="py-3 px-4">{session.tabSwitchCount || 0}</td>
                <td className="py-3 px-4">
                  {session.videoPlayCount || 0}{' '}
                  <span className="text-slate-400">({session.autoplayCount || 0})</span>
                </td>
                <td className="py-3 px-4 max-w-[180px] truncate">
                  {session.domains && session.domains.length > 0 ? (
                    <span className="text-slate-300" title={session.domains.join(', ')}>
                      {session.domains.join(', ')}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onDeleteSession(session.sessionId)}
                    className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, sessions.length)} of {sessions.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
