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
        title: '这张礼卡已被首扫使用',
        message: '正式版这里会提示用户联系品牌客服或使用新的专属礼卡。'
      };
    case 'CODE_EXPIRED':
      return {
        title: '二维码已过期',
        message: '该码不再有效，后台可查询并重新生成新的批次码。'
      };
    case 'CODE_NOT_FOUND':
      return {
        title: '未找到该二维码',
        message: '请确认扫码参数正确，或在后台检查批次状态。'
      };
    case 'NETWORK_ERROR':
      return {
        title: '服务端未连接',
        message: '请先启动 `server/`，并在开发者工具里关闭 request 合法域名校验。'
      };
    default:
      return {
        title: '进入失败',
        message: '本地接口返回了未预期错误，请检查服务端日志。'
      };
  }
}

Page({
  data: {
    state: 'loading',
    title: '正在核验首扫资格',
    message: '只允许第一次扫码进入专属页，随后会生成这次会话的酒庄与配乐数据。',
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
      title: '扫码入口已准备好',
      message: '真实环境从礼盒二维码进入。当前本地演示可以一键生成新的首扫码。'
    });
  },

  async consume(scene) {
    this.setData({
      state: 'loading',
      scene,
      title: '正在打开专属体验',
      message: '酒庄内容、酒款详情与专属配乐会一起写入本次会话。'
    });

    try {
      await consumeScene(scene);
      this.setData({
        state: 'success',
        title: '首扫成功',
        message: '正在进入这瓶酒的专属页。'
      });

      setTimeout(() => {
        wx.redirectTo({ url: '/pages/cellar/index' });
      }, 650);
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
      title: '正在生成演示首扫码',
      message: '会重置本地数据，并生成一个新的可消费二维码。'
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
  },

  reloadPage() {
    wx.redirectTo({ url: '/pages/redeem/index' });
  }
});
