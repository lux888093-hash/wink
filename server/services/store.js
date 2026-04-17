const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_USER_ID,
  DEFAULT_ADMIN_USERNAME,
  createSeedStore
} = require('./demo-data');
const { getRuntimeWarnings, runtimeConfig } = require('./config');
const {
  ensureDatabase,
  getPersistenceMeta,
  loadStore,
  replaceStore
} = require('./db');
const {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isStrongPassword,
  verifyPasswordHash
} = require('./security');

const auditContext = new AsyncLocalStorage();

const DEFAULT_ADMIN_ROLES = [
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
];

function createAppError(code, statusCode = 400, meta = null) {
  const error = new Error(code);
  error.statusCode = statusCode;
  error.meta = meta;
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

function plusDays(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

function plusDaysFrom(baseIso, days) {
  const value = new Date(baseIso || Date.now());
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

function plusMinutes(minutes) {
  const value = new Date();
  value.setMinutes(value.getMinutes() + minutes);
  return value.toISOString();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('base64url')}`;
}

function withAuditContext(context, handler) {
  return auditContext.run(context || {}, handler);
}

function ensureAdminRoles(store) {
  let changed = false;

  if (!Array.isArray(store.adminRoles)) {
    store.adminRoles = [];
    changed = true;
  }

  DEFAULT_ADMIN_ROLES.forEach((defaultRole) => {
    const existing = store.adminRoles.find((role) => role.id === defaultRole.id);

    if (!existing) {
      store.adminRoles.push({ ...defaultRole });
      changed = true;
      return;
    }

    const permissions = new Set([...(existing.permissions || []), ...defaultRole.permissions]);
    if (permissions.size !== (existing.permissions || []).length) {
      existing.permissions = [...permissions];
      changed = true;
    }

    if (!existing.name) {
      existing.name = defaultRole.name;
      changed = true;
    }
  });

  return changed;
}

function ensureStoreFile() {
  ensureDatabase();
  const store = readStore();

  if (applyRuntimeSecurityPolicies(store)) {
    writeStore(store);
  }
}

function readStore() {
  return loadStore();
}

function writeStore(store) {
  replaceStore(store);
}

function createValidationError(field, reason, details = null) {
  return createAppError('INVALID_INPUT', 400, {
    field,
    reason,
    ...(details || {})
  });
}

function ensureText(value, options = {}) {
  const {
    field = 'value',
    required = false,
    min = 0,
    max = 120,
    defaultValue = ''
  } = options;
  const normalized = value === undefined || value === null ? '' : String(value).trim();

  if (!normalized) {
    if (required) {
      throw createValidationError(field, 'required');
    }
    return defaultValue;
  }

  if (normalized.length < min) {
    throw createValidationError(field, 'too_short', { min });
  }

  if (normalized.length > max) {
    throw createValidationError(field, 'too_long', { max });
  }

  return normalized;
}

function ensureInteger(value, options = {}) {
  const {
    field = 'value',
    required = false,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    defaultValue = 0
  } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createValidationError(field, 'required');
    }
    return defaultValue;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized)) {
    throw createValidationError(field, 'not_integer');
  }

  if (normalized < min || normalized > max) {
    throw createValidationError(field, 'out_of_range', { min, max });
  }

  return normalized;
}

function ensureEnum(value, allowed, options = {}) {
  const { field = 'value', defaultValue } = options;
  const normalized = value === undefined || value === null || value === '' ? defaultValue : String(value).trim();

  if (!allowed.includes(normalized)) {
    throw createValidationError(field, 'invalid_enum', {
      allowed
    });
  }

  return normalized;
}

function ensureArray(value, options = {}) {
  const { field = 'value', maxLength = 20, defaultValue = [] } = options;

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (!Array.isArray(value)) {
    throw createValidationError(field, 'not_array');
  }

  if (value.length > maxLength) {
    throw createValidationError(field, 'too_many_items', { maxLength });
  }

  return value;
}

function ensureIsoDate(value, options = {}) {
  const { field = 'value', required = false, defaultValue = null } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createValidationError(field, 'required');
    }
    return defaultValue;
  }

  const timestamp = Date.parse(String(value));

  if (Number.isNaN(timestamp)) {
    throw createValidationError(field, 'invalid_date');
  }

  return new Date(timestamp).toISOString();
}

function ensureAdminToken(token) {
  const normalized = String(token || '').trim();

  if (!normalized) {
    throw createAppError('ADMIN_UNAUTHORIZED', 401);
  }

  if (normalized.length < 20 || normalized.length > 256) {
    throw createAppError('ADMIN_UNAUTHORIZED', 401);
  }

  return normalized;
}

function cleanupAdminSessions(store) {
  let changed = false;
  let sessions = store.adminSessions.filter((item) => {
    const keep = !isExpired(item.expireAt);
    if (!keep) {
      changed = true;
    }
    return keep;
  });

  sessions = sessions.map((session) => {
    if (!session.tokenHash && session.token) {
      changed = true;
      return {
        ...session,
        tokenHash: hashSessionToken(session.token),
        tokenPreview: String(session.token).slice(-6)
      };
    }

    return session;
  });

  store.adminUsers.forEach((admin) => {
    const adminSessions = sessions
      .filter((item) => item.adminUserId === admin.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    if (adminSessions.length <= runtimeConfig.maxAdminSessionsPerUser) {
      return;
    }

    const keepIds = new Set(adminSessions.slice(0, runtimeConfig.maxAdminSessionsPerUser).map((item) => item.id));
    const nextSessions = sessions.filter((item) => item.adminUserId !== admin.id || keepIds.has(item.id));

    if (nextSessions.length !== sessions.length) {
      changed = true;
      sessions = nextSessions;
    }
  });

  store.adminSessions = sessions;
  return changed;
}

function applyRuntimeSecurityPolicies(store) {
  let changed = cleanupAdminSessions(store);
  changed = ensureAdminRoles(store) || changed;
  const primaryAdmin = store.adminUsers.find((item) => item.username === DEFAULT_ADMIN_USERNAME);

  if (
    primaryAdmin &&
    runtimeConfig.adminBootstrapPassword &&
    verifyPasswordHash(primaryAdmin.passwordHash, DEFAULT_ADMIN_PASSWORD).valid &&
    !verifyPasswordHash(primaryAdmin.passwordHash, runtimeConfig.adminBootstrapPassword).valid
  ) {
    primaryAdmin.passwordHash = hashPassword(runtimeConfig.adminBootstrapPassword);
    changed = true;
  }

  return changed;
}

function getSecurityWarnings() {
  const warnings = [...getRuntimeWarnings()];
  const store = readStore();
  const primaryAdmin = store.adminUsers.find((item) => item.username === DEFAULT_ADMIN_USERNAME);

  if (
    runtimeConfig.isProduction &&
    primaryAdmin &&
    verifyPasswordHash(primaryAdmin.passwordHash, DEFAULT_ADMIN_PASSWORD).valid
  ) {
    warnings.push('Default admin password is still active.');
  }

  if (runtimeConfig.adminBootstrapPassword && !isStrongPassword(runtimeConfig.adminBootstrapPassword)) {
    warnings.push('ADMIN_BOOTSTRAP_PASSWORD does not meet the recommended strength policy.');
  }

  return warnings;
}

function indexById(items) {
  return items.reduce((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});
}

function sanitizeScene(sceneValue) {
  if (!sceneValue) {
    return '';
  }

  const raw = String(sceneValue).trim();

  try {
    return decodeURIComponent(raw).trim().slice(0, 128);
  } catch (error) {
    return raw.slice(0, 128);
  }
}

function getDefaultUser(store) {
  return store.users.find((user) => user.id === DEFAULT_USER_ID) || store.users[0];
}

function getUserById(store, userId) {
  if (!userId) {
    return getDefaultUser(store);
  }

  return store.users.find((user) => user.id === userId) || getDefaultUser(store);
}

function requireExistingUser(store, userId) {
  const user = store.users.find((item) => item.id === userId);

  if (!user) {
    throw createAppError('USER_NOT_FOUND', 404);
  }

  return user;
}

function getWineById(store, wineId) {
  return store.wines.find((wine) => wine.id === wineId);
}

function getTrackById(store, trackId) {
  return store.tracks.find((track) => track.id === trackId);
}

function getDefaultTrackForWine(store, wineId) {
  const wine = getWineById(store, wineId);
  const trackId = wine && Array.isArray(wine.trackIds) && wine.trackIds.length ? wine.trackIds[0] : '';
  return trackId ? getTrackById(store, trackId) : store.tracks.find((track) => track.wineId === wineId);
}

function getTrackForWine(store, wineId, trackId) {
  const track = trackId ? getTrackById(store, trackId) : getDefaultTrackForWine(store, wineId);

  if (!track) {
    throw createAppError('TRACK_NOT_FOUND', 404);
  }

  if (track.wineId !== wineId) {
    throw createAppError('TRACK_WINE_MISMATCH', 400);
  }

  return track;
}

function getAssetByTrackId(store, trackId) {
  return store.downloadAssets.find((asset) => asset.trackId === trackId);
}

function getProductById(store, productId) {
  return store.products.find((product) => product.id === productId);
}

function getSkuById(store, skuId) {
  return store.productSkus.find((sku) => sku.id === skuId);
}

function getOrderById(store, orderId) {
  return store.orders.find((order) => order.id === orderId);
}

function getOrderItems(store, orderId) {
  return store.orderItems.filter((item) => item.orderId === orderId);
}

function getScanSessionById(store, sessionId) {
  return store.scanSessions.find((session) => session.id === sessionId);
}

function isExpired(isoString) {
  return Boolean(isoString) && new Date(isoString).getTime() < Date.now();
}

function buildMembershipView(store, userId) {
  const membership = [...store.memberships]
    .filter((item) => item.userId === userId)
    .sort((left, right) => new Date(right.expireAt).getTime() - new Date(left.expireAt).getTime())[0];

  if (!membership) {
    return null;
  }

  const plan = store.membershipPlans.find((item) => item.id === membership.planId) || null;
  const active = membership.status === 'active' && !isExpired(membership.expireAt);

  return {
    ...membership,
    status: active ? 'active' : 'expired',
    plan,
    isActive: active
  };
}

function buildUserSummary(store, userId) {
  const user = store.users.find((item) => item.id === userId);
  const membership = buildMembershipView(store, user.id);

  return {
    id: user.id,
    nickname: user.nickname,
    mobile: user.mobile || '',
    avatar: user.avatar || '',
    isMember: Boolean(membership && membership.isActive),
    memberExpireAt: membership && membership.isActive ? membership.expireAt : null,
    tierLabel: membership && membership.isActive ? membership.plan.name : '普通用户'
  };
}

function getReservedStock(sku) {
  return Math.max(0, Number(sku && sku.reservedStock) || 0);
}

function getAvailableStock(sku) {
  return Math.max(0, (Number(sku && sku.stock) || 0) - getReservedStock(sku));
}

function buildAddressSummary(address) {
  if (!address) {
    return '';
  }

  return [address.provinceCity, address.detail]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 200);
}

function normalizeAddressInput(payload = {}, options = {}) {
  const contactName = ensureText(payload.contactName, {
    field: 'contactName',
    required: options.required,
    min: 2,
    max: 40,
    defaultValue: ''
  });
  const mobile = ensureText(payload.mobile, {
    field: 'mobile',
    required: options.required,
    min: 6,
    max: 30,
    defaultValue: ''
  });
  const provinceCity = ensureText(payload.provinceCity, {
    field: 'provinceCity',
    required: options.required,
    min: 2,
    max: 80,
    defaultValue: ''
  });
  const detail = ensureText(payload.detail, {
    field: 'detail',
    required: options.required,
    min: 4,
    max: 160,
    defaultValue: ''
  });

  if (mobile && !/^[0-9+\-\s]{6,30}$/.test(mobile)) {
    throw createValidationError('mobile', 'invalid_mobile');
  }

  return {
    contactName,
    mobile,
    provinceCity,
    detail,
    deliveryNote: ensureText(payload.deliveryNote, {
      field: 'deliveryNote',
      min: 0,
      max: 120,
      defaultValue: ''
    })
  };
}

function getDefaultAddress(store, userId) {
  return (
    store.userAddresses.find((item) => item.userId === userId && item.isDefault) ||
    store.userAddresses.find((item) => item.userId === userId) ||
    null
  );
}

function upsertMiniappUser(payload = {}) {
  const store = readStore();
  const openid = ensureText(payload.openid, {
    field: 'openid',
    required: true,
    min: 6,
    max: 128
  });
  const unionid = ensureText(payload.unionid, {
    field: 'unionid',
    min: 0,
    max: 128,
    defaultValue: ''
  });
  const nickname = ensureText(payload.nickname, {
    field: 'nickname',
    min: 1,
    max: 40,
    defaultValue: `酒庄访客${openid.slice(-4)}`
  });
  const avatar = ensureText(payload.avatarUrl, {
    field: 'avatarUrl',
    min: 0,
    max: 500,
    defaultValue: ''
  });

  let user = store.users.find((item) => item.openid === openid || (unionid && item.unionid === unionid));

  if (!user) {
    user = {
      id: randomId('user'),
      openid,
      unionid,
      nickname,
      avatar,
      mobile: '',
      createdAt: nowIso(),
      preferredTheme: 'moon',
      status: 'active',
      lastLoginAt: nowIso()
    };
    store.users.unshift(user);
    writeAudit(store, 'miniapp.user.created', user.id, user.id);
  } else {
    user.openid = openid;
    user.unionid = unionid || user.unionid || '';
    user.nickname = nickname || user.nickname;
    user.avatar = avatar || user.avatar || '';
    user.lastLoginAt = nowIso();
    writeAudit(store, 'miniapp.user.login', user.id, user.id);
  }

  writeStore(store);

  return {
    user,
    summary: buildUserSummary(store, user.id)
  };
}

function getUserSummaryById(userId) {
  const store = readStore();
  const user = requireExistingUser(store, userId);

  return {
    user,
    summary: buildUserSummary(store, user.id)
  };
}

function getTrackEntitlement(store, userId, trackId) {
  return [...store.downloadEntitlements]
    .filter((item) => item.userId === userId && item.trackId === trackId)
    .sort((left, right) => new Date(right.expiredAt).getTime() - new Date(left.expiredAt).getTime())[0];
}

function canTrackPlayFully(store, userId, track, options = {}) {
  const membership = buildMembershipView(store, userId);
  const entitlement = getTrackEntitlement(store, userId, track.id);
  const fromScan = Boolean(options.scanWineId && options.scanWineId === track.wineId);

  if (fromScan) {
    return {
      full: true,
      source: 'scan'
    };
  }

  if (membership && membership.isActive) {
    return {
      full: true,
      source: 'membership'
    };
  }

  if (track.playRule === 'trial') {
    return {
      full: true,
      source: 'trial_open'
    };
  }

  if (entitlement && !isExpired(entitlement.expiredAt)) {
    return {
      full: true,
      source: 'purchase'
    };
  }

  return {
    full: false,
    source: 'preview'
  };
}

function buildTrackCard(store, userId, track, options = {}) {
  const access = canTrackPlayFully(store, userId, track, options);
  const entitlement = getTrackEntitlement(store, userId, track.id);
  const asset = getAssetByTrackId(store, track.id);

  return {
    ...track,
    access: {
      canPlayFull: access.full,
      previewSeconds: access.full ? null : track.previewSeconds || 12,
      playSource: access.source,
      hasEntitlement: Boolean(entitlement && !isExpired(entitlement.expiredAt)),
      canDownload: Boolean(entitlement && !isExpired(entitlement.expiredAt)),
      unlockPrice: track.unlockPrice,
      assetId: asset ? asset.id : null
    }
  };
}

function buildWineExperience(store, wineId, userId, options = {}) {
  const wine = getWineById(store, wineId);

  if (!wine) {
    throw createAppError('WINE_NOT_FOUND', 404);
  }

  const winery = store.wineries.find((item) => item.id === wine.wineryId) || null;
  const scopedTrackIds =
    Array.isArray(options.trackIds) && options.trackIds.length ? options.trackIds : wine.trackIds || [];
  const tracks = scopedTrackIds
    .map((trackId) => getTrackById(store, trackId))
    .filter((track) => track && track.wineId === wine.id)
    .filter(Boolean)
    .map((track) => buildTrackCard(store, userId, track, options));

  return {
    wine,
    winery,
    tracks,
    collection: wine.collection || [],
    access: {
      scope: options.visibility || 'public',
      showMall: options.visibility !== 'exclusive',
      canCrossWineBrowse: options.visibility !== 'exclusive'
    }
  };
}

function buildCartSummary(store, userId) {
  const skuIndex = indexById(store.productSkus);
  const productIndex = indexById(store.products);

  const items = store.cartItems
    .filter((item) => item.userId === userId)
    .map((item) => {
      const sku = skuIndex[item.skuId];
      const product = sku ? productIndex[sku.productId] : null;

      if (!sku || !product) {
        return null;
      }

      return {
        id: item.id,
        quantity: item.quantity,
        skuId: sku.id,
        productId: product.id,
        productName: product.name,
        productSubtitle: product.subtitle,
        coverImage: product.coverImage,
        specName: sku.specName,
        price: sku.price,
        marketPrice: sku.marketPrice,
        stock: sku.stock,
        reservedStock: getReservedStock(sku),
        availableStock: getAvailableStock(sku),
        lineAmount: sku.price * item.quantity
      };
    })
    .filter(Boolean);

  const totalAmount = items.reduce((sum, item) => sum + item.lineAmount, 0);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    totalAmount,
    totalCount
  };
}

function buildProductCard(store, productId) {
  const product = getProductById(store, productId);

  if (!product) {
    return null;
  }

  const wine = getWineById(store, product.wineId);
  const skus = store.productSkus
    .filter((sku) => sku.productId === product.id && sku.status === 'published')
    .sort((left, right) => left.price - right.price)
    .map((sku) => ({
      ...sku,
      reservedStock: getReservedStock(sku),
      availableStock: getAvailableStock(sku)
    }));
  const lowestPrice = skus.length ? skus[0].price : 0;

  return {
    ...product,
    wine,
    skus,
    lowestPrice
  };
}

function buildOrderView(store, order) {
  const items = store.orderItems
    .filter((item) => item.orderId === order.id)
    .map((item) => {
      const sku = item.skuId ? getSkuById(store, item.skuId) : null;
      const product = item.productId ? getProductById(store, item.productId) : null;
      const track = item.trackId ? getTrackById(store, item.trackId) : null;

      return {
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        productName: product ? product.name : null,
        specName: sku ? sku.specName : null,
        coverImage: product ? product.coverImage : null,
        trackTitle: track ? track.cnTitle || track.title : null
      };
    });

  const payment = store.payments.find((item) => item.orderId === order.id) || null;

  return {
    ...order,
    items,
    payment
  };
}

function generateOrderNo(store) {
  const date = new Date();
  const prefix = `HJ${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`;
  const sameDayCount =
    store.orders.filter((order) => String(order.orderNo || '').startsWith(prefix)).length + 1;
  return `${prefix}${String(sameDayCount).padStart(4, '0')}`;
}

function slugifyId(value, fallbackPrefix) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized && /[a-z]/.test(normalized)) {
    return normalized;
  }

  return randomId(fallbackPrefix || 'item');
}

function writeAudit(store, action, target, actor = 'system', meta = null) {
  const context = auditContext.getStore() || {};
  const resolvedActor =
    actor === DEFAULT_ADMIN_USERNAME && context.adminUsername
      ? context.adminUsername
      : actor;

  store.auditLogs.unshift({
    id: randomId('audit'),
    actor: resolvedActor,
    action,
    target,
    createdAt: nowIso(),
    ...(context.requestId || context.ip || context.userAgent || meta
      ? {
          meta: {
            ...(meta || {}),
            ...(context.requestId ? { requestId: context.requestId } : {}),
            ...(context.ip ? { ip: context.ip } : {}),
            ...(context.userAgent ? { userAgent: context.userAgent } : {})
          }
        }
      : {})
  });
}

function generateSixDigitCode(existingCodes) {
  const existingSet = new Set(existingCodes.map((item) => item.redeemCode).filter(Boolean));
  let attempts = 0;
  while (attempts < 100) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    if (!existingSet.has(code)) {
      return code;
    }
    attempts += 1;
  }
  throw createAppError('CODE_GENERATION_FAILED', 500);
}

function createSeedCodeForReset(store) {
  const demoCode = store.scanCodes.find((item) => item.redeemCode === '888888');
  if (demoCode) {
    if (!demoCode.trackId) {
      demoCode.trackId = getTrackForWine(store, demoCode.wineId).id;
    }
    return demoCode;
  }
  const track = getTrackForWine(store, store.wines[0].id);

  const fallback = {
    id: randomId('code'),
    token: randomId('card'),
    redeemCode: '888888',
    label: '演示提取码',
    wineId: store.wines[0].id,
    trackId: track.id,
    batchNo: 'RESET_BATCH',
    status: 'ready',
    createdAt: nowIso(),
    expiresAt: plusDays(30),
    firstUsedAt: null,
    firstUserId: null,
    sessionId: null
  };
  store.scanCodes.unshift(fallback);
  return fallback;
}

function seedDemoData() {
  const store = createSeedStore();
  const code = createSeedCodeForReset(store);
  const wine = getWineById(store, code.wineId);
  writeStore(store);

  return {
    store,
    code,
    wine
  };
}

function createOneTimeCode(input = {}) {
  const store = readStore();
  const wineId = input.wineId || store.wines[0].id;
  const wine = getWineById(store, wineId);

  if (!wine) {
    throw createAppError('WINE_NOT_FOUND', 404);
  }
  const track = getTrackForWine(store, wine.id, input.trackId);

  const redeemCode = ensureText(input.redeemCode, {
    field: 'redeemCode',
    min: 6,
    max: 6,
    defaultValue: generateSixDigitCode(store.scanCodes)
  });

  if (!/^\d{6}$/.test(redeemCode)) {
    throw createValidationError('redeemCode', 'must_be_6_digits');
  }

  if (store.scanCodes.some((item) => item.redeemCode === redeemCode)) {
    throw createAppError('CODE_TOKEN_EXISTS', 409);
  }

  const code = {
    id: randomId('code'),
    token: randomId('card'),
    redeemCode,
    label: ensureText(input.label || `${wine.name || wine.title} 提取码`, {
      field: 'label',
      min: 2,
      max: 80
    }),
    wineId: wine.id,
    trackId: track.id,
    batchNo: ensureText(input.batchNo || 'CUSTOM', {
      field: 'batchNo',
      min: 2,
      max: 40
    }),
    status: 'ready',
    createdAt: nowIso(),
    expiresAt: ensureIsoDate(input.expiresAt, {
      field: 'expiresAt',
      defaultValue: plusDays(180)
    }),
    firstUsedAt: null,
    firstUserId: null,
    sessionId: null
  };

  store.scanCodes.unshift(code);
  writeAudit(store, 'code.created', code.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);

  return {
    code,
    wine
  };
}

function createCodeBatch(input = {}) {
  const store = readStore();
  const quantity = ensureInteger(input.quantity, {
    field: 'quantity',
    min: 1,
    max: 500,
    defaultValue: 12
  });
  const wine = getWineById(store, input.wineId || store.wines[0].id);

  if (!wine) {
    throw createAppError('WINE_NOT_FOUND', 404);
  }
  const track = getTrackForWine(store, wine.id, input.trackId);

  const batchNo =
    ensureText(input.batchNo, {
      field: 'batchNo',
      min: 2,
      max: 40,
      defaultValue:
        `HJ${new Date().getFullYear()}${String(store.codeBatches.length + 1).padStart(4, '0')}`
    });
  const batch = {
    id: randomId('batch'),
    batchNo,
    wineId: wine.id,
    trackId: track.id,
    quantity,
    createdAt: nowIso(),
    createdBy: input.createdBy || DEFAULT_ADMIN_USERNAME
  };

  if (store.codeBatches.some((item) => item.batchNo === batchNo)) {
    throw createAppError('BATCH_NO_EXISTS', 409);
  }

  const codes = [];
  for (let index = 0; index < quantity; index += 1) {
    const redeemCode = generateSixDigitCode([...store.scanCodes, ...codes]);
    codes.push({
      id: randomId('code'),
      token: randomId('card'),
      redeemCode,
      label: `${wine.name || wine.title} 提取码 ${index + 1}`,
      wineId: wine.id,
      trackId: track.id,
      batchNo,
      status: 'ready',
      createdAt: nowIso(),
      expiresAt: ensureIsoDate(input.expiresAt, {
        field: 'expiresAt',
        defaultValue: plusDays(180)
      }),
      firstUsedAt: null,
      firstUserId: null,
      sessionId: null
    });
  }

  store.codeBatches.unshift(batch);
  store.scanCodes.unshift(...codes);
  writeAudit(store, 'codes.batch.created', batch.id, batch.createdBy);
  writeStore(store);

  return {
    batch,
    codes
  };
}

function sessionPayload(store, sessionId, userId) {
  const session = getScanSessionById(store, sessionId);

  if (!session) {
    throw createAppError('SESSION_NOT_FOUND', 404);
  }

  if (isExpired(session.expiredAt)) {
    throw createAppError('SESSION_EXPIRED', 410);
  }

  return {
    session,
    experience: buildWineExperience(store, session.wineId, userId || session.userId, {
      visibility: 'exclusive',
      scanWineId: session.wineId,
      trackIds: session.scopeJson && session.scopeJson.trackIds ? session.scopeJson.trackIds : []
    })
  };
}

function logRedeemFailure(store, redeemCode, reason, meta) {
  store.redeemFailLogs.unshift({
    id: randomId('rfail'),
    code: redeemCode,
    reason,
    ip: (meta && meta.ip) || 'unknown',
    userId: (meta && meta.userId) || 'anonymous',
    createdAt: nowIso()
  });
  writeAudit(store, 'code.redeem.failed', `code=${redeemCode}&reason=${reason}`, (meta && meta.userId) || 'anonymous');
}

function consumeOneTimeCode(redeemCodeValue, userId, requestMeta) {
  const redeemCode = String(redeemCodeValue || '').trim();

  if (!redeemCode || !/^\d{6}$/.test(redeemCode)) {
    const store = readStore();
    logRedeemFailure(store, redeemCode, 'INVALID_FORMAT', requestMeta);
    writeStore(store);
    throw createAppError('INVALID_REDEEM_CODE', 400);
  }

  const store = readStore();
  const code = store.scanCodes.find((item) => item.redeemCode === redeemCode);
  const user = getUserById(store, userId);

  if (!code) {
    logRedeemFailure(store, redeemCode, 'CODE_NOT_FOUND', requestMeta);
    writeStore(store);
    throw createAppError('CODE_NOT_FOUND', 404);
  }

  if (code.status === 'disabled') {
    logRedeemFailure(store, redeemCode, 'CODE_DISABLED', requestMeta);
    writeStore(store);
    throw createAppError('CODE_DISABLED', 410, code);
  }

  if (isExpired(code.expiresAt) || code.status === 'expired') {
    code.status = 'expired';
    logRedeemFailure(store, redeemCode, 'CODE_EXPIRED', requestMeta);
    writeStore(store);
    throw createAppError('CODE_EXPIRED', 410, code);
  }

  if (code.status === 'claimed' || code.firstUsedAt) {
    logRedeemFailure(store, redeemCode, 'CODE_ALREADY_USED', requestMeta);
    writeStore(store);
    throw createAppError('CODE_ALREADY_USED', 410, code);
  }
  const track = getTrackForWine(store, code.wineId, code.trackId);

  const session = {
    id: randomId('ses'),
    codeId: code.id,
    userId: user.id,
    wineId: code.wineId,
    sessionType: 'redeem',
    scopeJson: {
      visibility: 'exclusive',
      trackIds: [track.id]
    },
    createdAt: nowIso(),
    expiredAt: plusMinutes(30)
  };

  code.status = 'claimed';
  code.trackId = track.id;
  code.firstUsedAt = nowIso();
  code.firstUserId = user.id;
  code.sessionId = session.id;
  store.scanSessions.unshift(session);
  writeAudit(store, 'code.redeemed', code.id, user.id);
  writeStore(store);

  return sessionPayload(store, session.id, user.id);
}

function getSessionExperience(sessionId, userId) {
  const store = readStore();
  return sessionPayload(store, sessionId, userId);
}

function getWineExperience(wineId, userId) {
  const store = readStore();
  return buildWineExperience(store, wineId, getUserById(store, userId).id);
}

function getStoreHome(userId) {
  const store = readStore();
  const user = getUserById(store, userId);
  const membership = buildMembershipView(store, user.id);
  const cart = buildCartSummary(store, user.id);

  return {
    hero: store.settings.homeHero,
    winery: store.wineries[0],
    user: buildUserSummary(store, user.id),
    cartCount: cart.totalCount,
    memberSummary: membership,
    featuredProducts: [...store.products]
      .filter((product) => product.status === 'published')
      .sort((left, right) => left.featuredRank - right.featuredRank)
      .map((product) => buildProductCard(store, product.id)),
    featuredWines: store.wines.map((wine) => ({
      id: wine.id,
      name: wine.name,
      title: wine.title,
      subtitle: wine.subtitle,
      image: wine.posterImage,
      badge: wine.eyebrow,
      quote: wine.quote
    })),
    membershipPlans: store.membershipPlans,
    exclusiveEntry: null
  };
}

function listProducts(options = {}) {
  const store = readStore();
  const category = options.category ? String(options.category) : '';

  const items = store.products
    .filter((product) => product.status === 'published')
    .filter((product) => !category || product.category === category)
    .sort((left, right) => left.featuredRank - right.featuredRank)
    .map((product) => buildProductCard(store, product.id));

  return {
    categories: ['全部', ...new Set(store.products.map((product) => product.category))],
    items
  };
}

function getProductDetail(productId, userId) {
  const store = readStore();
  const product = buildProductCard(store, productId);

  if (!product) {
    throw createAppError('PRODUCT_NOT_FOUND', 404);
  }

  return {
    product,
    user: buildUserSummary(store, getUserById(store, userId).id)
  };
}

function listUserAddresses(userId) {
  const store = readStore();
  const user = getUserById(store, userId);
  return {
    items: store.userAddresses
      .filter((item) => item.userId === user.id)
      .sort((left, right) => Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault)))
  };
}

function saveUserAddress(userId, payload = {}) {
  const store = readStore();
  const user = getUserById(store, userId);
  const address = normalizeAddressInput(payload, { required: true });
  const isDefault = payload.isDefault !== false;
  let item = null;

  if (payload.id) {
    item = store.userAddresses.find((entry) => entry.id === payload.id && entry.userId === user.id);

    if (!item) {
      throw createAppError('ADDRESS_NOT_FOUND', 404);
    }

    Object.assign(item, address, {
      isDefault,
      updatedAt: nowIso()
    });
  } else {
    item = {
      id: randomId('addr'),
      userId: user.id,
      ...address,
      isDefault,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    store.userAddresses.unshift(item);
  }

  if (item.isDefault) {
    store.userAddresses.forEach((entry) => {
      if (entry.userId === user.id && entry.id !== item.id) {
        entry.isDefault = false;
      }
    });
  }

  writeAudit(store, 'address.saved', item.id, user.id);
  writeStore(store);

  return {
    item,
    items: listUserAddresses(user.id).items
  };
}

function deleteUserAddress(userId, addressId) {
  const store = readStore();
  const user = getUserById(store, userId);
  const item = store.userAddresses.find((entry) => entry.id === addressId && entry.userId === user.id);

  if (!item) {
    throw createAppError('ADDRESS_NOT_FOUND', 404);
  }

  store.userAddresses = store.userAddresses.filter((entry) => entry.id !== item.id);
  if (item.isDefault) {
    const next = store.userAddresses.find((entry) => entry.userId === user.id);
    if (next) {
      next.isDefault = true;
    }
  }

  writeAudit(store, 'address.deleted', item.id, user.id);
  writeStore(store);

  return listUserAddresses(user.id);
}

function getCart(userId) {
  const store = readStore();
  return {
    user: buildUserSummary(store, getUserById(store, userId).id),
    cart: buildCartSummary(store, getUserById(store, userId).id)
  };
}

function addCartItem(userId, payload = {}) {
  const store = readStore();
  const user = getUserById(store, userId);
  const sku = getSkuById(store, payload.skuId);

  if (!sku || sku.status !== 'published') {
    throw createAppError('SKU_NOT_FOUND', 404);
  }

  const quantity = ensureInteger(payload.quantity, {
    field: 'quantity',
    min: 1,
    max: 24,
    defaultValue: 1
  });
  const existing = store.cartItems.find((item) => item.userId === user.id && item.skuId === sku.id);
  const nextQuantity = (existing ? existing.quantity : 0) + quantity;

  if (getAvailableStock(sku) < nextQuantity) {
    throw createAppError('SKU_STOCK_NOT_ENOUGH', 409, {
      skuId: sku.id,
      stock: getAvailableStock(sku)
    });
  }

  if (existing) {
    existing.quantity = ensureInteger(nextQuantity, {
      field: 'quantity',
      min: 1,
      max: 99,
      required: true
    });
  } else {
    store.cartItems.unshift({
      id: randomId('cart'),
      userId: user.id,
      skuId: sku.id,
      quantity,
      createdAt: nowIso()
    });
  }

  writeAudit(store, 'cart.item.added', sku.id, user.id);
  writeStore(store);
  return getCart(user.id);
}

function updateCartItem(userId, itemId, payload = {}) {
  const store = readStore();
  const user = getUserById(store, userId);
  const item = store.cartItems.find((cartItem) => cartItem.id === itemId && cartItem.userId === user.id);

  if (!item) {
    throw createAppError('CART_ITEM_NOT_FOUND', 404);
  }

  const quantity = ensureInteger(payload.quantity, {
    field: 'quantity',
    min: 0,
    max: 99,
    defaultValue: 0
  });

  if (quantity === 0) {
    store.cartItems = store.cartItems.filter((cartItem) => cartItem.id !== item.id);
  } else {
    const sku = getSkuById(store, item.skuId);
    if (!sku || getAvailableStock(sku) < quantity) {
      throw createAppError('SKU_STOCK_NOT_ENOUGH', 409, {
        skuId: item.skuId,
        stock: sku ? getAvailableStock(sku) : 0
      });
    }
    item.quantity = quantity;
  }

  writeAudit(store, 'cart.item.updated', item.id, user.id);
  writeStore(store);
  return getCart(user.id);
}

function removeCartItem(userId, itemId) {
  const store = readStore();
  const user = getUserById(store, userId);
  const existed = store.cartItems.some((item) => item.id === itemId && item.userId === user.id);

  if (!existed) {
    throw createAppError('CART_ITEM_NOT_FOUND', 404);
  }

  store.cartItems = store.cartItems.filter((item) => item.id !== itemId);
  writeAudit(store, 'cart.item.removed', itemId, user.id);
  writeStore(store);
  return getCart(user.id);
}

function createOrder(userId, payload = {}) {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const user = getUserById(store, userId);
  const clientRequestId = ensureText(payload.clientRequestId, {
    field: 'clientRequestId',
    min: 8,
    max: 80,
    defaultValue: ''
  });

  if (clientRequestId) {
    const existingOrder = store.orders.find(
      (item) =>
        item.userId === user.id &&
        item.clientRequestId === clientRequestId &&
        ['pending_payment', 'paid', 'completed'].includes(item.status)
    );

    if (existingOrder) {
      return {
        order: buildOrderView(store, existingOrder),
        cart: buildCartSummary(store, user.id)
      };
    }
  }

  const sourceItems = payload.items
    ? ensureArray(payload.items, {
        field: 'items',
        maxLength: 20
      })
    : store.cartItems
        .filter((item) => item.userId === user.id)
        .map((item) => ({ skuId: item.skuId, quantity: item.quantity, cartItemId: item.id }));

  if (!sourceItems.length) {
    throw createAppError('EMPTY_CART', 400);
  }

  const normalizedItems = sourceItems.map((item) => {
    const skuId = ensureText(item.skuId, {
      field: 'skuId',
      required: true,
      min: 2,
      max: 120
    });
    const sku = getSkuById(store, skuId);
    if (!sku || sku.status !== 'published') {
      throw createAppError('SKU_NOT_FOUND', 404);
    }

    const quantity = ensureInteger(item.quantity, {
      field: 'quantity',
      min: 1,
      max: 24,
      defaultValue: 1
    });

    if (getAvailableStock(sku) < quantity) {
      throw createAppError('SKU_STOCK_NOT_ENOUGH', 409, {
        skuId: sku.id,
        stock: getAvailableStock(sku)
      });
    }

    return {
      sku,
      quantity,
      cartItemId: item.cartItemId || null
    };
  });

  const amount = normalizedItems.reduce((sum, item) => sum + item.sku.price * item.quantity, 0);
  const submittedAddress =
    payload.address && typeof payload.address === 'object'
      ? normalizeAddressInput(payload.address, { required: true })
      : null;
  const defaultAddress = getDefaultAddress(store, user.id);
  const address =
    submittedAddress ||
    (defaultAddress
      ? normalizeAddressInput(defaultAddress, { required: true })
      : {
          contactName: user.nickname || '收货人',
          mobile: user.mobile || '13800000000',
          provinceCity: '上海市静安区',
          detail: '演示收货地址',
          deliveryNote: ''
        });

  if (payload.saveAddress && submittedAddress) {
    store.userAddresses.forEach((item) => {
      if (item.userId === user.id) {
        item.isDefault = false;
      }
    });
    store.userAddresses.unshift({
      id: randomId('addr'),
      userId: user.id,
      ...address,
      isDefault: true,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }

  const order = {
    id: randomId('order'),
    userId: user.id,
    orderNo: generateOrderNo(store),
    orderType: 'physical',
    amount,
    payAmount: amount,
    status: 'pending_payment',
    paidAt: null,
    createdAt: nowIso(),
    expiresAt: plusMinutes(30),
    deliveryStatus: 'pending',
    clientRequestId: clientRequestId || null,
    address,
    addressSummary:
      ensureText(payload.addressSummary, {
        field: 'addressSummary',
        min: 0,
        max: 200,
        defaultValue: ''
      }) || buildAddressSummary(address),
    stockReserved: true,
    reservationReleasedAt: null,
    refundStatus: 'none'
  };

  store.orders.unshift(order);
  normalizedItems.forEach((item) => {
    store.orderItems.push({
      id: randomId('order_item'),
      orderId: order.id,
      productId: item.sku.productId,
      skuId: item.sku.id,
      quantity: item.quantity,
      price: item.sku.price
    });
    item.sku.reservedStock = getReservedStock(item.sku) + item.quantity;
  });
  store.cartItems = store.cartItems.filter(
    (item) => !normalizedItems.some((entry) => entry.cartItemId && entry.cartItemId === item.id)
  );

  writeAudit(store, 'order.created', order.id, user.id);
  writeStore(store);

  return {
    order: buildOrderView(store, order),
    cart: buildCartSummary(store, user.id)
  };
}

function releaseOrderReservation(store, order) {
  if (!order || order.orderType !== 'physical' || !order.stockReserved) {
    return false;
  }

  getOrderItems(store, order.id).forEach((item) => {
    const sku = getSkuById(store, item.skuId);
    if (sku) {
      sku.reservedStock = Math.max(0, getReservedStock(sku) - item.quantity);
    }
  });
  order.stockReserved = false;
  order.reservationReleasedAt = nowIso();
  return true;
}

function closeExpiredOrders(store) {
  let changed = false;

  store.orders.forEach((order) => {
    if (order.status !== 'pending_payment' || !order.expiresAt || !isExpired(order.expiresAt)) {
      return;
    }

    releaseOrderReservation(store, order);
    order.status = 'closed';
    order.deliveryStatus = 'closed';
    order.closedAt = nowIso();
    const payment = findLatestPayment(store, order.id);
    if (payment && ['created', 'pending'].includes(payment.status)) {
      payment.status = 'cancelled';
      payment.updatedAt = nowIso();
    }
    writeAudit(store, 'order.closed.expired', order.id, 'system');
    changed = true;
  });

  return changed;
}

function applyOrderPaidEffects(store, order) {
  if (order.orderType === 'physical') {
    store.orderItems
      .filter((item) => item.orderId === order.id)
      .forEach((item) => {
        const sku = getSkuById(store, item.skuId);
        if (sku) {
          if (order.stockReserved) {
            sku.reservedStock = Math.max(0, getReservedStock(sku) - item.quantity);
          }
          sku.stock = Math.max(0, sku.stock - item.quantity);
        }
      });
    order.stockReserved = false;
    order.reservationReleasedAt = nowIso();
    order.deliveryStatus = 'delivering';
    return;
  }

  if (order.orderType === 'membership') {
    const planId = order.planId;
    const plan = store.membershipPlans.find((item) => item.id === planId);
    if (plan) {
      const now = nowIso();
      const latestMembership = [...store.memberships]
        .filter((item) => item.userId === order.userId)
        .sort((left, right) => new Date(right.expireAt).getTime() - new Date(left.expireAt).getTime())[0];
      const baseDate =
        latestMembership && latestMembership.status === 'active' && !isExpired(latestMembership.expireAt)
          ? latestMembership.expireAt
          : now;
      const expireAt = plusDaysFrom(baseDate, plan.durationDays);

      if (latestMembership) {
        latestMembership.planId = plan.id;
        latestMembership.status = 'active';
        latestMembership.startAt = latestMembership.startAt || now;
        latestMembership.expireAt = expireAt;
        latestMembership.sourceOrderIds = [
          ...new Set([...(latestMembership.sourceOrderIds || []), order.id])
        ];
        latestMembership.updatedAt = now;
      } else {
        store.memberships.unshift({
          id: randomId('membership'),
          userId: order.userId,
          planId: plan.id,
          status: 'active',
          startAt: now,
          expireAt,
          sourceOrderIds: [order.id]
        });
      }

      const welcomeTrackIds = ['track_quiet_world', 'track_amber_salon', 'track_copper_dawn'].slice(
        0,
        plan.id === 'plan_year' ? 3 : 1
      );

      welcomeTrackIds.forEach((trackId) => {
        const existingEntitlement = getTrackEntitlement(store, order.userId, trackId);
        if (existingEntitlement && !isExpired(existingEntitlement.expiredAt)) {
          existingEntitlement.expiredAt = plusDaysFrom(existingEntitlement.expiredAt, plan.durationDays);
          existingEntitlement.sourceOrderIds = [
            ...new Set([...(existingEntitlement.sourceOrderIds || []), existingEntitlement.sourceOrderId, order.id].filter(Boolean))
          ];
        } else {
          store.downloadEntitlements.unshift({
            id: randomId('entitlement'),
            userId: order.userId,
            trackId,
            sourceOrderId: order.id,
            sourceOrderIds: [order.id],
            maxDownloads: 3,
            usedDownloads: 0,
            expiredAt: expireAt
          });
        }
      });
    }

    order.deliveryStatus = 'rights_issued';
    order.status = 'completed';
    return;
  }

  if (order.orderType === 'digital_track') {
    const existingEntitlement = order.trackId
      ? getTrackEntitlement(store, order.userId, order.trackId)
      : null;
    if (order.trackId && (!existingEntitlement || isExpired(existingEntitlement.expiredAt))) {
      store.downloadEntitlements.unshift({
        id: randomId('entitlement'),
        userId: order.userId,
        trackId: order.trackId,
        sourceOrderId: order.id,
        sourceOrderIds: [order.id],
        maxDownloads: 3,
        usedDownloads: 0,
        expiredAt: plusDays(365)
      });
    }

    order.deliveryStatus = 'rights_issued';
    order.status = 'completed';
  }
}

function toFen(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function findLatestPayment(store, orderId) {
  return store.payments
    .filter((item) => item.orderId === orderId)
    .sort(
      (left, right) =>
        new Date(right.createdAt || right.paidAt || 0).getTime() -
        new Date(left.createdAt || left.paidAt || 0).getTime()
    )[0];
}

function buildOrderPaymentStatus(store, order) {
  const payment = findLatestPayment(store, order.id) || null;

  return {
    order: buildOrderView(store, order),
    payment,
    paid: ['paid', 'completed'].includes(order.status)
  };
}

function prepareWechatJsapiPayment(userId, orderId, payload = {}) {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const user = getUserById(store, userId);
  const order = store.orders.find((item) => item.id === orderId && item.userId === user.id);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  if (!['pending_payment', 'paid', 'completed'].includes(order.status)) {
    throw createAppError('ORDER_NOT_PAYABLE', 409);
  }

  if (!user.openid) {
    throw createAppError('WECHAT_AUTH_REQUIRED', 401);
  }

  if (['paid', 'completed'].includes(order.status)) {
    return {
      reused: true,
      order,
      payment: findLatestPayment(store, order.id) || null,
      user
    };
  }

  const idempotencyKey = ensureText(payload.idempotencyKey || payload.clientRequestId, {
    field: 'idempotencyKey',
    required: true,
    min: 8,
    max: 80
  });
  const existingPayment = store.payments.find(
    (item) =>
      item.orderId === order.id &&
      item.channel === 'wechat_pay_jsapi' &&
      item.idempotencyKey === idempotencyKey &&
      ['created', 'pending', 'paid'].includes(item.status)
  );

  if (existingPayment) {
    return {
      reused: true,
      order,
      payment: existingPayment,
      user
    };
  }

  const payment = {
    id: randomId('payment'),
    orderId: order.id,
    channel: 'wechat_pay_jsapi',
    transactionId: null,
    status: 'created',
    createdAt: nowIso(),
    paidAt: null,
    idempotencyKey,
    outTradeNo: order.orderNo,
    totalFen: toFen(order.payAmount),
    callbackPayload: {
      mode: 'wechat_jsapi'
    }
  };

  store.payments.unshift(payment);
  writeAudit(store, 'payment.wechat.prepared', payment.id, user.id);
  writeStore(store);

  return {
    reused: false,
    order,
    payment,
    user
  };
}

function saveWechatPrepay(orderId, paymentId, payload = {}) {
  const store = readStore();
  const order = getOrderById(store, orderId);
  const payment = store.payments.find((item) => item.id === paymentId && item.orderId === orderId);

  if (!order || !payment) {
    throw createAppError('PAYMENT_NOT_FOUND', 404);
  }

  payment.status = 'pending';
  payment.prepayId = payload.prepayId || payment.prepayId || null;
  payment.jsapiParams = payload.jsapiParams || payment.jsapiParams || null;
  payment.requestPayload = payload.requestPayload || payment.requestPayload || null;
  payment.updatedAt = nowIso();

  writeAudit(store, 'payment.wechat.preauth.created', payment.id, order.userId);
  writeStore(store);

  return {
    order,
    payment
  };
}

function markOrderPaidByWechat(payload = {}) {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const outTradeNo = ensureText(payload.outTradeNo, {
    field: 'outTradeNo',
    required: true,
    min: 6,
    max: 80
  });
  const transactionId = ensureText(payload.transactionId, {
    field: 'transactionId',
    required: true,
    min: 6,
    max: 80
  });
  const order = store.orders.find((item) => item.orderNo === outTradeNo);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  const payment =
    store.payments.find((item) => item.orderId === order.id && item.transactionId === transactionId) ||
    store.payments.find((item) => item.orderId === order.id && item.outTradeNo === outTradeNo) ||
    store.payments.find((item) => item.orderId === order.id);

  if (!payment) {
    throw createAppError('PAYMENT_NOT_FOUND', 404);
  }

  const alreadyPaid = ['paid', 'completed'].includes(order.status) && payment.status === 'paid';

  payment.channel = 'wechat_pay_jsapi';
  payment.status = 'paid';
  payment.transactionId = transactionId;
  payment.paidAt = ensureIsoDate(payload.paidAt, {
    field: 'paidAt',
    defaultValue: nowIso()
  });
  payment.callbackPayload = payload.rawPayload || payment.callbackPayload || null;
  payment.updatedAt = nowIso();

  if (!alreadyPaid) {
    order.status = 'paid';
    order.paidAt = payment.paidAt;
    applyOrderPaidEffects(store, order);
    writeAudit(store, 'order.wechat.paid', order.id, order.userId);
  }

  writeStore(store);

  return {
    order: buildOrderView(store, order),
    payment
  };
}

function getOrderPaymentStatus(userId, orderId) {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const user = getUserById(store, userId);
  const order = store.orders.find((item) => item.id === orderId && item.userId === user.id);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  return buildOrderPaymentStatus(store, order);
}

function payOrder(userId, orderId) {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const user = getUserById(store, userId);
  const order = store.orders.find((item) => item.id === orderId && item.userId === user.id);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  if (order.status !== 'pending_payment') {
    throw createAppError('ORDER_NOT_PAYABLE', 409);
  }

  order.status = 'paid';
  order.paidAt = nowIso();
  store.payments.unshift({
    id: randomId('payment'),
    orderId: order.id,
    channel: 'wechat_pay_mock',
    outTradeNo: order.orderNo,
    totalFen: toFen(order.payAmount),
    transactionId: randomId('wx'),
    status: 'paid',
    paidAt: order.paidAt,
    callbackPayload: {
      mode: 'mock'
    }
  });

  applyOrderPaidEffects(store, order);
  writeAudit(store, 'order.paid', order.id, user.id);
  writeStore(store);

  return {
    order: buildOrderView(store, order),
    member: buildMembershipView(store, user.id),
    ...(order.orderType === 'membership' || order.orderType === 'digital_track'
      ? { profile: getMemberProfile(user.id) }
      : {}),
    cart: buildCartSummary(store, user.id)
  };
}

function listOrders(userId) {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const user = getUserById(store, userId);

  return {
    items: store.orders
      .filter((order) => order.userId === user.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((order) => buildOrderView(store, order))
  };
}

function generateRefundNo(store) {
  const date = new Date();
  const prefix = `RF${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`;
  const sameDayCount =
    store.refunds.filter((refund) => String(refund.refundNo || '').startsWith(prefix)).length + 1;
  return `${prefix}${String(sameDayCount).padStart(4, '0')}`;
}

function findOrderRefund(store, orderId) {
  return store.refunds.find((refund) => refund.orderId === orderId && refund.status !== 'cancelled') || null;
}

function requestOrderRefund(userId, orderId, payload = {}) {
  const store = readStore();
  const user = getUserById(store, userId);
  const order = store.orders.find((item) => item.id === orderId && item.userId === user.id);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  if (!['paid', 'completed'].includes(order.status)) {
    throw createAppError('ORDER_NOT_REFUNDABLE', 409);
  }

  const existing = findOrderRefund(store, order.id);
  if (existing) {
    return {
      order: buildOrderView(store, order),
      refund: existing
    };
  }

  const refund = {
    id: randomId('refund'),
    refundNo: generateRefundNo(store),
    orderId: order.id,
    userId: user.id,
    amount: order.payAmount,
    status: 'pending',
    reason: ensureText(payload.reason, {
      field: 'reason',
      min: 0,
      max: 200,
      defaultValue: '用户申请售后退款'
    }),
    requestedAt: nowIso(),
    reviewedAt: null,
    refundedAt: null,
    operator: null,
    restock: false
  };

  store.refunds.unshift(refund);
  order.status = 'refund_pending';
  order.refundStatus = 'pending';
  order.refundRequestedAt = refund.requestedAt;
  writeAudit(store, 'order.refund.requested', order.id, user.id);
  writeStore(store);

  return {
    order: buildOrderView(store, order),
    refund
  };
}

function markOrderRefunded(store, order, payload = {}) {
  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  const refund = findOrderRefund(store, order.id) || {
    id: randomId('refund'),
    refundNo: generateRefundNo(store),
    orderId: order.id,
    userId: order.userId,
    amount: order.payAmount,
    status: 'pending',
    reason: ensureText(payload.refundReason, {
      field: 'refundReason',
      min: 0,
      max: 200,
      defaultValue: '后台退款处理'
    }),
    requestedAt: nowIso(),
    reviewedAt: null,
    refundedAt: null,
    operator: null,
    restock: false
  };

  if (!store.refunds.some((item) => item.id === refund.id)) {
    store.refunds.unshift(refund);
  }

  const restock = payload.restock === true || payload.restock === 'true';
  if (restock && order.orderType === 'physical' && !refund.restock) {
    getOrderItems(store, order.id).forEach((item) => {
      const sku = getSkuById(store, item.skuId);
      if (sku) {
        sku.stock = (Number(sku.stock) || 0) + item.quantity;
      }
    });
    refund.restock = true;
  }

  refund.status = 'refunded';
  refund.reviewedAt = nowIso();
  refund.refundedAt = nowIso();
  refund.operator = (auditContext.getStore() || {}).adminUsername || DEFAULT_ADMIN_USERNAME;
  order.status = 'refunded';
  order.refundStatus = 'refunded';
  order.refundedAt = refund.refundedAt;
  order.deliveryStatus = 'closed';

  const payment = findLatestPayment(store, order.id);
  if (payment) {
    payment.status = 'refunded';
    payment.refundedAt = refund.refundedAt;
    payment.refundAmount = refund.amount;
    payment.updatedAt = nowIso();
  }

  writeAudit(store, 'order.refunded', order.id, DEFAULT_ADMIN_USERNAME, {
    refundNo: refund.refundNo
  });

  return refund;
}

function getRefundOperator() {
  return (auditContext.getStore() || {}).adminUsername || DEFAULT_ADMIN_USERNAME;
}

function prepareWechatRefund(orderId, payload = {}) {
  const store = readStore();
  const order = getOrderById(store, orderId);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  if (!['paid', 'completed', 'refund_pending'].includes(order.status)) {
    throw createAppError('ORDER_NOT_REFUNDABLE', 409);
  }

  const payment = findLatestPayment(store, order.id);
  if (!payment || payment.status !== 'paid') {
    throw createAppError('PAYMENT_NOT_PAID', 409);
  }

  const totalFen = toFen(order.payAmount);
  const refundFen = ensureInteger(payload.refundFen || payload.amountFen || totalFen, {
    field: 'refundFen',
    min: 1,
    max: totalFen,
    defaultValue: totalFen
  });
  const reason = ensureText(payload.reason || payload.refundReason, {
    field: 'reason',
    min: 0,
    max: 80,
    defaultValue: '用户申请售后退款'
  });
  let refund = findOrderRefund(store, order.id);

  if (!refund) {
    refund = {
      id: randomId('refund'),
      refundNo: generateRefundNo(store),
      orderId: order.id,
      userId: order.userId,
      amount: refundFen / 100,
      status: 'pending',
      reason,
      requestedAt: nowIso(),
      reviewedAt: null,
      refundedAt: null,
      operator: null,
      restock: false
    };
    store.refunds.unshift(refund);
  }

  refund.amount = refundFen / 100;
  refund.amountFen = refundFen;
  refund.totalFen = totalFen;
  refund.reason = reason;
  refund.status = 'processing';
  refund.channel = 'wechat_pay';
  refund.outRefundNo = refund.outRefundNo || refund.refundNo;
  refund.reviewedAt = nowIso();
  refund.operator = getRefundOperator();
  refund.updatedAt = nowIso();
  refund.requestPayload = {
    outTradeNo: payment.outTradeNo || order.orderNo,
    transactionId: payment.transactionId || '',
    outRefundNo: refund.outRefundNo,
    refundFen,
    totalFen,
    reason
  };
  order.status = 'refund_pending';
  order.refundStatus = 'processing';
  order.refundRequestedAt = order.refundRequestedAt || refund.requestedAt;
  writeAudit(store, 'order.refund.wechat.requested', order.id, getRefundOperator(), {
    refundNo: refund.refundNo,
    outRefundNo: refund.outRefundNo
  });
  writeStore(store);

  return {
    order: buildOrderView(store, order),
    refund,
    payment,
    wechat: {
      outTradeNo: payment.outTradeNo || order.orderNo,
      transactionId: payment.transactionId || '',
      outRefundNo: refund.outRefundNo,
      refundFen,
      totalFen,
      reason
    }
  };
}

function markWechatRefundAccepted(refundId, payload = {}) {
  const store = readStore();
  const refund = store.refunds.find((item) => item.id === refundId);

  if (!refund) {
    throw createAppError('REFUND_NOT_FOUND', 404);
  }

  const order = getOrderById(store, refund.orderId);

  refund.status = 'processing';
  refund.wechatRefundId = payload.refund_id || payload.refundId || refund.wechatRefundId || null;
  refund.wechatStatus = payload.status || payload.refund_status || refund.wechatStatus || 'PROCESSING';
  refund.responsePayload = payload;
  refund.updatedAt = nowIso();

  if (order) {
    order.status = 'refund_pending';
    order.refundStatus = 'processing';
  }

  writeAudit(store, 'order.refund.wechat.accepted', refund.orderId, getRefundOperator(), {
    refundNo: refund.refundNo,
    wechatRefundId: refund.wechatRefundId
  });
  writeStore(store);

  return {
    order: order ? buildOrderView(store, order) : null,
    refund
  };
}

function markWechatRefundResult(payload = {}) {
  const store = readStore();
  const outRefundNo = ensureText(payload.outRefundNo || payload.out_refund_no, {
    field: 'outRefundNo',
    required: true,
    min: 2,
    max: 80
  });
  const refund = store.refunds.find(
    (item) => item.outRefundNo === outRefundNo || item.refundNo === outRefundNo
  );

  if (!refund) {
    throw createAppError('REFUND_NOT_FOUND', 404);
  }

  const order = getOrderById(store, refund.orderId);
  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  const refundStatus = ensureText(payload.refundStatus || payload.refund_status || payload.status, {
    field: 'refundStatus',
    min: 0,
    max: 40,
    defaultValue: 'PROCESSING'
  });
  refund.wechatStatus = refundStatus;
  refund.wechatRefundId = payload.refundId || payload.refund_id || refund.wechatRefundId || null;
  refund.callbackPayload = payload.rawPayload || payload;
  refund.updatedAt = nowIso();

  if (refundStatus === 'SUCCESS') {
    markOrderRefunded(store, order, {
      refundReason: refund.reason,
      restock: refund.restock === true
    });
    refund.status = 'refunded';
    refund.refundedAt = ensureIsoDate(payload.successTime || payload.success_time, {
      field: 'successTime',
      defaultValue: refund.refundedAt || nowIso()
    });
  } else if (['CLOSED', 'ABNORMAL'].includes(refundStatus)) {
    refund.status = 'failed';
    refund.failedAt = nowIso();
    refund.failReason = ensureText(payload.failReason || payload.statusMessage || payload.status_message, {
      field: 'failReason',
      min: 0,
      max: 200,
      defaultValue: refundStatus
    });
    order.refundStatus = 'failed';
    if (order.status === 'refund_pending') {
      order.status = order.deliveryStatus === 'completed' ? 'completed' : 'paid';
    }
  } else {
    refund.status = 'processing';
    order.refundStatus = 'processing';
    order.status = 'refund_pending';
  }

  writeAudit(store, 'order.refund.wechat.callback', order.id, 'wechat', {
    refundNo: refund.refundNo,
    status: refundStatus
  });
  writeStore(store);

  return {
    order: buildOrderView(store, order),
    refund
  };
}

function buildOrderItemDescription(store, order) {
  return getOrderItems(store, order.id)
    .map((item) => {
      const product = item.productId ? getProductById(store, item.productId) : null;
      const sku = item.skuId ? getSkuById(store, item.skuId) : null;
      const track = item.trackId ? getTrackById(store, item.trackId) : null;
      const name = product ? product.name : track ? track.cnTitle || track.title : order.orderNo;
      return sku ? `${name} ${sku.specName}` : name;
    })
    .filter(Boolean)
    .join('、')
    .slice(0, 120);
}

function prepareWechatShippingSync(orderId, payload = {}) {
  const store = readStore();
  const order = getOrderById(store, orderId);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  if (order.orderType !== 'physical') {
    throw createAppError('ORDER_NOT_PHYSICAL', 409);
  }

  if (!['paid', 'completed'].includes(order.status)) {
    throw createAppError('ORDER_NOT_SHIPPABLE', 409);
  }

  const user = getUserById(store, order.userId);
  if (!user.openid) {
    throw createAppError('WECHAT_OPENID_REQUIRED', 409);
  }

  const payment = findLatestPayment(store, order.id);
  const transactionId = ensureText(payload.transactionId || (payment && payment.transactionId), {
    field: 'transactionId',
    required: true,
    min: 6,
    max: 80
  });
  const shippingCompany = ensureText(payload.shippingCompany || payload.deliveryCompany || order.shippingCompany, {
    field: 'shippingCompany',
    required: true,
    min: 1,
    max: 80
  });
  const trackingNo = ensureText(payload.trackingNo || order.trackingNo, {
    field: 'trackingNo',
    required: true,
    min: 1,
    max: 80
  });
  const itemDesc = ensureText(payload.itemDesc || buildOrderItemDescription(store, order), {
    field: 'itemDesc',
    required: true,
    min: 1,
    max: 120
  });
  const uploadTime = nowIso();

  order.shippingCompany = shippingCompany;
  order.trackingNo = trackingNo;
  order.deliveryStatus = 'delivering';
  order.shippedAt = order.shippedAt || uploadTime;
  order.wechatShippingSyncStatus = 'pending';
  order.wechatShippingLastAttemptAt = uploadTime;
  writeAudit(store, 'order.shipping.wechat.requested', order.id, getRefundOperator(), {
    transactionId,
    trackingNo
  });
  writeStore(store);

  return {
    order: buildOrderView(store, order),
    user,
    wechat: {
      order_key: {
        order_number_type: 2,
        transaction_id: transactionId
      },
      logistics_type: 1,
      delivery_mode: 1,
      shipping_list: [
        {
          tracking_no: trackingNo,
          express_company: shippingCompany,
          item_desc: itemDesc
        }
      ],
      upload_time: uploadTime,
      payer: {
        openid: user.openid
      },
      is_all_delivered: true
    }
  };
}

function markWechatShippingSynced(orderId, payload = {}) {
  const store = readStore();
  const order = getOrderById(store, orderId);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  order.wechatShippingSyncStatus = 'synced';
  order.wechatShippingSyncedAt = nowIso();
  order.wechatShippingResponse = payload;
  writeAudit(store, 'order.shipping.wechat.synced', order.id, getRefundOperator(), payload);
  writeStore(store);

  return {
    ...buildOrderView(store, order),
    user: buildUserSummary(store, order.userId),
    refund: findOrderRefund(store, order.id)
  };
}

function markWechatShippingFailed(orderId, error) {
  const store = readStore();
  const order = getOrderById(store, orderId);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  order.wechatShippingSyncStatus = 'failed';
  order.wechatShippingError = error && error.message ? error.message : String(error || 'WECHAT_SHIPPING_FAILED');
  order.wechatShippingFailedAt = nowIso();
  writeAudit(store, 'order.shipping.wechat.failed', order.id, getRefundOperator(), {
    error: order.wechatShippingError,
    meta: error && error.meta ? error.meta : null
  });
  writeStore(store);

  return {
    ...buildOrderView(store, order),
    user: buildUserSummary(store, order.userId),
    refund: findOrderRefund(store, order.id)
  };
}

function adminCloseExpiredOrders() {
  const store = readStore();
  const changed = closeExpiredOrders(store);

  if (changed) {
    writeStore(store);
  }

  return {
    closed: changed
  };
}

function createPendingVirtualOrder(store, userId, config) {
  const clientRequestId = ensureText(config.clientRequestId, {
    field: 'clientRequestId',
    min: 8,
    max: 80,
    defaultValue: ''
  });

  if (clientRequestId) {
    const existingOrder = store.orders.find(
      (item) =>
        item.userId === userId &&
        item.clientRequestId === clientRequestId &&
        item.orderType === config.orderType &&
        ['pending_payment', 'paid', 'completed'].includes(item.status)
    );

    if (existingOrder) {
      return {
        order: existingOrder,
        created: false
      };
    }
  }

  const order = {
    id: randomId('order'),
    userId,
    orderNo: generateOrderNo(store),
    orderType: config.orderType,
    amount: config.amount,
    payAmount: config.amount,
    status: 'pending_payment',
    paidAt: null,
    createdAt: nowIso(),
    expiresAt: plusMinutes(30),
    deliveryStatus: 'pending',
    addressSummary: '数字权益发放',
    clientRequestId: clientRequestId || null,
    stockReserved: false,
    refundStatus: 'none',
    planId: config.planId || null,
    trackId: config.trackId || null
  };

  store.orders.unshift(order);

  if (config.trackId) {
    store.orderItems.push({
      id: randomId('order_item'),
      orderId: order.id,
      productId: null,
      skuId: null,
      quantity: 1,
      price: config.amount,
      trackId: config.trackId
    });
  }

  return {
    order,
    created: true
  };
}

function getMemberProfile(userId) {
  const store = readStore();
  const user = getUserById(store, userId);
  const membership = buildMembershipView(store, user.id);
  const entitlements = store.downloadEntitlements
    .filter((item) => item.userId === user.id)
    .map((item) => ({
      ...item,
      track: getTrackById(store, item.trackId)
    }));

  return {
    user: buildUserSummary(store, user.id),
    membership,
    plans: store.membershipPlans,
    library: store.tracks.map((track) => buildTrackCard(store, user.id, track)),
    entitlements,
    downloads: store.downloadLogs
      .filter((item) => item.userId === user.id)
      .sort((left, right) => new Date(right.downloadAt).getTime() - new Date(left.downloadAt).getTime())
      .map((item) => ({
        ...item,
        track: getTrackById(store, item.trackId)
      })),
    recentOrders: store.orders
      .filter((order) => order.userId === user.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 4)
      .map((order) => buildOrderView(store, order))
  };
}

function purchaseMembership(userId, payloadOrPlanId) {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const user = getUserById(store, userId);
  const payload =
    payloadOrPlanId && typeof payloadOrPlanId === 'object'
      ? payloadOrPlanId
      : { planId: payloadOrPlanId };
  const normalizedPlanId = ensureText(payload.planId, {
    field: 'planId',
    required: true,
    min: 2,
    max: 80
  });
  const plan = store.membershipPlans.find((item) => item.id === normalizedPlanId);

  if (!plan) {
    throw createAppError('PLAN_NOT_FOUND', 404);
  }

  const result = createPendingVirtualOrder(store, user.id, {
    orderType: 'membership',
    amount: plan.price,
    planId: plan.id,
    clientRequestId: payload.clientRequestId || payload.idempotencyKey || ''
  });
  const order = result.order;

  writeAudit(store, result.created ? 'membership.order.created' : 'membership.order.reused', order.id, user.id);
  writeStore(store);

  return {
    order: buildOrderView(store, order),
    paymentRequired: order.status === 'pending_payment',
    profile: getMemberProfile(user.id)
  };
}

function unlockTrack(userId, trackId, payload = {}) {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const user = getUserById(store, userId);
  const normalizedTrackId = ensureText(trackId, {
    field: 'trackId',
    required: true,
    min: 2,
    max: 120
  });
  const track = getTrackById(store, normalizedTrackId);

  if (!track) {
    throw createAppError('TRACK_NOT_FOUND', 404);
  }

  const membership = buildMembershipView(store, user.id);
  const entitlement = getTrackEntitlement(store, user.id, track.id);

  const action = ensureEnum(payload.action, ['purchase', 'preview'], {
    field: 'action',
    defaultValue: 'purchase'
  });

  if (entitlement && !isExpired(entitlement.expiredAt)) {
    return {
      unlocked: true,
      reason: 'existing_entitlement',
      profile: getMemberProfile(user.id)
    };
  }

  if (action !== 'purchase') {
    return {
      unlocked: Boolean(membership && membership.isActive),
      reason: membership && membership.isActive ? 'membership_play_only' : 'preview_only',
      track: buildTrackCard(store, user.id, track)
    };
  }

  const result = createPendingVirtualOrder(store, user.id, {
    orderType: 'digital_track',
    amount: track.unlockPrice || 29,
    trackId: track.id,
    clientRequestId: payload.clientRequestId || payload.idempotencyKey || ''
  });
  const order = result.order;

  writeAudit(store, result.created ? 'track.unlock.order.created' : 'track.unlock.order.reused', track.id, user.id);
  writeStore(store);

  return {
    unlocked: false,
    reason: order.status === 'pending_payment' ? 'payment_required' : 'purchased',
    paymentRequired: order.status === 'pending_payment',
    order: buildOrderView(store, order),
    profile: getMemberProfile(user.id)
  };
}

function signDownload(userId, trackId, requestMeta) {
  const store = readStore();
  const user = getUserById(store, userId);
  const track = getTrackById(store, trackId);
  const entitlement = getTrackEntitlement(store, user.id, trackId);

  if (!track) {
    throw createAppError('TRACK_NOT_FOUND', 404);
  }

  if (!entitlement || isExpired(entitlement.expiredAt) || entitlement.usedDownloads >= entitlement.maxDownloads) {
    throw createAppError('DOWNLOAD_NOT_ALLOWED', 403);
  }

  const ticket = {
    id: randomId('ticket'),
    token: randomId('dl'),
    userId: user.id,
    trackId: track.id,
    entitlementId: entitlement.id,
    expiresAt: plusMinutes(15),
    usedAt: null
  };

  store.downloadTickets.unshift(ticket);
  writeAudit(store, 'download.signed', ticket.id, user.id);
  writeStore(store);

  return {
    ticketId: ticket.id,
    expiresAt: ticket.expiresAt,
    url: `/api/downloads/file?token=${ticket.token}`
  };
}

function consumeDownloadTicket(token, requestMeta) {
  const store = readStore();
  const ticket = store.downloadTickets.find((item) => item.token === token);

  if (!ticket) {
    throw createAppError('DOWNLOAD_TICKET_NOT_FOUND', 404);
  }

  if (ticket.usedAt) {
    throw createAppError('DOWNLOAD_TICKET_USED', 410);
  }

  if (isExpired(ticket.expiresAt)) {
    throw createAppError('DOWNLOAD_TICKET_EXPIRED', 410);
  }

  const entitlement = store.downloadEntitlements.find((item) => item.id === ticket.entitlementId);
  const track = getTrackById(store, ticket.trackId);
  const asset = getAssetByTrackId(store, ticket.trackId);

  if (!entitlement || !track || !asset) {
    throw createAppError('DOWNLOAD_ASSET_NOT_FOUND', 404);
  }

  if (entitlement.usedDownloads >= entitlement.maxDownloads) {
    throw createAppError('DOWNLOAD_LIMIT_REACHED', 410);
  }

  ticket.usedAt = nowIso();
  entitlement.usedDownloads += 1;
  store.downloadLogs.unshift({
    id: randomId('download_log'),
    userId: ticket.userId,
    trackId: ticket.trackId,
    assetId: asset.id,
    ip: (requestMeta && requestMeta.ip) || '127.0.0.1',
    deviceInfo: (requestMeta && requestMeta.deviceInfo) || 'mini-program',
    downloadAt: ticket.usedAt
  });

  writeAudit(store, 'download.completed', ticket.id, ticket.userId);
  writeStore(store);

  return {
    track,
    asset
  };
}

function getDownloadLogs(userId) {
  return getMemberProfile(userId).downloads;
}

function adminLogin(payload = {}) {
  const store = readStore();
  cleanupAdminSessions(store);
  const username = ensureText(payload.username, {
    field: 'username',
    required: true,
    min: 3,
    max: 80
  });
  const password = ensureText(payload.password, {
    field: 'password',
    required: true,
    min: 8,
    max: 128
  });
  const admin = store.adminUsers.find((item) => item.username === username && item.status === 'active');

  if (!admin) {
    throw createAppError('ADMIN_LOGIN_FAILED', 401);
  }

  const passwordState = verifyPasswordHash(admin.passwordHash, password);
  if (!passwordState.valid) {
    throw createAppError('ADMIN_LOGIN_FAILED', 401);
  }

  if (passwordState.needsRehash) {
    admin.passwordHash = hashPassword(password);
  }

  const token = createSessionToken();
  const session = {
    id: randomId('admin_session'),
    tokenHash: hashSessionToken(token),
    tokenPreview: token.slice(-6),
    adminUserId: admin.id,
    expireAt: plusDays(runtimeConfig.adminSessionDays),
    createdAt: nowIso(),
    lastSeenAt: nowIso()
  };

  admin.lastLoginAt = nowIso();
  store.adminSessions.unshift(session);
  cleanupAdminSessions(store);
  writeAudit(store, 'admin.login', admin.id, admin.username);
  writeStore(store);

  const role = getAdminRole(store, admin);

  return {
    token,
    user: {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      roleId: admin.roleId,
      roleName: role ? role.name : '',
      permissions: getAdminPermissions(store, admin)
    }
  };
}

function assertAdmin(store, token) {
  const normalizedToken = ensureAdminToken(token);
  const cleanupChanged = cleanupAdminSessions(store);
  const tokenHash = hashSessionToken(normalizedToken);
  const session = store.adminSessions.find(
    (item) => item.tokenHash === tokenHash || (item.token && item.token === normalizedToken)
  );

  if (!session || isExpired(session.expireAt)) {
    throw createAppError('ADMIN_UNAUTHORIZED', 401);
  }

  const admin = store.adminUsers.find((item) => item.id === session.adminUserId);

  if (!admin || admin.status !== 'active') {
    throw createAppError('ADMIN_UNAUTHORIZED', 401);
  }

  const shouldTouchSession =
    !session.lastSeenAt || Date.now() - new Date(session.lastSeenAt).getTime() > 5 * 60 * 1000;

  if (cleanupChanged || shouldTouchSession) {
    session.lastSeenAt = nowIso();
    writeStore(store);
  }

  return admin;
}

function getAdminRole(store, admin) {
  ensureAdminRoles(store);
  return store.adminRoles.find((role) => role.id === admin.roleId) || null;
}

function getAdminPermissions(store, admin) {
  const role = getAdminRole(store, admin);
  return role && Array.isArray(role.permissions) ? role.permissions : [];
}

function permissionMatches(allowedPermission, requiredPermission) {
  if (allowedPermission === '*') {
    return true;
  }

  if (allowedPermission === requiredPermission) {
    return true;
  }

  if (allowedPermission.endsWith('.*')) {
    const prefix = allowedPermission.slice(0, -2);
    return requiredPermission === prefix || requiredPermission.startsWith(`${prefix}.`);
  }

  return false;
}

function assertAdminPermission(store, admin, permission) {
  if (!permission) {
    return true;
  }

  const permissions = getAdminPermissions(store, admin);
  if (permissions.some((allowed) => permissionMatches(allowed, permission))) {
    return true;
  }

  throw createAppError('ADMIN_FORBIDDEN', 403, {
    permission
  });
}

function adminLogout(token) {
  const store = readStore();
  const normalizedToken = ensureAdminToken(token);
  const tokenHash = hashSessionToken(normalizedToken);
  const matchedSession = store.adminSessions.find(
    (item) => item.tokenHash === tokenHash || item.token === normalizedToken
  );
  const matchedAdmin = matchedSession
    ? store.adminUsers.find((item) => item.id === matchedSession.adminUserId)
    : null;
  const before = store.adminSessions.length;
  store.adminSessions = store.adminSessions.filter(
    (item) => item.tokenHash !== tokenHash && item.token !== normalizedToken
  );

  if (store.adminSessions.length === before) {
    throw createAppError('ADMIN_UNAUTHORIZED', 401);
  }

  writeAudit(store, 'admin.logout', 'session', matchedAdmin ? matchedAdmin.username : DEFAULT_ADMIN_USERNAME);
  writeStore(store);

  return {
    loggedOut: true
  };
}

function adminChangePassword(token, payload = {}) {
  const store = readStore();
  const normalizedToken = ensureAdminToken(token);
  const admin = assertAdmin(store, normalizedToken);
  const currentPassword = ensureText(payload.currentPassword, {
    field: 'currentPassword',
    required: true,
    min: 8,
    max: 128
  });
  const nextPassword = ensureText(payload.nextPassword, {
    field: 'nextPassword',
    required: true,
    min: 10,
    max: 128
  });

  if (!verifyPasswordHash(admin.passwordHash, currentPassword).valid) {
    throw createAppError('ADMIN_PASSWORD_INVALID', 401);
  }

  if (!isStrongPassword(nextPassword)) {
    throw createAppError('ADMIN_PASSWORD_WEAK', 400, {
      policy: '10-128 chars with upper, lower, number, symbol'
    });
  }

  if (currentPassword === nextPassword) {
    throw createAppError('ADMIN_PASSWORD_REUSED', 400);
  }

  admin.passwordHash = hashPassword(nextPassword);
  const currentTokenHash = hashSessionToken(normalizedToken);
  store.adminSessions = store.adminSessions.filter(
    (item) => item.tokenHash === currentTokenHash || item.token === normalizedToken
  );
  writeAudit(store, 'admin.password.changed', admin.id, admin.username);
  writeStore(store);

  return {
    updated: true
  };
}

function adminDashboard() {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }
  const paidOrders = store.orders.filter((order) => ['paid', 'completed'].includes(order.status));
  const revenue = paidOrders.reduce((sum, order) => sum + (order.payAmount || 0), 0);
  const claimedCodes = store.scanCodes.filter((code) => code.status === 'claimed').length;
  const readyCodes = store.scanCodes.filter((code) => code.status === 'ready').length;
  const disabledCodes = store.scanCodes.filter((code) => code.status === 'disabled').length;
  const totalCodes = store.scanCodes.length;
  const failLogs = store.redeemFailLogs || [];
  const failLogs24h = failLogs.filter(
    (log) => Date.now() - new Date(log.createdAt).getTime() < 24 * 60 * 60 * 1000
  ).length;
  const activeMembers = store.memberships.filter(
    (membership) => membership.status === 'active' && !isExpired(membership.expireAt)
  ).length;
  const totalUsers = store.users.length;

  // 提取码验证成功率（总尝试 = 成功 + 失败）
  const totalAttempts = claimedCodes + failLogs.length;
  const successRate = totalAttempts > 0 ? Math.round((claimedCodes / totalAttempts) * 100) : 0;

  // 会员转化率（有会员的用户 / 总用户）
  const memberRate = totalUsers > 0 ? Math.round((activeMembers / totalUsers) * 100) : 0;

  // 下载统计
  const totalDownloads = store.downloadLogs.length;
  const downloads24h = store.downloadLogs.filter(
    (log) => Date.now() - new Date(log.downloadAt).getTime() < 24 * 60 * 60 * 1000
  ).length;

  // 订单转化（下单数/总用户）
  const orderUsers = new Set(store.orders.map((o) => o.userId)).size;
  const orderRate = totalUsers > 0 ? Math.round((orderUsers / totalUsers) * 100) : 0;

  return {
    cards: [
      { label: '累计成交', value: `¥${revenue}`, detail: `${paidOrders.length} 笔已支付订单` },
      { label: '提取码已使用', value: `${claimedCodes}`, detail: `${readyCodes} 个待使用 · 成功率 ${successRate}%` },
      { label: '会员用户', value: `${activeMembers}`, detail: `${totalUsers} 位用户 · 转化率 ${memberRate}%` },
      { label: '24h验证失败', value: `${failLogs24h}`, detail: `${failLogs.length} 条历史失败记录` }
    ],
    metrics: {
      codeSuccessRate: successRate,
      codeTotal: totalCodes,
      memberRate: memberRate,
      orderRate: orderRate,
      totalDownloads: totalDownloads,
      downloads24h: downloads24h,
      totalUsers: totalUsers,
      activeMembers: activeMembers
    },
    recentOrders: store.orders
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 6)
      .map((order) => buildOrderView(store, order)),
    hotProducts: store.products
      .sort((left, right) => left.featuredRank - right.featuredRank)
      .map((product) => buildProductCard(store, product.id)),
    codeSummary: {
      ready: readyCodes,
      claimed: claimedCodes,
      expired: store.scanCodes.filter((code) => code.status === 'expired').length,
      disabled: disabledCodes
    }
  };
}

function adminReconciliationReport() {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }

  const paidOrders = store.orders.filter((order) => ['paid', 'completed'].includes(order.status));
  const paidPayments = store.payments.filter((payment) => payment.status === 'paid');
  const pendingRefunds = store.refunds.filter((refund) => ['pending', 'processing'].includes(refund.status));
  const unsettledPhysicalOrders = store.orders.filter(
    (order) =>
      order.orderType === 'physical' &&
      ['paid', 'completed'].includes(order.status) &&
      !['completed', 'closed'].includes(order.deliveryStatus)
  );
  const anomalies = [];

  paidOrders.forEach((order) => {
    const payment = findLatestPayment(store, order.id);
    if (!payment || payment.status !== 'paid') {
      anomalies.push({
        level: 'high',
        type: 'paid_order_without_paid_payment',
        orderId: order.id,
        orderNo: order.orderNo,
        message: '订单已支付，但没有 paid 状态支付流水。'
      });
    }
  });

  paidPayments.forEach((payment) => {
    const order = getOrderById(store, payment.orderId);
    if (!order || !['paid', 'completed', 'refunded'].includes(order.status)) {
      anomalies.push({
        level: 'high',
        type: 'paid_payment_without_paid_order',
        orderId: payment.orderId,
        paymentId: payment.id,
        message: '支付流水已成功，但订单未进入已支付/完成/退款状态。'
      });
    }
  });

  store.productSkus.forEach((sku) => {
    if (Number(sku.stock || 0) < 0 || Number(sku.reservedStock || 0) < 0) {
      anomalies.push({
        level: 'medium',
        type: 'negative_stock',
        skuId: sku.id,
        message: 'SKU 库存或预占库存出现负数。'
      });
    }
  });

  unsettledPhysicalOrders
    .filter((order) => order.deliveryStatus === 'delivering' && order.wechatShippingSyncStatus !== 'synced')
    .forEach((order) => {
      anomalies.push({
        level: 'medium',
        type: 'shipping_not_synced',
        orderId: order.id,
        orderNo: order.orderNo,
        message: '实物订单已进入发货流程，但未完成微信发货同步。'
      });
    });

  pendingRefunds.forEach((refund) => {
    const ageMs = Date.now() - new Date(refund.requestedAt || refund.reviewedAt || Date.now()).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      anomalies.push({
        level: 'medium',
        type: 'refund_pending_over_24h',
        refundId: refund.id,
        orderId: refund.orderId,
        message: '退款超过 24 小时仍未结束。'
      });
    }
  });

  return {
    generatedAt: nowIso(),
    summary: {
      orders: store.orders.length,
      paidOrders: paidOrders.length,
      paidAmount: paidOrders.reduce((sum, order) => sum + Number(order.payAmount || 0), 0),
      paidPayments: paidPayments.length,
      paidPaymentAmount: paidPayments.reduce((sum, payment) => sum + Number(payment.totalFen || 0) / 100, 0),
      refunds: store.refunds.length,
      pendingRefunds: pendingRefunds.length,
      unsettledPhysicalOrders: unsettledPhysicalOrders.length,
      anomalies: anomalies.length
    },
    pendingRefunds,
    unsettledPhysicalOrders: unsettledPhysicalOrders.map((order) => buildOrderView(store, order)),
    anomalies
  };
}

function escapeCsv(value) {
  const text = String(value === undefined || value === null ? '' : value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function adminExportOrdersCsv() {
  const store = readStore();
  const header = [
    '订单号',
    '用户',
    '类型',
    '金额',
    '状态',
    '履约状态',
    '支付渠道',
    '微信交易号',
    '退款状态',
    '微信发货同步',
    '物流公司',
    '物流单号',
    '创建时间',
    '支付时间'
  ];
  const rows = store.orders
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((order) => {
      const user = getUserById(store, order.userId);
      const payment = findLatestPayment(store, order.id) || {};
      return [
        order.orderNo,
        user.nickname || user.id,
        order.orderType,
        order.payAmount,
        order.status,
        order.deliveryStatus,
        payment.channel || '',
        payment.transactionId || '',
        order.refundStatus || '',
        order.wechatShippingSyncStatus || '',
        order.shippingCompany || '',
        order.trackingNo || '',
        order.createdAt || '',
        order.paidAt || ''
      ];
    });

  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function adminListWines() {
  const store = readStore();

  return store.wines.map((wine) => ({
    ...wine,
    trackCount: (wine.trackIds || []).length
  }));
}

function adminListWineries() {
  const store = readStore();
  return store.wineries.map((winery) => ({
    ...winery,
    wineCount: store.wines.filter((wine) => wine.wineryId === winery.id).length
  }));
}

function adminCreateWinery(payload = {}) {
  const store = readStore();
  const name = ensureText(payload.name, {
    field: 'name',
    required: true,
    min: 2,
    max: 80
  });
  const id = payload.id || slugifyId(`${name}-${Date.now()}`, 'winery');

  if (store.wineries.some((item) => item.id === id)) {
    throw createAppError('WINERY_ID_EXISTS', 409);
  }

  const winery = {
    id,
    name,
    englishName: ensureText(payload.englishName, {
      field: 'englishName',
      min: 0,
      max: 80,
      defaultValue: ''
    }),
    tagline: ensureText(payload.tagline, {
      field: 'tagline',
      min: 0,
      max: 120,
      defaultValue: ''
    }),
    intro: ensureText(payload.intro, {
      field: 'intro',
      min: 0,
      max: 1000,
      defaultValue: ''
    }),
    story: ensureText(payload.story, {
      field: 'story',
      min: 0,
      max: 2000,
      defaultValue: ''
    }),
    heroImage: ensureText(payload.heroImage, {
      field: 'heroImage',
      min: 0,
      max: 500,
      defaultValue: '/assets/images/winery-vineyard-moon.jpg'
    }),
    portraitImage: ensureText(payload.portraitImage, {
      field: 'portraitImage',
      min: 0,
      max: 500,
      defaultValue: ''
    }),
    harvestImage: ensureText(payload.harvestImage, {
      field: 'harvestImage',
      min: 0,
      max: 500,
      defaultValue: ''
    }),
    giftImage: ensureText(payload.giftImage, {
      field: 'giftImage',
      min: 0,
      max: 500,
      defaultValue: ''
    })
  };

  store.wineries.unshift(winery);
  writeAudit(store, 'winery.created', winery.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return winery;
}

function adminListTracks() {
  const store = readStore();
  return store.tracks.map((track) => ({
    ...track,
    wineName: (getWineById(store, track.wineId) || {}).name || '-'
  }));
}

function adminCreateTrack(payload = {}) {
  const store = readStore();
  const title = ensureText(payload.title, {
    field: 'title',
    required: true,
    min: 1,
    max: 120
  });
  const wineId = ensureText(payload.wineId, {
    field: 'wineId',
    required: true,
    min: 2,
    max: 120
  });
  const wine = getWineById(store, wineId);
  if (!wine) {
    throw createAppError('WINE_NOT_FOUND', 404);
  }

  const id = payload.id || slugifyId(`${title}-${Date.now()}`, 'track');
  if (store.tracks.some((item) => item.id === id)) {
    throw createAppError('TRACK_ID_EXISTS', 409);
  }

  const track = {
    id,
    wineId,
    mood: ensureText(payload.mood, { field: 'mood', min: 0, max: 40, defaultValue: '' }),
    title,
    cnTitle: ensureText(payload.cnTitle, { field: 'cnTitle', min: 0, max: 80, defaultValue: '' }),
    description: ensureText(payload.description, { field: 'description', min: 0, max: 500, defaultValue: '' }),
    src: ensureText(payload.src, { field: 'src', min: 0, max: 500, defaultValue: '' }),
    durationLabel: ensureText(payload.durationLabel, { field: 'durationLabel', min: 0, max: 20, defaultValue: '' }),
    art: ensureText(payload.art, { field: 'art', min: 0, max: 40, defaultValue: 'noir' }),
    cover: ensureText(payload.cover, { field: 'cover', min: 0, max: 500, defaultValue: '' }),
    playRule: ensureEnum(payload.playRule, ['trial', 'scan_or_member', 'member'], { field: 'playRule', defaultValue: 'member' }),
    previewSeconds: ensureInteger(payload.previewSeconds, { field: 'previewSeconds', min: 5, max: 60, defaultValue: 12 }),
    unlockPrice: ensureInteger(payload.unlockPrice, { field: 'unlockPrice', min: 0, max: 999, defaultValue: 29 })
  };

  store.tracks.unshift(track);

  if (!wine.trackIds) {
    wine.trackIds = [];
  }
  if (!wine.trackIds.includes(track.id)) {
    wine.trackIds.push(track.id);
  }

  const asset = {
    id: `asset_${track.id}`,
    trackId: track.id,
    fileUrl: track.src,
    fileHash: `hash-${track.id}`,
    fileSize: 0,
    downloadRule: 'entitlement'
  };
  if (!store.downloadAssets.some((item) => item.trackId === track.id)) {
    store.downloadAssets.unshift(asset);
  }

  writeAudit(store, 'track.created', track.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return { ...track, wineName: wine.name };
}

function adminSaveTrack(payload = {}) {
  const store = readStore();
  const track = store.tracks.find((item) => item.id === payload.id);

  if (!track) {
    throw createAppError('TRACK_NOT_FOUND', 404);
  }

  const fields = ['title', 'cnTitle', 'mood', 'description', 'src', 'durationLabel', 'art', 'cover'];
  const fieldRules = {
    title: { min: 1, max: 120 },
    cnTitle: { min: 0, max: 80 },
    mood: { min: 0, max: 40 },
    description: { min: 0, max: 500 },
    src: { min: 0, max: 500 },
    durationLabel: { min: 0, max: 20 },
    art: { min: 0, max: 40 },
    cover: { min: 0, max: 500 }
  };

  fields.forEach((field) => {
    if (payload[field] !== undefined) {
      track[field] = ensureText(payload[field], {
        field,
        required: field === 'title',
        min: fieldRules[field].min,
        max: fieldRules[field].max
      });
    }
  });

  if (payload.playRule !== undefined) {
    track.playRule = ensureEnum(payload.playRule, ['trial', 'scan_or_member', 'member'], { field: 'playRule' });
  }

  if (payload.previewSeconds !== undefined) {
    track.previewSeconds = ensureInteger(payload.previewSeconds, { field: 'previewSeconds', min: 5, max: 60 });
  }

  if (payload.unlockPrice !== undefined) {
    track.unlockPrice = ensureInteger(payload.unlockPrice, { field: 'unlockPrice', min: 0, max: 999 });
  }

  if (payload.wineId !== undefined) {
    const newWineId = ensureText(payload.wineId, { field: 'wineId', min: 2, max: 120 });
    if (newWineId !== track.wineId) {
      const oldWine = getWineById(store, track.wineId);
      if (oldWine && oldWine.trackIds) {
        oldWine.trackIds = oldWine.trackIds.filter((id) => id !== track.id);
      }
      const newWine = getWineById(store, newWineId);
      if (!newWine) {
        throw createAppError('WINE_NOT_FOUND', 404);
      }
      if (!newWine.trackIds) {
        newWine.trackIds = [];
      }
      if (!newWine.trackIds.includes(track.id)) {
        newWine.trackIds.push(track.id);
      }
      track.wineId = newWineId;
    }
  }

  const asset = store.downloadAssets.find((item) => item.trackId === track.id);
  if (asset && track.src && asset.fileUrl !== track.src) {
    asset.fileUrl = track.src;
  }

  writeAudit(store, 'track.updated', track.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return { ...track, wineName: (getWineById(store, track.wineId) || {}).name || '-' };
}

function adminSaveWinery(payload = {}) {
  const store = readStore();
  const winery = store.wineries.find((item) => item.id === payload.id);

  if (!winery) {
    throw createAppError('WINERY_NOT_FOUND', 404);
  }

  const fields = ['name', 'englishName', 'tagline', 'intro', 'story', 'heroImage', 'portraitImage', 'harvestImage', 'giftImage'];
  const fieldRules = {
    name: { min: 2, max: 80 },
    englishName: { min: 0, max: 80 },
    tagline: { min: 0, max: 120 },
    intro: { min: 0, max: 1000 },
    story: { min: 0, max: 2000 },
    heroImage: { min: 0, max: 500 },
    portraitImage: { min: 0, max: 500 },
    harvestImage: { min: 0, max: 500 },
    giftImage: { min: 0, max: 500 }
  };

  fields.forEach((field) => {
    if (payload[field] !== undefined) {
      winery[field] = ensureText(payload[field], {
        field,
        required: field === 'name',
        min: fieldRules[field].min,
        max: fieldRules[field].max
      });
    }
  });

  writeAudit(store, 'winery.updated', winery.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return winery;
}

function adminCreateWine(payload = {}) {
  const store = readStore();
  const winery = store.wineries.find((item) => item.id === (payload.wineryId || store.wineries[0].id));

  if (!winery) {
    throw createAppError('WINERY_NOT_FOUND', 404);
  }

  const baseName = ensureText(payload.name || payload.title || '新酒款', {
    field: 'name',
    required: true,
    min: 2,
    max: 80
  });
  const id = payload.id || slugifyId(`${baseName}-${Date.now()}`, 'wine');
  if (store.wines.some((item) => item.id === id)) {
    throw createAppError('WINE_ID_EXISTS', 409);
  }

  const wine = {
    id,
    wineryId: winery.id,
    brand: payload.brand || 'Hongjiu Estate',
    eyebrow: ensureText(payload.eyebrow, {
      field: 'eyebrow',
      min: 1,
      max: 24,
      defaultValue: '新建酒款'
    }),
    title: ensureText(payload.title || baseName, {
      field: 'title',
      min: 2,
      max: 100,
      defaultValue: baseName
    }),
    name: baseName,
    subtitle: ensureText(payload.subtitle, {
      field: 'subtitle',
      min: 2,
      max: 120,
      defaultValue: '待完善副标题'
    }),
    vintage: payload.vintage || '2026 New Edition',
    region: ensureText(payload.region, {
      field: 'region',
      min: 2,
      max: 80,
      defaultValue: '待设置产区'
    }),
    country: payload.country || 'China',
    grapes: payload.grapes || '待设置葡萄品种',
    abv: payload.abv || '13.5% vol',
    style: payload.style || '待设置风格',
    serving: payload.serving || '待设置饮用建议',
    quote: payload.quote || '待补充品牌引言。',
    overview: payload.overview || '待补充酒款概述。',
    storyTitle: payload.storyTitle || '酒款故事',
    story: payload.story || '待补充酒款故事。',
    moodLine: payload.moodLine || '待补充配乐提示。',
    estateName: payload.estateName || winery.name,
    estateTagline: payload.estateTagline || winery.tagline || '待补充酒庄标语',
    estateIntro: payload.estateIntro || winery.intro || '待补充酒庄简介。',
    estatePhilosophy: payload.estatePhilosophy || winery.story || '待补充酒庄理念。',
    estateHeroImage: payload.estateHeroImage || winery.heroImage,
    estatePortraitImage: payload.estatePortraitImage || winery.portraitImage,
    harvestImage: payload.harvestImage || winery.harvestImage,
    bottleImage: payload.bottleImage || '/assets/images/wine-bottle-estate.jpg',
    posterImage: payload.posterImage || '/assets/images/wine-bottle-poster.jpg',
    giftImage: payload.giftImage || winery.giftImage || '/assets/images/wine-gift-set.jpg',
    estateStats: payload.estateStats || [
      { label: '内容状态', value: '新建草稿' },
      { label: '酒庄', value: winery.name },
      { label: '下一步', value: '补全酒款信息并绑定商品' }
    ],
    tasting: payload.tasting || [
      { key: '香气', icon: 'AROMA', text: '待补充香气描述。', meter: 70 },
      { key: '口感', icon: 'PALATE', text: '待补充口感描述。', meter: 70 },
      { key: '尾韵', icon: 'FINISH', text: '待补充尾韵描述。', meter: 70 }
    ],
    scores: payload.scores || [
      { source: '氛围', score: 'New' },
      { source: '质地', score: 'Draft' },
      { source: '记忆点', score: 'Pending' }
    ],
    technical: payload.technical || [
      { label: '醒酒建议', value: '待完善' },
      { label: '配餐建议', value: '待完善' },
      { label: '礼赠属性', value: '待完善' },
      { label: '音乐搭配', value: '待完善' }
    ],
    collection: payload.collection || [],
    trackIds: payload.trackIds || [],
    productId: payload.productId || '',
    status: payload.status || 'active'
  };

  store.wines.unshift(wine);
  writeAudit(store, 'wine.created', wine.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return wine;
}

function adminSaveWine(payload = {}) {
  const store = readStore();
  const wine = store.wines.find((item) => item.id === payload.id);

  if (!wine) {
    throw createAppError('WINE_NOT_FOUND', 404);
  }

  const fields = [
    'eyebrow',
    'name',
    'subtitle',
    'overview',
    'quote',
    'region',
    'grapes',
    'abv',
    'serving'
  ];

  const fieldRules = {
    eyebrow: { min: 1, max: 24 },
    name: { min: 2, max: 80 },
    subtitle: { min: 2, max: 120 },
    overview: { min: 2, max: 500 },
    quote: { min: 2, max: 160 },
    region: { min: 2, max: 80 },
    grapes: { min: 2, max: 120 },
    abv: { min: 2, max: 40 },
    serving: { min: 2, max: 80 }
  };

  fields.forEach((field) => {
    if (payload[field] !== undefined) {
      wine[field] = ensureText(payload[field], {
        field,
        required: true,
        min: fieldRules[field].min,
        max: fieldRules[field].max
      });
    }
  });

  writeAudit(store, 'wine.updated', wine.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);

  return wine;
}

function adminDeleteWine(wineId) {
  const store = readStore();
  const wine = store.wines.find((item) => item.id === wineId);

  if (!wine) {
    throw createAppError('WINE_NOT_FOUND', 404);
  }

  const linkedTrackIds = store.tracks
    .filter((item) => item.wineId === wineId)
    .map((item) => item.id);
  const linkedTrackIdSet = new Set(linkedTrackIds);
  const hasReferences =
    linkedTrackIds.length > 0 ||
    store.products.some((item) => item.wineId === wineId) ||
    store.scanCodes.some((item) => item.wineId === wineId) ||
    store.scanSessions.some((item) => item.wineId === wineId) ||
    store.orderItems.some((item) => item.trackId && linkedTrackIdSet.has(item.trackId)) ||
    store.downloadEntitlements.some((item) => linkedTrackIdSet.has(item.trackId)) ||
    store.downloadLogs.some((item) => linkedTrackIdSet.has(item.trackId)) ||
    store.downloadTickets.some((item) => linkedTrackIdSet.has(item.trackId));

  if (hasReferences) {
    wine.status = 'archived';
    writeAudit(store, 'wine.archived', wine.id, DEFAULT_ADMIN_USERNAME);
    writeStore(store);
    return {
      mode: 'archived',
      item: wine
    };
  }

  store.wines = store.wines.filter((item) => item.id !== wineId);
  writeAudit(store, 'wine.deleted', wineId, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return {
    mode: 'deleted',
    item: wine
  };
}

function adminExportCodesCsv() {
  const store = readStore();
  const header = '提取码,酒款,歌曲,批次,状态,创建时间,使用时间,使用用户\n';
  const rows = store.scanCodes
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((code) => {
      const wineName = code.wineId ? (getWineById(store, code.wineId) || {}).name || '' : '';
      const track = code.trackId ? getTrackById(store, code.trackId) : null;
      const trackName = track ? track.cnTitle || track.title || '' : '';
      return `${code.redeemCode || code.token},${wineName},${trackName},${code.batchNo || ''},${code.status},${code.createdAt || ''},${code.firstUsedAt || ''},${code.firstUserId || ''}`;
    })
    .join('\n');
  return header + rows;
}

function adminListCodes() {
  const store = readStore();

  return store.scanCodes
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((code) => ({
      ...code,
      wine: getWineById(store, code.wineId),
      track: getTrackById(store, code.trackId)
    }));
}

function adminListProducts() {
  const store = readStore();

  return store.products.map((product) => buildProductCard(store, product.id));
}

function adminCreateProduct(payload = {}) {
  const store = readStore();
  const wine = getWineById(store, payload.wineId || store.wines[0].id);

  if (!wine) {
    throw createAppError('WINE_NOT_FOUND', 404);
  }

  const baseName = ensureText(payload.name || `${wine.name} 礼盒`, {
    field: 'name',
    required: true,
    min: 2,
    max: 120
  });
  const product = {
    id: payload.id || slugifyId(`${baseName}-${Date.now()}`, 'product'),
    wineId: wine.id,
    name: baseName,
    subtitle: ensureText(payload.subtitle, {
      field: 'subtitle',
      min: 2,
      max: 120,
      defaultValue: '待完善商品副标题'
    }),
    coverImage: payload.coverImage || wine.giftImage || '/assets/images/wine-gift-set.jpg',
    status: ensureEnum(payload.status, ['draft', 'published', 'archived'], {
      field: 'status',
      defaultValue: 'draft'
    }),
    category: ensureText(payload.category, {
      field: 'category',
      min: 1,
      max: 40,
      defaultValue: '礼盒'
    }),
    badge: ensureText(payload.badge, {
      field: 'badge',
      min: 1,
      max: 32,
      defaultValue: '新建商品'
    }),
    story: payload.story || '待补充商品故事。',
    highlights: payload.highlights || ['待补充卖点'],
    gallery: payload.gallery || [payload.coverImage || wine.giftImage || '/assets/images/wine-gift-set.jpg'],
    tags: payload.tags || ['待完善'],
    featuredRank: ensureInteger(payload.featuredRank, {
      field: 'featuredRank',
      min: 1,
      max: 9999,
      defaultValue: Math.max(1, ...store.products.map((item) => Number(item.featuredRank) || 0)) + 1
    })
  };

  if (store.products.some((item) => item.id === product.id)) {
    throw createAppError('PRODUCT_ID_EXISTS', 409);
  }

  const sku = {
    id: payload.skuId || slugifyId(`${product.id}-default`, 'sku'),
    productId: product.id,
    specName: ensureText(payload.specName, {
      field: 'specName',
      min: 1,
      max: 40,
      defaultValue: '默认规格'
    }),
    price: ensureInteger(payload.price, {
      field: 'price',
      min: 0,
      max: 999999,
      defaultValue: 399
    }),
    marketPrice: ensureInteger(payload.marketPrice, {
      field: 'marketPrice',
      min: 0,
      max: 999999,
      defaultValue: 469
    }),
    stock: ensureInteger(payload.stock, {
      field: 'stock',
      min: 0,
      max: 999999,
      defaultValue: 12
    }),
    status: ensureEnum(payload.skuStatus, ['draft', 'published', 'archived'], {
      field: 'skuStatus',
      defaultValue: 'published'
    })
  };

  if (sku.marketPrice < sku.price) {
    throw createValidationError('marketPrice', 'less_than_price');
  }

  store.products.unshift(product);
  store.productSkus.unshift(sku);
  if (!wine.productId) {
    wine.productId = product.id;
  }
  writeAudit(store, 'product.created', product.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return buildProductCard(store, product.id);
}

function adminUpdateProduct(productId, payload = {}) {
  const store = readStore();
  const product = store.products.find((item) => item.id === productId);

  if (!product) {
    throw createAppError('PRODUCT_NOT_FOUND', 404);
  }

  if (payload.name !== undefined) {
    product.name = ensureText(payload.name, {
      field: 'name',
      required: true,
      min: 2,
      max: 120
    });
  }

  if (payload.subtitle !== undefined) {
    product.subtitle = ensureText(payload.subtitle, {
      field: 'subtitle',
      required: true,
      min: 2,
      max: 120
    });
  }

  if (payload.status !== undefined) {
    product.status = ensureEnum(payload.status, ['draft', 'published', 'archived'], {
      field: 'status'
    });
  }

  if (payload.badge !== undefined) {
    product.badge = ensureText(payload.badge, {
      field: 'badge',
      required: true,
      min: 1,
      max: 32
    });
  }

  if (payload.category !== undefined) {
    product.category = ensureText(payload.category, {
      field: 'category',
      required: true,
      min: 1,
      max: 40
    });
  }

  writeAudit(store, 'product.updated', product.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return buildProductCard(store, product.id);
}

function adminDeleteProduct(productId) {
  const store = readStore();
  const product = store.products.find((item) => item.id === productId);

  if (!product) {
    throw createAppError('PRODUCT_NOT_FOUND', 404);
  }

  const skuIds = store.productSkus.filter((item) => item.productId === productId).map((item) => item.id);
  const skuIdSet = new Set(skuIds);
  const hasReferences =
    store.orderItems.some((item) => item.productId === productId) ||
    store.cartItems.some((item) => skuIdSet.has(item.skuId));

  if (hasReferences) {
    product.status = 'archived';
    store.productSkus
      .filter((item) => item.productId === productId)
      .forEach((item) => {
        item.status = 'archived';
      });
    writeAudit(store, 'product.archived', product.id, DEFAULT_ADMIN_USERNAME);
    writeStore(store);
    return {
      mode: 'archived',
      item: buildProductCard(store, product.id)
    };
  }

  store.products = store.products.filter((item) => item.id !== productId);
  store.productSkus = store.productSkus.filter((item) => item.productId !== productId);
  store.wines
    .filter((wine) => wine.productId === productId)
    .forEach((wine) => {
      wine.productId = '';
    });
  writeAudit(store, 'product.deleted', product.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return {
    mode: 'deleted',
    item: product
  };
}

function adminUpdateSkuPrice(skuId, payload = {}) {
  const store = readStore();
  const sku = store.productSkus.find((item) => item.id === skuId);

  if (!sku) {
    throw createAppError('SKU_NOT_FOUND', 404);
  }

  if (payload.price !== undefined) {
    sku.price = ensureInteger(payload.price, {
      field: 'price',
      min: 0,
      max: 999999,
      required: true
    });
  }

  if (payload.marketPrice !== undefined) {
    sku.marketPrice = ensureInteger(payload.marketPrice, {
      field: 'marketPrice',
      min: 0,
      max: 999999,
      required: true
    });
  }

  if (payload.stock !== undefined) {
    sku.stock = ensureInteger(payload.stock, {
      field: 'stock',
      min: 0,
      max: 999999,
      required: true
    });
  }

  if (payload.status !== undefined) {
    sku.status = ensureEnum(payload.status, ['draft', 'published', 'archived'], {
      field: 'status'
    });
  }

  if (sku.marketPrice < sku.price) {
    throw createValidationError('marketPrice', 'less_than_price');
  }

  writeAudit(store, 'sku.updated', sku.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return sku;
}

function adminCreateSku(productId, payload = {}) {
  const store = readStore();
  const product = store.products.find((item) => item.id === productId);

  if (!product) {
    throw createAppError('PRODUCT_NOT_FOUND', 404);
  }

  const sku = {
    id: payload.id || slugifyId(`${productId}-${payload.specName || 'sku'}-${Date.now()}`, 'sku'),
    productId,
    specName: ensureText(payload.specName, {
      field: 'specName',
      required: true,
      min: 1,
      max: 40
    }),
    price: ensureInteger(payload.price, {
      field: 'price',
      min: 0,
      max: 999999,
      defaultValue: 0
    }),
    marketPrice: ensureInteger(payload.marketPrice, {
      field: 'marketPrice',
      min: 0,
      max: 999999,
      defaultValue: Number(payload.price || 0)
    }),
    stock: ensureInteger(payload.stock, {
      field: 'stock',
      min: 0,
      max: 999999,
      defaultValue: 0
    }),
    status: ensureEnum(payload.status, ['draft', 'published', 'archived'], {
      field: 'status',
      defaultValue: 'published'
    })
  };

  if (sku.marketPrice < sku.price) {
    throw createValidationError('marketPrice', 'less_than_price');
  }

  if (store.productSkus.some((item) => item.id === sku.id)) {
    throw createAppError('SKU_ID_EXISTS', 409);
  }

  store.productSkus.unshift(sku);
  writeAudit(store, 'sku.created', sku.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return sku;
}

function adminListOrders() {
  const store = readStore();
  if (closeExpiredOrders(store)) {
    writeStore(store);
  }

  return store.orders
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((order) => ({
      ...buildOrderView(store, order),
      user: buildUserSummary(store, order.userId),
      refund: findOrderRefund(store, order.id)
    }));
}

function adminUpdateOrder(orderId, payload = {}) {
  const store = readStore();
  const order = getOrderById(store, orderId);

  if (!order) {
    throw createAppError('ORDER_NOT_FOUND', 404);
  }

  if (payload.status !== undefined) {
    const nextStatus = ensureEnum(
      payload.status,
      ['pending_payment', 'paid', 'completed', 'closed', 'refund_pending', 'refunded'],
      { field: 'status' }
    );

    if (nextStatus === 'closed' && order.status === 'pending_payment') {
      releaseOrderReservation(store, order);
      order.closedAt = nowIso();
      const payment = findLatestPayment(store, order.id);
      if (payment && ['created', 'pending'].includes(payment.status)) {
        payment.status = 'cancelled';
        payment.updatedAt = nowIso();
      }
    }

    if (nextStatus === 'refund_pending') {
      order.refundStatus = 'pending';
      order.refundRequestedAt = order.refundRequestedAt || nowIso();
      if (!findOrderRefund(store, order.id)) {
        store.refunds.unshift({
          id: randomId('refund'),
          refundNo: generateRefundNo(store),
          orderId: order.id,
          userId: order.userId,
          amount: order.payAmount,
          status: 'pending',
          reason: ensureText(payload.refundReason, {
            field: 'refundReason',
            min: 0,
            max: 200,
            defaultValue: '后台登记退款申请'
          }),
          requestedAt: order.refundRequestedAt,
          reviewedAt: null,
          refundedAt: null,
          operator: null,
          restock: false
        });
      }
    }

    if (nextStatus === 'refunded') {
      markOrderRefunded(store, order, payload);
    } else {
      order.status = nextStatus;
    }
  }

  if (payload.deliveryStatus !== undefined) {
    order.deliveryStatus = ensureEnum(
      payload.deliveryStatus,
      ['pending', 'delivering', 'completed', 'rights_issued', 'downloaded', 'closed'],
      { field: 'deliveryStatus' }
    );

    if (order.deliveryStatus === 'delivering') {
      order.shippedAt = ensureIsoDate(payload.shippedAt, {
        field: 'shippedAt',
        defaultValue: order.shippedAt || nowIso()
      });
    }

    if (order.deliveryStatus === 'completed') {
      order.completedAt = ensureIsoDate(payload.completedAt, {
        field: 'completedAt',
        defaultValue: order.completedAt || nowIso()
      });
      if (order.orderType === 'physical' && order.status === 'paid') {
        order.status = 'completed';
      }
    }
  }

  if (payload.shippingCompany !== undefined || payload.deliveryCompany !== undefined) {
    order.shippingCompany = ensureText(payload.shippingCompany || payload.deliveryCompany, {
      field: 'shippingCompany',
      min: 0,
      max: 80,
      defaultValue: order.shippingCompany || ''
    });
  }

  if (payload.trackingNo !== undefined) {
    order.trackingNo = ensureText(payload.trackingNo, {
      field: 'trackingNo',
      min: 0,
      max: 80,
      defaultValue: order.trackingNo || ''
    });
  }

  writeAudit(store, 'order.updated', order.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return {
    ...buildOrderView(store, order),
    user: buildUserSummary(store, order.userId),
    refund: findOrderRefund(store, order.id)
  };
}

function adminListMemberships() {
  const store = readStore();

  return store.users.map((user) => {
    const membership = buildMembershipView(store, user.id);
    const logs = store.downloadLogs.filter((log) => log.userId === user.id);

    return {
      user: buildUserSummary(store, user.id),
      membership,
      entitlements: store.downloadEntitlements.filter((item) => item.userId === user.id),
      downloads: logs.length
    };
  });
}

function adminListAuditLogs(limit = 60) {
  const store = readStore();
  const normalizedLimit = ensureInteger(limit, {
    field: 'limit',
    min: 1,
    max: 200,
    defaultValue: 60
  });

  return store.auditLogs
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, normalizedLimit);
}

function adminGrantMembership(payload = {}) {
  const store = readStore();
  const userId = ensureText(payload.userId, {
    field: 'userId',
    required: true,
    min: 2,
    max: 120
  });
  const planId = ensureText(payload.planId, {
    field: 'planId',
    required: true,
    min: 2,
    max: 80
  });
  const user = requireExistingUser(store, userId);
  const plan = store.membershipPlans.find((item) => item.id === planId);

  if (!plan) {
    throw createAppError('PLAN_NOT_FOUND', 404);
  }

  const membership = {
    id: randomId('membership'),
    userId: user.id,
    planId: plan.id,
    status: ensureEnum(payload.status, ['active', 'inactive', 'expired'], {
      field: 'status',
      defaultValue: 'active'
    }),
    startAt: nowIso(),
    expireAt: ensureIsoDate(payload.expireAt, {
      field: 'expireAt',
      defaultValue: plusDays(plan.durationDays)
    })
  };

  store.memberships.unshift(membership);
  writeAudit(store, 'membership.granted', membership.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);

  return {
    user: buildUserSummary(store, user.id),
    membership: buildMembershipView(store, user.id)
  };
}

function adminListRedeemFailLogs(limit) {
  const store = readStore();
  const normalizedLimit = ensureInteger(limit, {
    field: 'limit',
    min: 1,
    max: 200,
    defaultValue: 60
  });

  return (store.redeemFailLogs || [])
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, normalizedLimit);
}

function adminSetCodeStatus(codeId, status) {
  const store = readStore();
  const code = store.scanCodes.find((item) => item.id === codeId);

  if (!code) {
    throw createAppError('CODE_NOT_FOUND', 404);
  }

  if (!['ready', 'claimed', 'expired', 'disabled'].includes(status)) {
    throw createAppError('INVALID_CODE_STATUS', 400);
  }

  code.status = status;
  if (status === 'ready') {
    code.firstUsedAt = null;
    code.firstUserId = null;
    code.sessionId = null;
    store.scanSessions = store.scanSessions.filter((item) => item.codeId !== code.id);
  }
  if (status === 'expired') {
    code.expiresAt = nowIso();
  }

  writeAudit(store, 'code.status.updated', code.id, DEFAULT_ADMIN_USERNAME);
  writeStore(store);
  return {
    ...code,
    wine: getWineById(store, code.wineId)
  };
}

module.exports = {
  adminChangePassword,
  adminCloseExpiredOrders,
  adminDashboard,
  adminCreateProduct,
  adminCreateSku,
  adminCreateWine,
  adminDeleteProduct,
  adminDeleteWine,
  adminExportCodesCsv,
  adminGrantMembership,
  adminListAuditLogs,
  adminListCodes,
  adminListRedeemFailLogs,
  adminListWineries,
  adminCreateWinery,
  adminSaveWinery,
  adminListTracks,
  adminCreateTrack,
  adminSaveTrack,
  adminListMemberships,
  adminListOrders,
  adminListProducts,
  adminListWines,
  adminReconciliationReport,
  adminLogin,
  adminLogout,
  adminSaveWine,
  adminSetCodeStatus,
  adminUpdateOrder,
  adminUpdateProduct,
  adminUpdateSkuPrice,
  adminExportOrdersCsv,
  addCartItem,
  assertAdmin,
  assertAdminPermission,
  consumeDownloadTicket,
  consumeOneTimeCode,
  createCodeBatch,
  createOneTimeCode,
  createOrder,
  ensureStoreFile,
  getCart,
  getDownloadLogs,
  getMemberProfile,
  getOrderPaymentStatus,
  getPersistenceMeta,
  getProductDetail,
  getUserSummaryById,
  getSecurityWarnings,
  getSessionExperience,
  getStoreHome,
  getWineExperience,
  listUserAddresses,
  listOrders,
  listProducts,
  markWechatRefundAccepted,
  markWechatRefundResult,
  markWechatShippingFailed,
  markWechatShippingSynced,
  markOrderPaidByWechat,
  payOrder,
  prepareWechatRefund,
  prepareWechatJsapiPayment,
  prepareWechatShippingSync,
  purchaseMembership,
  readStore,
  removeCartItem,
  requestOrderRefund,
  saveWechatPrepay,
  saveUserAddress,
  seedDemoData,
  signDownload,
  upsertMiniappUser,
  unlockTrack,
  updateCartItem,
  deleteUserAddress,
  withAuditContext
};
