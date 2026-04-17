const assert = require('assert');

const { createSeedStore } = require('../services/demo-data');
const { replaceStore } = require('../services/db');
const {
  adminExportOrdersCsv,
  adminReconciliationReport,
  createOrder,
  markWechatRefundAccepted,
  markWechatRefundResult,
  markWechatShippingSynced,
  payOrder,
  prepareWechatRefund,
  prepareWechatShippingSync,
  readStore
} = require('../services/store');

function makeAddress() {
  return {
    contactName: '生产专项测试',
    mobile: '13800000002',
    provinceCity: '上海市静安区',
    detail: '对账路 6 号',
    deliveryNote: '工作日配送'
  };
}

function main() {
  const originalStore = readStore();

  try {
    replaceStore(createSeedStore());

    const created = createOrder('user_demo_guest', {
      items: [{ skuId: 'sku_rose_double', quantity: 1 }],
      address: makeAddress(),
      clientRequestId: 'stage6_wechat_ops_001'
    });
    const paid = payOrder('user_demo_guest', created.order.id);
    assert.strictEqual(paid.order.status, 'paid');

    const shipping = prepareWechatShippingSync(created.order.id, {
      shippingCompany: '顺丰速运',
      trackingNo: 'SF1234567890'
    });
    assert.strictEqual(shipping.wechat.order_key.order_number_type, 2);
    assert.strictEqual(shipping.wechat.shipping_list[0].tracking_no, 'SF1234567890');

    const synced = markWechatShippingSynced(created.order.id, {
      errcode: 0,
      errmsg: 'ok'
    });
    assert.strictEqual(synced.wechatShippingSyncStatus, 'synced');

    const refund = prepareWechatRefund(created.order.id, {
      reason: '测试退款'
    });
    assert.strictEqual(refund.refund.status, 'processing');
    assert.strictEqual(refund.wechat.outTradeNo, refund.order.orderNo);

    const accepted = markWechatRefundAccepted(refund.refund.id, {
      refund_id: 'wx_refund_stage6',
      status: 'PROCESSING'
    });
    assert.strictEqual(accepted.refund.wechatRefundId, 'wx_refund_stage6');

    const refunded = markWechatRefundResult({
      outRefundNo: refund.refund.outRefundNo,
      refundId: 'wx_refund_stage6',
      refundStatus: 'SUCCESS',
      successTime: new Date().toISOString()
    });
    assert.strictEqual(refunded.order.status, 'refunded');
    assert.strictEqual(refunded.refund.status, 'refunded');

    const report = adminReconciliationReport();
    assert(report.summary.orders >= 1);
    assert(Array.isArray(report.anomalies));

    const csv = adminExportOrdersCsv();
    assert(csv.includes('订单号'));
    assert(csv.includes(refund.order.orderNo));

    console.log('stage6 production tests passed');
  } finally {
    replaceStore(originalStore);
  }
}

main();
