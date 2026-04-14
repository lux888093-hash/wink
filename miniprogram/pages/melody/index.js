const { request } = require('../../utils/api');
const { restoreExperience, getCurrentExperience } = require('../../utils/session');
const { formatSeconds } = require('../../utils/format');

let audioContext = null;
const DEFAULT_FEATURED_TRACK_ID = 'track_quiet_world';

Page({
  data: {
    ready: false,
    wine: null,
    tracks: [],
    currentTrack: null,
    currentTrackIndex: 0,
    isPlaying: false,
    currentTimeLabel: '00:00',
    durationLabel: '00:00',
    progress: 0,
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
    this.loadContext();
  },

  onHide() {
    if (audioContext) {
      audioContext.pause();
      this.setData({ isPlaying: false });
    }
  },

  onUnload() {
    this.destroyAudio();
  },

  async loadContext() {
    try {
      let experience = null;

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
        experience = getCurrentExperience() || (await restoreExperience());
      }

      if (!experience || !experience.tracks || !experience.tracks.length) {
        this.setData({
          ready: false,
          errorTitle: '当前没有可播放曲目',
          errorMessage: '请从专属页或会员中心重新进入。'
        });
        return;
      }

      const currentTrackIndex = this.trackId
        ? Math.max(
            0,
            experience.tracks.findIndex((item) => item.id === this.trackId)
          )
        : Math.max(
            0,
            experience.tracks.findIndex((item) => item.id === DEFAULT_FEATURED_TRACK_ID)
          );
      const currentTrack = experience.tracks[currentTrackIndex] || experience.tracks[0];

      this.setData({
        ready: true,
        wine: experience.wine,
        tracks: experience.tracks,
        currentTrackIndex,
        currentTrack,
        durationLabel: currentTrack.durationLabel || '00:00',
        gateMessage:
          currentTrack.access && !currentTrack.access.canPlayFull
            ? `普通用户试听 ${currentTrack.access.previewSeconds} 秒，解锁后可完整播放。`
            : '',
        errorTitle: '',
        errorMessage: ''
      });

      this.setupAudio(currentTrack);
    } catch (error) {
      this.setData({
        ready: false,
        errorTitle: '配乐页暂不可用',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? '本地服务端未启动。'
            : '当前会话已失效，请重新进入。'
      });
    }
  },

  destroyAudio() {
    if (!audioContext) {
      return;
    }

    audioContext.destroy();
    audioContext = null;
  },

  setupAudio(track, autoplay) {
    this.destroyAudio();
    this.previewStopped = false;

    audioContext = wx.createInnerAudioContext({
      useWebAudioImplement: false
    });

    audioContext.src = track.src;
    audioContext.loop = true;
    audioContext.obeyMuteSwitch = false;

    audioContext.onPlay(() => {
      this.setData({ isPlaying: true });
    });

    audioContext.onPause(() => {
      this.setData({ isPlaying: false });
    });

    audioContext.onStop(() => {
      this.setData({
        isPlaying: false,
        currentTimeLabel: '00:00',
        progress: 0
      });
    });

    audioContext.onTimeUpdate(() => {
      const duration = audioContext.duration || 0;
      const currentTime = audioContext.currentTime || 0;
      const safeDuration = duration > 0 ? duration : 0;
      const progress = safeDuration ? Math.min(100, (currentTime / safeDuration) * 100) : 0;
      const previewSeconds = track.access && track.access.previewSeconds;

      if (
        track.access &&
        !track.access.canPlayFull &&
        previewSeconds &&
        currentTime >= previewSeconds &&
        !this.previewStopped
      ) {
        this.previewStopped = true;
        audioContext.pause();
        wx.showToast({
          title: '试听已结束',
          icon: 'none'
        });
      }

      this.setData({
        currentTimeLabel: formatSeconds(currentTime),
        durationLabel: track.durationLabel || formatSeconds(duration),
        progress
      });
    });

    audioContext.onError(() => {
      this.setData({
        errorTitle: '音频资源加载失败',
        errorMessage: '请确认音频资源存在，或重新生成本地演示数据。',
        ready: false
      });
    });

    this.setData({
      currentTrack: track,
      currentTimeLabel: '00:00',
      durationLabel: track.durationLabel || '00:00',
      progress: 0,
      isPlaying: false,
      gateMessage:
        track.access && !track.access.canPlayFull
          ? `普通用户试听 ${track.access.previewSeconds} 秒，解锁后可完整播放。`
          : ''
    });

    if (autoplay) {
      audioContext.play();
    }
  },

  togglePlayback() {
    if (!audioContext || !this.data.currentTrack) {
      return;
    }

    if (this.data.isPlaying) {
      audioContext.pause();
      return;
    }

    audioContext.play();
  },

  playByIndex(index) {
    const targetIndex = Number(index);
    const track = this.data.tracks[targetIndex];

    if (!track) {
      return;
    }

    this.setData({
      currentTrackIndex: targetIndex
    });
    this.setupAudio(track, true);
  },

  selectTrack(event) {
    this.playByIndex(event.currentTarget.dataset.index);
  },

  playPrev() {
    if (!this.data.tracks.length) {
      return;
    }

    const nextIndex =
      (this.data.currentTrackIndex - 1 + this.data.tracks.length) % this.data.tracks.length;
    this.playByIndex(nextIndex);
  },

  playNext() {
    if (!this.data.tracks.length) {
      return;
    }

    const nextIndex = (this.data.currentTrackIndex + 1) % this.data.tracks.length;
    this.playByIndex(nextIndex);
  },

  async unlockCurrentTrack() {
    if (!this.data.currentTrack) {
      return;
    }

    try {
      await request({
        url: `/api/tracks/${this.data.currentTrack.id}/unlock`,
        method: 'POST',
        data: {
          action: 'purchase'
        }
      });
      wx.showToast({
        title: '已解锁完整播放与下载',
        icon: 'none'
      });
      this.loadContext();
    } catch (error) {
      wx.showToast({
        title: '解锁失败',
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
