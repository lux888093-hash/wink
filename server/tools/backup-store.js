require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { runtimeConfig } = require('../services/config');
const { readStore } = require('../services/store');

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function resolveBackupDir() {
  return path.isAbsolute(runtimeConfig.backupDir)
    ? runtimeConfig.backupDir
    : path.join(__dirname, '..', runtimeConfig.backupDir);
}

function main() {
  const backupDir = resolveBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });

  const store = readStore();
  const target = path.join(backupDir, `store-backup-${timestampForFile()}.json`);
  fs.writeFileSync(target, JSON.stringify(store, null, 2), 'utf8');

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        path: target,
        bytes: fs.statSync(target).size
      },
      null,
      2
    )
  );
}

main();
