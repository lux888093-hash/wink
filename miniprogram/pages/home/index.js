const { request } = require('../../utils/api');

function normalizeChapterEyebrow(value, fallback) {
  const text = String(value || '').trim().toUpperCase();

  if (text.includes('PHILOSOPHY')) {
    return '静界';
  }

  if (text.includes('ORIGIN')) {
    return '老藤';
  }

  if (text.includes('RESONANCE')) {
    return '共振';
  }

  return String(value || fallback || '').trim();
}

Page({
  data: {
    loading: true,
    pageReady: false,
    hero: null,
    homeContent: null,
    winery: null,
    heroImage: '',
    estateFacts: [],
    estateSections: [],
    estateChapters: [],
    statementKicker: '',
    statementTitle: '',
    ageNote: '',
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
      const hero = payload.hero || {};
      const homeContent = payload.homeContent || {};
      const winery = payload.winery || {};
      getApp().setCartCount(payload.cartCount || 0);

      this.setData({
        loading: false,
        pageReady: true,
        hero,
        homeContent,
        winery,
        heroImage: this.resolveHeroImage(winery),
        estateFacts: this.buildEstateFacts(winery, homeContent),
        estateSections: this.buildEstateSections(homeContent, winery),
        estateChapters: this.buildEstateChapters(winery, homeContent),
        statementKicker: homeContent.statementKicker || '酒庄档案',
        statementTitle: this.buildStatementTitle(homeContent),
        ageNote: homeContent.ageNote || hero.ambienceNote || '理性饮酒，拒绝酒驾。未成年人禁止饮酒。',
        cartCount: payload.cartCount || 0
      });
    } catch (error) {
      this.setData({
        loading: false,
        pageReady: false,
        errorTitle: '庄园目录暂时不可用',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? '网络连接不可用，请确认连接后重试。'
            : '首页数据加载失败，请稍后重试。'
      });
    }
  },

  resolveHeroImage(winery) {
    return winery.heroImage || '/assets/images/winery-vineyard-moon.jpg';
  },

  buildStatementTitle(homeContent) {
    const title = homeContent && homeContent.statementTitle ? String(homeContent.statementTitle).trim() : '';

    if (title && title.length <= 10) {
      return title;
    }

    return '月色、藤影与木屋';
  },

  buildEstateFacts(winery, homeContent) {
    if (Array.isArray(homeContent.facts)) {
      const facts = homeContent.facts.filter((item) => item && item.label && item.value);
      if (facts.length) {
        return facts;
      }
    }

    return [
      {
        label: '主线',
        value: '月光、葡萄藤与木屋'
      },
      {
        label: '气质',
        value: winery.tagline || 'Moonlit Vineyard Residency'
      },
      {
        label: '秩序',
        value: '安静、克制、留白'
      }
    ];
  },

  buildEstateChapters(winery, homeContent) {
    if (Array.isArray(homeContent.chapters)) {
      const chapters = homeContent.chapters
        .filter((item) => item && item.title)
        .map((item, index) => ({
          ...item,
          eyebrow: normalizeChapterEyebrow(item.eyebrow, `篇章 ${index + 1}`)
        }))
        .slice(0, 3);
      if (chapters.length) {
        return chapters;
      }
    }

    return [
      {
        eyebrow: '静界',
        title: '夜色里的葡萄园',
        body:
          '鸿玖把庄园的第一印象留给夜色、藤影和远处的微光。这里的画面不急着解释，只让葡萄园先成为记忆。',
        image: winery.harvestImage || '/assets/images/harvest-under-moon.jpg'
      },
      {
        eyebrow: '木屋',
        title: '一盏留亮的窗',
        body:
          '庄园的故事从一盏窗开始：木屋、藤影、夜风和被留住的微光，让酒有了可以被记住的住所。',
        image: winery.portraitImage || '/assets/images/winery-cottage-night.jpg'
      },
      {
        eyebrow: '秩序',
        title: '留白中的秩序',
        body:
          '深色、木质与一抹金色只作为背景，让庄园本身成为主角。信息被压缩到必要的几句，余下交给画面。',
        image: winery.heroImage || '/assets/images/winery-vineyard-moon.jpg'
      }
    ];
  },

  buildEstateSections(homeContent, winery) {
    if (Array.isArray(homeContent.sections)) {
      const sections = homeContent.sections.filter((item) => item && item.title && item.body);
      if (sections.length) {
        return sections;
      }
    }

    if (Array.isArray(homeContent.chapters)) {
      const sections = homeContent.chapters
        .filter((item) => item && item.title && item.body)
        .map((item, index) => ({
          ...item,
          eyebrow: normalizeChapterEyebrow(item.eyebrow, `篇章 ${index + 1}`)
        }));
      if (sections.length) {
        return sections;
      }
    }

    return [
      {
        eyebrow: '静界',
        title: '先把世界留在门外',
        body: winery.story || ''
      },
      {
        eyebrow: '风土',
        title: '老藤、红土与桶中时间',
        body: homeContent.statementBody || ''
      }
    ].filter((item) => item.body);
  }
});
