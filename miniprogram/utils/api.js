function getBaseUrl() {
  const app = getApp();
  return app.globalData.apiBaseUrl;
}

function request(options) {
  const { url, method = 'GET', data = null } = options;

  return new Promise((resolve, reject) => {
    const requestOptions = {
      url: `${getBaseUrl()}${url}`,
      method,
      header: {
        'content-type': 'application/json'
      },
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
        const error = new Error('NETWORK_ERROR');
        reject(error);
      }
    };

    if (data !== null && data !== undefined) {
      requestOptions.data = data;
    }

    wx.request(requestOptions);
  });
}

module.exports = {
  request
};
