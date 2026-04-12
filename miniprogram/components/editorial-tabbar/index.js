Component({
  properties: {
    active: {
      type: String,
      value: 'cellar'
    }
  },

  methods: {
    switchView(event) {
      const { key, url } = event.currentTarget.dataset;
      if (key === this.properties.active) {
        return;
      }

      wx.redirectTo({ url });
    }
  }
});
