const { request } = require('../../utils/api');
const { getCurrentExperience } = require('../../utils/session');
const { isPaymentCancelled, payPendingOrder, randomKey } = require('../../utils/payment');

const UI_DEFAULT_CURRENT = '00:00';
const UI_DEFAULT_DURATION = '00:00';
const UI_DEFAULT_PROGRESS = 0;

function trackGateMessage(track) {
  if (!track || !track.access || track.access.canPlayFull) {
    return '';
  }

  return `当前为试听模式，可播放 ${track.access.previewSeconds || 12} 秒。开通会员或解锁曲目后可完整播放与下载。`;
}

Page({
  data: {
    ready: false,
    wine: null,
    tracks: [],
    currentTrack: null,
    currentTrackIndex: 0,
    isPlaying: false,
    currentTimeLabel: UI_DEFAULT_CURRENT,
    durationLabel: UI_DEFAULT_DURATION,
    progress: UI_DEFAULT_PROGRESS,
    gateMessage: '',
    errorTitle: '',
    errorMessage: ''
  },

  onLoad(query) {
    this.trackId = query.trackId || '';
    this.entryScope = query.scope || (this.trackId ? 'public' : 'exclusive');
    this.setData({
      entryScope: this.entryScope
    });
  },

  onShow() {
    this.unsubscribePlayer = getApp().subscribePlayer((state) => {
      this.applyPlayerState(state);
    });
    this.loadContext();
  },

  onHide() {
    this.teardownPlayerSubscription();
  },

  onUnload() {
    this.teardownPlayerSubscription();
  },

  teardownPlayerSubscription() {
    if (this.unsubscribePlayer) {
      this.unsubscribePlayer();
      this.unsubscribePlayer = null;
    }
  },

  applyPlayerState(state) {
    if (!state || !state.tracks || !state.tracks.length) {
      return;
    }

    this.setData({
      tracks: state.tracks,
      currentTrack: state.currentTrack,
      currentTrackIndex: state.currentTrackIndex,
      isPlaying: state.isPlaying,
      currentTimeLabel: state.currentTimeLabel || UI_DEFAULT_CURRENT,
      durationLabel: state.durationLabel || UI_DEFAULT_DURATION,
      progress: state.progress || UI_DEFAULT_PROGRESS,
      gateMessage: trackGateMessage(state.currentTrack)
    });

    if (state.errorMessage) {
      this.setData({
        ready: false,
        errorTitle: '音频资源加载失败',
        errorMessage: state.errorMessage
      });
    }
  },

  async loadContext() {
    try {
      let experience = null;
      let currentTrackIndex = 0;

      if (this.trackId) {
        const profile = await request({ url: '/api/member/profile' });
        const currentTrack = (profile.library || []).find((item) => item.id === this.trackId);

        if (!currentTrack) {
          throw new Error('TRACK_NOT_FOUND');
        }

        const payload = await request({
          url: `/api/wines/${currentTrack.wineId}/experience`
        });
        experience = payload.experience;
      } else {
        experience = getCurrentExperience();
      }

      if (!experience || !experience.tracks || !experience.tracks.length) {
        this.setData({
          ready: false,
          errorTitle: '当前没有可播放曲目',
          errorMessage: '请从专属页或会员中心重新进入。'
        });
        return;
      }

      if (this.trackId) {
        currentTrackIndex = Math.max(
          0,
          experience.tracks.findIndex((item) => item.id === this.trackId)
        );
      }

      this.setData({
        ready: true,
        wine: experience.wine,
        errorTitle: '',
        errorMessage: ''
      });

      getApp().startExperiencePlayback(experience, {
        index: currentTrackIndex,
        autoplay: this.entryScope === 'exclusive',
        preserve: this.entryScope === 'exclusive'
      });
      this.applyPlayerState(getApp().getPlayerState());
    } catch (error) {
      this.setData({
        ready: false,
        errorTitle: '配乐页暂不可用',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? '网络连接不可用，请确认连接后重试。'
            : '当前会话已失效，请重新进入。'
      });
    }
  },

  togglePlayback() {
    getApp().togglePlayerPlayback();
  },

  playByIndex(index) {
    getApp().playPlayerByIndex(index, true);
  },

  selectTrack(event) {
    this.playByIndex(event.currentTarget.dataset.index);
  },

  playPrev() {
    getApp().playPlayerPrev(true);
  },

  playNext() {
    getApp().playPlayerNext(true);
  },

  async unlockCurrentTrack() {
    if (!this.data.currentTrack) {
      return;
    }

    const idempotencyKey = randomKey('track');

    try {
      const created = await request({
        url: `/api/tracks/${this.data.currentTrack.id}/unlock`,
        method: 'POST',
        data: {
          action: 'purchase',
          clientRequestId: idempotencyKey
        }
      });

      if (created.paymentRequired && created.order) {
        await payPendingOrder(created.order, { idempotencyKey });
      }

      wx.showToast({
        title: '已解锁完整播放与下载',
        icon: 'none'
      });
      this.loadContext();
    } catch (error) {
      wx.showToast({
        title: isPaymentCancelled(error) ? '已取消支付' : '解锁失败',
        icon: 'none'
      });
    }
  },

  openMember() {
    wx.navigateTo({ url: '/pages/member/index' });
  },

  openDetail() {
    if (this.entryScope === 'exclusive') {
      wx.redirectTo({ url: '/pages/detail/index' });
      return;
    }

    if (this.data.wine && this.data.wine.id) {
      wx.navigateTo({
        url: `/pages/detail/index?wineId=${this.data.wine.id}&scope=public`
      });
    }
  }
});
