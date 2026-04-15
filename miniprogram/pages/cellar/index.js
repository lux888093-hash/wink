const { getCurrentExperience } = require('../../utils/session');

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

  loadExperience() {
    const experience = getCurrentExperience();

    if (!experience) {
      this.setData({
        ready: false,
        errorTitle: '专属页未激活',
        errorMessage: '请先输入有效的提取码，才能查看这瓶酒的专属内容。'
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
  },

  goBack() {
    wx.redirectTo({ url: '/pages/redeem/index' });
  },

  openDetail() {
    wx.redirectTo({ url: '/pages/detail/index' });
  },

  openMelody() {
    wx.redirectTo({ url: '/pages/melody/index' });
  }
});
