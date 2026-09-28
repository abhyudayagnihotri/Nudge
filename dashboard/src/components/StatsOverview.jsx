import React from 'react';
import { Clock, MousePointer, Activity, FastForward, Layers, Gauge } from 'lucide-react';

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${totalSeconds % 60}s`;
}

export default function StatsOverview({ sessions, activeSession }) {
  const allSessions = [...(sessions || [])];
  if (activeSession) {
    allSessions.push(activeSession);
  }

  const totalSessionsCount = sessions ? sessions.length : 0;
  const totalDurationMs = allSessions.reduce((acc, s) => acc + (s.durationMs || 0), 0);
  const totalScrollDistance = allSessions.reduce((acc, s) => acc + (s.totalScrollDistance || 0), 0);
  const totalScrolls = allSessions.reduce((acc, s) => acc + (s.scrollCount || 0), 0);
  const totalTabSwitches = allSessions.reduce((acc, s) => acc + (s.tabSwitchCount || 0), 0);
  const totalVideos = allSessions.reduce((acc, s) => acc + (s.videoPlayCount || 0), 0);
  const totalAutoplays = allSessions.reduce((acc, s) => acc + (s.autoplayCount || 0), 0);

  const avgVelocity = totalScrolls > 0
    ? (allSessions.reduce((acc, s) => acc + (s.totalScrollVelocity || 0), 0) / totalScrolls).toFixed(2)
    : '0.00';

  const stats = [
    {
      label: 'Historical Sessions',
      value: totalSessionsCount,
      subtext: activeSession ? '+1 active now' : 'Archived in DB',
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10'
    },
    {
      label: 'Tracked Browsing Time',
      value: formatDuration(totalDurationMs),
      subtext: `${allSessions.length} total sessions recorded`,
      icon: Clock,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10'
    },
    {
      label: 'Total Scroll Distance',
      value: `${(totalScrollDistance / 1000).toFixed(1)}k px`,
      subtext: `${totalScrolls.toLocaleString()} scroll events`,
      icon: MousePointer,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10'
    },
    {
      label: 'Avg Scroll Velocity',
      value: `${avgVelocity} px/ms`,
      subtext: 'Behavioral speed index',
      icon: Gauge,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10'
    },
    {
      label: 'Videos / Autoplays',
      value: `${totalVideos} / ${totalAutoplays}`,
      subtext: `${totalVideos > 0 ? Math.round((totalAutoplays / totalVideos) * 100) : 0}% autoplay ratio`,
      icon: FastForward,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10'
    },
    {
      label: 'Tab Switches',
      value: totalTabSwitches,
      subtext: 'Context transitions',
      icon: Activity,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">{stat.label}</span>
              <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-white tracking-tight">{stat.value}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{stat.subtext}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
