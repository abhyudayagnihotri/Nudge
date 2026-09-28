import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AnalyticsCharts({ sessions }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <p className="text-sm">Not enough historical sessions recorded to render behavioral trends.</p>
        <p className="text-xs text-slate-400 mt-1">
          Complete a browsing session (over 60s inactivity) to populate IndexedDB historical data.
        </p>
      </div>
    );
  }

  // Chronological order for trend charts
  const chronologicalSessions = [...sessions].reverse();
  const labels = chronologicalSessions.map((s, idx) => {
    const time = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `#${idx + 1} (${time})`;
  });

  // Duration & Scroll Velocity Chart
  const durationAndVelocityData = {
    labels,
    datasets: [
      {
        type: 'line',
        label: 'Duration (minutes)',
        data: chronologicalSessions.map((s) => Math.round((s.durationMs || 0) / 60000)),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Avg Scroll Velocity (px/ms)',
        data: chronologicalSessions.map((s) => Number(s.averageScrollVelocity || 0).toFixed(2)),
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderRadius: 4,
        yAxisID: 'y1'
      }
    ]
  };

  const durationChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.4)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      y: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Duration (min)', color: '#94a3b8', font: { size: 10 } },
        grid: { color: 'rgba(51, 65, 85, 0.4)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'Velocity (px/ms)', color: '#94a3b8', font: { size: 10 } },
        grid: { drawOnChartArea: false },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      }
    }
  };

  // Domain Distribution
  const domainCounts = {};
  sessions.forEach((s) => {
    (s.domains || []).forEach((d) => {
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    });
  });

  const domainLabels = Object.keys(domainCounts).slice(0, 5);
  const domainData = {
    labels: domainLabels.length > 0 ? domainLabels : ['No domains recorded'],
    datasets: [
      {
        data: domainLabels.length > 0 ? domainLabels.map((d) => domainCounts[d]) : [1],
        backgroundColor: [
          '#6366f1',
          '#38bdf8',
          '#34d399',
          '#f59e0b',
          '#ec4899',
          '#64748b'
        ],
        borderWidth: 0
      }
    ]
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Session Duration vs Scroll Velocity</h3>
        <p className="text-xs text-slate-400 mb-4">Historical progression across tracked sessions</p>
        <div className="h-64">
          <Line data={durationAndVelocityData} options={durationChartOptions} />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Top Contexts Visited</h3>
          <p className="text-xs text-slate-400 mb-4">Hostnames observed during sessions</p>
          <div className="h-52 relative flex items-center justify-center">
            <Doughnut
              data={domainData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 }
                  }
                },
                cutout: '70%'
              }}
            />
          </div>
        </div>
        <div className="text-[11px] text-center text-slate-400 pt-2 border-t border-slate-800/80">
          Privacy: Hostnames only, no URL paths or queries
        </div>
      </div>
    </div>
  );
}
