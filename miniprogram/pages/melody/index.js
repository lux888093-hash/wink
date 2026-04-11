const { restoreExperience, getCurrentExperience } = require('../../utils/session');
const { formatSeconds } = require('../../utils/format');

let audioContext = null;

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
    errorTitle: '',
    errorMessage: ''
  },

  onShow() {
    this.loadExperience();
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

  async loadExperience() {
    try {
      const experience = getCurrentExperience() || (await restoreExperience());

      if (!experience || !experience.tracks || !experience.tracks.length) {
        this.setData({
          ready: false,
          errorTitle: 'No pairing tracks available.',
          errorMessage: 'There are no pairing tracks available in this session.'
        });
        return;
      }

      const currentTrack = experience.tracks[this.data.currentTrackIndex] || experience.tracks[0];

      this.setData({
        ready: true,
        wine: experience.wine,
        tracks: experience.tracks,
        currentTrack,
        durationLabel: currentTrack.durationLabel || '00:00',
        errorTitle: '',
        errorMessage: ''
      });

      if (!audioContext) {
        this.setupAudio(currentTrack);
      }
    } catch (error) {
      this.setData({
        ready: false,
        errorTitle: 'Melody room unavailable.',
        errorMessage:
          error.message === 'NETWORK_ERROR'
            ? 'The local backend is not running.'
            : 'This session has expired. Re-enter from the scan page.'
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

    audioContext = wx.createInnerAudioContext({
      useWebAudioImplement: false
    });

    audioContext.src = track.src;
    audioContext.loop = true;
    audioContext.obeyMuteSwitch = false;

    audioContext.onCanplay(() => {
      this.setData({
        durationLabel: track.durationLabel || this.data.durationLabel
      });

      if (autoplay) {
        audioContext.play();
      }
    });

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

      this.setData({
        currentTimeLabel: formatSeconds(currentTime),
        durationLabel: track.durationLabel || formatSeconds(duration),
        progress
      });
    });

    audioContext.onError(() => {
      this.setData({
        errorTitle: 'Audio failed to load.',
        errorMessage: 'Check that the audio file exists, or regenerate the demo assets.',
        ready: false
      });
    });

    this.setData({
      currentTrack: track,
      currentTimeLabel: '00:00',
      durationLabel: track.durationLabel || '00:00',
      progress: 0,
      isPlaying: false
    });
  },

  togglePlayback() {
    if (!audioContext) {
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
  }
});
