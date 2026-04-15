const { request } = require('./api');

async function consumeCode(code) {
  const payload = await request({
    url: '/api/redeem/consume',
    method: 'POST',
    data: { code }
  });

  getApp().setExperience(payload.sessionId, payload.experience);
  return payload;
}

function getCurrentExperience() {
  return getApp().globalData.experience;
}

module.exports = {
  consumeCode,
  getCurrentExperience
};
