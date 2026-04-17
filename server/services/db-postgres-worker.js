require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { runtimeConfig } = require('./config');

const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');
const ENTITY_TABLES = [
  { table: 'wineries', key: 'wineries', label: (item) => item.name, status: () => 'active' },
  { table: 'wines', key: 'wines', label: (item) => item.name || item.title, status: (item) => item.status || 'active', ref1: (item) => item.wineryId, ref2: (item) => item.productId },
  { table: 'tracks', key: 'tracks', label: (item) => item.cnTitle || item.title, status: (item) => item.playRule || 'active', ref1: (item) => item.wineId },
  { table: 'download_assets', key: 'downloadAssets', label: (item) => item.fileUrl, status: (item) => item.downloadRule || 'active', ref1: (item) => item.trackId },
  { table: 'products', key: 'products', label: (item) => item.name, status: (item) => item.status, ref1: (item) => item.wineId, ref2: (item) => item.category, sort: (item) => item.featuredRank },
  { table: 'product_skus', key: 'productSkus', label: (item) => item.specName, status: (item) => item.status, ref1: (item) => item.productId, sort: (item) => item.price },
  { table: 'users', key: 'users', label: (item) => item.nickname, status: (item) => item.status || 'active', ref1: (item) => item.openid, ref2: (item) => item.unionid, time1: (item) => item.createdAt, time2: (item) => item.lastLoginAt },
  { table: 'user_addresses', key: 'userAddresses', label: (item) => item.contactName, status: (item) => (item.isDefault ? 'default' : 'active'), ref1: (item) => item.userId, ref2: (item) => item.mobile, time1: (item) => item.createdAt, time2: (item) => item.updatedAt },
  { table: 'membership_plans', key: 'membershipPlans', label: (item) => item.name, status: (item) => item.status || 'active', sort: (item) => item.price },
  { table: 'memberships', key: 'memberships', label: (item) => item.planId, status: (item) => item.status, ref1: (item) => item.userId, ref2: (item) => item.planId, time1: (item) => item.startAt, time2: (item) => item.expireAt },
  { table: 'download_entitlements', key: 'downloadEntitlements', label: (item) => item.trackId, status: (item) => item.status || 'active', ref1: (item) => item.userId, ref2: (item) => item.trackId, sort: (item) => item.usedDownloads, time1: (item) => item.expiredAt },
  { table: 'download_logs', key: 'downloadLogs', label: (item) => item.assetId, status: () => 'completed', ref1: (item) => item.userId, ref2: (item) => item.trackId, time1: (item) => item.downloadAt },
  { table: 'download_tickets', key: 'downloadTickets', label: (item) => item.token, status: (item) => (item.usedAt ? 'used' : 'active'), ref1: (item) => item.userId, ref2: (item) => item.trackId, time1: (item) => item.expiresAt, time2: (item) => item.usedAt },
  { table: 'code_batches', key: 'codeBatches', label: (item) => item.batchNo, status: (item) => item.status || 'active', ref1: (item) => item.wineId, ref2: (item) => item.trackId, sort: (item) => item.quantity, time1: (item) => item.createdAt },
  { table: 'scan_codes', key: 'scanCodes', label: (item) => item.redeemCode, status: (item) => item.status, ref1: (item) => item.redeemCode, ref2: (item) => item.wineId, time1: (item) => item.firstUsedAt, time2: (item) => item.expiresAt },
  { table: 'scan_sessions', key: 'scanSessions', label: (item) => item.sessionType, status: () => 'active', ref1: (item) => item.codeId, ref2: (item) => item.userId, time1: (item) => item.createdAt, time2: (item) => item.expiredAt },
  { table: 'cart_items', key: 'cartItems', label: (item) => item.skuId, status: () => 'active', ref1: (item) => item.userId, ref2: (item) => item.skuId, sort: (item) => item.quantity, time1: (item) => item.createdAt },
  { table: 'orders', key: 'orders', label: (item) => item.orderNo, status: (item) => item.status, ref1: (item) => item.userId, ref2: (item) => item.orderType, sort: (item) => item.payAmount, time1: (item) => item.paidAt, time2: (item) => item.createdAt },
  { table: 'order_items', key: 'orderItems', label: (item) => item.productId || item.trackId, status: () => 'active', ref1: (item) => item.orderId, ref2: (item) => item.skuId || item.trackId, sort: (item) => item.quantity },
  { table: 'payments', key: 'payments', label: (item) => item.transactionId || item.outTradeNo, status: (item) => item.status, ref1: (item) => item.orderId, ref2: (item) => item.channel, sort: (item) => item.totalFen, time1: (item) => item.paidAt, time2: (item) => item.createdAt },
  { table: 'refunds', key: 'refunds', label: (item) => item.refundNo, status: (item) => item.status, ref1: (item) => item.orderId, ref2: (item) => item.userId, sort: (item) => item.amount, time1: (item) => item.requestedAt, time2: (item) => item.refundedAt },
  { table: 'admin_roles', key: 'adminRoles', label: (item) => item.name, status: () => 'active' },
  { table: 'admin_users', key: 'adminUsers', label: (item) => item.username, status: (item) => item.status, ref1: (item) => item.roleId, time1: (item) => item.lastLoginAt },
  { table: 'admin_sessions', key: 'adminSessions', label: (item) => item.tokenPreview, status: () => 'active', ref1: (item) => item.adminUserId, time1: (item) => item.createdAt, time2: (item) => item.expireAt },
  { table: 'audit_logs', key: 'auditLogs', label: (item) => item.action, status: () => 'recorded', ref1: (item) => item.actor, ref2: (item) => item.target, time1: (item) => item.createdAt }
];

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

function pickValue(mapper, item, fallback = null) {
  if (!mapper) {
    return fallback;
  }

  const value = mapper(item);
  return value === undefined || value === '' ? fallback : value;
}

function normalizeTime(value) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

async function syncEntityTables(client, store) {
  for (const config of [...ENTITY_TABLES].reverse()) {
    await client.query(`delete from ${config.table}`);
  }

  for (const config of ENTITY_TABLES) {
    const items = Array.isArray(store[config.key]) ? store[config.key] : [];

    for (const item of items) {
      await client.query(
        `
          insert into ${config.table}
          (id, label, status, ref1, ref2, sort_order, time1, time2, payload)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        `,
        [
          item.id,
          pickValue(config.label, item, item.id),
          pickValue(config.status, item, 'active'),
          pickValue(config.ref1, item),
          pickValue(config.ref2, item),
          Number.isFinite(Number(pickValue(config.sort, item))) ? Number(pickValue(config.sort, item)) : null,
          normalizeTime(pickValue(config.time1, item)),
          normalizeTime(pickValue(config.time2, item)),
          JSON.stringify(item)
        ]
      );
    }
  }
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
    await syncEntityTables(client, store);
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
