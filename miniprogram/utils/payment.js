const { request } = require('./api');

function randomKey(prefix) {
  return `${prefix || 'pay'}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function requestWechatPayment(paymentParams) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      ...paymentParams,
      success: resolve,
      fail: reject
    });
  });
}

async function pollPaymentStatus(orderId, options = {}) {
  const maxAttempts = options.maxAttempts || 8;
  const intervalMs = options.intervalMs || 1200;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payload = await request({
      url: `/api/payments/orders/${orderId}/status?refresh=1`
    });

    if (payload.paid) {
      return payload;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('PAYMENT_STATUS_TIMEOUT');
}

async function payPendingOrder(order, options = {}) {
  if (!order || order.status !== 'pending_payment') {
    return {
      mode: 'already_paid',
      order
    };
  }

  const idempotencyKey = options.idempotencyKey || randomKey('pay');
  const launched = await request({
    url: `/api/payments/orders/${order.id}/jsapi`,
    method: 'POST',
    data: {
      idempotencyKey
    }
  });

  if (launched.mode === 'mock' || launched.mode === 'paid') {
    return launched;
  }

  await requestWechatPayment(launched.paymentParams);
  const status = await pollPaymentStatus(order.id, options);

  return {
    ...status,
    mode: launched.mode || 'wechat'
  };
}

function isPaymentCancelled(error) {
  return /cancel/i.test(String(error && error.message ? error.message : error || ''));
}

module.exports = {
  isPaymentCancelled,
  payPendingOrder,
  pollPaymentStatus,
  randomKey,
  requestWechatPayment
};
