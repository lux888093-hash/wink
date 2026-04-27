require('dotenv').config();

const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  adminChangePassword,
  adminCloseExpiredOrders,
  adminDashboard,
  adminCreateProduct,
  adminCreateSku,
  adminGetSiteContent,
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
  adminSaveSiteContent,
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
  getProductDetail,
  getPersistenceMeta,
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
  payOrder,
  prepareWechatRefund,
  prepareWechatJsapiPayment,
  prepareWechatShippingSync,
  purchaseMembership,
  removeCartItem,
  requestOrderRefund,
  saveWechatPrepay,
  saveUserAddress,
  seedDemoData,
  signDownload,
  upsertMiniappUser,
  unlockTrack,
  markOrderPaidByWechat,
  updateCartItem,
  deleteUserAddress,
  withAuditContext
} = require('./services/store');
const { getReadinessChecks, runtimeConfig } = require('./services/config');
const { getRedisHealth, incrementWindow } = require('./services/redis-client');
const { createRequestId } = require('./services/security');
const {
  exchangeMiniappCode,
  hasMiniappSessionSecret,
  hasWechatLoginCredentials,
  issueMiniappUserToken,
  verifyMiniappUserToken
} = require('./services/miniapp-auth');
const {
  createJsapiTransaction,
  createMiniProgramPaymentParams,
  createRefund,
  decryptWechatpayResource,
  hasWechatPayCredentials,
  queryRefundByOutRefundNo,
  queryTransactionByOutTradeNo,
  verifyWechatpaySignature
} = require('./services/wechat-pay');
const { hasWechatCredentials, generateMiniProgramCode, uploadShippingInfo } = require('./services/wechat');

const app = express();
const port = runtimeConfig.port;
const pagePath = 'pages/redeem/index';
const metrics = {
  startedAt: new Date().toISOString(),
  requests: 0,
  responses2xx: 0,
  responses4xx: 0,
  responses5xx: 0
};
const audioStaticDirs = [
  path.join(__dirname, '..', 'miniprogram', 'assets', 'audio'),
  path.join(__dirname, '..', 'music')
];
const imageUploadRootDir = path.join(__dirname, 'public', 'uploads', 'images');
const IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const imageMimeExtensionMap = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

ensureStoreFile();
app.disable('x-powered-by');
app.set('trust proxy', 1);

function decodeAssetFilename(fileUrl = '') {
  const basename = path.posix.basename(String(fileUrl).split('?')[0]);

  try {
    return decodeURIComponent(basename);
  } catch (error) {
    return basename;
  }
}

function sanitizeUploadFolder(folder = '') {
  const normalized = String(folder || 'general')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');

  if (['wines', 'wineries', 'products', 'tracks', 'site', 'general'].includes(normalized)) {
    return normalized;
  }

  return 'general';
}

