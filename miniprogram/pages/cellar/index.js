const { getCurrentExperience } = require('../../utils/session');

function normalizeEyebrow(value, fallback) {
  const text = String(value || fallback || '').trim();
  const parts = text.split('/');
  return parts[parts.length - 1].trim() || text;
}

function buildScenes(wine, collection) {
  if (Array.isArray(collection) && collection.length) {
    return collection;
  }

  return [
    {
      id: 'estate-hero',
      vintage: '酒庄',
      title: wine.estateTagline || wine.estateName || '鸿玖酒庄',
      note: wine.estateIntro || '',
      image: wine.estateHeroImage || wine.posterImage || wine.bottleImage
    },
    {
      id: 'estate-poster',
      vintage: '酒款',
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
      eyebrow: '静界',
      title: '先把世界留在门外',
      body: wine.story || wine.estateIntro || ''
    },
    {
      key: 'estate',
      eyebrow: '风土',
      title: '老藤、红土与桶中时间',
      body: wine.estatePhilosophy || ''
    },
    {
      key: 'maker',
      eyebrow: '酿造',
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
    storyModules: [],
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

    const collection = buildScenes(experience.wine, experience.collection);
    const estateSections = buildEstateSections(experience.wine);

    this.setData({
      ready: true,
      wine: experience.wine,
      collection,
      estateSections,
      storyModules: this.buildStoryModules(experience.wine, estateSections, collection),
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
  },

  buildStoryModules(wine, estateSections, collection) {
    if (!Array.isArray(estateSections) || !estateSections.length) {
      return [];
    }

    const imagePool = [
      (collection[0] && collection[0].image) || wine.estateHeroImage || '/assets/images/village-ancient-vine-sign.jpg',
      (collection[1] && collection[1].image) || wine.harvestImage || '/assets/images/village-ancient-vine-cellar.jpg',
      wine.giftImage || wine.posterImage || wine.bottleImage || '/assets/images/village-ancient-vine-packaging.jpg',
      (collection[2] && collection[2].image) || wine.winemakerImage || wine.estatePortraitImage || '/assets/images/eva-glaetzer-winemaker.jpg',
      (collection[3] && collection[3].image) || wine.posterImage || wine.bottleImage || '/assets/images/vinyl-ode-bottle-vineyard.jpg',
      '/assets/images/winery-cottage-night.jpg'
    ];

    return estateSections.slice(0, 6).map((section, index) => ({
      key: section.key || `story-${index}`,
      eyebrow: normalizeEyebrow(section.eyebrow, `篇章 ${index + 1}`),
      title: section.title,
      body: section.body,
      image: section.image || imagePool[index] || imagePool[imagePool.length - 1],
      layoutClass: index % 2 === 0 ? 'is-odd' : 'is-even',
      sizeClass: index === 0 ? 'is-hero' : index % 3 === 1 ? 'is-wide' : 'is-regular'
    }));
  }
});
