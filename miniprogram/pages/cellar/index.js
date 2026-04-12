const { restoreExperience, getCurrentExperience } = require('../../utils/session');

Page({
  data: {
    ready: false,
    wine: null,
    collection: [],
    errorTitle: '',
    errorMessage: ''
  },

  onShow() {
    this.loadExperience();
  },

  async loadExperience() {
    try {
      const experience = getCurrentExperience() || (await restoreExperience());

      if (!experience) {
        this.setData({
          ready: false,
          errorTitle: '专属页未激活',
          errorMessage: '请先通过礼盒二维码进入，才能查看这瓶酒的专属内容。'
        });
        return;
      }

      this.setData({
        ready: true,
        wine: experience.wine,
        collection: experience.collection || [],
        errorTitle: '',
        errorMessage: ''
      });
    } catch (error) {
      this.setData({
        ready: false,
        errorTitle: '专属会话不可用',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? '本地服务端未启动。'
            : '当前专属体验已过期，请重新扫码进入。'
      });
    }
  },

  openDetail() {
    wx.redirectTo({ url: '/pages/detail/index' });
  },

  openMelody() {
    wx.redirectTo({ url: '/pages/melody/index' });
  }
});
