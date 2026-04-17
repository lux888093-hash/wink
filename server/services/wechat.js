const fs = require('fs');
const path = require('path');
const { runtimeConfig } = require('./config');

let cachedToken = null;

function hasWechatCredentials() {
  return Boolean(runtimeConfig.wechatAppId && runtimeConfig.wechatAppSecret);
}

async function getAccessToken() {
  if (
    cachedToken &&
    cachedToken.value &&
    cachedToken.expiresAt &&
    cachedToken.expiresAt > Date.now() + 60 * 1000
  ) {
    return cachedToken.value;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credential',
    appid: runtimeConfig.wechatAppId,
    secret: runtimeConfig.wechatAppSecret
  });

  const response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg || 'WECHAT_ACCESS_TOKEN_FAILED');
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  };

  return payload.access_token;
}

async function generateMiniProgramCode({ scene, token, page }) {
  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scene,
        page,
        check_path: true,
        env_version: runtimeConfig.wechatEnvVersion,
        width: 430,
        auto_color: false,
        line_color: {
          r: 233,
          g: 193,
          b: 118
        },
        is_hyaline: true
      })
    }
  );

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    throw new Error(payload.errmsg || 'WECHAT_QRCODE_FAILED');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const outputDir = path.join(__dirname, '..', 'public', 'qrcodes');
  const fileName = `${token}.png`;
  const filePath = path.join(outputDir, fileName);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    publicPath: `/qrcodes/${fileName}`
  };
}

async function callMiniProgramApi(apiPath, body) {
  const accessToken = await getAccessToken();
  const separator = apiPath.includes('?') ? '&' : '?';
  const response = await fetch(
    `https://api.weixin.qq.com${apiPath}${separator}access_token=${accessToken}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }
  );
  const payload = await response.json();

  if (!response.ok || payload.errcode) {
    const error = new Error(payload.errmsg || 'WECHAT_MINIAPP_API_FAILED');
    error.meta = payload;
    throw error;
  }

  return payload;
}

async function uploadShippingInfo(payload) {
  return callMiniProgramApi('/wxa/sec/order/upload_shipping_info', payload);
}

module.exports = {
  callMiniProgramApi,
  getAccessToken,
  hasWechatCredentials,
  generateMiniProgramCode,
  uploadShippingInfo
};
