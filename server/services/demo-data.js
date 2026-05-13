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
      brandName: '古藤村落酒庄 Village Ancient Vine',
      initializedAt: new Date().toISOString()
    },
    settings: {
      homeHero: {
        eyebrow: 'Village Ancient Vine',
        title: '古藤村落酒庄',
        subtitle: '南澳古藤西拉、19首私享乐章与 567 价值坐标。',
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
        name: '古藤村落酒庄',
        englishName: 'Village Ancient Vine',
        tagline: '在安静中听见灵魂',
        intro:
          '古藤村落酒庄位于南澳巴罗萨谷古藤产区，以红土、老藤、石屋和橡木桶酒窖构成核心场景。',
        story:
          '它不追求喧闹传播，而是把酒、音乐和独处时刻做成一条完整体验线：开瓶、输入密钥、进入只属于这一瓶酒的安静空间。',
        heroImage: '/assets/images/village-ancient-vine-sign.jpg',
        portraitImage: '/assets/images/eva-glaetzer-winemaker.jpg',
        harvestImage: '/assets/images/village-ancient-vine-cellar.jpg',
        giftImage: '/assets/images/village-ancient-vine-packaging.jpg'
      }
    ],
    wines: [
      {
        id: 'soundless-a-quiet-world-2022',
        wineryId,
        brand: 'Village Ancient Vine',
        eyebrow: '扫码限定',
        title: 'A Quiet World · Voice of the Soul',
        name: '567 黑胶颂·古藤西拉',
        subtitle: '2022 南澳古藤西拉干红',
        vintage: '2022 Vintage',
        region: '南澳巴罗萨谷古藤产区',
        country: 'Australia',
        grapes: '古藤西拉 Shiraz',
        abv: '14.3% vol',
        style: '干红',
        serving: '16-18°C · 醒酒 30-45 分钟',
        quote: '当世界安静下来，酒液、旋律与自我才会真正对上频率。',
        overview:
          '这支 2022 古藤西拉来自南澳深层红土。黑果、紫罗兰、香料与橡木的层次在 18 个月熟成后收束成深邃结构，入口克制，随后释放出老藤西拉的力量。',
        storyTitle: '静界的入口',
        story:
          '这支酒把开瓶、听歌和独饮连成同一条路径。酒标上的微光小屋不是装饰，而是提醒你暂时离开外界噪声。',
        moodLine: '把灯光压低，再开始倒酒。',
        estateName: '古藤村落酒庄',
        estateTagline: '老藤、时间与一段私享乐章',
        estateIntro:
          '酒庄位于南澳巴罗萨谷古藤产区。红土、石屋、老藤与橡木桶酒窖，共同定义它的第一印象。',
        estatePhilosophy:
          '我们相信一瓶好酒不需要靠喧闹证明自己。老藤的根系、18个月桶中时间与克制定价，共同完成这瓶酒的结构和体面。',
        estateStatementTitle: '老藤、时间与安静的秩序',
        estateHeroImage: '/assets/images/village-ancient-vine-sign.jpg',
        estatePortraitImage: '/assets/images/eva-glaetzer-winemaker.jpg',
        harvestImage: '/assets/images/village-ancient-vine-cellar.jpg',
        bottleImage: '/assets/images/vinyl-ode-bottle-vineyard.jpg',
        posterImage: '/assets/images/vinyl-ode-bottle-vineyard.jpg',
        giftImage: '/assets/images/village-ancient-vine-packaging.jpg',
        estateStats: [
          { label: '所属产区', value: '南澳巴罗萨谷' },
          { label: '核心葡萄', value: '古藤西拉 Shiraz' },
          { label: '私享内容', value: '16位密钥 · 19首乐章' }
        ],
        estateSections: [
          {
            key: 'chapter-quiet',
            eyebrow: '01 / 静界',
            title: '先把世界留在门外',
            body: '开瓶的第一步，不是社交，而是离场。把屏幕放下，把噪声关小，让这一杯酒重新变成与自己对话的入口。'
          },
          {
            key: 'chapter-vine',
            eyebrow: '02 / 老藤',
            title: '红土里的百年根系',
            body: '南澳古藤把岁月压进根系。它穿过硬土与岩层，留下更深的果味骨架、矿物感和稳定张力。'
          },
          {
            key: 'chapter-time',
            eyebrow: '03 / 时间',
            title: '十八个月的慢慢收束',
            body: '采收后的西拉并不急着表达。18个月橡木桶熟成，让黑果、香料和木质感慢慢收束，换来克制后的爆发力。'
          },
          {
            key: 'chapter-creed',
            eyebrow: '04 / 价值',
            title: '567 只是把价值说清楚',
            body: '法兰克福大赛金奖只是注脚。真正重要的是，它在盲品里靠结构感说服评审，也让 567 成为不随热度起伏的价格坐标。'
          },
          {
            key: 'chapter-resonance',
            eyebrow: '05 / 共振',
            title: '一组密钥，十九首乐章',
            body: '瓶封上的专属密钥连接 Sam 写下的 19 首私享作品。开瓶、醒酒、落针，酒香与旋律在同一时刻展开。'
          },
          {
            key: 'chapter-covenant',
            eyebrow: '06 / 契约',
            title: '不同频，也保留体面',
            body: '如果风味与当下心境不能共振，请停止饮用。按规则保留原瓶退回，我们愿意把选择权和体面一起留给你。'
          }
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
          { label: '杯型建议', value: '高脚红酒杯，杯肚保留足够醒香空间' }
        ],
        collection: [
          {
            id: 'moon-arch',
            vintage: 'ESTATE',
            title: '古藤村落入口',
            note: '南澳古藤葡萄园的第一眼，是红土、石屋与写着 Village Ancient Vine 的木牌。',
            image: '/assets/images/village-ancient-vine-sign.jpg'
          },
          {
            id: 'oak-cellar',
            vintage: 'AGING',
            title: '橡木桶中的十八个月',
            note: '西拉的野性在微氧黑暗中慢慢收束，留下克制之后的爆发力。',
            image: '/assets/images/village-ancient-vine-cellar.jpg'
          },
          {
            id: 'eva-glaetzer',
            vintage: 'MAKER',
            title: 'Eva Glaetzer',
            note: '第六代家族传人，以直觉判断古藤西拉的采收与单宁成熟度。',
            image: '/assets/images/eva-glaetzer-winemaker.jpg'
          },
          {
            id: 'vinyl-ode-label',
            vintage: '567',
            title: '黑胶颂酒标',
            note: '黑胶唱片、微光小屋与 567 共同构成这瓶酒的识别记忆。',
            image: '/assets/images/vinyl-ode-bottle-vineyard.jpg'
          }
        ],
        trackIds: ['track_moonlit_path', 'track_harvest_whisper', 'track_quiet_world'],
        productId: 'product_estate_moon_box',
        winemakerName: 'Eva Glaetzer',
        winemakerCnName: '伊娃·格雷策',
        winemakerTitle: '首席酿酒师 · 第六代家族传人',
        winemakerImage: '/assets/images/eva-glaetzer-winemaker.jpg',
        winemakerIntro:
          'Eva Glaetzer 是家族第六代酿酒师。她更相信老藤自身的节奏，以直觉判断成熟度，让土地与年份自己说话。'
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
          '琥珀夜曲珍藏呈现更深的黑果、雪松与可可气息，结构比旗舰款更紧实，尾段保留清晰木质回甘。',
        storyTitle: '礼序与陈列',
        story:
          '它更像会员橱窗里的主展示品，强调视觉深度、收藏感与更正式的礼盒结构。',
        moodLine: '适合在正式宴请前开场。',
        estateName: '鸿玖珍藏酒窖',
        estateTagline: '更深的木质气息与更正式的礼序',
        estateIntro:
          '鸿玖珍藏酒窖以木桶、石墙和低照度陈列为核心，空间更深、更安静。',
        estatePhilosophy: '酒窖不强调喧闹陈列，而是用材质、温度和暗光呈现更正式的收藏秩序。',
        estateHeroImage: '/assets/images/wine-bottle-poster.jpg',
        estatePortraitImage: '/assets/images/wine-bottle-estate.jpg',
        harvestImage: '/assets/images/wine-gift-set.jpg',
        bottleImage: '/assets/images/wine-bottle-estate.jpg',
        posterImage: '/assets/images/wine-bottle-poster.jpg',
        giftImage: '/assets/images/wine-gift-set.jpg',
        estateStats: [
          { label: '空间类型', value: '珍藏酒窖' },
          { label: '主要材质', value: '木桶、石墙、暗色陈列架' },
          { label: '酒窖气质', value: '深沉、正式、适合珍藏' }
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
          { label: '陈年潜力', value: '具备 3-5 年陈放潜力' }
        ],
        collection: [],
        trackIds: ['track_amber_salon', 'track_grapefield_river', 'track_far_gaze'],
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
          '铜曦桃红以草莓、覆盆子和清爽酸度为主线，酒体更轻盈，适合低温饮用。',
        storyTitle: '白昼款的必要性',
        story: '这支桃红的重点在于明亮果香、轻盈酒体和更清爽的饮用节奏。',
        moodLine: '午后露台、轻食和更明亮的果香。',
        estateName: '鸿玖晨曦园',
        estateTagline: '更明亮的果香与轻礼社交',
        estateIntro: '鸿玖晨曦园更靠近日间葡萄园，保留清晨光线、石径与花果香气。',
        estatePhilosophy: '晨曦园的表达更轻盈，但仍以酒庄的秩序感、自然光和克制留白为核心。',
        estateHeroImage: '/assets/images/harvest-under-moon.jpg',
        estatePortraitImage: '/assets/images/wine-gift-set.jpg',
        harvestImage: '/assets/images/winery-vineyard-moon.jpg',
        bottleImage: '/assets/images/wine-bottle-poster.jpg',
        posterImage: '/assets/images/harvest-under-moon.jpg',
        giftImage: '/assets/images/wine-gift-set.jpg',
        estateStats: [
          { label: '园区光线', value: '晨间自然光与开阔葡萄园' },
          { label: '庄园景观', value: '石径、花果香气、低矮葡萄藤' },
          { label: '空间气质', value: '轻盈、明净、克制' }
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
          { label: '杯型建议', value: '郁金香杯或白葡萄酒杯' }
        ],
        collection: [],
        trackIds: ['track_copper_dawn', 'track_murmur', 'track_reluctant_part'],
        productId: 'product_copper_rose_set'
      }
    ],
    tracks: [
      {
        id: 'track_moonlit_path',
        wineId: 'soundless-a-quiet-world-2022',
        mood: 'Dreamscape',
        title: 'A Transparent Dream',
        cnTitle: '透明之梦',
        description: '真实音频导入后的开场曲，更轻更空，适合把环境慢慢降下来。',
        src: '/assets/audio/A%20Transparent%20Dream.wav',
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
        mood: 'Wind Whisper',
        title: 'the whisper of the wind',
        cnTitle: '风的耳语',
        description: '更轻微、更贴近空气流动感，适合夜色里安静往下听。',
        src: '/assets/audio/the%20whisper%20of%20the%20wind.wav',
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
        mood: 'Lament',
        title: 'Concerto of Lament',
        cnTitle: '悲叹协奏曲',
        description: '默认主曲切到真实音频后，保留深色主视觉，氛围更贴近弦乐独奏。',
        src: '/assets/audio/Concerto%20of%20Lament.wav',
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
        mood: 'Velvet Dialogue',
        title: 'Affectionate conversation',
        cnTitle: '深情对话',
        description: '这首更温暖，适合会所和正式宴请的慢节奏场景。',
        src: '/assets/audio/Affectionate%20conversation.wav',
        durationLabel: '00:22',
        art: 'jazz',
        cover: '/assets/images/wine-gift-set.jpg',
        playRule: 'member',
        previewSeconds: 12,
        unlockPrice: 49
      },
      {
        id: 'track_grapefield_river',
        wineId: 'amber-nocturne-reserve-2021',
        mood: 'Estate River',
        title: 'The river by the grape fields',
        cnTitle: '葡萄田边的河流',
        description: '把庄园环境声和空间感拉得更开，适合沉浸式浏览。',
        src: '/assets/audio/The%20river%20by%20the%20grape%20fields.wav',
        durationLabel: '00:23',
        art: 'earth',
        cover: '/assets/images/winery-vineyard-moon.jpg',
        playRule: 'member',
        previewSeconds: 12,
        unlockPrice: 49
      },
      {
        id: 'track_far_gaze',
        wineId: 'amber-nocturne-reserve-2021',
        mood: 'Far Gaze',
        title: 'gaze far away',
        cnTitle: '远望',
        description: '延展感更强，适合列表切歌和会员曲库浏览。',
        src: '/assets/audio/gaze%20far%20away.wav',
        durationLabel: '00:25',
        art: 'noir',
        cover: '/assets/images/wine-bottle-estate.jpg',
        playRule: 'member',
        previewSeconds: 12,
        unlockPrice: 49
      },
      {
        id: 'track_copper_dawn',
        wineId: 'dawn-rose-2023',
        mood: 'Ripple',
        title: 'ripple',
        cnTitle: '涟漪',
        description: '更适合轻盈一点的场景，作为新客友好的真实音频入口。',
        src: '/assets/audio/ripple.wav',
        durationLabel: '00:24',
        art: 'earth',
        cover: '/assets/images/harvest-under-moon.jpg',
        playRule: 'trial',
        previewSeconds: 20,
        unlockPrice: 19
      },
      {
        id: 'track_murmur',
        wineId: 'dawn-rose-2023',
        mood: 'Murmur',
        title: 'murmur',
        cnTitle: '呢喃',
        description: '更近、更私密，适合短暂停留和反复切换。',
        src: '/assets/audio/murmur.wav',
        durationLabel: '00:21',
        art: 'earth',
        cover: '/assets/images/wine-gift-set.jpg',
        playRule: 'trial',
        previewSeconds: 18,
        unlockPrice: 19
      },
      {
        id: 'track_reluctant_part',
        wineId: 'dawn-rose-2023',
        mood: 'Parting Light',
        title: 'reluctant to part',
        cnTitle: '依依不舍',
        description: '作为这一组里最收尾的一首，适合停留在页面尾段时播放。',
        src: '/assets/audio/reluctant%20to%20part.wav',
        durationLabel: '00:24',
        art: 'jazz',
        cover: '/assets/images/wine-bottle-poster.jpg',
        playRule: 'trial',
        previewSeconds: 18,
        unlockPrice: 19
      }
    ],
    downloadAssets: [
      {
        id: 'asset_track_moonlit_path',
        trackId: 'track_moonlit_path',
        fileUrl: '/assets/audio/A%20Transparent%20Dream.wav',
        fileHash: 'real-track-a-transparent-dream',
        fileSize: 36139116,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_harvest_whisper',
        trackId: 'track_harvest_whisper',
        fileUrl: '/assets/audio/the%20whisper%20of%20the%20wind.wav',
        fileHash: 'real-track-the-whisper-of-the-wind',
        fileSize: 22937336,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_quiet_world',
        trackId: 'track_quiet_world',
        fileUrl: '/assets/audio/Concerto%20of%20Lament.wav',
        fileHash: 'real-track-concerto-of-lament',
        fileSize: 37726712,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_amber_salon',
        trackId: 'track_amber_salon',
        fileUrl: '/assets/audio/Affectionate%20conversation.wav',
        fileHash: 'real-track-affectionate-conversation',
        fileSize: 42101432,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_grapefield_river',
        trackId: 'track_grapefield_river',
        fileUrl: '/assets/audio/The%20river%20by%20the%20grape%20fields.wav',
        fileHash: 'real-track-the-river-by-the-grape-fields',
        fileSize: 30226184,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_far_gaze',
        trackId: 'track_far_gaze',
        fileUrl: '/assets/audio/gaze%20far%20away.wav',
        fileHash: 'real-track-gaze-far-away',
        fileSize: 38601656,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_copper_dawn',
        trackId: 'track_copper_dawn',
        fileUrl: '/assets/audio/ripple.wav',
        fileHash: 'real-track-ripple',
        fileSize: 35518184,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_murmur',
        trackId: 'track_murmur',
        fileUrl: '/assets/audio/murmur.wav',
        fileHash: 'real-track-murmur',
        fileSize: 33648344,
        downloadRule: 'entitlement'
      },
      {
        id: 'asset_track_reluctant_part',
        trackId: 'track_reluctant_part',
        fileUrl: '/assets/audio/reluctant%20to%20part.wav',
        fileHash: 'real-track-reluctant-to-part',
        fileSize: 39575384,
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
    userAddresses: [
      {
        id: 'addr_demo_guest_default',
        userId: guestId,
        contactName: '月光访客',
        mobile: '13800000000',
        provinceCity: '上海市静安区',
        detail: '鸿玖会所演示地址',
        deliveryNote: '工作日 18:00 后配送',
        isDefault: true,
        createdAt: shiftDays(-1),
        updatedAt: shiftDays(-1)
      },
      {
        id: 'addr_demo_member_default',
        userId: memberId,
        contactName: '藏香会员',
        mobile: '13800000088',
        provinceCity: '上海市静安区',
        detail: '会员会所专送地址',
        deliveryNote: '提前电话确认',
        isDefault: true,
        createdAt: shiftDays(-15),
        updatedAt: shiftDays(-15)
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
    redeemFailLogs: [],
    codeBatches: [
      {
        id: 'batch_spring_2026',
        batchNo: 'HJ2026SPRING',
        wineId: 'soundless-a-quiet-world-2022',
        trackId: 'track_moonlit_path',
        quantity: 48,
        createdAt: shiftDays(-10),
        createdBy: DEFAULT_ADMIN_USERNAME
      }
    ],
    scanCodes: [
      {
        id: 'code_demo_ready',
        token: 'demo_vintage_noir',
        redeemCode: '385721',
        label: '演示提取码',
        wineId: 'soundless-a-quiet-world-2022',
        trackId: 'track_moonlit_path',
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
        redeemCode: '619403',
        label: '已使用提取码',
        wineId: 'soundless-a-quiet-world-2022',
        trackId: 'track_harvest_whisper',
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
        redeemCode: '502874',
        label: '过期提取码',
        wineId: 'amber-nocturne-reserve-2021',
        trackId: 'track_amber_salon',
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
        redeemCode: '731596',
        label: '作废提取码',
        wineId: 'dawn-rose-2023',
        trackId: 'track_copper_dawn',
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
        sessionType: 'redeem',
        scopeJson: {
          visibility: 'exclusive',
          trackIds: ['track_harvest_whisper']
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
        expiresAt: shiftDays(-3),
        deliveryStatus: 'delivering',
        addressSummary: '上海市静安区 · 会所专送',
        address: {
          contactName: '藏香会员',
          mobile: '13800000088',
          provinceCity: '上海市静安区',
          detail: '会员会所专送地址',
          deliveryNote: '提前电话确认'
        },
        stockReserved: false,
        shippingCompany: '顺丰速运',
        trackingNo: 'SF20260410001',
        shippedAt: shiftDays(-2),
        completedAt: null,
        refundStatus: 'none'
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
        expiresAt: shiftDays(-4),
        deliveryStatus: 'downloaded',
        addressSummary: '数字权益发放',
        stockReserved: false,
        refundStatus: 'none'
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
    refunds: [],
    adminRoles: [
      {
        id: 'role_super_admin',
        name: '超级管理员',
        permissions: ['*']
      },
      {
        id: 'role_ops',
        name: '运营管理员',
        permissions: [
          'dashboard.read',
          'wines.read',
          'wines.write',
          'wineries.read',
          'wineries.write',
          'tracks.read',
          'tracks.write',
          'codes.read',
          'codes.write',
          'audit.read'
        ]
      },
      {
        id: 'role_product',
        name: '商品管理员',
        permissions: [
          'dashboard.read',
          'products.read',
          'products.write',
          'orders.read',
          'orders.write',
          'orders.refund'
        ]
      },
      {
        id: 'role_support',
        name: '客服管理员',
        permissions: [
          'dashboard.read',
          'codes.read',
          'orders.read',
          'orders.write',
          'memberships.read',
          'memberships.grant',
          'audit.read'
        ]
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
