import { Capacitor } from '@capacitor/core';
import {
  SQLiteConnection,
  CapacitorSQLite,
} from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);

let db: any = null;

// Initialize web store - must be called before any DB operations
export async function initWebStore() {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Initializing web store...');
    await sqlite.initWebStore();
    console.log('✓ Web store initialized');
  }
}

export async function getDB() {
  if (db) return db;

  const consistency = await sqlite.checkConnectionsConsistency();
  const isConn = (await sqlite.isConnection('gainforest', false)).result;

  if (consistency.result && isConn) {
    db = await sqlite.retrieveConnection('gainforest', false);
  } else {
    db = await sqlite.createConnection(
      'gainforest',
      false,
      'no-encryption',
      1,
      false
    );
  }

  await db.open();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS gnss_sessions (
      session_id TEXT PRIMARY KEY,
      lat REAL,
      lon REAL,
      accuracy REAL,
      gnss_timestamp INTEGER,
      created_at INTEGER
    );
  `);

  return db;
}


export async function saveGNSS(sessionId: string, fix: {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}) {
  const db = await getDB();

  await db.run(
    `INSERT OR REPLACE INTO gnss_sessions
     (session_id, lat, lon, accuracy, gnss_timestamp, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      fix.lat,
      fix.lon,
      fix.accuracy,
      fix.timestamp,
      Date.now()
    ]
  );
}

export async function loadGNSS(sessionId: string) {
  const db = await getDB();
  const res = await db.query(
    `SELECT * FROM gnss_sessions WHERE session_id = ?`,
    [sessionId]
  );
  return res.values?.[0];
}
