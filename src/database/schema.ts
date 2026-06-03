import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('kmerfret_v3.db');

export const initDatabase = async (): Promise<void> => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      local_id    TEXT NOT NULL,
      server_id   TEXT,
      payload     TEXT NOT NULL,
      status      TEXT    DEFAULT 'PENDING',
      priority    INTEGER DEFAULT 5,
      retry_count INTEGER DEFAULT 0,
      last_error  TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      synced_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status, priority DESC);

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
      email TEXT,
      phone TEXT,
      biometric_expires_at TEXT,
      expires_at TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS local_chat_messages (
      id          TEXT PRIMARY KEY,
      mission_id  TEXT NOT NULL,
      sender_id   TEXT NOT NULL,
      sender_name TEXT DEFAULT '',
      content     TEXT NOT NULL,
      msg_type    TEXT DEFAULT 'TEXT',
      is_read     INTEGER DEFAULT 0,
      created_at  TEXT NOT NULL,
      is_synced   INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_chat_local_mission  ON local_chat_messages(mission_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_local_unsynced ON local_chat_messages(is_synced);

    CREATE TABLE IF NOT EXISTS local_notifications (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      body         TEXT NOT NULL,
      notif_type   TEXT NOT NULL,
      reference_id TEXT,
      is_read      INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notif_unread ON local_notifications(is_read, created_at DESC);

    CREATE TABLE IF NOT EXISTS cached_routes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id  TEXT NOT NULL UNIQUE,
      route_json  TEXT NOT NULL,
      distance_m  REAL,
      duration_s  REAL,
      cached_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations incrémentales — colonnes ajoutées en V3 (idempotent)
  const migrations = [
    "ALTER TABLE local_session       ADD COLUMN email TEXT",
    "ALTER TABLE local_session       ADD COLUMN biometric_expires_at TEXT",
    "ALTER TABLE cached_missions     ADD COLUMN mission_type TEXT DEFAULT 'NORMAL'",
    "ALTER TABLE cached_missions     ADD COLUMN driver_name TEXT",
    "ALTER TABLE cached_missions     ADD COLUMN driver_phone TEXT",
    "ALTER TABLE cached_missions     ADD COLUMN pickup_scheduled_at TEXT",
    "ALTER TABLE cached_missions     ADD COLUMN first_payment_amount REAL",
    "ALTER TABLE cached_missions     ADD COLUMN payment_status TEXT DEFAULT 'PENDING'",
    "ALTER TABLE cached_missions     ADD COLUMN cargo_type TEXT",
    "ALTER TABLE local_chat_messages ADD COLUMN sender_name TEXT DEFAULT ''",
    "ALTER TABLE local_chat_messages ADD COLUMN msg_type TEXT DEFAULT 'TEXT'",
    "ALTER TABLE local_chat_messages ADD COLUMN is_read INTEGER DEFAULT 0",
    "ALTER TABLE sync_queue          ADD COLUMN priority INTEGER DEFAULT 5",
  ];
  for (const sql of migrations) {
    try { await db.execAsync(sql); } catch { /* colonne déjà présente */ }
  }
};
