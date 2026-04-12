const crypto = require('crypto');
const { runtimeConfig } = require('./config');

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', runtimeConfig.miniappSessionSecret)
    .update(payload)
    .digest('base64url');
}

function hasMiniappSessionSecret() {
  return Boolean(
    runtimeConfig.miniappSessionSecret && runtimeConfig.miniappSessionSecret !== 'replace-this-miniapp-secret'
  );
}

function hasWechatLoginCredentials() {
  return Boolean(runtimeConfig.wechatAppId && runtimeConfig.wechatAppSecret);
}

async function exchangeMiniappCode(code) {
  if (!hasWechatLoginCredentials()) {
    throw new Error('WECHAT_LOGIN_DISABLED');
  }

  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) {
    throw new Error('WECHAT_LOGIN_CODE_REQUIRED');
  }

  const params = new URLSearchParams({
    appid: runtimeConfig.wechatAppId,
    secret: runtimeConfig.wechatAppSecret,
    js_code: normalizedCode,
    grant_type: 'authorization_code'
  });

  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg || 'WECHAT_CODE2SESSION_FAILED');
  }

  return {
    openid: payload.openid,
    unionid: payload.unionid || '',
    sessionKey: payload.session_key || ''
  };
}

function issueMiniappUserToken(user) {
  if (!hasMiniappSessionSecret()) {
    throw new Error('MINIAPP_SESSION_SECRET_MISSING');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + runtimeConfig.miniappSessionDays * 24 * 60 * 60;
  const payload = base64url(
    JSON.stringify({
      userId: user.id,
      openid: user.openid || '',
      issuedAt,
      expiresAt
    })
  );
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

function verifyMiniappUserToken(token) {
  const normalized = String(token || '').trim();
  if (!normalized || !normalized.includes('.')) {
    return null;
  }

  const [payload, signature] = normalized.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.userId || !decoded.expiresAt || decoded.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

module.exports = {
  exchangeMiniappCode,
  hasMiniappSessionSecret,
  hasWechatLoginCredentials,
  issueMiniappUserToken,
  verifyMiniappUserToken
};
