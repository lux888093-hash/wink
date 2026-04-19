const { request } = require('../../utils/api');

function buildGalleryImages(product) {
  const seen = new Set();
  return [product.coverImage].concat(product.gallery || []).filter((item) => {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function buildWineMetaLine(product) {
  const wine = (product && product.wine) || {};
  return [wine.name, wine.region].filter(Boolean).join(' · ');
}

function formatStockText(sku) {
  if (!sku || !sku.id) {
    return '暂无规格';
  }
  return sku.availableStock > 0 ? `库存 ${sku.availableStock}件` : '暂时缺货';
}

function emptySku() {
  return {
    id: '',
    specName: '',
    price: '',
    marketPrice: '',
    availableStock: 0
  };
}

Page({
  data: {
    loading: true,
    pageReady: false,
    product: null,
    galleryImages: [],
    activeGalleryIndex: 0,
    galleryDisplayIndex: 1,
    wineMetaLine: '',
    selectedSkuId: '',
    selectedSku: emptySku(),
    stockText: '暂无规格',
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
      const product = productPayload.product;
      const selectedSku = product.skus[0] || emptySku();
      const galleryImages = buildGalleryImages(product);

      getApp().setCartCount(cartPayload.cart.totalCount || 0);

      this.setData({
        loading: false,
        pageReady: true,
        product,
        galleryImages,
        activeGalleryIndex: 0,
        galleryDisplayIndex: galleryImages.length ? 1 : 0,
        wineMetaLine: buildWineMetaLine(product),
        selectedSkuId: selectedSku.id || '',
        selectedSku,
        stockText: formatStockText(selectedSku),
        canBuy: Boolean(selectedSku.id && selectedSku.availableStock > 0),
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
      stockText: formatStockText(sku),
      canBuy: sku.availableStock > 0
    });
  },

  handleGalleryChange(event) {
    const current = Number(event.detail.current) || 0;
    this.setData({
      activeGalleryIndex: current,
      galleryDisplayIndex: current + 1
    });
  },

  previewGallery(event) {
    const galleryImages = this.data.galleryImages || [];
    if (!galleryImages.length) {
      return;
    }

    const index = Number(event.currentTarget.dataset.index);
    const currentIndex = Number.isNaN(index) ? this.data.activeGalleryIndex : index;

    wx.previewImage({
      current: galleryImages[currentIndex] || galleryImages[0],
      urls: galleryImages
    });
  },

  async _addSelectedSku(options = {}) {
    const silent = Boolean(options.silent);
    if (!this.data.selectedSkuId || !this.data.canBuy) {
      if (!silent) {
        wx.showToast({
          title: '当前规格暂无库存',
          icon: 'none'
        });
      }
      return false;
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

      if (!silent) {
        wx.showToast({
          title: '已加入购物袋',
          icon: 'none'
        });
      }
      return true;
    } catch (error) {
      if (!silent) {
        wx.showToast({
          title: '加入失败',
          icon: 'none'
        });
      }
      return false;
    }
  },

  async addToCart() {
    await this._addSelectedSku();
  },

  async buyNow() {
    const success = await this._addSelectedSku({ silent: true });
    if (!success) {
      return;
    }
    wx.navigateTo({ url: '/pages/cart/index' });
  }
});
