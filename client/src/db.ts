import { Capacitor } from '@capacitor/core';

// Simple IndexedDB wrapper for web
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('gainforest', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('gnss_sessions')) {
        const store = db.createObjectStore('gnss_sessions', { keyPath: 'session_id' });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });

  return dbPromise;
}

export async function initWebStore() {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Initializing IndexedDB...');
    await openDB();
    console.log('✓ IndexedDB initialized');
  }
}

export async function saveGNSS(sessionId: string, fix: {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}) {
  const db = await openDB();
  const tx = db.transaction('gnss_sessions', 'readwrite');
  const store = tx.objectStore('gnss_sessions');

  const data = {
    session_id: sessionId,
    lat: fix.lat,
    lon: fix.lon,
    accuracy: fix.accuracy,
    gnss_timestamp: fix.timestamp,
    created_at: Date.now()
  };

  await new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  console.log('✓ GNSS data saved:', sessionId);
}

export async function loadGNSS(sessionId: string) {
  const db = await openDB();
  const tx = db.transaction('gnss_sessions', 'readonly');
  const store = tx.objectStore('gnss_sessions');

  return new Promise((resolve, reject) => {
    const request = store.get(sessionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listAllSessions() {
  const db = await openDB();
  const tx = db.transaction('gnss_sessions', 'readonly');
  const store = tx.objectStore('gnss_sessions');

  return new Promise<any[]>((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
