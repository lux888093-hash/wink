const { request } = require('./api');

async function consumeScene(scene) {
  const payload = await request({
    url: '/api/redeem/consume',
    method: 'POST',
    data: { scene }
  });

  getApp().setExperience(payload.sessionId, payload.experience);
  return payload;
}

async function restoreExperience() {
  const app = getApp();

  if (app.globalData.experience) {
    return app.globalData.experience;
  }

  if (!app.globalData.sessionId) {
    return null;
  }

  try {
    const payload = await request({
      url: `/api/sessions/${app.globalData.sessionId}`
    });

    app.setExperience(payload.sessionId, payload.experience);
    return payload.experience;
  } catch (error) {
    if (
      error.message === 'SESSION_NOT_FOUND' ||
      error.message === 'SESSION_EXPIRED' ||
      error.message === 'NETWORK_ERROR'
    ) {
      if (error.message !== 'NETWORK_ERROR') {
        app.clearExperience();
      }
    }

    throw error;
  }
}

function getCurrentExperience() {
  return getApp().globalData.experience;
}

module.exports = {
  consumeScene,
  restoreExperience,
  getCurrentExperience
};

