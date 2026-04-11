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
          errorTitle: 'Cellar locked.',
          errorMessage: 'Unlock the current wine experience from the one-time entry page first.'
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
        errorTitle: 'Collection unavailable.',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? 'The local backend is not running.'
            : 'This session has expired. Re-enter from the scan page.'
      });
    }
  },

  openDetail() {
    wx.redirectTo({ url: '/pages/detail/index' });
  }
});
