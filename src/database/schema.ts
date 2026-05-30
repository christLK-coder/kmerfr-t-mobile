// Initialisation de la base SQLite locale — toutes les tables KmerFret
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('kmerfrеt.db');

export const initDatabase = async (): Promise<void> => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      local_id TEXT NOT NULL,
      server_id TEXT,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);

    CREATE TABLE IF NOT EXISTS local_road_hazards (
      id TEXT PRIMARY KEY,
      mission_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL,
      accuracy REAL,
      shock_magnitude REAL NOT NULL,
      shock_axis TEXT DEFAULT 'Z',
      speed_kmh REAL,
      severity TEXT NOT NULL,
      hazard_type TEXT DEFAULT 'POTHOLE',
      recorded_at TEXT NOT NULL,
      is_synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_hazards_synced ON local_road_hazards(is_synced);

    CREATE TABLE IF NOT EXISTS local_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed_kmh REAL,
      heading REAL,
      accuracy REAL,
      recorded_at TEXT NOT NULL,
      is_synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_positions_mission ON local_positions(mission_id, is_synced);

    CREATE TABLE IF NOT EXISTS cached_missions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      origin_label TEXT NOT NULL,
      destination_label TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      dest_lat REAL NOT NULL,
      dest_lng REAL NOT NULL,
      cargo_description TEXT,
      total_price REAL,
      driver_id TEXT,
      importer_id TEXT,
      qr_token TEXT,
      raw_json TEXT,
      cached_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS local_alerts (
      id TEXT PRIMARY KEY,
      mission_id TEXT,
      alert_type TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      message TEXT,
      sms_fallback INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      is_synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS local_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id TEXT NOT NULL,
      user_role TEXT NOT NULL,
      jwt_token TEXT NOT NULL,
      refresh_token TEXT,
      full_name TEXT,
      phone TEXT,
      expires_at TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
};
