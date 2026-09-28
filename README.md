# Nudge: AI-Powered Doomscrolling Detection & Digital Wellness

> A privacy-first Chrome browser extension that detects compulsive browsing and doomscrolling through behavioral telemetry (scrolling kinematics, video autoplay, tab transitions) rather than simplistic screen time counters.

---

## 1. Project Overview & Philosophy

Most digital wellness tools simply measure raw minutes: *"You have been on Instagram for 30 minutes."*

**Nudge** takes a fundamentally different, behavioral-first approach:
- Measures **how** you interact with content (scrolling velocity, scroll distance, repetition, idle times, tab churn).
- Distinguishes passive autoplay consumption from intentional navigation.
- Evaluates compulsive behavioral markers locally on your device without sending any data to external servers or cloud APIs.

```
       ┌────────────────────────────────────────────────────────┐
       │                       WEB PAGE                         │
       └──────────────────────────┬─────────────────────────────┘
                                  │
                                  ▼
                            content.js
                     (Observes without capturing)
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
     Scroll Kinematics       User Presence         Video Events
     (scrollTop delta)     (keyboard/mouse ticks)  (play & autoplay)
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  ▼
                            background.js
                     (Manifest V3 Service Worker)
           ┌──────────────────────┴──────────────────────┐
           │                                             │
           ▼                                             ▼
  Active Session State                         Historical Store
(chrome.storage.local)                       (IndexedDB: nudgeDB)
(rotated on 60s idle)                        (completed sessions)
           │                                             │
           └──────────────────────┬──────────────────────┘
                                  ▼
                         React Vite Dashboard
               (Live telemetry, trends, dataset export)
```

---

## 2. Privacy Guarantees

Privacy is a non-negotiable core design requirement.

| Telemetry Type | What Nudge Collects | What Nudge Strictly Prohibits |
|---|---|---|
| **Keyboard** | Timestamp of keypress activity only | ❌ Key values, characters, passwords, form values |
| **Scrolling** | Distance in pixels, velocity (`px/ms`), scroll count | ❌ DOM content, text viewed, element coordinates |
| **URLs** | Normalized hostname only (e.g. `youtube.com`) | ❌ Full paths, query params (`?v=...`), search queries |
| **Video** | Playback started, autoplay flag | ❌ Video title, media stream, audio, thumbnails |
| **Networking** | 100% Local (0 bytes sent to external servers) | ❌ Cloud analytics, external telemetry, third-party APIs |

---

## 3. Behavioral Signals & Metrics

Each completed browsing session in `IndexedDB` contains:

- `sessionId`: Unique session UUID
- `startTime` / `endTime`: Exact session bounds
- `durationMs`: Net active duration in milliseconds
- `scrollCount`: Total scroll bursts detected
- `totalScrollDistance`: Cumulative vertical pixels traversed
- `totalScrollVelocity`: Accumulated velocity index
- `averageScrollVelocity`: `totalScrollVelocity / scrollCount`
- `maxScrollVelocity`: Peak velocity burst (`px/ms`)
- `activityCount`: Total user interactions (clicks, scrolls, key ticks, mouse movement)
- `tabSwitchCount`: Context switching count across tabs
- `videoPlayCount`: Total HTML5 video playback occurrences
- `autoplayCount`: Videos detected with `autoplay` attribute or non-user invocation
- `domains`: List of unique normalized hostnames visited (e.g. `['reddit.com', 'x.com']`)

---

## 4. Project Structure

```text
new_nudge/
├── extension/                       # Chrome Extension (Manifest V3)
│   ├── manifest.json                # Extension manifest configuration
│   ├── background.js                # Background service worker (MV3)
│   ├── content.js                   # Privacy-preserving DOM observer
│   ├── db.js                        # IndexedDB wrapper (nudgeDB)
│   ├── icons/                       # Extension icon assets (16, 48, 128)
│   ├── popup/                       # Extension action popup
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── utils/
│   │   ├── session.js               # Pure session lifecycle & metric math
│   │   └── url.js                   # Privacy-preserving hostname sanitizer
│   └── dashboard/                   # Bundled production dashboard
│
├── dashboard/                       # React + Vite + Tailwind + Chart.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActiveSessionCard.jsx
│   │   │   ├── AnalyticsCharts.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── HistoricalSessionsTable.jsx
│   │   │   ├── PrivacyCard.jsx
│   │   │   └── StatsOverview.jsx
│   │   ├── services/
│   │   │   └── extensionApi.js      # Bridge for extension messaging & preview
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
│
├── tests/                           # Vitest Automated Test Suite
│   ├── db.test.js                   # IndexedDB CRUD tests (fake-indexeddb)
│   ├── messaging.test.js            # Message validation & sanitization
│   ├── session.test.js              # Session kinetics & idle rotation
│   └── url.test.js                  # Hostname extraction & privacy filter
│
├── scripts/
│   ├── copy-dashboard.js            # Syncs Vite build into extension/
│   └── generate-icons.js            # Generates PNG icon assets
│
├── package.json                     # Monorepo root configuration
├── vitest.config.js                 # Vitest test runner configuration
└── README.md
```

