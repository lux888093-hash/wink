Component({
  properties: {
    active: {
      type: String,
      value: 'home'
    },
    cartCount: {
      type: Number,
      value: 0,
      observer(value) {
        this.setData({
          badgeText: value > 99 ? '99+' : String(value || 0)
        });
      }
    }
  },

  data: {
    badgeText: '0'
  },

  methods: {
    switchView(event) {
      const { key, url } = event.currentTarget.dataset;
      if (key === this.properties.active) {
        return;
      }

      wx.reLaunch({ url });
    }
  }
});
