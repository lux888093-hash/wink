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

const TASTING_SLOTS = [
  { slot: 'aroma', title: '香气', eyebrow: 'AROMA', iconType: 'aroma' },
  { slot: 'structure', title: '结构', eyebrow: 'STRUCTURE', iconType: 'structure' },
  { slot: 'finish', title: '尾韵', eyebrow: 'FINISH', iconType: 'finish' }
];

const TECHNICAL_ICON_TYPES = ['temperature', 'pairing', 'aging', 'value'];

function detectTastingSlot(item, index) {
  const key = String((item && item.key) || '');

  if (/香|果香|aroma/i.test(key)) {
    return 'aroma';
  }

  if (/尾|回味|finish/i.test(key)) {
    return 'finish';
  }

  if (/结构|口感|酸度|酒体|palate|structure|acid/i.test(key)) {
    return 'structure';
  }

  return (TASTING_SLOTS[index] && TASTING_SLOTS[index].slot) || 'structure';
}

function buildTastingTitle(slot, sourceKey) {
  const key = String(sourceKey || '').trim();

  if (!key) {
    return slot.title;
  }

  if (slot.slot === 'aroma' && /果香|香气|aroma/i.test(key)) {
    return '香气';
  }

  if (slot.slot === 'structure' && /口感|结构|酒体|palate|structure/i.test(key)) {
    return '结构';
  }

  if (slot.slot === 'finish' && /回味|尾感|尾韵|finish/i.test(key)) {
    return '尾韵';
  }

  return key;
}

function buildTastingColumns(wine) {
  const tasting = Array.isArray(wine && wine.tasting) ? wine.tasting : [];
  const sourceBySlot = {};

  tasting.forEach((item, index) => {
    const slot = detectTastingSlot(item, index);
    if (!sourceBySlot[slot]) {
      sourceBySlot[slot] = item;
    }
  });

  return TASTING_SLOTS.map((slot) => {
    const source = sourceBySlot[slot.slot] || {};
    return {
      slot: slot.slot,
      iconType: slot.iconType,
      eyebrow: slot.eyebrow,
      displayKey: buildTastingTitle(slot, source.key),
      text: source.text || ''
    };
  }).filter((item) => item.text);
}

function detectTechnicalIconType(label, index) {
  const text = String(label || '');

  if (/温|醒酒|饮用/i.test(text)) {
    return 'temperature';
  }

  if (/餐|配/i.test(text)) {
    return 'pairing';
  }

  if (/熟成|陈年|陈放|适饮期/i.test(text)) {
    return 'aging';
  }

  if (/价值|坐标|礼赠|人群|场景/i.test(text)) {
    return 'value';
  }

  return TECHNICAL_ICON_TYPES[index] || 'value';
}

function buildTechnicalRows(wine) {
  const technical = Array.isArray(wine && wine.technical) ? wine.technical : [];

  return technical.map((item, index) => ({
    slot: `technical-${index}`,
    label: item.label || '',
    value: item.value || '',
    iconType: detectTechnicalIconType(item.label, index)
  }));
}

Page({
  data: {
    ready: false,
    experience: null,
    wine: null,
    editorialSections: [],
    tastingColumns: [],
    technicalRows: [],
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
        tastingColumns: buildTastingColumns(experience.wine),
        technicalRows: buildTechnicalRows(experience.wine),
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