---

## 5. Getting Started & Installation

### Prerequisites
- Node.js (v18 or higher recommended; developed on Node v24)
- Google Chrome (or Chromium-based browser)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Test Suite
```bash
npm test
```
All unit tests will execute across session math, URL sanitization, IndexedDB operations, and message validation.

### 3. Build the Dashboard
```bash
npm run dashboard:build
```
This compiles the React + Vite dashboard and syncs the distribution files directly into `extension/dashboard/` so the Chrome extension can load it natively.

---

## 6. How to Load the Chrome Extension

1. Open Google Chrome.
2. In the address bar, navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the upper-right corner.
4. Click **Load unpacked**.
5. Select the `extension/` folder inside this project directory:
   ```
   D:\File Transfer\Academia\Projects\new_nudge\extension
   ```
6. The **Nudge: Digital Wellness & Behavioral Tracker** extension is now active.

---

## 7. How to Run the Dashboard

You can use the dashboard in two ways:

### Mode A: Directly inside the Chrome Extension (Recommended)
1. Click the **Nudge** icon in your Chrome extensions toolbar.
2. In the popup window, click **Open Analytics Dashboard**.
3. It will open `chrome-extension://<id>/dashboard/index.html` with direct access to live background sessions and IndexedDB storage.

### Mode B: Standalone Vite Dev Server
```bash
npm run dashboard:dev
```
- Open `http://localhost:5173` in any browser.
- The dashboard will run in Standalone Preview mode with sample data and local storage caching for UI inspection and development.

---

## 8. Manual Verification Steps

1. **Active Telemetry**:
   - Open any website (e.g. `https://news.ycombinator.com` or `https://youtube.com`).
   - Scroll up and down, move your mouse, and switch tabs.
   - Click the Nudge extension icon in the toolbar.
   - Verify the popup displays incrementing scroll counts, distance, average velocity, and active domains.

2. **Idle Session Rotation**:
   - Leave the browser untouched for at least 60 seconds.
   - Resume activity (scroll or move mouse).
   - Verify that the previous session was finalized and committed to IndexedDB, and a fresh active session began.

3. **Service Worker Persistence**:
   - Navigate to `chrome://extensions/` and click the reload icon on Nudge.
   - Click the Nudge popup icon.
   - Verify that the active session was restored seamlessly from `chrome.storage.local`.

4. **Historical Database & Dashboard**:
   - Open the Dashboard.
   - Verify completed sessions appear in the **Historical Sessions (IndexedDB)** table.
   - Test deleting an individual session and exporting the dataset via **Export Dataset**.

---

## 9. Future Development Roadmap

- [x] **Phase 1**: Chrome Extension Foundation (MV3, permissions, icons, popup)
- [x] **Phase 2**: Behavioral Event Collection (kinematics, activity, video/autoplay)
- [x] **Phase 3**: Session Management (idle detection, threshold rotation, metrics)
- [x] **Phase 4**: Local Persistent Storage (IndexedDB `nudgeDB` + `chrome.storage.local`)
- [ ] **Phase 5**: Feature Engineering (session periodicity, velocity acceleration, compulsion ratio)
- [ ] **Phase 6**: Rule-Based Doomscroll Detector (`doomscrollScore: 0.0 - 1.0`)
- [ ] **Phase 7**: Nudge / Gentle Intervention UI (non-intrusive break suggestions)
- [x] **Phase 8**: React Analytics Dashboard (Vite, Tailwind, Chart.js, dataset export)
- [ ] **Phase 9**: Dataset Generation & Labeling Pipeline
- [ ] **Phase 10**: Python ML Model Training (Random Forest / XGBoost on exported JSON datasets)
- [ ] **Phase 11**: ONNX Runtime Web In-Browser Local Inference
- [ ] **Phase 12**: Personalization & Adaptive Baseline Calibration
