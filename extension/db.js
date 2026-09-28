/**
 * IndexedDB persistence layer for Nudge.
 *
 * Database Name: nudgeDB
 * Version: 1
 * Store: sessions
 * Key: sessionId
 * Index: startTime
 */

const DB_NAME = 'nudgeDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let dbInstance = null;

/**
 * Opens or retrieves the singleton IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        store.createIndex('startTime', 'startTime', { unique: false });
        store.createIndex('endTime', 'endTime', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      // Reset cache on close/error
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      dbInstance.onerror = (e) => {
        console.error('[Nudge DB] Connection error:', e);
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[Nudge DB] Failed to open IndexedDB:', event.target.error);
      reject(event.target.error || new Error('Failed to open database'));
    };
  });
}

/**
 * Saves or updates a completed session in IndexedDB.
 *
 * @param {Object} session - The session object
 * @returns {Promise<string>} The saved sessionId
 */
export async function saveSession(session) {
  if (!session || !session.sessionId) {
    throw new Error('Invalid session: sessionId is required.');
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(session);

      request.onsuccess = () => {
        resolve(session.sessionId);
      };

      request.onerror = (event) => {
        console.error(`[Nudge DB] Error saving session ${session.sessionId}:`, event.target.error);
        reject(event.target.error);
      };
    } catch (err) {
      console.error('[Nudge DB] Transaction error while saving session:', err);
      reject(err);
    }
  });
}

/**
 * Retrieves all historical sessions from IndexedDB, sorted chronologically.
 *
 * @returns {Promise<Array<Object>>}
 */
export async function getAllSessions() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('startTime');
      const request = index.getAll();

      request.onsuccess = () => {
        // Return sorted newest first
        const sessions = (request.result || []).sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
        resolve(sessions);
      };

      request.onerror = (event) => {
        console.error('[Nudge DB] Error fetching all sessions:', event.target.error);
        reject(event.target.error);
      };
    } catch (err) {
      console.error('[Nudge DB] Transaction error while reading sessions:', err);
      reject(err);
    }
  });
}

/**
 * Retrieves a single session by its sessionId.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
export async function getSession(sessionId) {
  if (!sessionId) return null;

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sessionId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = (event) => {
        console.error(`[Nudge DB] Error getting session ${sessionId}:`, event.target.error);
        reject(event.target.error);
      };
    } catch (err) {
      console.error('[Nudge DB] Transaction error getting session:', err);
      reject(err);
    }
  });
}

/**
 * Deletes a single historical session by sessionId.
 *
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
export async function deleteSession(sessionId) {
  if (!sessionId) return false;

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(sessionId);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        console.error(`[Nudge DB] Error deleting session ${sessionId}:`, event.target.error);
        reject(event.target.error);
      };
    } catch (err) {
      console.error('[Nudge DB] Transaction error deleting session:', err);
      reject(err);
    }
  });
}

/**
 * Clears all historical sessions from the database.
 * NOTE: This clears completed sessions only; does NOT clear active session in chrome.storage.
 *
 * @returns {Promise<boolean>}
 */
export async function clearSessions() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        console.error('[Nudge DB] Error clearing sessions:', event.target.error);
        reject(event.target.error);
      };
    } catch (err) {
      console.error('[Nudge DB] Transaction error clearing sessions:', err);
      reject(err);
    }
  });
}