function saveAdminImageUpload(payload = {}) {
  const dataUrl = String(payload.dataUrl || '').trim();
  const folder = sanitizeUploadFolder(payload.folder);

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw appError('UPLOAD_IMAGE_INVALID', 400);
  }

  const mimeType = match[1].toLowerCase();
  const extension = imageMimeExtensionMap[mimeType];
  if (!extension) {
    throw appError('UPLOAD_IMAGE_TYPE_UNSUPPORTED', 400);
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > IMAGE_UPLOAD_MAX_BYTES) {
    throw appError('UPLOAD_IMAGE_TOO_LARGE', 400);
  }

  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`;
  const folderDir = path.join(imageUploadRootDir, folder);
  fs.mkdirSync(folderDir, { recursive: true });

  const absolutePath = path.join(folderDir, fileName);
  const publicPath = `/uploads/images/${folder}/${fileName}`;
  fs.writeFileSync(absolutePath, buffer);

  return {
    fileName,
    folder,
    mimeType,
    size: buffer.length,
    publicPath,
    url: `${runtimeConfig.miniprogramBaseUrl}${publicPath}`
  };
}

function resolveAudioFilePath(fileUrl = '') {
  const filename = decodeAssetFilename(fileUrl);

  for (const directory of audioStaticDirs) {
    const candidate = path.join(directory, filename);

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return '';
}

function resolveAssetUrlPath(asset) {
  const source = String((asset && (asset.cdnPath || asset.objectKey || asset.fileUrl)) || '');

  if (!source) {
    return '';
  }

  if (/^https?:\/\//i.test(source)) {
    try {
      return new URL(source).pathname;
    } catch (error) {
      return source;
    }
  }

  return source.startsWith('/') ? source : `/${source}`;
}

function buildCdnDownloadUrl(asset) {
  if (!runtimeConfig.cdnBaseUrl) {
    return '';
  }

  const pathname = resolveAssetUrlPath(asset);
  if (!pathname) {
    return '';
  }

  const url = new URL(pathname, runtimeConfig.cdnBaseUrl.endsWith('/') ? runtimeConfig.cdnBaseUrl : `${runtimeConfig.cdnBaseUrl}/`);

  if (runtimeConfig.cdnSigningSecret) {
    const expires = Math.floor(Date.now() / 1000) + runtimeConfig.cdnSignedUrlTtlSeconds;
    const signature = crypto
      .createHmac('sha256', runtimeConfig.cdnSigningSecret)
      .update(`${url.pathname}\n${expires}`)
      .digest('hex');
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', signature);
  }

  return url.toString();
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createRateLimiter(options) {
  const buckets = new Map();

  return async (req, res, next) => {
    const key = options.key(req);
    const now = Date.now();
    const redisBucket = await incrementWindow(`rate:${key}`, options.windowMs);

    const bucket =
      redisBucket ||
      (() => {
        if (buckets.size > 5000) {
          for (const [bucketKey, bucketValue] of buckets.entries()) {
            if (bucketValue.resetAt <= now) {
              buckets.delete(bucketKey);
            }
          }
        }

        const current = buckets.get(key);
        const localBucket =
          current && current.resetAt > now
            ? current
            : {
                count: 0,
                resetAt: now + options.windowMs
              };

        localBucket.count += 1;
        buckets.set(key, localBucket);
        return localBucket;
      })();

    if (bucket.count > options.max) {
      res.setHeader('retry-after', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({
        ok: false,
        code: options.code,
        meta: {
          windowMs: options.windowMs,
          max: options.max
        },
        requestId: res.getHeader('x-request-id') || ''
      });
      return;
    }

    next();
  };
}

const loginLimiter = createRateLimiter({
  windowMs: runtimeConfig.loginRateLimitWindowMs,
  max: runtimeConfig.loginRateLimitMax,
  code: 'LOGIN_RATE_LIMITED',
  key: (req) => `login:${clientIp(req)}`
});

const redeemLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  code: 'REDEEM_RATE_LIMITED',
  key: (req) => `redeem:${clientIp(req)}`
});

const writeLimiter = createRateLimiter({
  windowMs: runtimeConfig.writeRateLimitWindowMs,
  max: runtimeConfig.writeRateLimitMax,
  code: 'WRITE_RATE_LIMITED',
  key: (req) => `write:${clientIp(req)}`
});

function corsOriginHandler(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (
    runtimeConfig.corsAllowedOrigins.includes('*') ||
    runtimeConfig.corsAllowedOrigins.includes(origin)
  ) {
    callback(null, true);
    return;
  }

  callback(new Error('CORS_ORIGIN_DENIED'));
}

app.use((req, res, next) => {
  const requestId = createRequestId();
  req.requestId = requestId;
  metrics.requests += 1;
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('cross-origin-opener-policy', 'same-origin');
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      metrics.responses5xx += 1;
    } else if (res.statusCode >= 400) {
      metrics.responses4xx += 1;
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      metrics.responses2xx += 1;
    }
  });
  next();
});

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'x-admin-token',
      'x-demo-user-id',
      'x-request-id',
      'x-user-token'
    ],
    exposedHeaders: ['x-request-id']
  })
);
app.use(
  express.json({
    strict: false,
    limit: runtimeConfig.jsonBodyLimit,
    verify(req, _res, buffer) {
      req.rawBody = buffer.toString('utf8');
    }
  })
);
app.use('/api', (req, res, next) => {
  if (req.path === '/admin/login') {
    return next();
  }

  if (req.path === '/payments/wechat/callback' || req.path === '/payments/wechat/refund-callback') {
    return next();
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }

  next();
});
app.use('/preview', express.static(path.join(__dirname, 'public', 'preview')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/assets/images', express.static(path.join(__dirname, '..', 'miniprogram', 'assets', 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
audioStaticDirs.forEach((directory) => {
  app.use('/assets/audio', express.static(directory));
});
app.use('/qrcodes', express.static(path.join(__dirname, 'public', 'qrcodes')));

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
    res.status(400).json({
      ok: false,
      code: 'INVALID_JSON_PAYLOAD',
      requestId: res.getHeader('x-request-id') || ''
    });
    return;
  }

  if (error && error.message === 'CORS_ORIGIN_DENIED') {
    res.status(403).json({
      ok: false,
      code: 'CORS_ORIGIN_DENIED',
      requestId: res.getHeader('x-request-id') || ''
    });
    return;
  }

  next(error);
});

function respondError(res, error) {
  const status = error.statusCode || 500;
  const requestId = res.getHeader('x-request-id') || '';
  console.error(`[${requestId}]`, error.message || 'INTERNAL_ERROR', error.meta || '');
  res.status(status).json({
    ok: false,
    code: error.message || 'INTERNAL_ERROR',
    meta: error.meta || null,
    requestId
  });
}

function appError(code, statusCode = 400) {
  const error = new Error(code);
  error.statusCode = statusCode;
  return error;
}

function resolveUserId(req) {
  const authHeader = String(req.headers.authorization || req.headers['x-user-token'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  const authSession = verifyMiniappUserToken(token);

  if (authSession && authSession.userId) {
    return authSession.userId;
  }

  if (runtimeConfig.isProduction) {
    return '';
  }

  return (
    req.headers['x-demo-user-id'] ||
    req.query.userId ||
    (req.body && req.body.userId) ||
    ''
  );
}

function requireUserId(req) {
  const userId = resolveUserId(req);

  if (!userId) {
    throw appError('MINIAPP_AUTH_REQUIRED', 401);
  }

  return userId;
}

function resolveAdminToken(req) {
  return String(req.headers['x-admin-token'] || '').trim();
}

function withAdmin(permissionOrHandler, maybeHandler) {
  const permission = typeof permissionOrHandler === 'string' ? permissionOrHandler : '';
  const handler = typeof permissionOrHandler === 'function' ? permissionOrHandler : maybeHandler;

  return (req, res) => {
    try {
      const { readStore } = require('./services/store');
      const store = readStore();
      const admin = assertAdmin(store, resolveAdminToken(req));
      assertAdminPermission(store, admin, permission);
      withAuditContext(
        {
          adminId: admin.id,
          adminUsername: admin.username,
          requestId: req.requestId,
          ip: clientIp(req),
          userAgent: req.headers['user-agent'] || ''
        },
        () => {
          Promise.resolve(handler(req, res, admin)).catch((error) => {
            respondError(res, error);
          });
        }
      );
    } catch (error) {
      respondError(res, error);
    }
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'hongjiu-curator-server',
    port,
    env: runtimeConfig.appEnv,
    persistence: getPersistenceMeta(),
    warnings: getSecurityWarnings(),
    capabilities: {
      wechatLogin: hasWechatLoginCredentials(),
      wechatPay: hasWechatPayCredentials(),
      redis: getRedisHealth(),
      cdnDelivery: runtimeConfig.mediaDeliveryMode === 'cdn' && Boolean(runtimeConfig.cdnBaseUrl)
    }
  });
});

app.get('/api/health/readiness', (_req, res) => {
  const report = getReadinessChecks({
    checks: [
      {
        key: 'wechat_login_runtime',
        ok: hasWechatLoginCredentials(),
        severity: 'required',
        message: 'WeChat mini-program login runtime credentials are available.'
      },
      {
        key: 'wechat_pay_runtime',
        ok: hasWechatPayCredentials(),
        severity: 'required',
        message: 'WeChat Pay runtime credentials are available.'
      }
    ]
  });

  res.status(report.ready ? 200 : 503).json({
    ok: report.ready,
    ...report,
    warnings: getSecurityWarnings(),
    persistence: getPersistenceMeta()
  });
});

app.get('/api/health/metrics', (_req, res) => {
  const uptimeSeconds = Math.round(process.uptime());

  res.json({
    ok: true,
    uptimeSeconds,
    startedAt: metrics.startedAt,
    requests: metrics.requests,
    responses2xx: metrics.responses2xx,
    responses4xx: metrics.responses4xx,
    responses5xx: metrics.responses5xx
  });
});

app.post('/api/auth/wechat/login', async (req, res) => {
  try {
    if (!hasMiniappSessionSecret()) {
      throw new Error('MINIAPP_SESSION_SECRET_MISSING');
    }

    let authResult = null;

    if (hasWechatLoginCredentials()) {
      const session = await exchangeMiniappCode(req.body && req.body.code);
      authResult = upsertMiniappUser({
        ...session,
        ...(req.body && req.body.profile ? req.body.profile : {})
      });
    } else if (!runtimeConfig.isProduction) {
      authResult = getUserSummaryById((req.body && req.body.demoUserId) || 'user_demo_guest');
    } else {
      throw new Error('WECHAT_LOGIN_DISABLED');
    }

    res.json({
      ok: true,
      mode: hasWechatLoginCredentials() ? 'wechat' : 'demo',
      token: issueMiniappUserToken(authResult.user),
      user: authResult.summary,
      capabilities: {
        wechatPay: hasWechatPayCredentials()
      }
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const userId = requireUserId(req);
    const payload = getUserSummaryById(userId);
    res.json({
      ok: true,
      user: payload.summary,
      capabilities: {
        wechatPay: hasWechatPayCredentials()
      }
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/admin/dev/reset', withAdmin('dashboard.write', (_req, res) => {
  if (!runtimeConfig.enableDevReset) {
    res.status(403).json({
      ok: false,
      code: 'DEV_RESET_DISABLED',
      requestId: res.getHeader('x-request-id') || ''
    });
    return;
  }

  const { code, store } = seedDemoData();
  const wine = store.wines[0];

  res.json({
    ok: true,
    note: 'Local demo data has been reset.',
    code,
    wine,
    redeemCode: code.redeemCode
  });
}));

app.post('/api/redeem/consume', redeemLimiter, (req, res) => {
  try {
    const code = (req.body && (req.body.code || req.body.redeemCode)) || '';
    const requestMeta = { ip: clientIp(req), userId: requireUserId(req) };
    const payload = consumeOneTimeCode(code, requestMeta.userId, requestMeta);
    res.json({
      ok: true,
      sessionId: payload.session.id,
      session: payload.session,
      experience: payload.experience
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/sessions/:sessionId', (req, res) => {
  try {
    throw appError('SESSION_RESTORE_DISABLED', 410);
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/wines/:wineId/experience', (req, res) => {
  try {
    res.json({
      ok: true,
      experience: getWineExperience(req.params.wineId, resolveUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/store/home', (req, res) => {
  try {
    res.json({
      ok: true,
      ...getStoreHome(resolveUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/products', (req, res) => {
  try {
    res.json({
      ok: true,
      ...listProducts(req.query)
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/products/:productId', (req, res) => {
  try {
    res.json({
      ok: true,
      ...getProductDetail(req.params.productId, resolveUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/addresses', (req, res) => {
  try {
    res.json({
      ok: true,
      ...listUserAddresses(requireUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/addresses', (req, res) => {
  try {
    res.json({
      ok: true,
      ...saveUserAddress(requireUserId(req), req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.put('/api/addresses/:addressId', (req, res) => {
  try {
    res.json({
      ok: true,
      ...saveUserAddress(requireUserId(req), {
        ...(req.body || {}),
        id: req.params.addressId
      })
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.delete('/api/addresses/:addressId', (req, res) => {
  try {
    res.json({
      ok: true,
      ...deleteUserAddress(requireUserId(req), req.params.addressId)
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/cart', (req, res) => {
  try {
    res.json({
      ok: true,
      ...getCart(requireUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/cart/items', (req, res) => {
  try {
    res.json({
      ok: true,
      ...addCartItem(requireUserId(req), req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.put('/api/cart/items/:itemId', (req, res) => {
  try {
    res.json({
      ok: true,
      ...updateCartItem(requireUserId(req), req.params.itemId, req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.delete('/api/cart/items/:itemId', (req, res) => {
  try {
    res.json({
      ok: true,
      ...removeCartItem(requireUserId(req), req.params.itemId)
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/orders', (req, res) => {
  try {
    res.json({
      ok: true,
      ...createOrder(requireUserId(req), req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/orders', (req, res) => {
  try {
    res.json({
      ok: true,
      ...listOrders(requireUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/orders/:orderId/refund', (req, res) => {
  try {
    res.json({
      ok: true,
      ...requestOrderRefund(requireUserId(req), req.params.orderId, req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/orders/:orderId/pay', (req, res) => {
  try {
    res.json({
      ok: true,
      ...payOrder(requireUserId(req), req.params.orderId)
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/payments/orders/:orderId/jsapi', async (req, res) => {
  try {
    const userId = requireUserId(req);
    const prepared = prepareWechatJsapiPayment(userId, req.params.orderId, req.body || {});

    if (!hasWechatPayCredentials()) {
      if (runtimeConfig.isProduction) {
        throw new Error('WECHAT_PAY_DISABLED');
      }

      const paid = payOrder(userId, req.params.orderId);
      res.json({
        ok: true,
        mode: 'mock',
        ...paid
      });
      return;
    }

    if (prepared.order.status === 'paid' || prepared.order.status === 'completed') {
      res.json({
        ok: true,
        mode: 'paid',
        ...getOrderPaymentStatus(userId, req.params.orderId)
      });
      return;
    }

    if (prepared.reused && prepared.payment && prepared.payment.prepayId) {
      res.json({
        ok: true,
        mode: 'wechat',
        order: prepared.order,
        payment: prepared.payment,
        paymentParams: createMiniProgramPaymentParams(prepared.payment.prepayId)
      });
      return;
    }

    const wxPayment = await createJsapiTransaction({
      description: `鸿玖酒庄订单 ${prepared.order.orderNo}`,
      outTradeNo: prepared.order.orderNo,
      totalFen: Math.round(Number(prepared.order.payAmount || 0) * 100),
      openid: prepared.user.openid,
      notifyUrl: runtimeConfig.wechatPayNotifyUrl,
      attach: JSON.stringify({
        orderId: prepared.order.id,
        userId: prepared.user.id
      })
    });

    const saved = saveWechatPrepay(prepared.order.id, prepared.payment.id, wxPayment);

    res.json({
      ok: true,
      mode: 'wechat',
      order: saved.order,
      payment: saved.payment,
      paymentParams: wxPayment.jsapiParams
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/payments/orders/:orderId/status', async (req, res) => {
  try {
    const userId = requireUserId(req);
    let statusPayload = getOrderPaymentStatus(userId, req.params.orderId);

    if (
      req.query.refresh &&
      hasWechatPayCredentials() &&
      statusPayload.order.status === 'pending_payment' &&
      statusPayload.payment &&
      statusPayload.payment.outTradeNo
    ) {
      const remote = await queryTransactionByOutTradeNo(statusPayload.payment.outTradeNo);

      if (remote.trade_state === 'SUCCESS') {
        markOrderPaidByWechat({
          outTradeNo: remote.out_trade_no,
          transactionId: remote.transaction_id,
          paidAt: remote.success_time,
          rawPayload: remote
        });
      }

      statusPayload = getOrderPaymentStatus(userId, req.params.orderId);
    }

    res.json({
      ok: true,
      ...statusPayload
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/payments/wechat/callback', async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});

  try {
    if (!verifyWechatpaySignature(req.headers, rawBody)) {
      res.status(401).json({
        code: 'FAIL',
        message: 'invalid wechatpay signature'
      });
      return;
    }

    const notification = req.body || {};

    if (notification.event_type !== 'TRANSACTION.SUCCESS') {
      res.status(204).end();
      return;
    }

    const resource = decryptWechatpayResource(notification.resource || {});
    markOrderPaidByWechat({
      outTradeNo: resource.out_trade_no,
      transactionId: resource.transaction_id,
      paidAt: resource.success_time,
      rawPayload: {
        notification,
        resource
      }
    });

    res.status(204).end();
  } catch (error) {
    console.error(`[${req.requestId || 'wechat-callback'}]`, error.message || 'WECHAT_CALLBACK_FAILED');
    res.status(500).json({
      code: 'FAIL',
      message: 'callback handling failed'
    });
  }
});

app.post('/api/payments/wechat/refund-callback', async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});

  try {
    if (!verifyWechatpaySignature(req.headers, rawBody)) {
      res.status(401).json({
        code: 'FAIL',
        message: 'invalid wechatpay signature'
      });
      return;
    }

    const notification = req.body || {};

    if (notification.event_type && !String(notification.event_type).startsWith('REFUND.')) {
      res.status(204).end();
      return;
    }

    const resource = decryptWechatpayResource(notification.resource || {});
    markWechatRefundResult({
      outRefundNo: resource.out_refund_no,
      refundId: resource.refund_id,
      refundStatus: resource.refund_status,
      successTime: resource.success_time,
      rawPayload: {
        notification,
        resource
      }
    });

    res.status(204).end();
  } catch (error) {
    console.error(`[${req.requestId || 'wechat-refund-callback'}]`, error.message || 'WECHAT_REFUND_CALLBACK_FAILED');
    res.status(500).json({
      code: 'FAIL',
      message: 'refund callback handling failed'
    });
  }
});

app.get('/api/member/profile', (req, res) => {
  try {
    res.json({
      ok: true,
      ...getMemberProfile(requireUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/member/purchase', (req, res) => {
  try {
    res.json({
      ok: true,
      ...purchaseMembership(requireUserId(req), req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/tracks/:trackId/unlock', (req, res) => {
  try {
    res.json({
      ok: true,
      ...unlockTrack(requireUserId(req), req.params.trackId, req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/downloads/:trackId/sign', (req, res) => {
  try {
    const requestMeta = {
      ip: clientIp(req),
      deviceInfo: req.headers['user-agent'] || 'unknown'
    };
    const payload = signDownload(requireUserId(req), req.params.trackId, requestMeta);
    res.json({
      ok: true,
      ...payload,
      absoluteUrl: `${runtimeConfig.miniprogramBaseUrl}${payload.url}`
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/downloads/logs', (req, res) => {
  try {
    res.json({
      ok: true,
      items: getDownloadLogs(requireUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/downloads/file', (req, res) => {
  try {
    const requestMeta = {
      ip: clientIp(req),
      deviceInfo: req.headers['user-agent'] || 'unknown'
    };
    const payload = consumeDownloadTicket(req.query.token, requestMeta);
    const cdnUrl =
      runtimeConfig.mediaDeliveryMode === 'cdn' || !resolveAudioFilePath(payload.asset.fileUrl)
        ? buildCdnDownloadUrl(payload.asset)
        : '';

    if (cdnUrl) {
      res.redirect(302, cdnUrl);
      return;
    }

    const localPath = resolveAudioFilePath(payload.asset.fileUrl);

    if (!localPath) {
      throw new Error('DOWNLOAD_FILE_NOT_FOUND');
    }

    res.download(localPath, `${payload.track.cnTitle || payload.track.title}${path.extname(localPath) || '.wav'}`);
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  try {
    res.json({
      ok: true,
      ...adminLogin(req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/admin/logout', withAdmin((req, res) => {
  res.json({
    ok: true,
    ...adminLogout(resolveAdminToken(req))
  });
}));

app.put('/api/admin/account/password', withAdmin((req, res) => {
  res.json({
    ok: true,
    ...adminChangePassword(resolveAdminToken(req), req.body || {})
  });
}));

app.get('/api/admin/dashboard', withAdmin('dashboard.read', (_req, res) => {
  res.json({
    ok: true,
    ...adminDashboard()
  });
}));

app.get('/api/admin/site-content', withAdmin('wineries.read', (_req, res) => {
  res.json({
    ok: true,
    item: adminGetSiteContent()
  });
}));

app.put('/api/admin/site-content', withAdmin('wineries.write', (req, res) => {
  res.json({
    ok: true,
    item: adminSaveSiteContent(req.body || {})
  });
}));

app.post('/api/admin/uploads/image', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: saveAdminImageUpload(req.body || {})
  });
}));

app.post('/api/admin/qrcode/fixed-redeem', withAdmin('codes.write', async (_req, res) => {
  if (!hasWechatCredentials()) {
    throw appError('WECHAT_CREDENTIALS_REQUIRED', 400);
  }

  const scene = 'fixed_redeem';
  const generated = await generateMiniProgramCode({
    scene,
    token: 'fixed-redeem',
    page: pagePath
  });

  res.json({
    ok: true,
    page: pagePath,
    scene,
    path: generated.publicPath,
    url: `${runtimeConfig.miniprogramBaseUrl}${generated.publicPath}`
  });
}));

app.get('/api/admin/wines', withAdmin('wines.read', (_req, res) => {
  res.json({
    ok: true,
    items: adminListWines()
  });
}));

app.post('/api/admin/wines', withAdmin('wines.write', (req, res) => {
  res.json({
    ok: true,
    item: adminCreateWine(req.body || {})
  });
}));

app.put('/api/admin/wines/:wineId', withAdmin('wines.write', (req, res) => {
  res.json({
    ok: true,
    item: adminSaveWine({
      ...(req.body || {}),
      id: req.params.wineId
    })
  });
}));

app.delete('/api/admin/wines/:wineId', withAdmin('wines.write', (req, res) => {
  res.json({
    ok: true,
    result: adminDeleteWine(req.params.wineId)
  });
}));

app.get('/api/admin/wineries', withAdmin('wineries.read', (_req, res) => {
  res.json({
    ok: true,
    items: adminListWineries()
  });
}));

app.post('/api/admin/wineries', withAdmin('wineries.write', (req, res) => {
  res.json({
    ok: true,
    item: adminCreateWinery(req.body || {})
  });
}));

app.put('/api/admin/wineries/:wineryId', withAdmin('wineries.write', (req, res) => {
  res.json({
    ok: true,
    item: adminSaveWinery({
      ...(req.body || {}),
      id: req.params.wineryId
    })
  });
}));

app.get('/api/admin/tracks', withAdmin('tracks.read', (_req, res) => {
  res.json({
    ok: true,
    items: adminListTracks()
  });
}));

app.post('/api/admin/tracks', withAdmin('tracks.write', (req, res) => {
  res.json({
    ok: true,
    item: adminCreateTrack(req.body || {})
  });
}));

app.put('/api/admin/tracks/:trackId', withAdmin('tracks.write', (req, res) => {
  res.json({
    ok: true,
    item: adminSaveTrack({
      ...(req.body || {}),
      id: req.params.trackId
    })
  });
}));

app.post('/api/admin/code-batches', withAdmin('codes.write', (req, res) => {
  res.json({
    ok: true,
    ...createCodeBatch(req.body || {})
  });
}));

app.get('/api/admin/codes', withAdmin('codes.read', (_req, res) => {
  res.json({
    ok: true,
    items: adminListCodes()
  });
}));

app.put('/api/admin/codes/:codeId/status', withAdmin('codes.write', (req, res) => {
  res.json({
    ok: true,
    item: adminSetCodeStatus(req.params.codeId, req.body && req.body.status)
  });
}));

app.get('/api/admin/codes/export', withAdmin('codes.read', (_req, res) => {
  const csv = adminExportCodesCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=redeem-codes.csv');
  res.send('\uFEFF' + csv);
}));

app.get('/api/admin/products', withAdmin('products.read', (_req, res) => {
  res.json({
    ok: true,
    items: adminListProducts()
  });
}));

app.post('/api/admin/products', withAdmin('products.write', (req, res) => {
  res.json({
    ok: true,
    item: adminCreateProduct(req.body || {})
  });
}));

app.put('/api/admin/products/:productId', withAdmin('products.write', (req, res) => {
  res.json({
    ok: true,
    item: adminUpdateProduct(req.params.productId, req.body || {})
  });
}));

app.delete('/api/admin/products/:productId', withAdmin('products.write', (req, res) => {
  res.json({
    ok: true,
    result: adminDeleteProduct(req.params.productId)
  });
}));

app.post('/api/admin/products/:productId/skus', withAdmin('products.write', (req, res) => {
  res.json({
    ok: true,
    item: adminCreateSku(req.params.productId, req.body || {})
  });
}));

app.put('/api/admin/skus/:skuId/price', withAdmin('products.write', (req, res) => {
  res.json({
    ok: true,
    item: adminUpdateSkuPrice(req.params.skuId, req.body || {})
  });
}));

app.get('/api/admin/orders', withAdmin('orders.read', (_req, res) => {
  res.json({
    ok: true,
    items: adminListOrders()
  });
}));

app.get('/api/admin/orders/export', withAdmin('orders.read', (_req, res) => {
  const csv = adminExportOrdersCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
  res.send('\uFEFF' + csv);
}));

app.post('/api/admin/orders/close-expired', withAdmin('orders.write', (_req, res) => {
  res.json({
    ok: true,
    ...adminCloseExpiredOrders()
  });
}));

app.post('/api/admin/orders/:orderId/shipping/wechat', withAdmin('orders.write', async (req, res) => {
  let prepared = null;

  try {
    prepared = prepareWechatShippingSync(req.params.orderId, req.body || {});

    if (!hasWechatCredentials()) {
      if (runtimeConfig.isProduction) {
        throw appError('WECHAT_CREDENTIALS_REQUIRED', 400);
      }

      res.json({
        ok: true,
        mode: 'mock',
        item: markWechatShippingSynced(req.params.orderId, {
          mode: 'mock',
          payload: prepared.wechat
        })
      });
      return;
    }

    const response = await uploadShippingInfo(prepared.wechat);
    res.json({
      ok: true,
      mode: 'wechat',
      item: markWechatShippingSynced(req.params.orderId, response)
    });
  } catch (error) {
    if (prepared) {
      markWechatShippingFailed(req.params.orderId, error);
    }
    throw error;
  }
}));

app.post('/api/admin/orders/:orderId/refund/wechat', withAdmin('orders.refund', async (req, res) => {
  let prepared = null;

  try {
    prepared = prepareWechatRefund(req.params.orderId, req.body || {});

    if (!hasWechatPayCredentials()) {
      if (runtimeConfig.isProduction) {
        throw appError('WECHAT_PAY_DISABLED', 400);
      }

      const result = markWechatRefundResult({
        outRefundNo: prepared.refund.outRefundNo,
        refundId: `mock_${prepared.refund.refundNo}`,
        refundStatus: 'SUCCESS',
        successTime: new Date().toISOString(),
        rawPayload: {
          mode: 'mock'
        }
      });

      res.json({
        ok: true,
        mode: 'mock',
        item: result.order,
        refund: result.refund
      });
      return;
    }

    const wxRefund = await createRefund({
      ...prepared.wechat,
      notifyUrl: runtimeConfig.wechatPayRefundNotifyUrl
    });
    const accepted = markWechatRefundAccepted(prepared.refund.id, wxRefund);

    res.json({
      ok: true,
      mode: 'wechat',
      item: accepted.order,
      refund: accepted.refund,
      wechat: wxRefund
    });
  } catch (error) {
    if (prepared) {
      markWechatRefundResult({
        outRefundNo: prepared.refund.outRefundNo,
        refundStatus: 'ABNORMAL',
        failReason: error.message,
        rawPayload: {
          meta: error.meta || null
        }
      });
    }
    throw error;
  }
}));

app.post('/api/admin/refunds/:outRefundNo/refresh-wechat', withAdmin('orders.refund', async (req, res) => {
  if (!hasWechatPayCredentials()) {
    if (runtimeConfig.isProduction) {
      throw appError('WECHAT_PAY_DISABLED', 400);
    }

    throw appError('WECHAT_PAY_DISABLED_IN_DEVELOPMENT', 400);
  }

  const wxRefund = await queryRefundByOutRefundNo(req.params.outRefundNo);
  const result = markWechatRefundResult({
    outRefundNo: wxRefund.out_refund_no || req.params.outRefundNo,
    refundId: wxRefund.refund_id,
    refundStatus: wxRefund.status || wxRefund.refund_status,
    successTime: wxRefund.success_time,
    rawPayload: wxRefund
  });

  res.json({
    ok: true,
    item: result.order,
    refund: result.refund,
    wechat: wxRefund
  });
}));

app.get('/api/admin/reports/reconciliation', withAdmin('dashboard.read', (_req, res) => {
  res.json({
    ok: true,
    report: adminReconciliationReport()
  });
}));

app.put('/api/admin/orders/:orderId', withAdmin('orders.write', (req, res) => {
  res.json({
    ok: true,
    item: adminUpdateOrder(req.params.orderId, req.body || {})
  });
}));

app.get('/api/admin/memberships', withAdmin('memberships.read', (_req, res) => {
  res.json({
    ok: true,
    items: adminListMemberships()
  });
}));

app.post('/api/admin/memberships/grant', withAdmin('memberships.grant', (req, res) => {
  res.json({
    ok: true,
    item: adminGrantMembership(req.body || {})
  });
}));

app.get('/api/admin/audit-logs', withAdmin('audit.read', (req, res) => {
  res.json({
    ok: true,
    items: adminListAuditLogs(req.query.limit)
  });
}));

app.get('/api/admin/redeem-fail-logs', withAdmin('codes.read', (req, res) => {
  res.json({
    ok: true,
    items: adminListRedeemFailLogs(req.query.limit)
  });
}));

app.post('/api/admin/codes', withAdmin('codes.write', async (req, res) => {
  try {
    const { code, wine } = createOneTimeCode(req.body || {});

    res.json({
      ok: true,
      code,
      wine,
      redeemCode: code.redeemCode
    });
  } catch (error) {
    respondError(res, error);
  }
}));

app.get('/', (_req, res) => {
  res.redirect('/admin/');
});

app.listen(port, () => {
  console.log(`Hongjiu curator backend listening on http://127.0.0.1:${port}`);
});
