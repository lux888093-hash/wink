const { request } = require('../../utils/api');
const { restoreExperience, getCurrentExperience } = require('../../utils/session');

Page({
  data: {
    ready: false,
    experience: null,
    wine: null,
    showMall: true,
    errorTitle: '',
    errorMessage: ''
  },

  onLoad(query) {
    this.wineId = query.wineId || '';
    this.entryScope = query.scope || (this.wineId ? 'public' : 'exclusive');
    this.setData({
      entryScope: this.entryScope
    });
  },

  onShow() {
    this.loadPage();
  },

  async loadPage() {
    try {
      let experience = null;

      if (this.wineId) {
        const payload = await request({
          url: `/api/wines/${this.wineId}/experience`
        });
        experience = payload.experience;
      } else {
        experience = getCurrentExperience() || (await restoreExperience());
      }

      if (!experience) {
        this.setData({
          ready: false,
          errorTitle: '未找到酒款内容',
          errorMessage: '请从专属体验或商城列表重新进入。'
        });
        return;
      }

      this.setData({
        ready: true,
        experience,
        wine: experience.wine,
        showMall: experience.access.showMall,
        errorTitle: '',
        errorMessage: ''
      });
    } catch (error) {
      this.setData({
        ready: false,
        errorTitle: '酒款详情暂不可用',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? '请先启动本地服务端。'
            : '当前内容可能已过期，请重新进入。'
      });
    }
  },

  openMelody() {
    const tracks = this.data.experience && this.data.experience.tracks ? this.data.experience.tracks : [];
    if (!tracks.length) {
      return;
    }

    if (this.wineId) {
      wx.navigateTo({
        url: `/pages/melody/index?trackId=${tracks[0].id}&scope=public`
      });
      return;
    }

    wx.redirectTo({ url: '/pages/melody/index' });
  },

  openProduct() {
    if (!this.data.wine || !this.data.wine.productId) {
      return;
    }

    wx.navigateTo({
      url: `/pages/product-detail/index?id=${this.data.wine.productId}`
    });
  }
});
