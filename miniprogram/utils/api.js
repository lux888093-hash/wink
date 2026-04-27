function getAppInstance() {
  return getApp();
}

function getBaseUrl() {
  return getAppInstance().globalData.apiBaseUrl;
}

async function resolveBaseUrl(app, force = false) {
  if (app && typeof app.resolveApiBaseUrl === 'function') {
    return app.resolveApiBaseUrl(force);
  }

  return getBaseUrl();
}

function getHeaders(extraHeaders) {
  const app = getAppInstance();

  return {
    'content-type': 'application/json',
    ...(app.globalData.userToken
      ? { Authorization: `Bearer ${app.globalData.userToken}` }
      : { 'x-demo-user-id': app.globalData.currentUserId || 'user_demo_guest' }),
    ...(extraHeaders || {})
  };
}

async function request(options) {
  const { url, method = 'GET', data = null, headers = null } = options;
  const app = getAppInstance();

  if (app && typeof app.ensureUserSession === 'function' && !String(url).startsWith('/api/auth/')) {
    await app.ensureUserSession();
  }

  const sendRequest = (baseUrl) => new Promise((resolve, reject) => {
    const requestOptions = {
      url: `${baseUrl}${url}`,
      method,
      timeout: 8000,
      header: getHeaders(headers),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok !== false) {
          resolve(res.data);
          return;
        }

        const error = new Error(
          (res.data && (res.data.code || res.data.message)) || `HTTP_${res.statusCode}`
        );
        error.response = res.data;
        reject(error);
      },
      fail() {
        reject(new Error('NETWORK_ERROR'));
      }
    };

    if (data !== null && data !== undefined) {
      requestOptions.data = data;
    }

    wx.request(requestOptions);
  });

  const baseUrl = await resolveBaseUrl(app);

  try {
    return await sendRequest(baseUrl);
  } catch (error) {
    if (error.message !== 'NETWORK_ERROR') {
      throw error;
    }

    const nextBaseUrl = await resolveBaseUrl(app, true);
    if (!nextBaseUrl || nextBaseUrl === baseUrl) {
      throw error;
    }

    return sendRequest(nextBaseUrl);
  }
}

module.exports = {
  getBaseUrl,
  request
};
