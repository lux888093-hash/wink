const { request } = require('../../utils/api');

function buildCatalogSections(items = []) {
  const normalizedItems = Array.isArray(items) ? items : [];

  return {
    featuredItem: normalizedItems[0] || null,
    gridItems: normalizedItems.slice(1)
  };
}

Page({
  data: {
    loading: true,
    pageReady: false,
    featuredItem: null,
    gridItems: [],
    cartCount: 0,
    errorTitle: '',
    errorMessage: ''
  },

  onShow() {
    this.loadPage();
  },

  async loadPage() {
    this.setData({ loading: true, errorTitle: '', errorMessage: '' });

    try {
      const [productsPayload, cartPayload] = await Promise.all([
        request({ url: '/api/products' }),
        request({ url: '/api/cart' })
      ]);

      getApp().setCartCount(cartPayload.cart.totalCount || 0);
      const catalogSections = buildCatalogSections(productsPayload.items);

      this.setData({
        loading: false,
        pageReady: true,
        ...catalogSections,
        cartCount: cartPayload.cart.totalCount || 0
      });
    } catch (error) {
      this.setData({
        loading: false,
        pageReady: false,
        errorTitle: '酒廊未准备好',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? '请先启动本地服务端。'
            : '商品目录加载失败，请稍后再试。'
      });
    }
  },

  openProduct(event) {
    const { productId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/product-detail/index?id=${productId}`
    });
  }
});
