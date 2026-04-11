const SESSION_STORAGE_KEY = 'curator-session-id';

App({
  globalData: {
    apiBaseUrl: 'http://127.0.0.1:3100',
    sessionId: '',
    experience: null,
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

    const savedSessionId = wx.getStorageSync(SESSION_STORAGE_KEY);
    if (savedSessionId) {
      this.globalData.sessionId = savedSessionId;
    }
  },

  setExperience(sessionId, experience) {
    this.globalData.sessionId = sessionId;
    this.globalData.experience = experience;
    wx.setStorageSync(SESSION_STORAGE_KEY, sessionId);
  },

  clearExperience() {
    this.globalData.sessionId = '';
    this.globalData.experience = null;
    wx.removeStorageSync(SESSION_STORAGE_KEY);
  }
});

