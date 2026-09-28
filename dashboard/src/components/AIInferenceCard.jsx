import React from 'react';
import { Brain, Cpu, Sparkles, AlertCircle, BellRing, UserCheck } from 'lucide-react';

export default function AIInferenceCard({ evaluation, personalProfile, onTriggerTestNudge }) {
  if (!evaluation) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
        <Brain className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
        <p className="text-sm">Inference engine awaiting active session telemetry.</p>
      </div>
    );
  }

  const scorePct = Math.round(evaluation.score * 100);
  const mlPct = Math.round((evaluation.mlProbability || 0) * 100);
  const rulePct = Math.round((evaluation.ruleScore || 0) * 100);

  const getTierColor = (level) => {
    switch (level) {
      case 'SEVERE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'ELEVATED':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'MODERATE':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
      default:
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Dual-Engine AI Behavioral Inference</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                ONNX / Calibrated
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Blends 50% Random Forest Probability with 50% Explainable Rule Heuristics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTriggerTestNudge}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
            title="Preview the gentle breathing nudge toast in the browser"
          >
            <BellRing className="w-3.5 h-3.5" />
            Test In-Browser Nudge
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Score & Risk Tier Meter */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-2">
              Doomscrolling Index
            </span>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-extrabold text-white tracking-tight">{scorePct}%</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getTierColor(evaluation.riskLevel)}`}>
                {evaluation.riskLevel}
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-indigo-400 to-rose-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(5, scorePct)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs pt-2 border-t border-slate-800/80">
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-400 block">ML Probability</span>
              <span className="font-mono font-bold text-indigo-400">{mlPct}%</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-400 block">Rule Heuristic</span>
              <span className="font-mono font-bold text-sky-400">{rulePct}%</span>
            </div>
          </div>
        </div>

        {/* Explainability & Drivers */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-2">
              Primary Behavioral Drivers
            </span>

            {evaluation.reasons && evaluation.reasons.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-300">
                {evaluation.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-400 font-bold">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">No elevated behavioral markers detected.</p>
            )}
          </div>

          {evaluation.recommendation && (
            <div className="mt-3 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
              {evaluation.recommendation}
            </div>
          )}
        </div>

        {/* Personalization Calibration Status */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Personalized Baseline
              </span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>

            {personalProfile?.isCalibrated ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Calibration Basis:</span>
                  <span className="font-mono">{personalProfile.sessionsCount} historical sessions</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Personal Median Velocity:</span>
                  <span className="font-mono text-amber-300">{personalProfile.medianVelocity} px/ms</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Calibrated Warning Vel:</span>
                  <span className="font-mono text-rose-300">{personalProfile.customThresholds?.velocityWarning} px/ms</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Sensitivity Multiplier:</span>
                  <span className="font-mono text-emerald-300">{personalProfile.sensitivityModifier}x</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 space-y-1">
                <p>Personal baseline is currently adapting.</p>
                <p className="text-[11px] text-slate-400">
                  Requires 3+ completed sessions to calibrate custom speed and duration profiles.
                </p>
              </div>
            )}
          </div>

          <div className="text-[10px] text-center text-slate-400 pt-2 border-t border-slate-800/80">
            Adapts thresholds automatically to your natural reading pace
          </div>
        </div>
      </div>
    </div>
  );
}
