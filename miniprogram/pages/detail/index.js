const { request } = require('../../utils/api');
const { getCurrentExperience } = require('../../utils/session');

function buildEditorialSections(wine) {
  if (!wine) {
    return [];
  }

  return [
    {
      key: 'overview',
      eyebrow: '风味',
      title: '先看结构，再读说明',
      body: wine.overview || '',
      image: wine.harvestImage || wine.estateHeroImage || wine.posterImage || wine.bottleImage || '',
      imageClass: 'is-tall'
    },
    {
      key: 'story',
      eyebrow: '酒款',
      title: wine.storyTitle || '静界的入口',
      body: wine.story || wine.quote || '',
      image: wine.posterImage || wine.bottleImage || wine.estateHeroImage || '',
      imageClass: 'is-wide'
    },
    wine.winemakerIntro
      ? {
          key: 'maker',
          eyebrow: '酿造',
          title: wine.winemakerCnName || wine.winemakerName || '酿酒师',
          body: wine.winemakerIntro,
          image: wine.winemakerImage || wine.estatePortraitImage || wine.harvestImage || '',
          imageClass: 'is-portrait'
        }
      : null
  ].filter((item) => item && item.body && item.image);
}

Page({
  data: {
    ready: false,
    experience: null,
    wine: null,
    editorialSections: [],
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
        experience = getCurrentExperience();
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
        editorialSections: buildEditorialSections(experience.wine),
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
            ? '网络连接不可用，请确认连接后重试。'
            : '当前内容可能已过期，请重新进入。'
      });
    }
  }
});
