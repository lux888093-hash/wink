const assert = require('assert');

const { getReadinessChecks, runtimeConfig } = require('../services/config');

function main() {
  const report = getReadinessChecks();
  assert(Array.isArray(report.checks));
  assert(report.checks.some((item) => item.key === 'database'));
  assert(report.checks.some((item) => item.key === 'wechat_pay'));
  assert(report.checks.some((item) => item.key === 'backup_dir'));

  if (!runtimeConfig.isProduction) {
    assert.strictEqual(report.ready, false);
  }

  console.log('stage5 tests passed');
}

main();
