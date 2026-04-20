const { request } = require('../../utils/api');

function buildProductItems(items = []) {
  const sourceItems = Array.isArray(items) ? items : [];

  return sourceItems.map((item) => {
    const firstSku = item.skus && item.skus.length ? item.skus[0] : null;

    return {
      ...item,
      firstSkuId: firstSku ? firstSku.id : '',
      canQuickAdd: Boolean(firstSku && firstSku.availableStock > 0)
    };
  });
}

function buildCatalogSections(items = []) {
  const normalizedItems = buildProductItems(items);

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
    addingSkuId: '',
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

  async addToCart(event) {
    const skuId = event.currentTarget.dataset.skuId;

    if (!skuId) {
      wx.showToast({
        title: '当前商品暂无库存',
        icon: 'none'
      });
      return;
    }

    if (this.data.addingSkuId) {
      return;
    }

    this.setData({ addingSkuId: skuId });

    try {
      const payload = await request({
        url: '/api/cart/items',
        method: 'POST',
        data: {
          skuId,
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
    } finally {
      this.setData({ addingSkuId: '' });
    }
  },

  openProduct(event) {
    const { productId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/product-detail/index?id=${productId}`
    });
  }
});
