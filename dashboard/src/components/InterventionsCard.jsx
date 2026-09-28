import React from 'react';
import { Bell, Sliders, History, Check, Clock, X } from 'lucide-react';

export default function InterventionsCard({ interventions, settings, onUpdateSettings }) {
  const handleToggle = (e) => {
    onUpdateSettings({ nudgeEnabled: e.target.checked });
  };

  const handleCooldownChange = (e) => {
    onUpdateSettings({ cooldownMinutes: Number(e.target.value) });
  };

  const handleSensitivityChange = (e) => {
    const val = e.target.value;
    const thresholdMap = { gentle: 0.75, normal: 0.65, strict: 0.50 };
    onUpdateSettings({ sensitivity: val, doomscrollThreshold: thresholdMap[val] || 0.65 });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Settings Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sliders className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">Nudge & Intervention Settings</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-slate-200 block">In-Page Wellness Prompts</label>
                <span className="text-[11px] text-slate-400">Display gentle toasts during compulsive loops</span>
              </div>
              <input
                type="checkbox"
                checked={settings?.nudgeEnabled ?? true}
                onChange={handleToggle}
                className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700 cursor-pointer"
              />
            </div>

            <div>
              <label className="font-medium text-slate-200 block mb-1">Cooldown Interval</label>
              <select
                value={settings?.cooldownMinutes || 15}
                onChange={handleCooldownChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
              >
                <option value={5}>5 minutes (Aggressive)</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes (Balanced)</option>
                <option value={30}>30 minutes (Relaxed)</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-slate-200 block mb-1">Sensitivity Profile</label>
              <select
                value={settings?.sensitivity || 'normal'}
                onChange={handleSensitivityChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
              >
                <option value="gentle">Gentle (Triggers at 75%+ score)</option>
                <option value="normal">Standard (Triggers at 65%+ score)</option>
                <option value="strict">Strict (Triggers at 50%+ score)</option>
              </select>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-800/80">
          Preferences sync locally to chrome.storage.local
        </p>
      </div>

      {/* Intervention Log */}
      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Intervention History</h3>
            <p className="text-xs text-slate-400">Past wellness check-ins and your responses</p>
          </div>
        </div>

        {interventions && interventions.length > 0 ? (
          <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
            {interventions.slice(0, 5).map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-semibold text-rose-400">
                      {Math.round(item.score * 100)}% Risk
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {item.riskLevel}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] truncate max-w-sm">
                    {item.reasons ? item.reasons.join(' • ') : 'Compulsive browsing pattern detected'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Response:</span>
                  <span className="font-medium text-indigo-300 capitalize">
                    {item.userAction ? item.userAction.replace('_', ' ') : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            No interventions triggered yet. As you browse, any triggered wellness check-ins will be logged here.
          </div>
        )}
      </div>
    </div>
  );
}
