const assert = require('assert');

const { createSeedStore } = require('../services/demo-data');
const { replaceStore } = require('../services/db');
const {
  consumeOneTimeCode,
  createCodeBatch,
  createOneTimeCode,
  getStoreHome,
  readStore
} = require('../services/store');

function assertAppError(fn, code) {
  let thrown = null;

  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  assert(thrown, `Expected ${code} to be thrown`);
  assert.strictEqual(thrown.message, code);
}

function findMissingCode() {
  const existing = new Set(readStore().scanCodes.map((item) => item.redeemCode));

  for (let index = 0; index < 1000000; index += 1) {
    const candidate = String(index).padStart(6, '0');
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('No missing redeem code available');
}

function main() {
  const originalStore = readStore();

  try {
    replaceStore(createSeedStore());

    const batch = createCodeBatch({
      wineId: 'soundless-a-quiet-world-2022',
      trackId: 'track_harvest_whisper',
      quantity: 2,
      batchNo: 'TEST_STAGE_0_BATCH'
    });
    assert.strictEqual(batch.codes.length, 2);
    assert(batch.codes.every((item) => item.trackId === 'track_harvest_whisper'));
    assert.strictEqual(new Set(batch.codes.map((item) => item.redeemCode)).size, 2);

    assertAppError(
      () =>
        createCodeBatch({
          wineId: 'soundless-a-quiet-world-2022',
          trackId: 'track_amber_salon',
          quantity: 1,
          batchNo: 'TEST_MISMATCH_BATCH'
        }),
      'TRACK_WINE_MISMATCH'
    );

    const consumed = consumeOneTimeCode(batch.codes[0].redeemCode, 'user_demo_guest', {
      ip: '127.0.0.1',
      userId: 'user_demo_guest'
    });
    assert.strictEqual(consumed.experience.access.scope, 'exclusive');
    assert.strictEqual(consumed.experience.tracks.length, 1);
    assert.strictEqual(consumed.experience.tracks[0].id, 'track_harvest_whisper');

    const autoBatch = createCodeBatch({
      wineId: 'soundless-a-quiet-world-2022',
      quantity: 1,
      batchNo: 'TEST_STAGE_0_AUTO_BATCH'
    });
    assert.strictEqual(autoBatch.codes.length, 1);
    assert.strictEqual(autoBatch.codes[0].trackId, 'track_moonlit_path');

    const storedCode = readStore().scanCodes.find((item) => item.id === batch.codes[0].id);
    assert.strictEqual(storedCode.status, 'claimed');
    assert(storedCode.firstUsedAt);

    assertAppError(
      () =>
        consumeOneTimeCode(batch.codes[0].redeemCode, 'user_demo_guest', {
          ip: '127.0.0.1',
          userId: 'user_demo_guest'
        }),
      'CODE_ALREADY_USED'
    );

    const single = createOneTimeCode({
      redeemCode: '246810',
      wineId: 'soundless-a-quiet-world-2022',
      trackId: 'track_quiet_world',
      batchNo: 'TEST_SINGLE'
    });
    const singlePayload = consumeOneTimeCode(single.code.redeemCode, 'user_demo_guest', {
      ip: '127.0.0.1',
      userId: 'user_demo_guest'
    });
    assert.strictEqual(singlePayload.experience.tracks.length, 1);
    assert.strictEqual(singlePayload.experience.tracks[0].id, 'track_quiet_world');

    assertAppError(() => consumeOneTimeCode('abc', 'user_demo_guest', {}), 'INVALID_REDEEM_CODE');
    assertAppError(() => consumeOneTimeCode(findMissingCode(), 'user_demo_guest', {}), 'CODE_NOT_FOUND');
    assertAppError(() => consumeOneTimeCode('502874', 'user_demo_guest', {}), 'CODE_EXPIRED');
    assertAppError(() => consumeOneTimeCode('731596', 'user_demo_guest', {}), 'CODE_DISABLED');

    const home = getStoreHome('user_demo_guest');
    assert.strictEqual(home.exclusiveEntry, null);

    console.log('stage0-stage1 tests passed');
  } finally {
    replaceStore(originalStore);
  }
}

main();
