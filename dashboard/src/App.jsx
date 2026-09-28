import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsOverview from './components/StatsOverview';
import ActiveSessionCard from './components/ActiveSessionCard';
import AIInferenceCard from './components/AIInferenceCard';
import AnalyticsCharts from './components/AnalyticsCharts';
import InterventionsCard from './components/InterventionsCard';
import HistoricalSessionsTable from './components/HistoricalSessionsTable';
import PrivacyCard from './components/PrivacyCard';

import {
  fetchActiveSession,
  fetchHistoricalSessions,
  fetchInterventions,
  fetchSettings,
  updateSettings,
  triggerTestNudge,
  deleteSession as deleteSessionApi,
  clearAllHistoricalSessions,
  exportDatasetAsJson
} from './services/extensionApi';

export default function App() {
  const [activeSession, setActiveSession] = useState(null);
  const [historicalSessions, setHistoricalSessions] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [settingsData, setSettingsData] = useState({ settings: null, personalProfile: null });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [active, history, inters, stg] = await Promise.all([
        fetchActiveSession(),
        fetchHistoricalSessions(),
        fetchInterventions(),
        fetchSettings()
      ]);
      setActiveSession(active);
      setHistoricalSessions(history || []);
      setInterventions(inters || []);
      setSettingsData(stg || { settings: null, personalProfile: null });
    } catch (err) {
      console.error('[Dashboard] Error loading data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleDeleteSession = async (sessionId) => {
    const success = await deleteSessionApi(sessionId);
    if (success) {
      setHistoricalSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    }
  };

  const handleClearAll = async () => {
    const success = await clearAllHistoricalSessions();
    if (success) {
      setHistoricalSessions([]);
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    await updateSettings(newSettings);
    setSettingsData((prev) => ({
      ...prev,
      settings: { ...(prev.settings || {}), ...newSettings }
    }));
  };

  const handleExport = () => {
    const all = [];
    if (activeSession) {
      all.push({ ...activeSession, _status: 'active' });
    }
    historicalSessions.forEach((s) => all.push({ ...s, _status: 'completed' }));
    exportDatasetAsJson(all);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      <Header
        onRefresh={loadData}
        onExport={handleExport}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Aggregate KPI Cards */}
        <StatsOverview
          sessions={historicalSessions}
          activeSession={activeSession}
        />

        {/* Dual-Engine AI Inference & Risk Meter */}
        <AIInferenceCard
          evaluation={activeSession?.evaluation}
          personalProfile={settingsData.personalProfile}
          onTriggerTestNudge={triggerTestNudge}
        />

        {/* Live Active Session Inspector */}
        <ActiveSessionCard activeSession={activeSession} />

        {/* Behavioral Trends & Visualizations */}
        <AnalyticsCharts sessions={historicalSessions} />

        {/* Intervention History & Nudge Settings */}
        <InterventionsCard
          interventions={interventions}
          settings={settingsData.settings}
          onUpdateSettings={handleUpdateSettings}
        />

        {/* Historical Completed Sessions (IndexedDB) */}
        <HistoricalSessionsTable
          sessions={historicalSessions}
          onDeleteSession={handleDeleteSession}
          onClearAllSessions={handleClearAll}
        />

        {/* Privacy Architecture Guarantee Card */}
        <PrivacyCard />
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-400">
        <p>
          Nudge • Digital Wellness Behavioral Telemetry • Dual-Engine Local AI • Zero Cloud Transmissions
        </p>
      </footer>
    </div>
  );
}
