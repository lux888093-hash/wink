const { request } = require('../../utils/api');
const { isPaymentCancelled, payPendingOrder, randomKey } = require('../../utils/payment');

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
    address: {
      contactName: '',
      mobile: '',
      provinceCity: '',
      detail: '',
      deliveryNote: ''
    },
    saveAddress: true,
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
      const [payload, addressesPayload] = await Promise.all([
        request({ url: '/api/cart' }),
        request({ url: '/api/addresses' })
      ]);
      const defaultAddress =
        (addressesPayload.items || []).find((item) => item.isDefault) ||
        (addressesPayload.items || [])[0] ||
        {
          contactName: '',
          mobile: '',
          provinceCity: '上海市静安区',
          detail: '',
          deliveryNote: ''
        };

      this.setData({
        loading: false,
        ready: true,
        cart: payload.cart,
        address: {
          contactName: defaultAddress.contactName || '',
          mobile: defaultAddress.mobile || '',
          provinceCity: defaultAddress.provinceCity || '',
          detail: defaultAddress.detail || '',
          deliveryNote: defaultAddress.deliveryNote || ''
        }
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

  bindAddressInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }

    this.setData({
      [`address.${field}`]: event.detail.value
    });
  },

  validateAddress() {
    const address = this.data.address || {};
    if (!address.contactName || !address.mobile || !address.provinceCity || !address.detail) {
      wx.showToast({
        title: '请补全收货信息',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  async submitOrder() {
    if (!this.data.cart || !this.data.cart.items.length || this.data.submitting) {
      return;
    }

    if (!this.validateAddress()) {
      return;
    }

    this.setData({ submitting: true });

    try {
      const idempotencyKey = randomKey('order');
      const created = await request({
        url: '/api/orders',
        method: 'POST',
        data: {
          address: this.data.address,
          saveAddress: this.data.saveAddress,
          clientRequestId: idempotencyKey
        }
      });
      getApp().setCartCount(created.cart.totalCount || 0);

      const paidPayload = await payPendingOrder(created.order, { idempotencyKey });
      const paidOrder = paidPayload.order;
      const nextCart = paidPayload.cart || { items: [], totalCount: 0, totalAmount: 0 };
      getApp().setCartCount(nextCart.totalCount || 0);

      this.setData({
        successOrder: normalizeOrder(paidOrder),
        cart: nextCart,
        submitting: false
      });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({
        title:
          isPaymentCancelled(error)
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
