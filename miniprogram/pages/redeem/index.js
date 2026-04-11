const { request } = require('../../utils/api');
const { consumeScene, restoreExperience } = require('../../utils/session');

function decodeScene(value) {
  if (!value) {
    return '';
  }

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return String(value);
  }
}

function errorCopy(code) {
  switch (code) {
    case 'CODE_ALREADY_USED':
      return {
        title: 'This card has already been poured.',
        message: 'This code has already been used. Generate a fresh local demo card to continue.'
      };
    case 'CODE_EXPIRED':
      return {
        title: 'This card has expired.',
        message: 'This code is no longer valid. Generate a new retail card from the backend.'
      };
    case 'CODE_NOT_FOUND':
      return {
        title: 'We could not find this card.',
        message: 'The scene token was not found. Check whether the scan parameter is correct.'
      };
    case 'NETWORK_ERROR':
      return {
        title: 'Backend unavailable.',
        message: 'Start `server/` first, then disable request domain validation in WeChat DevTools.'
      };
    default:
      return {
        title: 'Entry failed.',
        message: 'The backend returned an unexpected error. Check the local server logs.'
      };
  }
}

Page({
  data: {
    state: 'loading',
    title: 'Preparing the estate entrance',
    message: 'Verifying the one-time code and preparing the estate, bottle and music experience.',
    scene: ''
  },

  async onLoad(query) {
    try {
      const experience = await restoreExperience();
      const scene = decodeScene(query.scene);

      if (!scene && experience) {
        wx.redirectTo({ url: '/pages/cellar/index' });
        return;
      }
    } catch (error) {
      console.warn('restore session failed', error);
    }

    const scene = decodeScene(query.scene || query.token);

    if (scene) {
      this.consume(scene);
      return;
    }

    this.setData({
      state: 'idle',
      title: 'Ready when you are',
      message: 'In production this page opens from a unique QR code. For local demo, generate and consume a fresh card below.'
    });
  },

  async consume(scene) {
    this.setData({
      state: 'loading',
      scene,
      title: 'Unlocking the tasting session',
      message: 'The first successful scan receives access. Any later scan of the same code will be rejected.'
    });

    try {
      await consumeScene(scene);
      this.setData({
        state: 'success',
        title: 'Entrance granted',
        message: 'The estate view is ready. Entering the main experience now.'
      });

      setTimeout(() => {
        wx.redirectTo({ url: '/pages/cellar/index' });
      }, 700);
    } catch (error) {
      const copy = errorCopy(error.message);
      this.setData({
        state: 'error',
        title: copy.title,
        message: copy.message
      });
    }
  },

  async useLocalDemo() {
    this.setData({
      state: 'loading',
      title: 'Generating a local card',
      message: 'Resetting local data and preparing a fresh demo entry.'
    });

    try {
      const payload = await request({
        url: '/api/admin/dev/reset',
        method: 'POST'
      });

      this.consume(payload.scene);
    } catch (error) {
      const copy = errorCopy(error.message);
      this.setData({
        state: 'error',
        title: copy.title,
        message: copy.message
      });
    }
  }
});
