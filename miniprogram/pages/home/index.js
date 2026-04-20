const { request } = require('../../utils/api');

Page({
  data: {
    loading: true,
    pageReady: false,
    hero: null,
    winery: null,
    estateIntro: '',
    estateFacts: [],
    estateChapters: [],
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
      const winery = payload.winery || {};
      getApp().setCartCount(payload.cartCount || 0);

      this.setData({
        loading: false,
        pageReady: true,
        hero: payload.hero,
        winery,
        estateIntro: this.buildEstateIntro(winery),
        estateFacts: this.buildEstateFacts(winery),
        estateChapters: this.buildEstateChapters(winery),
        cartCount: payload.cartCount || 0
      });
    } catch (error) {
      this.setData({
        loading: false,
        pageReady: false,
        errorTitle: '庄园目录暂时不可用',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? '请先启动本地服务端，再重新进入首页。'
            : '首页数据加载失败，请稍后重试。'
      });
    }
  },

  buildEstateIntro() {
    return '鸿玖酒庄以月光、葡萄藤、木屋与夜色为主线，讲述一处安静、克制、带有收藏感的东方庄园。';
  },

  buildEstateFacts(winery) {
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

  buildEstateChapters(winery) {
    return [
      {
        eyebrow: '01 / PLACE',
        title: '夜色里的葡萄园',
        body:
          '鸿玖把庄园的第一印象留给夜色、藤影和远处的微光。这里的画面不急着解释，只让葡萄园先成为记忆。',
        image: winery.harvestImage || '/assets/images/harvest-under-moon.jpg'
      },
      {
        eyebrow: '02 / HOUSE',
        title: '一盏留亮的窗',
        body:
          '庄园的故事从一盏窗开始：木屋、藤影、夜风和被留住的微光，让酒有了可以被记住的住所。',
        image: winery.portraitImage || '/assets/images/winery-cottage-night.jpg'
      },
      {
        eyebrow: '03 / RITUAL',
        title: '留白中的秩序',
        body:
          '深色、木质与一抹金色只作为背景，让庄园本身成为主角。信息被压缩到必要的几句，余下交给画面。',
        image: winery.heroImage || '/assets/images/winery-vineyard-moon.jpg'
      }
    ];
  }
});
