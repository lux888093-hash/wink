const fs = require('fs');
const path = require('path');

let cachedToken = null;

function hasWechatCredentials() {
  return Boolean(process.env.WECHAT_APPID && process.env.WECHAT_APPSECRET);
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
    appid: process.env.WECHAT_APPID,
    secret: process.env.WECHAT_APPSECRET
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
        env_version: process.env.WECHAT_ENV_VERSION || 'release',
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

module.exports = {
  hasWechatCredentials,
  generateMiniProgramCode
};

