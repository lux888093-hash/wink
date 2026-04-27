const { getCurrentExperience } = require('../../utils/session');

function buildScenes(wine, collection) {
  if (Array.isArray(collection) && collection.length) {
    return collection;
  }

  return [
    {
      id: 'estate-hero',
      vintage: 'ESTATE',
      title: wine.estateTagline || wine.estateName || '鸿玖酒庄',
      note: wine.estateIntro || '',
      image: wine.estateHeroImage || wine.posterImage || wine.bottleImage
    },
    {
      id: 'estate-poster',
      vintage: 'WINE',
      title: wine.name || '酒款',
      note: wine.subtitle || '',
      image: wine.posterImage || wine.estateHeroImage || wine.bottleImage
    }
  ].filter((item) => item.image);
}

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
      collection: buildScenes(experience.wine, experience.collection),
      errorTitle: '',
      errorMessage: ''
    });

    const app = getApp();
    const state = app.getPlayerState ? app.getPlayerState() : null;
    const tracks = state && Array.isArray(state.tracks) ? state.tracks : [];
    if (app.startExperiencePlayback && experience.tracks && experience.tracks.length && !tracks.length) {
      app.startExperiencePlayback(experience, {
        autoplay: true,
        preserve: false
      });
    }
  },

  goBack() {
    wx.redirectTo({ url: '/pages/redeem/index' });
  },

  openDetail() {
    wx.redirectTo({ url: '/pages/detail/index' });
  }
});
