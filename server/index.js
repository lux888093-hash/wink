require('dotenv').config();

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  adminChangePassword,
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
  adminLogin,
  adminLogout,
  adminSaveWine,
  adminSetCodeStatus,
  adminUpdateOrder,
  adminUpdateProduct,
  adminUpdateSkuPrice,
  addCartItem,
  assertAdmin,
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
  listOrders,
  listProducts,
  payOrder,
  prepareWechatJsapiPayment,
  purchaseMembership,
  removeCartItem,
  saveWechatPrepay,
  seedDemoData,
  signDownload,
  upsertMiniappUser,
  unlockTrack,
  markOrderPaidByWechat,
  updateCartItem
} = require('./services/store');
const { runtimeConfig } = require('./services/config');
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
  decryptWechatpayResource,
  hasWechatPayCredentials,
  queryTransactionByOutTradeNo,
  verifyWechatpaySignature
} = require('./services/wechat-pay');
const { hasWechatCredentials, generateMiniProgramCode } = require('./services/wechat');

const app = express();
const port = runtimeConfig.port;
const pagePath = 'pages/redeem/index';
const audioStaticDirs = [
  path.join(__dirname, '..', 'miniprogram', 'assets', 'audio'),
  path.join(__dirname, '..', 'music')
];

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

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function createRateLimiter(options) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = options.key(req);
    const now = Date.now();

    if (buckets.size > 5000) {
      for (const [bucketKey, bucketValue] of buckets.entries()) {
        if (bucketValue.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > now
        ? current
        : {
            count: 0,
            resetAt: now + options.windowMs
          };

    bucket.count += 1;
    buckets.set(key, bucket);

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
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('cross-origin-opener-policy', 'same-origin');
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

  if (req.path === '/payments/wechat/callback') {
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

  return (
    req.headers['x-demo-user-id'] ||
    req.query.userId ||
    (req.body && req.body.userId) ||
    ''
  );
}

function resolveAdminToken(req) {
  return String(req.headers['x-admin-token'] || '').trim();
}

function withAdmin(handler) {
  return (req, res) => {
    try {
      const { readStore } = require('./services/store');
      const store = readStore();
      const admin = assertAdmin(store, resolveAdminToken(req));
      Promise.resolve(handler(req, res, admin)).catch((error) => {
        respondError(res, error);
      });
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
      wechatPay: hasWechatPayCredentials()
    }
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
    const userId = resolveUserId(req);
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

app.post('/api/admin/dev/reset', withAdmin((_req, res) => {
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
    const requestMeta = { ip: clientIp(req), userId: resolveUserId(req) };
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

app.get('/api/cart', (req, res) => {
  try {
    res.json({
      ok: true,
      ...getCart(resolveUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/cart/items', (req, res) => {
  try {
    res.json({
      ok: true,
      ...addCartItem(resolveUserId(req), req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.put('/api/cart/items/:itemId', (req, res) => {
  try {
    res.json({
      ok: true,
      ...updateCartItem(resolveUserId(req), req.params.itemId, req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.delete('/api/cart/items/:itemId', (req, res) => {
  try {
    res.json({
      ok: true,
      ...removeCartItem(resolveUserId(req), req.params.itemId)
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/orders', (req, res) => {
  try {
    res.json({
      ok: true,
      ...createOrder(resolveUserId(req), req.body || {})
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/orders', (req, res) => {
  try {
    res.json({
      ok: true,
      ...listOrders(resolveUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/orders/:orderId/pay', (req, res) => {
  try {
    res.json({
      ok: true,
      ...payOrder(resolveUserId(req), req.params.orderId)
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/payments/orders/:orderId/jsapi', async (req, res) => {
  try {
    const userId = resolveUserId(req);
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
    const userId = resolveUserId(req);
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

app.get('/api/member/profile', (req, res) => {
  try {
    res.json({
      ok: true,
      ...getMemberProfile(resolveUserId(req))
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/member/purchase', (req, res) => {
  try {
    res.json({
      ok: true,
      ...purchaseMembership(resolveUserId(req), req.body && req.body.planId)
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/tracks/:trackId/unlock', (req, res) => {
  try {
    res.json({
      ok: true,
      ...unlockTrack(resolveUserId(req), req.params.trackId, req.body || {})
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
    const payload = signDownload(resolveUserId(req), req.params.trackId, requestMeta);
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
      items: getDownloadLogs(resolveUserId(req))
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

app.get('/api/admin/dashboard', withAdmin((_req, res) => {
  res.json({
    ok: true,
    ...adminDashboard()
  });
}));

app.post('/api/admin/qrcode/fixed-redeem', withAdmin(async (_req, res) => {
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

app.get('/api/admin/wines', withAdmin((_req, res) => {
  res.json({
    ok: true,
    items: adminListWines()
  });
}));

app.post('/api/admin/wines', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminCreateWine(req.body || {})
  });
}));

app.put('/api/admin/wines/:wineId', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminSaveWine({
      ...(req.body || {}),
      id: req.params.wineId
    })
  });
}));

app.delete('/api/admin/wines/:wineId', withAdmin((req, res) => {
  res.json({
    ok: true,
    result: adminDeleteWine(req.params.wineId)
  });
}));

app.get('/api/admin/wineries', withAdmin((_req, res) => {
  res.json({
    ok: true,
    items: adminListWineries()
  });
}));

app.post('/api/admin/wineries', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminCreateWinery(req.body || {})
  });
}));

app.put('/api/admin/wineries/:wineryId', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminSaveWinery({
      ...(req.body || {}),
      id: req.params.wineryId
    })
  });
}));

app.get('/api/admin/tracks', withAdmin((_req, res) => {
  res.json({
    ok: true,
    items: adminListTracks()
  });
}));

app.post('/api/admin/tracks', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminCreateTrack(req.body || {})
  });
}));

app.put('/api/admin/tracks/:trackId', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminSaveTrack({
      ...(req.body || {}),
      id: req.params.trackId
    })
  });
}));

app.post('/api/admin/code-batches', withAdmin((req, res) => {
  res.json({
    ok: true,
    ...createCodeBatch(req.body || {})
  });
}));

app.get('/api/admin/codes', withAdmin((_req, res) => {
  res.json({
    ok: true,
    items: adminListCodes()
  });
}));

app.put('/api/admin/codes/:codeId/status', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminSetCodeStatus(req.params.codeId, req.body && req.body.status)
  });
}));

app.get('/api/admin/codes/export', withAdmin((_req, res) => {
  const csv = adminExportCodesCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=redeem-codes.csv');
  res.send('\uFEFF' + csv);
}));

app.get('/api/admin/products', withAdmin((_req, res) => {
  res.json({
    ok: true,
    items: adminListProducts()
  });
}));

app.post('/api/admin/products', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminCreateProduct(req.body || {})
  });
}));

app.put('/api/admin/products/:productId', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminUpdateProduct(req.params.productId, req.body || {})
  });
}));

app.delete('/api/admin/products/:productId', withAdmin((req, res) => {
  res.json({
    ok: true,
    result: adminDeleteProduct(req.params.productId)
  });
}));

app.post('/api/admin/products/:productId/skus', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminCreateSku(req.params.productId, req.body || {})
  });
}));

app.put('/api/admin/skus/:skuId/price', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminUpdateSkuPrice(req.params.skuId, req.body || {})
  });
}));

app.get('/api/admin/orders', withAdmin((_req, res) => {
  res.json({
    ok: true,
    items: adminListOrders()
  });
}));

app.put('/api/admin/orders/:orderId', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminUpdateOrder(req.params.orderId, req.body || {})
  });
}));

app.get('/api/admin/memberships', withAdmin((_req, res) => {
  res.json({
    ok: true,
    items: adminListMemberships()
  });
}));

app.post('/api/admin/memberships/grant', withAdmin((req, res) => {
  res.json({
    ok: true,
    item: adminGrantMembership(req.body || {})
  });
}));

app.get('/api/admin/audit-logs', withAdmin((req, res) => {
  res.json({
    ok: true,
    items: adminListAuditLogs(req.query.limit)
  });
}));

app.get('/api/admin/redeem-fail-logs', withAdmin((req, res) => {
  res.json({
    ok: true,
    items: adminListRedeemFailLogs(req.query.limit)
  });
}));

app.post('/api/admin/codes', withAdmin(async (req, res) => {
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
