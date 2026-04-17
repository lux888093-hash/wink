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
  wechatPayRefundNotifyUrl: process.env.WECHATPAY_REFUND_NOTIFY_URL || '',
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
  wechatPayPlatformCertPath: parsePath(process.env.WECHATPAY_PLATFORM_CERT_PATH),
  redisUrl: process.env.REDIS_URL || '',
  objectStorageBaseUrl: process.env.OBJECT_STORAGE_BASE_URL || '',
  cdnBaseUrl: process.env.CDN_BASE_URL || '',
  cdnSigningSecret: process.env.CDN_SIGNING_SECRET || '',
  cdnSignedUrlTtlSeconds: parseInteger(process.env.CDN_SIGNED_URL_TTL_SECONDS, 15 * 60, {
    min: 60,
    max: 24 * 60 * 60
  }),
  mediaDeliveryMode: String(process.env.MEDIA_DELIVERY_MODE || 'local').toLowerCase(),
  backupDir: parsePath(process.env.BACKUP_DIR, 'data/backups'),
  logDir: parsePath(process.env.LOG_DIR, 'logs')
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
      !runtimeConfig.wechatPayRefundNotifyUrl ||
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

function getReadinessChecks(extra = {}) {
  const checks = [
    {
      key: 'app_env',
      ok: runtimeConfig.isProduction,
      severity: 'required',
      message: runtimeConfig.isProduction ? 'APP_ENV is production.' : 'APP_ENV is not production.'
    },
    {
      key: 'https_base_url',
      ok: /^https:\/\//i.test(runtimeConfig.miniprogramBaseUrl),
      severity: 'required',
      message: 'MINIPROGRAM_BASE_URL must be an HTTPS production domain.'
    },
    {
      key: 'cors',
      ok: runtimeConfig.corsAllowedOrigins.length > 0 && !runtimeConfig.corsAllowedOrigins.includes('*'),
      severity: 'required',
      message: 'CORS_ALLOWED_ORIGINS must list explicit production origins.'
    },
    {
      key: 'database',
      ok: Boolean(
        runtimeConfig.databaseUrl ||
          (runtimeConfig.postgresHost && runtimeConfig.postgresDatabase && runtimeConfig.postgresUser)
      ),
      severity: 'required',
      message: 'Real PostgreSQL connection must be configured.'
    },
    {
      key: 'admin_secret',
      ok:
        runtimeConfig.adminSessionPepper !== 'replace-this-pepper-in-production' &&
        Boolean(runtimeConfig.adminBootstrapPassword),
      severity: 'required',
      message: 'Admin session pepper and bootstrap password must be configured.'
    },
    {
      key: 'miniapp_login',
      ok:
        runtimeConfig.miniappSessionSecret !== 'replace-this-miniapp-secret' &&
        Boolean(runtimeConfig.wechatAppId && runtimeConfig.wechatAppSecret),
      severity: 'required',
      message: 'Mini-program login secrets must be configured.'
    },
    {
      key: 'wechat_pay',
      ok: Boolean(
        runtimeConfig.wechatPayMerchantId &&
          runtimeConfig.wechatPayMerchantSerialNo &&
          runtimeConfig.wechatPayPrivateKeyPath &&
          runtimeConfig.wechatPayNotifyUrl &&
          runtimeConfig.wechatPayRefundNotifyUrl &&
          runtimeConfig.wechatPayApiV3Key &&
          (runtimeConfig.wechatPayPlatformPublicKeyPath || runtimeConfig.wechatPayPlatformCertPath)
      ),
      severity: 'required',
      message: 'WeChat Pay merchant configuration must be complete.'
    },
    {
      key: 'dev_reset',
      ok: !runtimeConfig.enableDevReset,
      severity: 'required',
      message: 'ENABLE_DEV_RESET must be false in production.'
    },
    {
      key: 'redis',
      ok: Boolean(runtimeConfig.redisUrl),
      severity: 'recommended',
      message: 'REDIS_URL is recommended for distributed rate limits and short-lived tickets.'
    },
    {
      key: 'object_storage',
      ok: Boolean(runtimeConfig.objectStorageBaseUrl && runtimeConfig.cdnBaseUrl),
      severity: 'recommended',
      message: 'Object storage and CDN are recommended for production media delivery.'
    },
    {
      key: 'cdn_signed_url',
      ok: Boolean(runtimeConfig.mediaDeliveryMode !== 'cdn' || runtimeConfig.cdnSigningSecret),
      severity: 'recommended',
      message: 'CDN signing secret is recommended when MEDIA_DELIVERY_MODE=cdn.'
    },
    {
      key: 'backup_dir',
      ok: Boolean(runtimeConfig.backupDir),
      severity: 'required',
      message: 'BACKUP_DIR must be configured for snapshot backups.'
    },
    ...((extra && extra.checks) || [])
  ];
  const required = checks.filter((item) => item.severity === 'required');

  return {
    ready: required.every((item) => item.ok),
    checks
  };
}

module.exports = {
  getReadinessChecks,
  getRuntimeWarnings,
  runtimeConfig
};
