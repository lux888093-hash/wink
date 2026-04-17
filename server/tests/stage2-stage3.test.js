const assert = require('assert');

const { createSeedStore } = require('../services/demo-data');
const { replaceStore } = require('../services/db');
const { hashPassword } = require('../services/security');
const {
  adminLogin,
  adminUpdateOrder,
  assertAdmin,
  assertAdminPermission,
  createOrder,
  listOrders,
  listUserAddresses,
  payOrder,
  readStore,
  requestOrderRefund,
  saveUserAddress
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

function makeAddress(suffix = '') {
  return {
    contactName: `测试收货人${suffix}`,
    mobile: '13800000001',
    provinceCity: '上海市静安区',
    detail: `测试路 ${suffix || '1'} 号`,
    deliveryNote: '电话确认'
  };
}

function main() {
  const originalStore = readStore();

  try {
    const seed = createSeedStore();
    seed.adminUsers.push({
      id: 'admin_ops_test',
      username: 'ops_test',
      passwordHash: hashPassword('OpsTest!2026'),
      roleId: 'role_ops',
      status: 'active',
      displayName: '运营测试',
      lastLoginAt: null
    });
    replaceStore(seed);

    const superLogin = adminLogin({ username: 'curator', password: 'Curator!2026' });
    let store = readStore();
    const superAdmin = assertAdmin(store, superLogin.token);
    assertAdminPermission(store, superAdmin, 'products.write');
    assert(superLogin.user.permissions.includes('*'));

    const opsLogin = adminLogin({ username: 'ops_test', password: 'OpsTest!2026' });
    store = readStore();
    const opsAdmin = assertAdmin(store, opsLogin.token);
    assertAdminPermission(store, opsAdmin, 'codes.write');
    assertAppError(() => assertAdminPermission(store, opsAdmin, 'products.write'), 'ADMIN_FORBIDDEN');

    const savedAddress = saveUserAddress('user_demo_guest', {
      ...makeAddress('A'),
      isDefault: true
    });
    assert.strictEqual(savedAddress.item.isDefault, true);
    assert.strictEqual(listUserAddresses('user_demo_guest').items[0].contactName, '测试收货人A');

    store = readStore();
    const skuId = 'sku_rose_double';
    const initialSku = store.productSkus.find((item) => item.id === skuId);
    const initialStock = initialSku.stock;

    const created = createOrder('user_demo_guest', {
      items: [{ skuId, quantity: 1 }],
      address: makeAddress('B'),
      clientRequestId: 'stage3_order_paid_001'
    });
    assert.strictEqual(created.order.status, 'pending_payment');
    store = readStore();
    assert.strictEqual(store.productSkus.find((item) => item.id === skuId).reservedStock, 1);

    const paid = payOrder('user_demo_guest', created.order.id);
    assert.strictEqual(paid.order.status, 'paid');
    store = readStore();
    let sku = store.productSkus.find((item) => item.id === skuId);
    assert.strictEqual(sku.stock, initialStock - 1);
    assert.strictEqual(sku.reservedStock, 0);

    const refund = requestOrderRefund('user_demo_guest', created.order.id, {
      reason: '测试退款'
    });
    assert.strictEqual(refund.refund.status, 'pending');
    const refunded = adminUpdateOrder(created.order.id, {
      status: 'refunded',
      refundReason: '测试退款通过',
      restock: true
    });
    assert.strictEqual(refunded.status, 'refunded');
    store = readStore();
    sku = store.productSkus.find((item) => item.id === skuId);
    assert.strictEqual(sku.stock, initialStock);

    const pending = createOrder('user_demo_guest', {
      items: [{ skuId, quantity: 1 }],
      address: makeAddress('C'),
      clientRequestId: 'stage3_order_expired_001'
    });
    store = readStore();
    const pendingOrder = store.orders.find((item) => item.id === pending.order.id);
    pendingOrder.expiresAt = new Date(Date.now() - 1000).toISOString();
    replaceStore(store);

    listOrders('user_demo_guest');
    store = readStore();
    const closedOrder = store.orders.find((item) => item.id === pending.order.id);
    sku = store.productSkus.find((item) => item.id === skuId);
    assert.strictEqual(closedOrder.status, 'closed');
    assert.strictEqual(closedOrder.stockReserved, false);
    assert.strictEqual(sku.reservedStock, 0);

    console.log('stage2-stage3 tests passed');
  } finally {
    replaceStore(originalStore);
  }
}

main();
