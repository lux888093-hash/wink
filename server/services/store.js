const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

const DEFAULT_WINES = [
  {
    id: 'soundless-a-quiet-world-2022',
    brand: 'Hongjiu Estate',
    title: 'Soundless A Quiet World',
    vintage: '2022 Estate Edition',
    eyebrow: 'Estate Signature',
    region: 'Moonlit Vineyard',
    country: 'China',
    grapes: 'Moon Harvest Signature',
    abv: 'Night Reserve',
    style: 'Estate Red',
    serving: '16-18°C · Open 20 min before serving',
    quote: 'Moonlight, oak and one lit window slow the wine to the right pace.',
    overview:
      'This wine does not arrive loudly. It opens like a second sentence after dusk: dark fruit first, then a softer line of oak, dried flowers and a finish that stays composed rather than forceful.',
    storyTitle: 'From Estate To Bottle',
    story:
      'Its narrative begins with the same visual world each time: vine rows under a crescent moon, a house glowing at the end of the path and hands moving through fruit after dark. The estate, the bottle and the music are meant to feel like one sequence.',
    moodLine: 'Lower the lights and let the room quieten with the pour.',
    estateName: 'Hongjiu Estate',
    estateTagline: 'Moonlight, vine rows and a window left glowing',
    estateIntro:
      'The estate is not memorable because it is loud. It is memorable because, after dark, everything falls into order: the crescent moon, the lamp, the path and the vines all read as a single composed scene.',
    estatePhilosophy:
      'The goal is not to present a bottle alone, but a complete sensory frame: first the estate, then the wine, then the music that lets the pour settle into memory.',
    estateHeroImage: '/assets/images/winery-vineyard-moon.jpg',
    estatePortraitImage: '/assets/images/winery-cottage-night.jpg',
    harvestImage: '/assets/images/harvest-under-moon.jpg',
    bottleImage: '/assets/images/wine-bottle-estate.jpg',
    posterImage: '/assets/images/wine-bottle-poster.jpg',
    giftImage: '/assets/images/wine-gift-set.jpg',
    estateStats: [
      { label: 'Atmosphere', value: 'Moonlight / Quiet / Warmth' },
      { label: 'Signature Image', value: 'A crescent moon above vine rows' },
      { label: 'Experience', value: 'Estate + Bottle + Music' }
    ],
    tasting: [
      {
        key: 'Aroma',
        icon: 'NOSE',
        text: 'Dark fruit leads, followed by dried petals, light oak and a faint coolness that feels almost nocturnal.'
      },
      {
        key: 'Palate',
        icon: 'FLOW',
        text: 'Rounded on entry and measured in its movement, it prefers length and composure over sheer impact.',
        meter: 82
      },
      {
        key: 'Finish',
        icon: 'FINISH',
        text: 'Clean and slightly mineral, with a quiet trace of wood that suits slow drinking and low-volume music.',
        meter: 76
      }
    ],
    scores: [
      { source: 'Atmosphere', score: 'Still' },
      { source: 'Texture', score: 'Velvet' },
      { source: 'Memory', score: 'Night' }
    ],
    technical: [
      { label: 'Style', value: 'Quiet, rounded, lightly oaked and dusk-toned' },
      { label: 'Best For', value: 'Solo pours, late conversation and gifting' },
      { label: 'Pairing', value: 'Aged cheese, lightly charred meat, dark chocolate' },
      { label: 'Music', value: 'Ambient piano, low strings, restrained jazz' }
    ],
    collection: [
      {
        id: 'moon-arch',
        vintage: 'MOON ARCH',
        title: 'Moon Arch',
        note: 'The vine corridor is the image that immediately explains why the estate works as an immersive experience.',
        image: '/assets/images/winery-vineyard-moon.jpg'
      },
      {
        id: 'lamp-house',
        vintage: 'LAMP HOUSE',
        title: 'The Lit House',
        note: 'A single warm window brings back the estate’s warmth and its sense of story.',
        image: '/assets/images/winery-cottage-night.jpg'
      },
      {
        id: 'night-harvest',
        vintage: 'NIGHT HARVEST',
        title: 'Night Harvest',
        note: 'When people, fruit and moonlight appear together, the brand identity feels complete.',
        image: '/assets/images/harvest-under-moon.jpg'
      }
    ],
    tracks: [
      {
        id: 'moonlit-path',
        mood: 'Moon Courtyard',
        title: 'Moonlit Path',
        description: 'A slow opening cue for looking through the estate before the pour.',
        src: '/assets/audio/vintage-noir.wav',
        durationLabel: '00:24',
        art: 'noir',
        cover: '/assets/images/winery-vineyard-moon.jpg'
      },
      {
        id: 'harvest-whisper',
        mood: 'Night Harvest',
        title: 'Harvest Whisper',
        description: 'Closer to the breathing rhythm of vine rows and harvest after dark.',
        src: '/assets/audio/earthly-echoes.wav',
        durationLabel: '00:26',
        art: 'earth',
        cover: '/assets/images/harvest-under-moon.jpg'
      },
      {
        id: 'candle-cellar',
        mood: 'Cellar Candle',
        title: 'Candle Cellar',
        description: 'Softer and warmer, suited to opening the case and pouring without rush.',
        src: '/assets/audio/relaxing-jazz.wav',
        durationLabel: '00:22',
        art: 'jazz',
        cover: '/assets/images/wine-gift-set.jpg'
      },
      {
        id: 'quiet-world',
        mood: 'Signature Pour',
        title: 'Quiet World',
        description: 'The track that lets label, light and pace resolve on a single page.',
        src: '/assets/audio/classical-piano.wav',
        durationLabel: '00:20',
        art: 'ivory',
        cover: '/assets/images/wine-bottle-poster.jpg'
      }
    ]
  }
];

