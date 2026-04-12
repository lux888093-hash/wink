function parseInteger(value, fallback, options = {}) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  const normalized = Math.trunc(number);

  if (options.min !== undefined && normalized < options.min) {
    return fallback;
  }

  if (options.max !== undefined && normalized > options.max) {
    return fallback;
  }

  return normalized;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseOrigins(value, fallback) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePath(value, fallback = '') {
  return value ? String(value).trim() : fallback;
}

const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
const isProduction = appEnv === 'production';
const port = parseInteger(process.env.PORT, 3100, {
  min: 1,
  max: 65535
});

const runtimeConfig = {
  appEnv,
  isProduction,
  port,
  miniprogramBaseUrl: process.env.MINIPROGRAM_BASE_URL || `http://127.0.0.1:${port}`,
  databaseUrl: process.env.DATABASE_URL || '',
  postgresHost: process.env.PGHOST || '',
  postgresPort: parseInteger(process.env.PGPORT, 5432, {
    min: 1,
    max: 65535
  }),
  postgresDatabase: process.env.PGDATABASE || '',
  postgresUser: process.env.PGUSER || '',
  postgresPassword: process.env.PGPASSWORD || '',
  postgresSsl: parseBoolean(process.env.PGSSL, false),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '256kb',
  corsAllowedOrigins: parseOrigins(
    process.env.CORS_ALLOWED_ORIGINS,
    isProduction ? [] : ['http://127.0.0.1:3100', 'http://localhost:3100']
  ),
  adminSessionDays: parseInteger(process.env.ADMIN_SESSION_DAYS, 3, {
    min: 1,
    max: 30
  }),
  maxAdminSessionsPerUser: parseInteger(process.env.MAX_ADMIN_SESSIONS_PER_USER, 5, {
    min: 1,
    max: 50
  }),
  adminSessionPepper: process.env.ADMIN_SESSION_PEPPER || 'replace-this-pepper-in-production',
  adminBootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD || '',
  loginRateLimitWindowMs: parseInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000, {
    min: 10 * 1000,
    max: 24 * 60 * 60 * 1000
  }),
  loginRateLimitMax: parseInteger(process.env.LOGIN_RATE_LIMIT_MAX, 8, {
    min: 1,
    max: 1000
  }),
  writeRateLimitWindowMs: parseInteger(process.env.WRITE_RATE_LIMIT_WINDOW_MS, 60 * 1000, {
    min: 1000,
    max: 24 * 60 * 60 * 1000
  }),
  writeRateLimitMax: parseInteger(process.env.WRITE_RATE_LIMIT_MAX, 180, {
    min: 10,
    max: 100000
  }),
  enableDevReset: parseBoolean(process.env.ENABLE_DEV_RESET, !isProduction),
  miniappSessionSecret: process.env.MINIAPP_SESSION_SECRET || 'replace-this-miniapp-secret',
  miniappSessionDays: parseInteger(process.env.MINIAPP_SESSION_DAYS, 30, {
    min: 1,
    max: 180
  }),
  wechatAppId: process.env.WECHAT_APPID || '',
  wechatAppSecret: process.env.WECHAT_APPSECRET || '',
  wechatEnvVersion: process.env.WECHAT_ENV_VERSION || 'release',
  wechatPayMerchantId: process.env.WECHATPAY_MCHID || '',
  wechatPayMerchantSerialNo: process.env.WECHATPAY_MCH_SERIAL_NO || '',
  wechatPayPrivateKeyPath: parsePath(process.env.WECHATPAY_PRIVATE_KEY_PATH),
  wechatPayNotifyUrl: process.env.WECHATPAY_NOTIFY_URL || '',
  wechatPayApiV3Key: process.env.WECHATPAY_API_V3_KEY || '',
  wechatPayCallbackToleranceSeconds: parseInteger(
    process.env.WECHATPAY_CALLBACK_TOLERANCE_SECONDS,
    300,
    {
      min: 30,
      max: 3600
    }
  ),
  wechatPayPlatformPublicKeyPath: parsePath(process.env.WECHATPAY_PLATFORM_PUBLIC_KEY_PATH),
  wechatPayPlatformCertPath: parsePath(process.env.WECHATPAY_PLATFORM_CERT_PATH)
};

function getRuntimeWarnings() {
  const warnings = [];

  if (runtimeConfig.isProduction && runtimeConfig.adminSessionPepper === 'replace-this-pepper-in-production') {
    warnings.push('ADMIN_SESSION_PEPPER is using the default placeholder.');
  }

  if (runtimeConfig.isProduction && runtimeConfig.corsAllowedOrigins.length === 0) {
    warnings.push('CORS_ALLOWED_ORIGINS is empty in production.');
  }

  if (runtimeConfig.isProduction && runtimeConfig.enableDevReset) {
    warnings.push('ENABLE_DEV_RESET should be disabled in production.');
  }

  if (runtimeConfig.isProduction && runtimeConfig.miniappSessionSecret === 'replace-this-miniapp-secret') {
    warnings.push('MINIAPP_SESSION_SECRET is using the default placeholder.');
  }

  if (
    runtimeConfig.isProduction &&
    !runtimeConfig.databaseUrl &&
    !(runtimeConfig.postgresHost && runtimeConfig.postgresDatabase && runtimeConfig.postgresUser)
  ) {
    warnings.push('Real PostgreSQL connection is not configured.');
  }

  if (runtimeConfig.isProduction && (!runtimeConfig.wechatAppId || !runtimeConfig.wechatAppSecret)) {
    warnings.push('WECHAT_APPID / WECHAT_APPSECRET are not configured.');
  }

  if (
    runtimeConfig.isProduction &&
    (!runtimeConfig.wechatPayMerchantId ||
      !runtimeConfig.wechatPayMerchantSerialNo ||
      !runtimeConfig.wechatPayPrivateKeyPath ||
      !runtimeConfig.wechatPayNotifyUrl ||
      !runtimeConfig.wechatPayApiV3Key ||
      (!runtimeConfig.wechatPayPlatformPublicKeyPath && !runtimeConfig.wechatPayPlatformCertPath))
  ) {
    warnings.push('WeChat Pay production configuration is incomplete.');
  }

  if (
    runtimeConfig.wechatPayApiV3Key &&
    runtimeConfig.wechatPayApiV3Key.length !== 32
  ) {
    warnings.push('WECHATPAY_API_V3_KEY must be exactly 32 bytes.');
  }

  return warnings;
}

module.exports = {
  getRuntimeWarnings,
  runtimeConfig
};
