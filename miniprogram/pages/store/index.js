const { request } = require('../../utils/api');

Page({
  data: {
    loading: true,
    pageReady: false,
    categories: [],
    activeCategory: '全部',
    items: [],
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

      this.setData({
        loading: false,
        pageReady: true,
        categories: productsPayload.categories || [],
        items: (productsPayload.items || []).map((item) => ({
          ...item,
          hasSkus: Boolean(item.skus && item.skus.length),
          firstMarketPrice: item.skus && item.skus.length ? item.skus[0].marketPrice : ''
        })),
        cartCount: cartPayload.cart.totalCount || 0,
        activeCategory: '全部'
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

  async switchCategory(event) {
    const category = event.currentTarget.dataset.category;
    this.setData({ activeCategory: category });

    try {
      const payload = await request({
        url: category === '全部' ? '/api/products' : `/api/products?category=${category}`
      });
      this.setData({
        items: (payload.items || []).map((item) => ({
          ...item,
          hasSkus: Boolean(item.skus && item.skus.length),
          firstMarketPrice: item.skus && item.skus.length ? item.skus[0].marketPrice : ''
        }))
      });
    } catch (error) {
      wx.showToast({
        title: '筛选失败',
        icon: 'none'
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
