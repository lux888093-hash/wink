const { request } = require('../../utils/api');

Page({
  data: {
    loading: true,
    pageReady: false,
    hero: null,
    winery: null,
    featuredProducts: [],
    featuredWines: [],
    membershipPlans: [],
    exclusiveEntry: null,
    user: null,
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
      const payload = await request({ url: '/api/store/home' });
      getApp().setCartCount(payload.cartCount || 0);

      this.setData({
        loading: false,
        pageReady: true,
        hero: payload.hero,
        winery: payload.winery,
        featuredProducts: (payload.featuredProducts || []).map((item) => ({
          ...item,
          hasSkus: Boolean(item.skus && item.skus.length),
          firstMarketPrice: item.skus && item.skus.length ? item.skus[0].marketPrice : ''
        })),
        featuredWines: payload.featuredWines || [],
        membershipPlans: (payload.membershipPlans || []).map((item) => ({
          ...item,
          benefitsLabel: (item.benefits || []).join(' · ')
        })),
        exclusiveEntry: payload.exclusiveEntry || null,
        user: payload.user,
        cartCount: payload.cartCount || 0
      });
    } catch (error) {
      this.setData({
        loading: false,
        pageReady: false,
        errorTitle: '庄园目录暂时不可用',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? '请先启动本地服务端，再重新进入首页。'
            : '首页数据加载失败，请稍后重试。'
      });
    }
  },

  async enterExclusive() {
    const entry = this.data.exclusiveEntry;
    if (!entry || !entry.sessionId) {
      return;
    }

    try {
      const payload = await request({
        url: `/api/sessions/${entry.sessionId}`
      });
      getApp().setExperience(payload.sessionId, payload.experience);
      wx.navigateTo({ url: '/pages/cellar/index' });
    } catch (error) {
      wx.showToast({
        title: error.message === 'SESSION_EXPIRED' ? '专属体验已过期' : '进入失败',
        icon: 'none'
      });
    }
  },

  openRedeem() {
    wx.navigateTo({ url: '/pages/redeem/index' });
  },

  openStore() {
    wx.reLaunch({ url: '/pages/store/index' });
  },

  openMember() {
    wx.reLaunch({ url: '/pages/member/index' });
  },

  openWine(event) {
    const { wineId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/index?wineId=${wineId}`
    });
  },

  openProduct(event) {
    const { productId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/product-detail/index?id=${productId}`
    });
  }
});