function createEmptyStore() {
  return {
    wines: DEFAULT_WINES,
    codes: [],
    sessions: []
  };
}

function ensureStoreFile() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(createEmptyStore(), null, 2), 'utf8');
    return;
  }

  const current = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  if (!Array.isArray(current.wines) || current.wines.length === 0) {
    current.wines = DEFAULT_WINES;
    if (!Array.isArray(current.codes)) {
      current.codes = [];
    }
    if (!Array.isArray(current.sessions)) {
      current.sessions = [];
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(current, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStoreFile();
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function randomToken(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('base64url')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function plusDays(days) {
  const time = Date.now() + days * 24 * 60 * 60 * 1000;
  return new Date(time).toISOString();
}

function getWineById(store, wineId) {
  return store.wines.find((wine) => wine.id === wineId);
}

function getDefaultWine(store) {
  return store.wines[0];
}

function sanitizeScene(sceneValue) {
  if (!sceneValue) {
    return '';
  }

  const rawValue = String(sceneValue).trim();

  try {
    return decodeURIComponent(rawValue).trim();
  } catch (error) {
    return rawValue;
  }
}

function seedDemoData() {
  const store = createEmptyStore();
  const defaultWine = getDefaultWine(store);
  const code = {
    token: 'demo_vintage_noir',
    label: 'Local demo card',
    wineId: defaultWine.id,
    status: 'ready',
    createdAt: nowIso(),
    expiresAt: plusDays(30),
    usedAt: null,
    sessionId: null
  };

  store.codes = [code];
  store.sessions = [];
  writeStore(store);
  return {
    store,
    code
  };
}

function createOneTimeCode(input = {}) {
  const store = readStore();
  const wine = input.wineId ? getWineById(store, input.wineId) : getDefaultWine(store);

  if (!wine) {
    const error = new Error('WINE_NOT_FOUND');
    error.statusCode = 404;
    throw error;
  }

  const code = {
    token: input.token || randomToken('card'),
    label: input.label || `${wine.title} retail card`,
    wineId: wine.id,
    status: 'ready',
    createdAt: nowIso(),
    expiresAt: input.expiresAt || plusDays(14),
    usedAt: null,
    sessionId: null
  };

  store.codes.unshift(code);
  writeStore(store);

  return {
    code,
    wine
  };
}

function sessionPayload(store, sessionId) {
  const session = store.sessions.find((item) => item.id === sessionId);

  if (!session) {
    const error = new Error('SESSION_NOT_FOUND');
    error.statusCode = 404;
    throw error;
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    const error = new Error('SESSION_EXPIRED');
    error.statusCode = 410;
    throw error;
  }

  const wine = getWineById(store, session.wineId);

  if (!wine) {
    const error = new Error('WINE_NOT_FOUND');
    error.statusCode = 404;
    throw error;
  }

  return {
    session,
    experience: {
      wine,
      collection: wine.collection,
      tracks: wine.tracks
    }
  };
}

function consumeOneTimeCode(sceneValue) {
  const scene = sanitizeScene(sceneValue);
  const store = readStore();
  const code = store.codes.find((item) => item.token === scene);

  if (!code) {
    const error = new Error('CODE_NOT_FOUND');
    error.statusCode = 404;
    throw error;
  }

  if (code.usedAt) {
    const error = new Error('CODE_ALREADY_USED');
    error.statusCode = 410;
    error.meta = code;
    throw error;
  }

  if (code.expiresAt && new Date(code.expiresAt).getTime() < Date.now()) {
    const error = new Error('CODE_EXPIRED');
    error.statusCode = 410;
    error.meta = code;
    throw error;
  }

  const session = {
    id: randomToken('ses'),
    wineId: code.wineId,
    createdAt: nowIso(),
    expiresAt: plusDays(7),
    sourceToken: code.token
  };

  code.usedAt = nowIso();
  code.status = 'used';
  code.sessionId = session.id;
  store.sessions.unshift(session);
  writeStore(store);

  return sessionPayload(store, session.id);
}

function getSessionExperience(sessionId) {
  const store = readStore();
  return sessionPayload(store, sessionId);
}

module.exports = {
  ensureStoreFile,
  seedDemoData,
  createOneTimeCode,
  consumeOneTimeCode,
  getSessionExperience
};
