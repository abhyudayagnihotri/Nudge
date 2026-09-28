import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsOverview from './components/StatsOverview';
import ActiveSessionCard from './components/ActiveSessionCard';
import AnalyticsCharts from './components/AnalyticsCharts';
import HistoricalSessionsTable from './components/HistoricalSessionsTable';
import PrivacyCard from './components/PrivacyCard';

import {
  fetchActiveSession,
  fetchHistoricalSessions,
  deleteSession as deleteSessionApi,
  clearAllHistoricalSessions,
  exportDatasetAsJson
} from './services/extensionApi';

export default function App() {
  const [activeSession, setActiveSession] = useState(null);
  const [historicalSessions, setHistoricalSessions] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [active, history] = await Promise.all([
        fetchActiveSession(),
        fetchHistoricalSessions()
      ]);
      setActiveSession(active);
      setHistoricalSessions(history || []);
      setLastRefreshed(Date.now());
    } catch (err) {
      console.error('[Dashboard] Error loading data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Auto-refresh active session and history every 3 seconds
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

        {/* Live Active Session Inspector */}
        <ActiveSessionCard activeSession={activeSession} />

        {/* Charts & Behavioral Trends */}
        <AnalyticsCharts sessions={historicalSessions} />

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
          Nudge • Digital Wellness Behavioral Telemetry • Zero Cloud • Local MV3 IndexedDB Pipeline
        </p>
      </footer>
    </div>
  );
}
