function getAppInstance() {
  return getApp();
}

function getBaseUrl() {
  return getAppInstance().globalData.apiBaseUrl;
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

  return new Promise((resolve, reject) => {
    const requestOptions = {
      url: `${getBaseUrl()}${url}`,
      method,
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
}

module.exports = {
  getBaseUrl,
  request
};
