const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { runtimeConfig } = require('./config');

let privateKeyCache = null;
let platformKeyCache = null;

function hasWechatPayCredentials() {
  return Boolean(
    runtimeConfig.wechatAppId &&
      runtimeConfig.wechatPayMerchantId &&
      runtimeConfig.wechatPayMerchantSerialNo &&
      runtimeConfig.wechatPayPrivateKeyPath &&
      runtimeConfig.wechatPayNotifyUrl &&
      runtimeConfig.wechatPayApiV3Key &&
      (runtimeConfig.wechatPayPlatformPublicKeyPath || runtimeConfig.wechatPayPlatformCertPath)
  );
}

function resolvePath(filePath) {
  if (!filePath) {
    return '';
  }

  return path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
}

function getMerchantPrivateKey() {
  if (privateKeyCache) {
    return privateKeyCache;
  }

  const filePath = resolvePath(runtimeConfig.wechatPayPrivateKeyPath);
  privateKeyCache = fs.readFileSync(filePath, 'utf8');
  return privateKeyCache;
}

function getWechatPayPlatformPublicKey() {
  if (platformKeyCache) {
    return platformKeyCache;
  }

  if (runtimeConfig.wechatPayPlatformPublicKeyPath) {
    platformKeyCache = fs.readFileSync(resolvePath(runtimeConfig.wechatPayPlatformPublicKeyPath), 'utf8');
    return platformKeyCache;
  }

  if (runtimeConfig.wechatPayPlatformCertPath) {
    const certificate = fs.readFileSync(resolvePath(runtimeConfig.wechatPayPlatformCertPath), 'utf8');
    platformKeyCache = crypto.createPublicKey(certificate).export({
      type: 'spki',
      format: 'pem'
    });
    return platformKeyCache;
  }

  throw new Error('WECHATPAY_PLATFORM_KEY_MISSING');
}

function signWithMerchantKey(message) {
  return crypto.sign('RSA-SHA256', Buffer.from(message, 'utf8'), getMerchantPrivateKey()).toString('base64');
}

function createAuthorizationHeader(method, requestPath, bodyText) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const message = `${method}\n${requestPath}\n${timestamp}\n${nonce}\n${bodyText}\n`;
  const signature = signWithMerchantKey(message);

  return {
    nonce,
    timestamp,
    signature,
    header:
      `WECHATPAY2-SHA256-RSA2048 ` +
      `mchid="${runtimeConfig.wechatPayMerchantId}",` +
      `nonce_str="${nonce}",` +
      `signature="${signature}",` +
      `timestamp="${timestamp}",` +
      `serial_no="${runtimeConfig.wechatPayMerchantSerialNo}"`
  };
}

function isWechatPayTimestampValid(timestamp) {
  const numeric = Number(timestamp);

  if (!Number.isFinite(numeric)) {
    return false;
  }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - numeric);
  return skew <= runtimeConfig.wechatPayCallbackToleranceSeconds;
}

async function wechatPayRequest(method, requestPath, body = null) {
  if (!hasWechatPayCredentials()) {
    throw new Error('WECHAT_PAY_DISABLED');
  }

  const bodyText = body ? JSON.stringify(body) : '';
  const auth = createAuthorizationHeader(method, requestPath, bodyText);
  const response = await fetch(`https://api.mch.weixin.qq.com${requestPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: auth.header
    },
    body: bodyText || undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(payload.message || payload.code || 'WECHATPAY_REQUEST_FAILED');
    error.meta = payload;
    throw error;
  }

  return payload;
}

function createMiniProgramPaymentParams(prepayId) {
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const packageValue = `prepay_id=${prepayId}`;
  const message = `${runtimeConfig.wechatAppId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const paySign = signWithMerchantKey(message);

  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA',
    paySign
  };
}

async function createJsapiTransaction(input) {
  const notifyUrl = input.notifyUrl || runtimeConfig.wechatPayNotifyUrl;
  const body = {
    appid: runtimeConfig.wechatAppId,
    mchid: runtimeConfig.wechatPayMerchantId,
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: notifyUrl,
    amount: {
      total: input.totalFen,
      currency: 'CNY'
    },
    payer: {
      openid: input.openid
    },
    attach: input.attach || ''
  };

  const payload = await wechatPayRequest('POST', '/v3/pay/transactions/jsapi', body);
  return {
    prepayId: payload.prepay_id,
    response: payload,
    jsapiParams: createMiniProgramPaymentParams(payload.prepay_id),
    requestPayload: body
  };
}

async function queryTransactionByOutTradeNo(outTradeNo) {
  const requestPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(runtimeConfig.wechatPayMerchantId)}`;
  return wechatPayRequest('GET', requestPath);
}

function verifyWechatpaySignature(headers, rawBody) {
  const timestamp = String(headers['wechatpay-timestamp'] || headers.Wechatpay-Timestamp || '');
  const nonce = String(headers['wechatpay-nonce'] || headers.Wechatpay-Nonce || '');
  const signature = String(headers['wechatpay-signature'] || headers.Wechatpay-Signature || '');

  if (!timestamp || !nonce || !signature) {
    return false;
  }

  if (!isWechatPayTimestampValid(timestamp)) {
    return false;
  }

  if (signature.startsWith('WECHATPAY/SIGNTEST/')) {
    return false;
  }

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  return crypto.verify(
    'RSA-SHA256',
    Buffer.from(message, 'utf8'),
    getWechatPayPlatformPublicKey(),
    Buffer.from(signature, 'base64')
  );
}

function decryptWechatpayResource(resource) {
  if (resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('WECHATPAY_RESOURCE_ALGORITHM_INVALID');
  }

  const nonce = Buffer.from(resource.nonce, 'utf8');
  const key = Buffer.from(runtimeConfig.wechatPayApiV3Key, 'utf8');

  if (key.length !== 32) {
    throw new Error('WECHATPAY_API_V3_KEY_INVALID');
  }

  const ciphertext = Buffer.from(resource.ciphertext, 'base64');
  const associatedData = Buffer.from(resource.associated_data || '', 'utf8');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);

  if (associatedData.length) {
    decipher.setAAD(associatedData);
  }

  decipher.setAuthTag(authTag);
  const result = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(result.toString('utf8'));
}

module.exports = {
  createMiniProgramPaymentParams,
  createJsapiTransaction,
  decryptWechatpayResource,
  hasWechatPayCredentials,
  queryTransactionByOutTradeNo,
  verifyWechatpaySignature
};
