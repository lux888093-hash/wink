const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { newDb } = require('pg-mem');
const { createSeedStore } = require('./demo-data');
const { runtimeConfig } = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'db-snapshot.json');
const LEGACY_STORE_PATH = path.join(DATA_DIR, 'store.json');
const WORKER_PATH = path.join(__dirname, 'db-postgres-worker.js');

let database = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeStore(store) {
  const seed = createSeedStore();
  const source = store && store.meta && store.meta.version === seed.meta.version ? store : seed;
  const normalized = {
    ...seed,
    ...source,
    meta: {
      ...seed.meta,
      ...(source.meta || {})
    },
    settings: {
      ...seed.settings,
      ...(source.settings || {})
    }
  };

  Object.keys(seed).forEach((key) => {
    if (Array.isArray(seed[key]) && !Array.isArray(normalized[key])) {
      normalized[key] = clone(seed[key]);
    }
  });

  return normalized;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createSchema() {
  return fs.readFileSync(SCHEMA_PATH, 'utf8');
}

function loadInitialStore() {
  ensureDataDir();

  if (fs.existsSync(SNAPSHOT_PATH)) {
    return normalizeStore(JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')));
  }

  if (fs.existsSync(LEGACY_STORE_PATH)) {
    return normalizeStore(JSON.parse(fs.readFileSync(LEGACY_STORE_PATH, 'utf8')));
  }

  return normalizeStore(createSeedStore());
}

function hasExternalPostgres() {
  return Boolean(
    runtimeConfig.databaseUrl ||
      (runtimeConfig.postgresHost && runtimeConfig.postgresDatabase && runtimeConfig.postgresUser)
  );
}

function getExternalConnectionMeta() {
  if (runtimeConfig.databaseUrl) {
    try {
      const parsed = new URL(runtimeConfig.databaseUrl);
      return {
        host: parsed.hostname,
        database: parsed.pathname.replace(/^\//, '')
      };
    } catch (error) {
      return {
        host: 'unknown',
        database: 'unknown'
      };
    }
  }

  return {
    host: runtimeConfig.postgresHost || 'unknown',
    database: runtimeConfig.postgresDatabase || 'unknown'
  };
}

function writeLocalSnapshot(store) {
  ensureDataDir();
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function runExternalWorker(command, store = null) {
  const result = spawnSync(process.execPath, [WORKER_PATH, command], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    encoding: 'utf8',
    input: store ? JSON.stringify(store) : ''
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(stderr || `POSTGRES_WORKER_${command.toUpperCase()}_FAILED`);
  }

  const stdout = (result.stdout || '').trim();
  return stdout ? JSON.parse(stdout) : { ok: true };
}

function initializeEmbeddedStore() {
  const db = newDb({
    autoCreateForeignKeyIndices: true
  });

  db.public.none(createSchema());
  const initialStore = normalizeStore(loadInitialStore());
  db.public.none(`
    insert into app_state(key, payload) values
    ('store_snapshot', '${JSON.stringify(initialStore).replace(/'/g, "''")}'::jsonb)
    on conflict (key) do update set payload = excluded.payload;
  `);

  return {
    mode: 'embedded',
    db
  };
}

function initializeExternalStore() {
  const payload = runExternalWorker('read');
  let store = payload.store ? normalizeStore(payload.store) : null;

  if (!store) {
    store = normalizeStore(loadInitialStore());
    runExternalWorker('write', store);
  }

  writeLocalSnapshot(store);
  return {
    mode: 'postgres',
    store
  };
}

function ensureDatabase() {
  if (database) {
    return database;
  }

  database = hasExternalPostgres() ? initializeExternalStore() : initializeEmbeddedStore();
  return database;
}

function replaceStore(store, options = {}) {
  const normalized = normalizeStore(store);
  const current = ensureDatabase();

  if (current.mode === 'postgres') {
    current.store = clone(normalized);
    runExternalWorker('write', normalized);
  } else {
    current.db.public.none('delete from app_state;');
    current.db.public.none(`
      insert into app_state(key, payload) values
      ('store_snapshot', '${JSON.stringify(normalized).replace(/'/g, "''")}'::jsonb);
    `);
  }

  if (options.persistSnapshot !== false) {
    writeLocalSnapshot(normalized);
  }

  return normalized;
}

function loadStore() {
  const current = ensureDatabase();

  if (current.mode === 'postgres') {
    return normalizeStore(current.store);
  }

  const row = current.db.public.one(`select payload from app_state where key = 'store_snapshot';`);
  return normalizeStore(row ? row.payload : loadInitialStore());
}

function resetDatabase(store) {
  return replaceStore(store || createSeedStore(), {
    persistSnapshot: true
  });
}

function getPersistenceMeta() {
  if (ensureDatabase().mode === 'postgres') {
    return {
      engine: 'postgres',
      mode: 'external-postgresql',
      snapshotPath: SNAPSHOT_PATH,
      ...getExternalConnectionMeta()
    };
  }

  return {
    engine: 'pg-mem',
    mode: 'embedded-postgres-compatible',
    snapshotPath: SNAPSHOT_PATH
  };
}

module.exports = {
  ensureDatabase,
  getPersistenceMeta,
  loadStore,
  replaceStore,
  resetDatabase
};
