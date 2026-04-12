require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { runtimeConfig } = require('./config');

const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

function createClient() {
  if (runtimeConfig.databaseUrl) {
    return new Client({
      connectionString: runtimeConfig.databaseUrl,
      ssl: runtimeConfig.postgresSsl ? { rejectUnauthorized: false } : false
    });
  }

  return new Client({
    host: runtimeConfig.postgresHost,
    port: runtimeConfig.postgresPort,
    database: runtimeConfig.postgresDatabase,
    user: runtimeConfig.postgresUser,
    password: runtimeConfig.postgresPassword,
    ssl: runtimeConfig.postgresSsl ? { rejectUnauthorized: false } : false
  });
}

async function ensureSchema(client) {
  await client.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

async function readStore(client) {
  const result = await client.query(`select payload from app_state where key = 'store_snapshot'`);
  return result.rows[0] ? result.rows[0].payload : null;
}

async function writeStore(client, store) {
  await client.query('begin');

  try {
    await client.query(`delete from app_state where key in ('meta', 'settings', 'store_snapshot')`);
    await client.query(
      `
        insert into app_state(key, payload) values
        ($1, $2::jsonb),
        ($3, $4::jsonb),
        ($5, $6::jsonb)
      `,
      [
        'meta',
        JSON.stringify(store.meta || {}),
        'settings',
        JSON.stringify(store.settings || {}),
        'store_snapshot',
        JSON.stringify(store)
      ]
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  const client = createClient();

  try {
    await client.connect();
    await ensureSchema(client);

    if (command === 'read') {
      const store = await readStore(client);
      process.stdout.write(JSON.stringify({ ok: true, store }));
      return;
    }

    if (command === 'write') {
      const input = await readStdin();
      const store = input ? JSON.parse(input) : null;
      if (!store) {
        throw new Error('STORE_PAYLOAD_REQUIRED');
      }

      await writeStore(client, store);
      process.stdout.write(JSON.stringify({ ok: true }));
      return;
    }

    throw new Error('UNSUPPORTED_DB_WORKER_COMMAND');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(error.message || 'DB_POSTGRES_WORKER_FAILED');
  process.exitCode = 1;
});
