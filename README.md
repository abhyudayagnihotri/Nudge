# Nudge: AI-Powered Doomscrolling Detection & Digital Wellness

> A privacy-first, on-device Chrome browser extension that detects compulsive browsing and doomscrolling through behavioral telemetry (scrolling kinematics, video autoplay, circadian context, tab transitions) and runs dual-engine (ML + Rule-Based) local inference with gentle, non-intrusive interventions.

---

## 1. Project Overview & Multi-Phase Architecture

Most digital wellness tools rely solely on coarse screen-time counters: *"You have been on Instagram for 30 minutes."*

**Nudge** is engineered around behavioral kinematics, evaluating compulsive consumption patterns locally on your machine without external cloud APIs.

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
  Feature Extraction                            Personal Profile
(12-dim behavioral vector)                  (Quantile baseline adapt)
           │                                             │
           ├──────────────────────┬──────────────────────┤
           │                      │                      │
           ▼                      ▼                      ▼
  Rule-Based Engine       In-Browser ML         Intervention Dispatcher
(Explainable heuristics) (Logistic / ONNX)      (Gentle breathing toast)
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  ▼
                         React Vite Dashboard
             (Dual-Engine AI gauge, trends, settings, export)
```

---

## 2. Complete Phase Implementation Status

| Phase | Milestone | Implementation Details |
|---|---|---|
| **Phase 1** | Chrome Extension Foundation | Manifest V3, minimal permissions (`storage`, `tabs`, `alarms`), popup UI, icons. |
| **Phase 2** | Behavioral Event Collection | `content.js` monitors scrolling kinematics (`scrollTop`), user activity ticks, HTML5 video/autoplay via MutationObserver. |
| **Phase 3** | Session Management | Inactivity threshold (60s), automatic session rotation, active session state. |
| **Phase 4** | Local Persistent Storage | Historical completed sessions stored in IndexedDB (`nudgeDB`); active session in `chrome.storage.local`. |
| **Phase 5** | Feature Engineering | Transforms raw telemetry into a standardized 12-dimensional behavioral feature vector (`features.js`). |
| **Phase 6** | Rule-Based Detection | Multi-signal heuristic evaluator calculating `doomscrollScore` (0.0 to 1.0) with plain-English reasons (`detector.js`). |
| **Phase 7** | Gentle Intervention System | Isolated Shadow DOM toast injected into current tab with a guided 60s breathing circle and snooze controls (`content.js`). |
| **Phase 8** | React Analytics Dashboard | Vite + React + Tailwind + Chart.js dashboard displaying live AI metrics, historical trends, settings, and JSON export. |
| **Phase 9** | Synthetic Dataset Generator | Realistic cohort generator producing 2,500 labeled sessions (`ml/generate_dataset.py`). |
| **Phase 10** | Machine Learning Pipeline | Python pipeline training Random Forest and Logistic Regression with evaluation and ONNX export (`ml/train.py`). |
| **Phase 11** | In-Browser ML / ONNX Inference | Zero-dependency on-device probability evaluation and dual-engine hybrid score blending (`modelRunner.js`). |
| **Phase 12** | Adaptive Personalization | Rolling quantile analysis of user's personal speed and duration to eliminate false positives (`personalization.js`). |

---

## 3. Privacy Guarantees

Privacy is a non-negotiable core architectural constraint.

| Telemetry Type | What Nudge Collects | What Nudge Strictly Prohibits |
|---|---|---|
| **Keyboard** | Timestamp of keypress activity only | ❌ Key values, characters, passwords, form values |
| **Scrolling** | Distance in pixels, velocity (`px/ms`), scroll count | ❌ DOM content, text viewed, element coordinates |
| **URLs** | Normalized hostname only (e.g. `youtube.com`) | ❌ Full paths, query params (`?v=...`), search queries |
| **Video** | Playback started, autoplay flag | ❌ Video title, media stream, audio, thumbnails |
| **Networking** | 100% Local (0 bytes sent to external servers) | ❌ Cloud analytics, external telemetry, third-party APIs |

---

## 4. Project Directory Structure

```text
new_nudge/
├── extension/                       # Chrome Extension (Manifest V3)
│   ├── manifest.json                # MV3 definition
│   ├── background.js                # Background service worker (all phases)
│   ├── content.js                   # Privacy DOM observer + Shadow DOM toast
│   ├── db.js                        # IndexedDB wrapper (nudgeDB)
│   ├── icons/                       # Icon assets (16, 48, 128)
│   ├── models/                      # Synced ONNX model & browser weights
│   │   ├── doomscroll_model.onnx
│   │   └── model_weights.json
│   ├── popup/                       # Extension action popup
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── utils/
│   │   ├── session.js               # Session lifecycle & metric math
│   │   ├── url.js                   # Privacy-preserving domain sanitizer
│   │   ├── features.js              # 12-dimensional feature engineering
│   │   ├── detector.js              # Rule-based heuristic scoring
│   │   ├── modelRunner.js           # In-browser ML / hybrid inference engine
│   │   └── personalization.js       # Adaptive quantile baseline calibration
│   └── dashboard/                   # Bundled production dashboard
│
├── dashboard/                       # React + Vite + Tailwind + Chart.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActiveSessionCard.jsx
│   │   │   ├── AIInferenceCard.jsx      # Dual-Engine AI gauge & drivers
│   │   │   ├── AnalyticsCharts.jsx      # Chart.js behavioral trends
│   │   │   ├── Header.jsx
│   │   │   ├── HistoricalSessionsTable.jsx
│   │   │   ├── InterventionsCard.jsx    # Nudge settings & intervention logs
│   │   │   ├── PrivacyCard.jsx
│   │   │   └── StatsOverview.jsx
│   │   ├── services/
│   │   │   └── extensionApi.js          # Extension messaging bridge
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
│
├── ml/                              # Python Machine Learning Pipeline
│   ├── generate_dataset.py          # Synthetic dataset generator (2,500 samples)
│   ├── train.py                     # Model training & ONNX export pipeline
│   ├── data/
│   │   ├── nudge_dataset.csv
│   │   └── nudge_dataset.json
│   └── models/
│       ├── doomscroll_model.onnx    # Exported ONNX model
│       └── model_weights.json       # Scaler parameters & logistic coefficients
│
├── tests/                           # Vitest Automated Test Suite (36 tests)
│   ├── session.test.js              # Session kinetics & idle rotation
│   ├── url.test.js                  # Domain extraction & privacy filter
│   ├── db.test.js                   # IndexedDB CRUD tests
│   ├── messaging.test.js            # Message validation & sanitization
│   ├── features.test.js             # Feature engineering validation
│   ├── detector.test.js             # Rule-based detector tests
│   ├── modelRunner.test.js          # In-browser ML probability & hybrid tests
│   └── personalization.test.js      # Adaptive quantile baseline tests
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
- Node.js (v18+)
- Python (3.10+; for ML dataset generation and model training)
- Google Chrome or any Chromium browser

