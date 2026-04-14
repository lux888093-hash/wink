const { hashPassword, legacySha256 } = require('./security');

const DEFAULT_USER_ID = 'user_demo_guest';
const DEFAULT_ADMIN_USERNAME = 'curator';
const DEFAULT_ADMIN_PASSWORD = 'Curator!2026';

function sha256(input) {
  return legacySha256(input);
}

function shiftDays(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

function shiftMinutes(minutes) {
  const value = new Date();
  value.setMinutes(value.getMinutes() + minutes);
  return value.toISOString();
}

function createSeedStore() {
  const guestId = DEFAULT_USER_ID;
  const memberId = 'user_demo_member';
  const wineryId = 'winery_hongjiu_moon';

  return {
    meta: {
      version: 2,
      brandName: '鸿玖酒庄 Hongjiu Estate',
      initializedAt: new Date().toISOString()
    },
    settings: {
      homeHero: {
        eyebrow: 'Hongjiu Estate',
        title: '把一瓶酒，做成一个可以被再次进入的体验。',
        subtitle:
          '扫码进入专属内容，平时从首页进入商城与会员区。整体体验不走大字海报感，而是更像酒庄手册、会员目录和礼盒内页。',
        ambienceNote: '理性饮酒，未成年人请勿饮酒。'
      },
      loungeCopy: {
        title: '庄园会所',
        note: '会员可无限听歌，已购单曲可签名下载。'
      }
    },
    wineries: [
      {
        id: wineryId,
        name: '鸿玖酒庄',
        englishName: 'Hongjiu Estate',
        tagline: 'Moonlit Vineyard Residency',
        intro:
          '鸿玖酒庄以月光、葡萄藤与木盒礼序为品牌主线，强调“酒庄叙事 + 单瓶体验 + 会员内容”三层结构。',
        story:
          '品牌叙事不是单独卖一瓶酒，而是把酒庄、包装、扫码内容和配乐做成同一条体验线。用户第一次扫码进入的是专属故事，之后从常规入口看到的是会员与商城世界。',
        heroImage: '/assets/images/winery-vineyard-moon.jpg',
        portraitImage: '/assets/images/winery-cottage-night.jpg',
        harvestImage: '/assets/images/harvest-under-moon.jpg',
        giftImage: '/assets/images/wine-gift-set.jpg'
      }
    ],
    wines: [
      {
        id: 'soundless-a-quiet-world-2022',
        wineryId,
        brand: 'Hongjiu Estate',
        eyebrow: '扫码限定',
        title: 'Soundless A Quiet World',
        name: '静夜序曲',
        subtitle: '庄园旗舰干红',
        vintage: '2022 Estate Edition',
        region: '宁夏贺兰山东麓',
        country: 'China',
        grapes: '赤霞珠 60% / 马瑟兰 40%',
        abv: '14.5% vol',
        style: '干红',
        serving: '16-18°C · 醒酒 20 分钟',
        quote: '月光、橡木与一扇亮着的窗，让节奏慢下来。',
        overview:
          '这支酒不是用冲击力去记忆，而是用秩序感。前段是沉静的黑果和木质气息，中段开始出现花香与细腻单宁，尾段保持克制。',
        storyTitle: '从酒庄到礼盒',
        story:
          '这支旗舰酒承担的是“扫码即进入”的第一印象，因此强调礼盒打开、酒标出现、音乐起势三个瞬间彼此连在一起，形成完整记忆点。',
        moodLine: '把灯光压低，再开始倒酒。',
        estateName: '鸿玖月庭酒庄',
        estateTagline: '月色、葡萄藤与一盏留亮的窗',
        estateIntro:
          '专属体验页不展示商城，而是先让用户看到酒庄，再看到这瓶酒，最后听到与它绑定的曲目。',
        estatePhilosophy:
          '酒庄内容不应像硬广告，而更像礼盒内页。它负责建立空间感和稀缺感，再把用户带向酒与音乐。',
        estateHeroImage: '/assets/images/winery-vineyard-moon.jpg',
        estatePortraitImage: '/assets/images/winery-cottage-night.jpg',
        harvestImage: '/assets/images/harvest-under-moon.jpg',
        bottleImage: '/assets/images/wine-bottle-estate.jpg',
        posterImage: '/assets/images/wine-bottle-poster.jpg',
        giftImage: '/assets/images/wine-gift-set.jpg',
        estateStats: [
          { label: '体验入口', value: '礼盒二维码首扫进入' },
          { label: '适饮场景', value: '晚宴、送礼、私享夜饮' },
          { label: '内容编排', value: '酒庄 / 酒款 / 音乐 / 会员转化' }
        ],
        tasting: [
          {
            key: '香气',
            icon: 'AROMA',
            text: '黑樱桃、紫罗兰、烘烤木香和轻微香料层层叠出。'
          },
          {
            key: '口感',
            icon: 'PALATE',
            text: '入口圆润，单宁细密，重心放在丝绒感和长度，而不是硬力度。',
            meter: 83
          },
          {
            key: '尾韵',
            icon: 'FINISH',
            text: '收尾克制，矿物感和木质回甘干净且持久。',
            meter: 76
          }
        ],
        scores: [
          { source: '氛围', score: 'Still' },
          { source: '质地', score: 'Velvet' },
          { source: '记忆点', score: 'Night' }
        ],
        technical: [
          { label: '醒酒建议', value: '开瓶后醒酒 20 分钟' },
          { label: '配餐建议', value: '熟成芝士、炭烤牛排、黑巧克力' },
          { label: '礼赠属性', value: '木盒与单瓶同色系包装，适合节庆送礼' },
          { label: '音乐搭配', value: '缓拍钢琴、低频弦乐、夜色爵士' }
        ],
        collection: [
          {
            id: 'moon-arch',
            vintage: 'ESTATE',
            title: '月下长廊',
            note: '进入专属体验时首先出现的场景，负责建立品牌的静谧气质。',
            image: '/assets/images/winery-vineyard-moon.jpg'
          },
          {
            id: 'lamp-house',
            vintage: 'HOUSE',
            title: '留灯小屋',
            note: '暖色窗光带来温度，避免奢华页面只剩冷感和距离感。',
            image: '/assets/images/winery-cottage-night.jpg'
          },
          {
            id: 'night-harvest',
            vintage: 'HARVEST',
            title: '夜收',
            note: '人与葡萄同时出现，让酒庄故事回到真实劳作，而不是纯概念图。',
            image: '/assets/images/harvest-under-moon.jpg'
          }
        ],
        trackIds: ['track_moonlit_path', 'track_harvest_whisper', 'track_quiet_world'],
        productId: 'product_estate_moon_box'
      },
      {
        id: 'amber-nocturne-reserve-2021',
        wineryId,
        brand: 'Hongjiu Estate',
        eyebrow: '商城精选',
        title: 'Amber Nocturne Reserve',
        name: '琥珀夜曲珍藏',
        subtitle: '珍藏级干红礼盒',
        vintage: '2021 Reserve',
        region: '贺兰山东麓核心产区',
        country: 'China',
        grapes: '蛇龙珠 50% / 赤霞珠 50%',
        abv: '14% vol',
        style: '珍藏干红',
        serving: '16-18°C · 醒酒 30 分钟',
        quote: '更深、更密，也更适合礼盒陈列。',
        overview:
          '琥珀夜曲适合放在商城主推位。它在包装、颜色和层次上都更偏典藏风，适合作为高客单礼盒和会员推荐款。',
        storyTitle: '礼序与陈列',
        story:
          '它更像会员橱窗里的主展示品，强调视觉深度、收藏感与更正式的礼盒结构。',
        moodLine: '适合在正式宴请前开场。',
        estateName: '鸿玖珍藏酒窖',
        estateTagline: '更深的木质气息与更正式的礼序',
        estateIntro:
          '公共首页展示这支酒时，会更强调收藏、送礼和会员尊享，而非扫码首扫体验。',
        estatePhilosophy: '它承担的是商城的高客单定位与品牌调性的稳定输出。',
        estateHeroImage: '/assets/images/wine-bottle-poster.jpg',
        estatePortraitImage: '/assets/images/wine-bottle-estate.jpg',
        harvestImage: '/assets/images/wine-gift-set.jpg',
        bottleImage: '/assets/images/wine-bottle-estate.jpg',
        posterImage: '/assets/images/wine-bottle-poster.jpg',
        giftImage: '/assets/images/wine-gift-set.jpg',
        estateStats: [
          { label: '定位', value: '商务礼赠 / 年节礼盒' },
          { label: '核心卖点', value: '木盒包装、层次更饱满、会员推荐' },
          { label: '建议页位', value: '商城头图第二屏与精选位' }
        ],
        tasting: [
          {
            key: '香气',
            icon: 'AROMA',
            text: '黑莓、雪松、可可和更厚一点的烘烤木桶气息。'
          },
          {
            key: '结构',
            icon: 'STRUCTURE',
            text: '骨架更结实，适合配红肉与浓郁奶酪。',
            meter: 88
          },
          {
            key: '回味',
            icon: 'FINISH',
            text: '尾段更长，适合慢饮与聚会分享。',
            meter: 81
          }
        ],
        scores: [
          { source: '礼赠感', score: 'Amber' },
          { source: '浓郁度', score: 'Reserve' },
          { source: '宴请感', score: 'Formal' }
        ],
        technical: [
          { label: '适饮期', value: '即饮，同时具备 3-5 年陈放潜力' },
          { label: '餐配建议', value: '熟成牛排、火腿拼盘、烤菌菇' },
          { label: '主推人群', value: '商务礼赠、纪念日、企业客户' },
          { label: '零售价带', value: '高客单精品礼盒' }
        ],
        collection: [],
        trackIds: ['track_amber_salon'],
        productId: 'product_amber_reserve_case'
      },
      {
        id: 'dawn-rose-2023',
        wineryId,
        brand: 'Hongjiu Estate',
        eyebrow: '新客友好',
        title: 'Copper Dawn Rose',
        name: '铜曦桃红',
        subtitle: '轻盈花果调桃红',
        vintage: '2023 Rose',
        region: '河谷庄园',
        country: 'China',
        grapes: '西拉 / 赤霞珠',
        abv: '12.5% vol',
        style: '桃红',
        serving: '8-10°C · 冰镇后饮用',
        quote: '更轻快，也更适合白天聚会与入门客群。',
        overview:
          '作为商城中更轻松的一支产品，它承担拉新和社交分享。页面会更轻盈，但仍保持精致的礼盒与编辑感。',
        storyTitle: '白昼款的必要性',
        story:
          '如果所有页面都太深太重，品牌会显得单一。桃红款负责让商城首页有呼吸感。',
        moodLine: '午后露台、轻食和更明亮的音乐。',
        estateName: '鸿玖晨曦园',
        estateTagline: '更明亮的果香与轻礼社交',
        estateIntro: '这支酒更多出现在商城和新客活动位，承担拉新和节日社交需求。',
        estatePhilosophy: '明亮一点，但不要失掉庄园的克制感。',
        estateHeroImage: '/assets/images/harvest-under-moon.jpg',
        estatePortraitImage: '/assets/images/wine-gift-set.jpg',
        harvestImage: '/assets/images/winery-vineyard-moon.jpg',
        bottleImage: '/assets/images/wine-bottle-poster.jpg',
        posterImage: '/assets/images/harvest-under-moon.jpg',
        giftImage: '/assets/images/wine-gift-set.jpg',
        estateStats: [
          { label: '定位', value: '聚会 / 入门 / 节日分享' },
          { label: '口感', value: '轻盈果香与清爽酸度' },
          { label: '页面策略', value: '提亮商城节奏，平衡整体色调' }
        ],
        tasting: [
          { key: '果香', icon: 'FRUIT', text: '草莓、覆盆子和淡淡玫瑰花香。', meter: 72 },
          { key: '酸度', icon: 'ACID', text: '清爽、利落，适合搭配轻食。', meter: 79 },
          { key: '尾感', icon: 'FINISH', text: '干净而轻快。', meter: 68 }
        ],
        scores: [
          { source: '轻盈度', score: 'Fresh' },
          { source: '社交感', score: 'Bright' },
          { source: '新客友好', score: 'Easy' }
        ],
        technical: [
          { label: '饮用温度', value: '冰镇至 8-10°C' },
          { label: '餐配建议', value: '沙拉、海鲜、轻甜点' },
          { label: '分享场景', value: '午后露台、野餐、小型聚会' },
          { label: '推荐渠道', value: '商城拉新位 / 节日活动位' }
        ],
        collection: [],
        trackIds: ['track_copper_dawn'],
        productId: 'product_copper_rose_set'
      }
    ],
    tracks: [
      {
        id: 'track_moonlit_path',
        wineId: 'soundless-a-quiet-world-2022',
        mood: 'Moon Courtyard',
        title: 'Moonlit Path',
        cnTitle: '月下长廊',
        description: '适合打开礼盒之后的第一首，负责把空间安静下来。',
        src: '/assets/audio/vintage-noir.wav',
        durationLabel: '00:24',
        art: 'noir',
        cover: '/assets/images/winery-vineyard-moon.jpg',
        playRule: 'scan_or_member',
        previewSeconds: 18,
        unlockPrice: 29
      },
      {
        id: 'track_harvest_whisper',
        wineId: 'soundless-a-quiet-world-2022',
        mood: 'Night Harvest',
        title: 'Harvest Whisper',
        cnTitle: '夜收耳语',
        description: '更贴近葡萄藤与夜收的呼吸感，适合第二杯之后。',
        src: '/assets/audio/earthly-echoes.wav',
        durationLabel: '00:26',
        art: 'earth',
        cover: '/assets/images/harvest-under-moon.jpg',
        playRule: 'scan_or_member',
        previewSeconds: 16,
        unlockPrice: 29
      },
      {
        id: 'track_quiet_world',
        wineId: 'soundless-a-quiet-world-2022',
        mood: 'Signature Pour',
        title: 'Quiet World',
        cnTitle: '静夜世界',
        description: '旗舰酒的主配乐，会员可无限听，非会员默认试听。',
        src: '/assets/audio/classical-piano.wav',
        durationLabel: '00:20',
        art: 'ivory',
        cover: '/assets/images/melody-phone-cover.jpg',
        playRule: 'member',
        previewSeconds: 12,
        unlockPrice: 49
      },
      {
        id: 'track_amber_salon',
        wineId: 'amber-nocturne-reserve-2021',
        mood: 'Salon Reserve',
        title: 'Amber Salon',
        cnTitle: '琥珀沙龙',
        description: '更适合正式宴请与会员会所界面。',
        src: '/assets/audio/relaxing-jazz.wav',
        durationLabel: '00:22',
        art: 'jazz',
        cover: '/assets/images/wine-gift-set.jpg',
        playRule: 'member',
        previewSeconds: 12,
        unlockPrice: 49
      },
      {
        id: 'track_copper_dawn',
        wineId: 'dawn-rose-2023',
        mood: 'Morning Terrace',
        title: 'Copper Dawn',
        cnTitle: '铜曦露台',
        description: '新客友好的轻盈曲目，试听门槛较低。',
        src: '/assets/audio/vintage-noir.wav',
        durationLabel: '00:24',
        art: 'earth',
        cover: '/assets/images/harvest-under-moon.jpg',
        playRule: 'trial',
        previewSeconds: 20,
        unlockPrice: 19
      }
    ],
    downloadAssets: [
      {
        id: 'asset_track_moonlit_path',
        trackId: 'track_moonlit_path',
        fileUrl: '/assets/audio/vintage-noir.wav',
        fileHash: 'demo-track-moonlit-path',
        fileSize: 248000,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_harvest_whisper',
        trackId: 'track_harvest_whisper',
        fileUrl: '/assets/audio/earthly-echoes.wav',
        fileHash: 'demo-track-harvest-whisper',
        fileSize: 266000,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_quiet_world',
        trackId: 'track_quiet_world',
        fileUrl: '/assets/audio/classical-piano.wav',
        fileHash: 'demo-track-quiet-world',
        fileSize: 242000,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_amber_salon',
        trackId: 'track_amber_salon',
        fileUrl: '/assets/audio/relaxing-jazz.wav',
        fileHash: 'demo-track-amber-salon',
        fileSize: 232000,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_copper_dawn',
        trackId: 'track_copper_dawn',
        fileUrl: '/assets/audio/vintage-noir.wav',
        fileHash: 'demo-track-copper-dawn',
        fileSize: 248000,
        downloadRule: 'entitlement'
      }
    ],
    products: [
      {
        id: 'product_estate_moon_box',
        wineId: 'soundless-a-quiet-world-2022',
        name: '月影庄园典藏礼盒',
        subtitle: '含首扫专属体验卡',
        coverImage: '/assets/images/wine-gift-set.jpg',
        status: 'published',
        category: '礼盒',
        badge: '庄园限定',
        story:
          '主视觉偏深色礼盒与月影酒标，适合作为品牌主打款出现在首页第一屏与扫码体验联动位。',
        highlights: ['礼盒首扫专属页', '旗舰酒款', '适合商务与节庆送礼'],
        gallery: [
          '/assets/images/wine-gift-set.jpg',
          '/assets/images/wine-bottle-poster.jpg',
          '/assets/images/wine-bottle-estate.jpg'
        ],
        tags: ['庄园直供', '扫码限定', '精品礼赠'],
        featuredRank: 1
      },
      {
        id: 'product_amber_reserve_case',
        wineId: 'amber-nocturne-reserve-2021',
        name: '琥珀夜曲珍藏木盒',
        subtitle: '宴请与商务礼赠主推',
        coverImage: '/assets/images/wine-bottle-estate.jpg',
        status: 'published',
        category: '珍藏',
        badge: '会员推荐',
        story: '更适合作为高客单陈列商品，突出收藏感和礼盒结构。',
        highlights: ['珍藏年份', '木盒包装', '会员优先价'],
        gallery: [
          '/assets/images/wine-bottle-estate.jpg',
          '/assets/images/wine-bottle-poster.jpg',
          '/assets/images/wine-gift-set.jpg'
        ],
        tags: ['商务礼赠', '高客单', '典藏气质'],
        featuredRank: 2
      },
      {
        id: 'product_copper_rose_set',
        wineId: 'dawn-rose-2023',
        name: '铜曦桃红双支装',
        subtitle: '节庆聚会与新客入门',
        coverImage: '/assets/images/harvest-under-moon.jpg',
        status: 'published',
        category: '桃红',
        badge: '新客友好',
        story: '用更轻快的产品去承接首页活动位和节日分享场景。',
        highlights: ['轻盈果香', '聚会分享', '活动位适配'],
        gallery: [
          '/assets/images/harvest-under-moon.jpg',
          '/assets/images/wine-gift-set.jpg',
          '/assets/images/winery-vineyard-moon.jpg'
        ],
        tags: ['聚会分享', '轻盈果香', '节日活动'],
        featuredRank: 3
      }
    ],
    productSkus: [
      {
        id: 'sku_estate_single',
        productId: 'product_estate_moon_box',
        specName: '单瓶礼盒',
        price: 599,
        marketPrice: 699,
        stock: 18,
        status: 'published'
      },
      {
        id: 'sku_estate_double',
        productId: 'product_estate_moon_box',
        specName: '双瓶礼盒',
        price: 1099,
        marketPrice: 1299,
        stock: 9,
        status: 'published'
      },
      {
        id: 'sku_amber_single',
        productId: 'product_amber_reserve_case',
        specName: '单瓶木盒',
        price: 899,
        marketPrice: 999,
        stock: 12,
        status: 'published'
      },
      {
        id: 'sku_amber_double',
        productId: 'product_amber_reserve_case',
        specName: '双瓶珍藏礼盒',
        price: 1699,
        marketPrice: 1899,
        stock: 6,
        status: 'published'
      },
      {
        id: 'sku_rose_double',
        productId: 'product_copper_rose_set',
        specName: '双支装',
        price: 399,
        marketPrice: 469,
        stock: 24,
        status: 'published'
      },
      {
        id: 'sku_rose_party',
        productId: 'product_copper_rose_set',
        specName: '四支派对装',
        price: 729,
        marketPrice: 829,
        stock: 15,
        status: 'published'
      }
    ],
    users: [
      {
        id: guestId,
        openid: 'demo-openid-guest',
        unionid: 'demo-unionid-guest',
        nickname: '月光访客',
        avatar: '',
        mobile: '',
        createdAt: shiftDays(-1),
        preferredTheme: 'moon'
      },
      {
        id: memberId,
        openid: 'demo-openid-member',
        unionid: 'demo-unionid-member',
        nickname: '藏香会员',
        avatar: '',
        mobile: '13800000088',
        createdAt: shiftDays(-35),
        preferredTheme: 'reserve'
      }
    ],
    membershipPlans: [
      {
        id: 'plan_quarter',
        name: '庄园随享季卡',
        price: 199,
        durationDays: 90,
        benefits: ['会员专区', '无限听歌', '赠送 1 首下载权益', '商城会员价'],
        badge: '新客首选'
      },
      {
        id: 'plan_year',
        name: '庄园珍藏年卡',
        price: 699,
        durationDays: 365,
        benefits: ['会员专区', '无限听歌', '赠送 3 首下载权益', '优先参与新酒活动'],
        badge: '高净值推荐'
      }
    ],
    memberships: [
      {
        id: 'membership_demo_member',
        userId: memberId,
        planId: 'plan_year',
        status: 'active',
        startAt: shiftDays(-18),
        expireAt: shiftDays(347)
      }
    ],
    downloadEntitlements: [
      {
        id: 'entitlement_demo_member_quiet_world',
        userId: memberId,
        trackId: 'track_quiet_world',
        sourceOrderId: 'order_seed_music_01',
        maxDownloads: 3,
        usedDownloads: 1,
        expiredAt: shiftDays(120)
      }
    ],
    downloadLogs: [
      {
        id: 'download_log_seed_1',
        userId: memberId,
        trackId: 'track_quiet_world',
        assetId: 'asset_track_quiet_world',
        ip: '127.0.0.1',
        deviceInfo: 'preview-browser',
        downloadAt: shiftDays(-2)
      }
    ],
    downloadTickets: [],
    codeBatches: [
      {
        id: 'batch_spring_2026',
        batchNo: 'HJ2026SPRING',
        wineId: 'soundless-a-quiet-world-2022',
        quantity: 48,
        createdAt: shiftDays(-10),
        createdBy: DEFAULT_ADMIN_USERNAME
      }
    ],
    scanCodes: [
      {
        id: 'code_demo_ready',
        token: 'demo_vintage_noir',
        label: '礼盒首扫演示码',
        wineId: 'soundless-a-quiet-world-2022',
        batchNo: 'HJ2026SPRING',
        status: 'ready',
        createdAt: shiftDays(-1),
        expiresAt: shiftDays(30),
        firstUsedAt: null,
        firstUserId: null,
        sessionId: null
      },
      {
        id: 'code_demo_claimed',
        token: 'claimed_cellar_pass',
        label: '已使用示例码',
        wineId: 'soundless-a-quiet-world-2022',
        batchNo: 'HJ2026SPRING',
        status: 'claimed',
        createdAt: shiftDays(-8),
        expiresAt: shiftDays(22),
        firstUsedAt: shiftDays(-2),
        firstUserId: memberId,
        sessionId: 'scan_session_seed_1'
      },
      {
        id: 'code_demo_expired',
        token: 'expired_cellar_pass',
        label: '过期示例码',
        wineId: 'amber-nocturne-reserve-2021',
        batchNo: 'HJ2026SPRING',
        status: 'expired',
        createdAt: shiftDays(-40),
        expiresAt: shiftDays(-3),
        firstUsedAt: null,
        firstUserId: null,
        sessionId: null
      },
      {
        id: 'code_demo_disabled',
        token: 'disabled_cellar_pass',
        label: '作废示例码',
        wineId: 'dawn-rose-2023',
        batchNo: 'HJ2026SPRING',
        status: 'disabled',
        createdAt: shiftDays(-20),
        expiresAt: shiftDays(15),
        firstUsedAt: null,
        firstUserId: null,
        sessionId: null
      }
    ],
    scanSessions: [
      {
        id: 'scan_session_seed_1',
        codeId: 'code_demo_claimed',
        userId: memberId,
        wineId: 'soundless-a-quiet-world-2022',
        sessionType: 'scan',
        scopeJson: {
          visibility: 'exclusive',
          trackIds: ['track_moonlit_path', 'track_harvest_whisper', 'track_quiet_world']
        },
        createdAt: shiftDays(-2),
        expiredAt: shiftDays(5)
      }
    ],
    cartItems: [
      {
        id: 'cart_seed_rose',
        userId: guestId,
        skuId: 'sku_rose_double',
        quantity: 1,
        createdAt: shiftDays(-1)
      }
    ],
    orders: [
      {
        id: 'order_seed_1',
        userId: memberId,
        orderNo: 'HJ20260410001',
        orderType: 'physical',
        amount: 1099,
        payAmount: 1099,
        status: 'paid',
        paidAt: shiftDays(-3),
        createdAt: shiftDays(-3),
        deliveryStatus: 'delivering',
        addressSummary: '上海市静安区 · 会所专送'
      },
      {
        id: 'order_seed_music_01',
        userId: memberId,
        orderNo: 'HJ20260408002',
        orderType: 'digital_track',
        amount: 49,
        payAmount: 49,
        status: 'completed',
        paidAt: shiftDays(-4),
        createdAt: shiftDays(-4),
        deliveryStatus: 'downloaded',
        addressSummary: '数字权益发放'
      }
    ],
    orderItems: [
      {
        id: 'order_item_seed_1',
        orderId: 'order_seed_1',
        productId: 'product_estate_moon_box',
        skuId: 'sku_estate_double',
        quantity: 1,
        price: 1099
      },
      {
        id: 'order_item_seed_2',
        orderId: 'order_seed_music_01',
        productId: null,
        skuId: null,
        quantity: 1,
        price: 49,
        trackId: 'track_quiet_world'
      }
    ],
    payments: [
      {
        id: 'payment_seed_1',
        orderId: 'order_seed_1',
        channel: 'wechat_pay_mock',
        transactionId: 'wx_mock_20260410_01',
        status: 'paid',
        paidAt: shiftDays(-3),
        callbackPayload: { note: 'seed payment' }
      },
      {
        id: 'payment_seed_2',
        orderId: 'order_seed_music_01',
        channel: 'wechat_pay_mock',
        transactionId: 'wx_mock_20260408_02',
        status: 'paid',
        paidAt: shiftDays(-4),
        callbackPayload: { note: 'seed payment' }
      }
    ],
    adminRoles: [
      {
        id: 'role_super_admin',
        name: '超级管理员',
        permissions: ['*']
      },
      {
        id: 'role_ops',
        name: '运营管理员',
        permissions: ['dashboard.read', 'wines.read', 'wines.write', 'codes.read', 'codes.write']
      }
    ],
    adminUsers: [
      {
        id: 'admin_1',
        username: DEFAULT_ADMIN_USERNAME,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        roleId: 'role_super_admin',
        status: 'active',
        displayName: '庄园运营台',
        lastLoginAt: null
      }
    ],
    adminSessions: [],
    auditLogs: [
      {
        id: 'audit_seed_1',
        actor: 'system',
        action: 'seed.completed',
        target: 'demo_store',
        createdAt: shiftMinutes(-20)
      }
    ]
  };
}

module.exports = {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_USER_ID,
  createSeedStore,
  sha256,
  shiftDays
};
