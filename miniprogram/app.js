const SESSION_STORAGE_KEY = 'hongjiu-session-id';
const USER_STORAGE_KEY = 'hongjiu-demo-user-id';
const USER_TOKEN_STORAGE_KEY = 'hongjiu-user-token';
const API_BASE_URL_STORAGE_KEY = 'hongjiu-api-base-url';
const API_BASE_URL_CANDIDATES = ['http://192.168.1.176:3100', 'http://127.0.0.1:3100'];
const UI_DEFAULT_CURRENT = '00:00';
const UI_DEFAULT_DURATION = '00:00';
const UI_DEFAULT_PROGRESS = 0;
const { formatSeconds } = require('./utils/format');

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

function createDefaultPlayerState() {
  return {
    tracks: [],
    currentTrack: null,
    currentTrackIndex: 0,
    isPlaying: false,
    currentTimeLabel: UI_DEFAULT_CURRENT,
    durationLabel: UI_DEFAULT_DURATION,
    progress: UI_DEFAULT_PROGRESS,
    errorMessage: ''
  };
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
    player: createDefaultPlayerState(),
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
    this.startExperiencePlayback(experience, { autoplay: true, preserve: false });
  },

  clearExperience() {
    this.globalData.sessionId = '';
    this.globalData.experience = null;
    wx.removeStorageSync(SESSION_STORAGE_KEY);
    this.stopPlayer();
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
  },

  resolveAudioSrc(src) {
    if (!src) {
      return '';
    }

    if (/^https?:\/\//i.test(src) || /^wxfile:\/\//i.test(src)) {
      return src;
    }

    if (src.startsWith('//')) {
      return `https:${src}`;
    }

    if (src.startsWith('/')) {
      return `${this.globalData.apiBaseUrl}${src}`;
    }

    return src;
  },

  subscribePlayer(listener) {
    if (!this.playerListeners) {
      this.playerListeners = [];
    }

    this.playerListeners.push(listener);
    listener(this.getPlayerState());

    return () => {
      this.playerListeners = (this.playerListeners || []).filter((item) => item !== listener);
    };
  },

  emitPlayerState() {
    const state = this.getPlayerState();
    (this.playerListeners || []).forEach((listener) => listener(state));
  },

  getPlayerState() {
    return {
      ...createDefaultPlayerState(),
      ...(this.globalData.player || {})
    };
  },

  setPlayerState(nextState) {
    this.globalData.player = {
      ...this.getPlayerState(),
      ...(nextState || {})
    };
    this.emitPlayerState();
  },

  startExperiencePlayback(experience, options = {}) {
    const tracks = experience && Array.isArray(experience.tracks) ? experience.tracks.filter((item) => item && item.src) : [];

    if (!tracks.length) {
      this.stopPlayer();
      return;
    }

    const currentState = this.getPlayerState();
    const preserve = options.preserve && currentState.tracks.length === tracks.length;
    const requestedIndex = Number.isInteger(options.index) ? options.index : 0;
    const currentTrackIndex = preserve ? currentState.currentTrackIndex : Math.max(0, Math.min(tracks.length - 1, requestedIndex));

    this.setPlayerState({
      tracks,
      currentTrackIndex,
      currentTrack: tracks[currentTrackIndex],
      errorMessage: ''
    });

    if (!preserve || !this.audioContext) {
      this.setupPlayerAudio(currentTrackIndex, options.autoplay !== false);
      return;
    }

    if (options.autoplay && !currentState.isPlaying) {
      this.playPlayer();
    }
  },

  setupPlayerAudio(index, autoplay = true) {
    const state = this.getPlayerState();
    const tracks = state.tracks || [];
    const track = tracks[index];

    if (!track) {
      return;
    }

    if (this.audioContext) {
      this.audioContext.destroy();
      this.audioContext = null;
    }

    const audio = wx.createInnerAudioContext({
      useWebAudioImplement: false
    });

    this.audioContext = audio;
    this.previewStopped = false;
    audio.src = this.resolveAudioSrc(track.src);
    audio.loop = false;
    audio.obeyMuteSwitch = false;
    audio.volume = 1;

    audio.onPlay(() => {
      this.setPlayerState({ isPlaying: true, errorMessage: '' });
    });

    audio.onPause(() => {
      this.setPlayerState({ isPlaying: false });
    });

    audio.onStop(() => {
      this.setPlayerState({
        isPlaying: false,
        currentTimeLabel: UI_DEFAULT_CURRENT,
        durationLabel: track.durationLabel || UI_DEFAULT_DURATION,
        progress: UI_DEFAULT_PROGRESS
      });
    });

    audio.onCanplay(() => {
      setTimeout(() => {
        const duration = this.audioContext ? this.audioContext.duration || 0 : 0;
        if (duration > 0) {
          this.setPlayerState({ durationLabel: formatSeconds(duration) });
        }
      }, 240);
    });

    audio.onTimeUpdate(() => {
      const duration = audio.duration || 0;
      const currentTime = audio.currentTime || 0;
      const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
      const previewSeconds = track.access && track.access.previewSeconds;

      if (
        track.access &&
        !track.access.canPlayFull &&
        previewSeconds &&
        currentTime >= previewSeconds &&
        !this.previewStopped
      ) {
        this.previewStopped = true;
        audio.pause();
        wx.showToast({
          title: '试听已结束',
          icon: 'none'
        });
      }

      this.setPlayerState({
        currentTimeLabel: formatSeconds(currentTime),
        durationLabel: duration > 0 ? formatSeconds(duration) : track.durationLabel || UI_DEFAULT_DURATION,
        progress
      });
    });

    audio.onEnded(() => {
      this.playPlayerNext(true);
    });

    audio.onError(() => {
      this.setPlayerState({
        isPlaying: false,
        errorMessage: '音频资源加载失败'
      });
    });

    this.setPlayerState({
      currentTrackIndex: index,
      currentTrack: track,
      isPlaying: false,
      currentTimeLabel: UI_DEFAULT_CURRENT,
      durationLabel: track.durationLabel || UI_DEFAULT_DURATION,
      progress: UI_DEFAULT_PROGRESS,
      errorMessage: ''
    });

    if (autoplay) {
      setTimeout(() => {
        this.playPlayer();
      }, 120);
    }
  },

  playPlayer() {
    if (this.audioContext) {
      this.audioContext.play();
    }
  },

  pausePlayer() {
    if (this.audioContext) {
      this.audioContext.pause();
    }
  },

  togglePlayerPlayback() {
    if (this.getPlayerState().isPlaying) {
      this.pausePlayer();
      return;
    }

    this.playPlayer();
  },

  playPlayerByIndex(index, autoplay = true) {
    const tracks = this.getPlayerState().tracks || [];
    const targetIndex = Number(index);

    if (!tracks[targetIndex]) {
      return;
    }

    this.setupPlayerAudio(targetIndex, autoplay);
  },

  playPlayerPrev(autoplay = true) {
    const state = this.getPlayerState();
    const count = state.tracks.length;

    if (!count) {
      return;
    }

    this.playPlayerByIndex((state.currentTrackIndex - 1 + count) % count, autoplay);
  },

  playPlayerNext(autoplay = true) {
    const state = this.getPlayerState();
    const count = state.tracks.length;

    if (!count) {
      return;
    }

    this.playPlayerByIndex((state.currentTrackIndex + 1) % count, autoplay);
  },

  stopPlayer() {
    if (this.audioContext) {
      this.audioContext.destroy();
      this.audioContext = null;
    }

    this.setPlayerState(createDefaultPlayerState());
  }
});
