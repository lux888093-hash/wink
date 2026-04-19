const { request } = require('../../utils/api');

Page({
  data: {
    loading: true,
    ready: false,
    cart: null,
    cartCount: 0,
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
      getApp().setCartCount(payload.cart.totalCount || 0);

      this.setData({
        loading: false,
        ready: true,
        cart: payload.cart,
        cartCount: payload.cart.totalCount || 0,
        hasItems: Boolean(payload.cart.items && payload.cart.items.length)
      });
    } catch (error) {
      this.setData({
        loading: false,
        ready: false,
        errorTitle: '购物袋暂不可用',
        errorMessage: error.message === 'NETWORK_ERROR' ? '请先启动本地服务端。' : '请稍后重试。'
      });
    }
  },

  /* --- 数量加减 --- */
  async changeQuantity(event) {
    const { itemId, step } = event.currentTarget.dataset;
    const target = (this.data.cart && this.data.cart.items || []).find((item) => item.id === itemId);
    if (!target) return;

    try {
      const payload = await request({
        url: `/api/cart/items/${itemId}`,
        method: 'PUT',
        data: { quantity: target.quantity + Number(step) }
      });
      getApp().setCartCount(payload.cart.totalCount || 0);
      this.setData({
        cart: payload.cart,
        cartCount: payload.cart.totalCount || 0,
        hasItems: Boolean(payload.cart.items && payload.cart.items.length)
      });
    } catch (error) {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  /* --- 删除商品 --- */
  async removeItem(event) {
    const { itemId } = event.currentTarget.dataset;

    try {
      const payload = await request({
        url: `/api/cart/items/${itemId}`,
        method: 'DELETE'
      });
      getApp().setCartCount(payload.cart.totalCount || 0);
      this.setData({
        cart: payload.cart,
        cartCount: payload.cart.totalCount || 0,
        hasItems: Boolean(payload.cart.items && payload.cart.items.length)
      });
    } catch (error) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  /* --- 结算 --- */
  checkout() {
    if (!this.data.cart || !this.data.cart.items.length) return;

    wx.navigateTo({ url: '/pages/order-confirm/index' });
  }
});
