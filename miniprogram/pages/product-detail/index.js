const { request } = require('../../utils/api');

Page({
  data: {
    loading: true,
    pageReady: false,
    product: null,
    selectedSkuId: '',
    selectedSku: null,
    canBuy: false,
    cartCount: 0,
    errorTitle: '',
    errorMessage: ''
  },

  onLoad(query) {
    this.productId = query.id || '';
  },

  onShow() {
    this.loadPage();
  },

  async loadPage() {
    if (!this.productId) {
      this.setData({
        loading: false,
        pageReady: false,
        errorTitle: '未找到商品',
        errorMessage: '缺少商品参数。'
      });
      return;
    }

    this.setData({ loading: true, errorTitle: '', errorMessage: '' });

    try {
      const [productPayload, cartPayload] = await Promise.all([
        request({ url: `/api/products/${this.productId}` }),
        request({ url: '/api/cart' })
      ]);
      const selectedSku = productPayload.product.skus[0] || null;

      getApp().setCartCount(cartPayload.cart.totalCount || 0);

      this.setData({
        loading: false,
        pageReady: true,
        product: productPayload.product,
        selectedSkuId: selectedSku ? selectedSku.id : '',
        selectedSku,
        canBuy: Boolean(selectedSku && selectedSku.availableStock > 0),
        cartCount: cartPayload.cart.totalCount || 0
      });
    } catch (error) {
      this.setData({
        loading: false,
        pageReady: false,
        errorTitle: '商品详情加载失败',
        errorMessage:
          error.message === 'NETWORK_ERROR' ? '请先启动本地服务端。' : '请返回酒廊重新选择商品。'
      });
    }
  },

  selectSku(event) {
    const skuId = event.currentTarget.dataset.skuId;
    const sku = (this.data.product && this.data.product.skus || []).find((item) => item.id === skuId);

    if (!sku) {
      return;
    }

    this.setData({
      selectedSkuId: sku.id,
      selectedSku: sku,
      canBuy: sku.availableStock > 0
    });
  },

  async addToCart() {
    if (!this.data.selectedSkuId || !this.data.canBuy) {
      wx.showToast({
        title: '当前规格暂无库存',
        icon: 'none'
      });
      return;
    }

    try {
      const payload = await request({
        url: '/api/cart/items',
        method: 'POST',
        data: {
          skuId: this.data.selectedSkuId,
          quantity: 1
        }
      });

      getApp().setCartCount(payload.cart.totalCount || 0);
      this.setData({
        cartCount: payload.cart.totalCount || 0
      });

      wx.showToast({
        title: '已加入购物袋',
        icon: 'none'
      });
    } catch (error) {
      wx.showToast({
        title: '加入失败',
        icon: 'none'
      });
    }
  },

  async buyNow() {
    await this.addToCart();
    wx.navigateTo({ url: '/pages/cart/index' });
  }
});
