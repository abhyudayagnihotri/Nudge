/**
 * Nudge Extension Popup Controller
 *
 * Fetches real-time session telemetry and hybrid ML doomscrolling score.
 */

function formatDuration(ms) {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

async function fetchSession() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    if (response && response.success && response.session) {
      updateUI(response.session);
    }
  } catch (err) {
    console.warn('[Nudge Popup] Background service worker may be warming up:', err);
  }
}

function updateUI(session) {
  const timerEl = document.getElementById('sessionTimer');
  const scrollCountEl = document.getElementById('scrollCount');
  const scrollDistanceEl = document.getElementById('scrollDistance');
  const avgVelocityEl = document.getElementById('avgVelocity');
  const tabSwitchesEl = document.getElementById('tabSwitches');
  const videoPlaysEl = document.getElementById('videoPlays');
  const autoplayCountEl = document.getElementById('autoplayCount');
  const domainTagsEl = document.getElementById('domainTags');
  const domainsRowEl = document.getElementById('domainsRow');

  const riskBadgeEl = document.getElementById('riskBadge');
  const riskBarEl = document.getElementById('riskBar');
  const riskDescEl = document.getElementById('riskDesc');

  if (timerEl) timerEl.textContent = formatDuration(session.durationMs);
  if (scrollCountEl) scrollCountEl.textContent = session.scrollCount.toLocaleString();
  if (scrollDistanceEl) scrollDistanceEl.textContent = `${session.totalScrollDistance.toLocaleString()} px`;
  if (avgVelocityEl) avgVelocityEl.textContent = session.averageScrollVelocity.toFixed(2);
  if (tabSwitchesEl) tabSwitchesEl.textContent = session.tabSwitchCount;
  if (videoPlaysEl) videoPlaysEl.textContent = session.videoPlayCount;
  if (autoplayCountEl) autoplayCountEl.textContent = session.autoplayCount;

  // Evaluation & Risk meter
  if (session.evaluation) {
    const evalData = session.evaluation;
    const scorePct = Math.round(evalData.score * 100);

    if (riskBarEl) riskBarEl.style.width = `${Math.max(5, scorePct)}%`;

    if (riskBadgeEl) {
      riskBadgeEl.textContent = `${evalData.riskLevel} (${scorePct}%)`;
      riskBadgeEl.className = 'risk-badge ' + evalData.riskLevel.toLowerCase();
    }

    if (riskDescEl) {
      if (evalData.recommendation) {
        riskDescEl.textContent = evalData.recommendation;
      } else if (evalData.reasons && evalData.reasons.length > 0) {
        riskDescEl.textContent = evalData.reasons[0];
      } else {
        riskDescEl.textContent = 'Browsing patterns appear healthy and intentional.';
      }
    }
  }

  // Domains
  if (domainTagsEl && domainsRowEl) {
    if (Array.isArray(session.domains) && session.domains.length > 0) {
      domainsRowEl.style.display = 'flex';
      domainTagsEl.innerHTML = '';
      session.domains.slice(0, 4).forEach((d) => {
        const span = document.createElement('span');
        span.className = 'domain-tag';
        span.textContent = d;
        domainTagsEl.appendChild(span);
      });
      if (session.domains.length > 4) {
        const more = document.createElement('span');
        more.className = 'domain-tag';
        more.textContent = `+${session.domains.length - 4}`;
        domainTagsEl.appendChild(more);
      }
    } else {
      domainsRowEl.style.display = 'none';
    }
  }
}

// Bind Actions
document.addEventListener('DOMContentLoaded', () => {
  fetchSession();
  const interval = setInterval(fetchSession, 1000);

  window.addEventListener('unload', () => {
    clearInterval(interval);
  });

  const openDashboardBtn = document.getElementById('openDashboardBtn');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      const dashboardUrl = chrome.runtime.getURL('dashboard/index.html');
      chrome.tabs.create({ url: dashboardUrl });
    });
  }

  const testNudgeBtn = document.getElementById('testNudgeBtn');
  if (testNudgeBtn) {
    testNudgeBtn.addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'TRIGGER_TEST_NUDGE' });
        window.close(); // Close popup so user sees toast on page
      } catch (err) {
        console.error('[Nudge Popup] Failed to trigger test nudge:', err);
      }
    });
  }

  const rotateBtn = document.getElementById('rotateSessionBtn');
  if (rotateBtn) {
    rotateBtn.addEventListener('click', async () => {
      rotateBtn.disabled = true;
      try {
        await chrome.runtime.sendMessage({
          type: 'USER_ACTIVITY',
          data: { activityType: 'session_rotation_requested', timestamp: Date.now() }
        });
        await fetchSession();
      } catch (err) {
        console.error('[Nudge Popup] Failed to rotate session:', err);
      } finally {
        rotateBtn.disabled = false;
      }
    });
  }
});