### 1. Install Node Dependencies
```bash
npm install
```

### 2. Run Automated Test Suite (36 Tests)
```bash
npm test
```
All unit tests will execute across session kinetics, URL filtering, IndexedDB, feature extraction, rule scoring, ML inference, and adaptive personalization.

### 3. Generate ML Dataset & Train Models (Optional / Pre-run)
```bash
python ml/generate_dataset.py
python ml/train.py
```
This generates `ml/data/nudge_dataset.csv`, trains the Random Forest and Logistic Regression models, and automatically syncs `doomscroll_model.onnx` and `model_weights.json` into `extension/models/`.

### 4. Build Dashboard & Sync into Extension
```bash
npm run dashboard:build
```

---

## 6. How to Load the Chrome Extension

1. Open Google Chrome.
2. In the address bar, navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the upper-right corner.
4. Click **Load unpacked**.
5. Select the `extension/` folder:
   ```
   D:\File Transfer\Academia\Projects\new_nudge\extension
   ```
6. The extension is now active.

---

## 7. How to Test the Complete System

1. **Popup & Risk Meter**:
   - Click the Nudge icon in the Chrome toolbar.
   - Observe the live **Behavioral Risk Score** and active session timer.
   - Click **Test Nudge**: A gentle, floating wellness check-in toast will appear on your active webpage with a guided 60-second breathing circle.
2. **Dashboard**:
   - Click **Open Analytics Dashboard** in the popup (or run `npm run dashboard:dev` for standalone browser preview at `http://localhost:5173`).
   - Inspect the **Dual-Engine AI Inference** panel showing ML probability, rule scores, and feature drivers.
   - Adjust nudge sensitivity, cooldown intervals, or export historical sessions as a JSON dataset.
