const { request } = require('../../utils/api');
const { isPaymentCancelled, payPendingOrder, randomKey } = require('../../utils/payment');

Page({
  data: {
    loading: true,
    pageReady: false,
    profile: null,
    cartCount: 0,
    errorTitle: '',
    errorMessage: ''
  },

  onShow() {
    this.loadPage();
  },

  async loadPage() {
    this.setData({ loading: true, errorTitle: '', errorMessage: '' });

    try {
      const [profilePayload, cartPayload] = await Promise.all([
        request({ url: '/api/member/profile' }),
        request({ url: '/api/cart' })
      ]);
      const library = profilePayload.library || [];
      const downloads = profilePayload.downloads || [];
      const hasActiveMembership = Boolean(profilePayload.membership && profilePayload.membership.isActive);

      getApp().setMemberProfile(profilePayload);
      getApp().setCartCount(cartPayload.cart.totalCount || 0);

      this.setData({
        loading: false,
        pageReady: true,
        profile: {
          ...profilePayload,
          library,
          downloads,
          plans: (profilePayload.plans || []).map((item) => ({
            ...item,
            benefitsLabel: (item.benefits || []).join(' · ')
          })),
          hasDownloads: Boolean(downloads.length),
          hasActiveMembership,
          membershipStateLabel: hasActiveMembership ? '已开通' : '未开通',
          membershipExpireAt:
            profilePayload.membership && profilePayload.membership.expireAt
              ? profilePayload.membership.expireAt
              : '',
          membershipSummary: hasActiveMembership
            ? '会员已开通，可完整播放并使用下载权益。'
            : '当前为普通用户，可开通会员或单独解锁。'
        },
        cartCount: cartPayload.cart.totalCount || 0
      });
    } catch (error) {
      this.setData({
        loading: false,
        pageReady: false,
        errorTitle: '会员中心暂不可用',
        errorMessage: error.message === 'NETWORK_ERROR' ? '请先启动本地服务端。' : '请稍后再试。'
      });
    }
  },

  async payRightsOrder(order, idempotencyKey) {
    const result = await payPendingOrder(order, { idempotencyKey });
    return result.order;
  },

  async purchasePlan(event) {
    const { planId } = event.currentTarget.dataset;
    const idempotencyKey = randomKey('membership');

    try {
      const created = await request({
        url: '/api/member/purchase',
        method: 'POST',
        data: {
          planId,
          clientRequestId: idempotencyKey
        }
      });
      await this.payRightsOrder(created.order, idempotencyKey);
      wx.showToast({
        title: '会员已开通',
        icon: 'none'
      });
      this.loadPage();
    } catch (error) {
      wx.showToast({
        title: isPaymentCancelled(error) ? '已取消支付' : '开通失败',
        icon: 'none'
      });
    }
  },

  async unlockTrack(event) {
    const { trackId } = event.currentTarget.dataset;
    const idempotencyKey = randomKey('track');

    try {
      const created = await request({
        url: `/api/tracks/${trackId}/unlock`,
        method: 'POST',
        data: {
          action: 'purchase',
          clientRequestId: idempotencyKey
        }
      });
      if (created.paymentRequired && created.order) {
        await this.payRightsOrder(created.order, idempotencyKey);
      }
      wx.showToast({
        title: '已解锁下载权益',
        icon: 'none'
      });
      this.loadPage();
    } catch (error) {
      wx.showToast({
        title: isPaymentCancelled(error) ? '已取消支付' : '解锁失败',
        icon: 'none'
      });
    }
  },

  async downloadTrack(event) {
    const { trackId } = event.currentTarget.dataset;

    try {
      const payload = await request({
        url: `/api/downloads/${trackId}/sign`,
        method: 'POST'
      });

      wx.downloadFile({
        url: payload.absoluteUrl,
        success: (result) => {
          wx.showModal({
            title: '下载已完成',
            content: result.tempFilePath || '音频已缓存到临时目录。',
            showCancel: false
          });
          this.loadPage();
        },
        fail: () => {
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      });
    } catch (error) {
      wx.showToast({
        title: '请先解锁权益',
        icon: 'none'
      });
    }
  },

  openTrack(event) {
    const { trackId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/melody/index?trackId=${trackId}&scope=member`
    });
  }
});
