const { restoreExperience, getCurrentExperience } = require('../../utils/session');

Page({
  data: {
    ready: false,
    wine: null,
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
          errorTitle: 'No active tasting session.',
          errorMessage: 'Enter from the one-time entry page first, or generate a fresh demo card.'
        });
        return;
      }

      this.setData({
        ready: true,
        wine: experience.wine,
        errorTitle: '',
        errorMessage: ''
      });
    } catch (error) {
      this.setData({
        ready: false,
        errorTitle: 'Session unavailable.',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? 'The local backend is not connected. Start `server/` first.'
            : 'This session is no longer valid. Re-enter from the one-time scan page.'
      });
    }
  },

  openMelody() {
    wx.redirectTo({ url: '/pages/melody/index' });
  }
});
