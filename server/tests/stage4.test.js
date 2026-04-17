const assert = require('assert');

const { createSeedStore } = require('../services/demo-data');
const { replaceStore } = require('../services/db');
const {
  getMemberProfile,
  payOrder,
  purchaseMembership,
  readStore,
  unlockTrack
} = require('../services/store');

function main() {
  const originalStore = readStore();

  try {
    replaceStore(createSeedStore());

    const beforeProfile = getMemberProfile('user_demo_guest');
    assert.strictEqual(beforeProfile.membership, null);

    const createdMembershipOrder = purchaseMembership('user_demo_guest', {
      planId: 'plan_quarter',
      clientRequestId: 'stage4_membership_001'
    });
    assert.strictEqual(createdMembershipOrder.order.status, 'pending_payment');
    assert.strictEqual(createdMembershipOrder.paymentRequired, true);
    assert.strictEqual(getMemberProfile('user_demo_guest').membership, null);

    const paidMembershipOrder = payOrder('user_demo_guest', createdMembershipOrder.order.id);
    assert.strictEqual(paidMembershipOrder.order.status, 'completed');
    const paidProfile = getMemberProfile('user_demo_guest');
    assert(paidProfile.membership && paidProfile.membership.isActive);
    assert.strictEqual(paidProfile.entitlements.length, 1);

    const memberBeforeRenew = getMemberProfile('user_demo_member').membership;
    const previousExpireAt = new Date(memberBeforeRenew.expireAt).getTime();
    const renewalOrder = purchaseMembership('user_demo_member', {
      planId: 'plan_quarter',
      clientRequestId: 'stage4_membership_renew_001'
    });
    payOrder('user_demo_member', renewalOrder.order.id);
    const memberAfterRenew = getMemberProfile('user_demo_member').membership;
    assert(new Date(memberAfterRenew.expireAt).getTime() > previousExpireAt);

    const createdTrackOrder = unlockTrack('user_demo_guest', 'track_amber_salon', {
      action: 'purchase',
      clientRequestId: 'stage4_track_001'
    });
    assert.strictEqual(createdTrackOrder.paymentRequired, true);
    assert.strictEqual(createdTrackOrder.unlocked, false);
    let store = readStore();
    assert(!store.downloadEntitlements.some((item) => item.userId === 'user_demo_guest' && item.trackId === 'track_amber_salon'));

    payOrder('user_demo_guest', createdTrackOrder.order.id);
    store = readStore();
    assert(store.downloadEntitlements.some((item) => item.userId === 'user_demo_guest' && item.trackId === 'track_amber_salon'));

    console.log('stage4 tests passed');
  } finally {
    replaceStore(originalStore);
  }
}

main();
