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

function buildEstateSections(wine) {
  if (Array.isArray(wine.estateSections) && wine.estateSections.length) {
    return wine.estateSections.filter((item) => item && item.title && item.body);
  }

  return [
    {
      key: 'quiet',
      eyebrow: '01 / 静界',
      title: '先把世界留在门外',
      body: wine.story || wine.estateIntro || ''
    },
    {
      key: 'estate',
      eyebrow: '02 / 风土',
      title: '老藤、红土与桶中时间',
      body: wine.estatePhilosophy || ''
    },
    {
      key: 'maker',
      eyebrow: '03 / 酿造',
      title: '让年份自己说话',
      body: wine.winemakerIntro || ''
    }
  ].filter((item) => item.body);
}

Page({
  data: {
    ready: false,
    wine: null,
    collection: [],
    estateSections: [],
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
      estateSections: buildEstateSections(experience.wine),
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
