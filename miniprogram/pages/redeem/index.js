const { consumeCode } = require('../../utils/session');

function errorCopy(code) {
  switch (code) {
    case 'CODE_ALREADY_USED':
      return {
        title: '提取码已使用',
        message: '该提取码已被验证，每个码仅限使用一次。'
      };
    case 'CODE_EXPIRED':
      return {
        title: '提取码已过期',
        message: '该提取码已失效，请联系品牌客服获取新的提取码。'
      };
    case 'CODE_NOT_FOUND':
      return {
        title: '提取码无效',
        message: '未找到该提取码，请检查后重新输入。'
      };
    case 'CODE_DISABLED':
      return {
        title: '提取码已停用',
        message: '该提取码已被管理员停用。'
      };
    case 'INVALID_REDEEM_CODE':
      return {
        title: '格式不正确',
        message: '请输入六位数字提取码。'
      };
    case 'REDEEM_RATE_LIMITED':
      return {
        title: '操作过于频繁',
        message: '请稍后再试。'
      };
    case 'NETWORK_ERROR':
      return {
        title: '服务端未连接',
        message: '请先启动 server/，并在开发者工具里关闭 request 合法域名校验。'
      };
    default:
      return {
        title: '验证失败',
        message: '本地接口返回了未预期错误，请检查服务端日志。'
      };
  }
}

Page({
  data: {
    state: 'idle',
    title: '输入提取码',
    message: '输入酒瓶标签上的六位数字提取码，开启专属体验。',
    codeDigits: ['', '', '', '', '', ''],
    focusIndex: 0,
    fullCode: ''
  },

  onLoad() {
    this.setData({ focusIndex: 0 });
  },

  onDigitInput(e) {
    const { index } = e.currentTarget.dataset;
    const value = e.detail.value.replace(/\D/g, '').slice(0, 1);

    const codeDigits = [...this.data.codeDigits];
    codeDigits[index] = value;

    const focusIndex = value && index < 5 ? index + 1 : this.data.focusIndex;
    const fullCode = codeDigits.join('');

    this.setData({ codeDigits, focusIndex, fullCode });

    if (fullCode.length === 6) {
      this.verifyCode(fullCode);
    }
  },

  onDigitFocus(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ focusIndex: index });
  },

  onKeyboardDelete(e) {
    const { index } = e.currentTarget.dataset;
    if (!this.data.codeDigits[index] && index > 0) {
      const codeDigits = [...this.data.codeDigits];
      codeDigits[index - 1] = '';
      this.setData({ codeDigits, focusIndex: index - 1, fullCode: codeDigits.join('') });
    }
  },

  async verifyCode(code) {
    this.setData({
      state: 'loading',
      title: '正在验证提取码',
      message: '正在核验提取码并加载专属内容...'
    });

    try {
      await consumeCode(code);
      this.setData({
        state: 'success',
        title: '验证成功',
        message: '正在进入专属体验...'
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

  clearInput() {
    this.setData({
      state: 'idle',
      title: '输入提取码',
      message: '输入酒瓶标签上的六位数字提取码，开启专属体验。',
      codeDigits: ['', '', '', '', '', ''],
      focusIndex: 0,
      fullCode: ''
    });
  }
});
