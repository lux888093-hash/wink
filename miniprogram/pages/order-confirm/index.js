const { request } = require('../../utils/api');

function randomKey(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function requestPayment(paymentParams) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      ...paymentParams,
      success: resolve,
      fail: reject
    });
  });
}

function mapDeliveryStatus(status) {
  return (
    {
      pending: '待确认',
      delivering: '待发货',
      completed: '已完成',
      rights_issued: '权益已发放',
      downloaded: '已下载',
      closed: '已关闭'
    }[status] || status || ''
  );
}

function normalizeOrder(order) {
  if (!order) {
    return order;
  }

  return {
    ...order,
    deliveryStatusLabel: mapDeliveryStatus(order.deliveryStatus)
  };
}

Page({
  data: {
    loading: true,
    ready: false,
    cart: null,
    submitting: false,
    successOrder: null,
    errorTitle: '',
    errorMessage: ''
  },

  onShow() {
    this.loadCart();
  },

  async loadCart() {
    this.setData({ loading: true, errorTitle: '', errorMessage: '' });

    try {
      const payload = await request({ url: '/api/cart' });
      this.setData({
        loading: false,
        ready: true,
        cart: payload.cart
      });
    } catch (error) {
      this.setData({
        loading: false,
        ready: false,
        errorTitle: '订单页暂不可用',
        errorMessage: error.message === 'NETWORK_ERROR' ? '请先启动本地服务端。' : '购物袋数据读取失败。'
      });
    }
  },

  async pollPaymentStatus(orderId, maxAttempts = 8) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const payload = await request({
        url: `/api/payments/orders/${orderId}/status?refresh=1`
      });

      if (payload.paid) {
        return payload.order;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    throw new Error('PAYMENT_STATUS_TIMEOUT');
  },

  async submitOrder() {
    if (!this.data.cart || !this.data.cart.items.length || this.data.submitting) {
      return;
    }

    this.setData({ submitting: true });

    try {
      const idempotencyKey = randomKey('order');
      const created = await request({
        url: '/api/orders',
        method: 'POST',
        data: {
          addressSummary: '上海市静安区 · 演示收货地址',
          clientRequestId: idempotencyKey
        }
      });
      getApp().setCartCount(created.cart.totalCount || 0);

      const launched = await request({
        url: `/api/payments/orders/${created.order.id}/jsapi`,
        method: 'POST',
        data: {
          idempotencyKey
        }
      });

      if (launched.mode === 'mock') {
        getApp().setCartCount(launched.cart.totalCount || 0);
        this.setData({
          successOrder: normalizeOrder(launched.order),
          cart: launched.cart,
          submitting: false
        });
        return;
      }

      if (launched.mode === 'paid') {
        getApp().setCartCount(0);
        this.setData({
          successOrder: normalizeOrder(launched.order),
          cart: { items: [], totalCount: 0, totalAmount: 0 },
          submitting: false
        });
        return;
      }

      await requestPayment(launched.paymentParams);
      const paidOrder = await this.pollPaymentStatus(created.order.id);
      getApp().setCartCount(0);

      this.setData({
        successOrder: normalizeOrder(paidOrder),
        cart: { items: [], totalCount: 0, totalAmount: 0 },
        submitting: false
      });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({
        title:
          error.message === 'requestPayment:fail cancel'
            ? '已取消支付'
            : error.message === 'SKU_STOCK_NOT_ENOUGH'
              ? '库存不足'
              : error.message === 'WECHAT_AUTH_REQUIRED'
                ? '请先完成微信登录'
                : '下单失败',
        icon: 'none'
      });
    }
  }
});
