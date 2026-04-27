const SESSION_STORAGE_KEY = 'hongjiu-session-id';
const USER_STORAGE_KEY = 'hongjiu-demo-user-id';
const USER_TOKEN_STORAGE_KEY = 'hongjiu-user-token';
const API_BASE_URL_STORAGE_KEY = 'hongjiu-api-base-url';
const API_BASE_URL_CANDIDATES = ['http://192.168.1.176:3100', 'http://127.0.0.1:3100'];

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function uniqueBaseUrls(urls) {
  const seen = {};
  return urls
    .map(normalizeBaseUrl)
    .filter(Boolean)
    .filter((url) => {
      if (seen[url]) {
        return false;
      }
      seen[url] = true;
      return true;
    });
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        resolve(result.code || '');
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function probeApiBaseUrl(baseUrl) {
  return new Promise((resolve) => {
    wx.request({
      url: `${baseUrl}/api/health`,
      method: 'GET',
      timeout: 1600,
      success(res) {
        resolve(res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok !== false);
      },
      fail() {
        resolve(false);
      }
    });
  });
}

function authRequest(baseUrl, payload) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}/api/auth/wechat/login`,
      method: 'POST',
      timeout: 8000,
      header: {
        'content-type': 'application/json'
      },
      data: payload,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok !== false) {
          resolve(res.data);
          return;
        }

        const error = new Error(
          (res.data && (res.data.code || res.data.message)) || `HTTP_${res.statusCode}`
        );
        reject(error);
      },
      fail() {
        reject(new Error('NETWORK_ERROR'));
      }
    });
  });
}

App({
  globalData: {
    apiBaseUrl: API_BASE_URL_CANDIDATES[0],
    apiBaseUrlCandidates: API_BASE_URL_CANDIDATES,
    currentUserId: 'user_demo_guest',
    userToken: '',
    authMode: 'demo',
    paymentMode: 'mock',
    sessionId: '',
    experience: null,
    cartCount: 0,
    memberProfile: null,
    system: {
      statusBarHeight: 20,
      windowWidth: 375,
      windowHeight: 667
    }
  },

  onLaunch() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.system = {
        statusBarHeight: systemInfo.statusBarHeight || 20,
        windowWidth: systemInfo.windowWidth || 375,
        windowHeight: systemInfo.windowHeight || 667
      };
    } catch (error) {
      console.warn('system info unavailable', error);
    }

    wx.removeStorageSync(SESSION_STORAGE_KEY);

    const savedUserId = wx.getStorageSync(USER_STORAGE_KEY);
    if (savedUserId) {
      this.globalData.currentUserId = savedUserId;
    }

    const savedApiBaseUrl = wx.getStorageSync(API_BASE_URL_STORAGE_KEY);
    this.globalData.apiBaseUrlCandidates = uniqueBaseUrls([
      savedApiBaseUrl,
      ...API_BASE_URL_CANDIDATES
    ]);
    this.globalData.apiBaseUrl = this.globalData.apiBaseUrlCandidates[0] || API_BASE_URL_CANDIDATES[0];

    const savedToken = wx.getStorageSync(USER_TOKEN_STORAGE_KEY);
    if (savedToken) {
      this.globalData.userToken = savedToken;
    }

    this.apiBaseUrlPromise = this.resolveApiBaseUrl();
    this.authPromise = this.bootstrapUserSession();
  },

  onHide() {
    this.clearExperience();
  },

  async bootstrapUserSession(force = false) {
    if (this.authPromise && !force) {
      return this.authPromise;
    }

    const task = (async () => {
      try {
        const apiBaseUrl = await this.resolveApiBaseUrl(force);
        const code = await wxLogin();
        const payload = await authRequest(apiBaseUrl, {
          code,
          demoUserId: this.globalData.currentUserId
        });
        this.setUserSession(payload);
        return payload;
      } catch (error) {
        this.globalData.userToken = '';
        this.globalData.authMode = 'demo';
        this.globalData.paymentMode = 'mock';
        wx.removeStorageSync(USER_TOKEN_STORAGE_KEY);
        return null;
      }
    })();

    this.authPromise = task;
    return task;
  },

  async resolveApiBaseUrl(force = false) {
    if (this.apiBaseUrlPromise && !force) {
      return this.apiBaseUrlPromise;
    }

    const task = (async () => {
      const candidates = uniqueBaseUrls([
        this.globalData.apiBaseUrl,
        ...(this.globalData.apiBaseUrlCandidates || []),
        ...API_BASE_URL_CANDIDATES
      ]);

      for (let index = 0; index < candidates.length; index += 1) {
        const baseUrl = candidates[index];
        const ok = await probeApiBaseUrl(baseUrl);
        if (ok) {
          this.globalData.apiBaseUrl = baseUrl;
          this.globalData.apiBaseUrlCandidates = uniqueBaseUrls([baseUrl, ...candidates]);
          wx.setStorageSync(API_BASE_URL_STORAGE_KEY, baseUrl);
          return baseUrl;
        }
      }

      return this.globalData.apiBaseUrl || API_BASE_URL_CANDIDATES[0];
    })();

    this.apiBaseUrlPromise = task;
    return task;
  },

  ensureUserSession() {
    return this.authPromise || Promise.resolve(null);
  },

  setUserSession(payload) {
    this.globalData.currentUserId = payload.user.id;
    this.globalData.userToken = payload.token || '';
    this.globalData.authMode = payload.mode || 'demo';
    this.globalData.paymentMode =
      payload.capabilities && payload.capabilities.wechatPay ? 'wechat' : 'mock';
    wx.setStorageSync(USER_STORAGE_KEY, this.globalData.currentUserId);
    if (this.globalData.userToken) {
      wx.setStorageSync(USER_TOKEN_STORAGE_KEY, this.globalData.userToken);
    } else {
      wx.removeStorageSync(USER_TOKEN_STORAGE_KEY);
    }
  },

  setExperience(sessionId, experience) {
    this.globalData.sessionId = sessionId;
    this.globalData.experience = experience;
    wx.removeStorageSync(SESSION_STORAGE_KEY);
  },

  clearExperience() {
    this.globalData.sessionId = '';
    this.globalData.experience = null;
    wx.removeStorageSync(SESSION_STORAGE_KEY);
  },

  setCartCount(count) {
    this.globalData.cartCount = Number(count) || 0;
  },

  setMemberProfile(profile) {
    this.globalData.memberProfile = profile || null;
  },

  switchDemoUser(userId) {
    this.globalData.currentUserId = userId || 'user_demo_guest';
    this.globalData.userToken = '';
    wx.setStorageSync(USER_STORAGE_KEY, this.globalData.currentUserId);
    wx.removeStorageSync(USER_TOKEN_STORAGE_KEY);
    this.authPromise = this.bootstrapUserSession(true);
  }
});
