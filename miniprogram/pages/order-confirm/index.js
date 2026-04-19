const { request } = require('../../utils/api');
const { isPaymentCancelled, payPendingOrder, randomKey } = require('../../utils/payment');

function mapDeliveryStatus(status) {
  return (
    {
      pending: '待确认',
      delivering: '待发货',
      completed: '已完成',
      rights_issued: '权益已发放',
      downloaded: '已下载',
      closed: '已关闭'
    }[status] || status || ''
  );
}

function normalizeOrder(order) {
  if (!order) {
    return order;
  }

  return {
    ...order,
    deliveryStatusLabel: mapDeliveryStatus(order.deliveryStatus)
  };
}

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

function maskMobile(mobile) {
  const text = String(mobile || '').trim();
  if (text.length < 7) {
    return text;
  }
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

function buildFallbackAddress() {
  return {
    id: '',
    contactName: '',
    mobile: '',
    provinceCity: '',
    detail: '',
    deliveryNote: '',
    maskedMobile: '',
    isDefault: false
  };
}

function enrichAddress(item = {}) {
  return {
    id: item.id || '',
    contactName: item.contactName || '',
    mobile: item.mobile || '',
    provinceCity: item.provinceCity || '',
    detail: item.detail || '',
    deliveryNote: item.deliveryNote || '',
    isDefault: Boolean(item.isDefault),
    maskedMobile: maskMobile(item.mobile)
  };
}

function splitDetail(detail) {
  const text = String(detail || '').trim();
  if (!text) {
    return {
      detail: '',
      houseNumber: ''
    };
  }

  const match = text.match(/^(.*?)[\s,，]+((?:\d|[A-Za-z一二三四五六七八九十甲乙丙丁]).*(?:栋|幢|座|号|室|层|单元).*)$/);
  if (match) {
    return {
      detail: match[1].trim(),
      houseNumber: match[2].trim()
    };
  }

  return {
    detail: text,
    houseNumber: ''
  };
}

function emptyAddressDraft(baseProvinceCity = '') {
  return {
    contactName: '',
    mobile: '',
    provinceCity: baseProvinceCity || '',
    detail: '',
    houseNumber: '',
    deliveryNote: ''
  };
}

Page({
  data: {
    loading: true,
    ready: false,
    cart: null,
    address: buildFallbackAddress(),
    hasRealAddress: false,
    addresses: [],
    activeAddressId: '',
    showAddressSheet: false,
    showAddressEditor: false,
    editingAddressId: '',
    addressDraft: emptyAddressDraft(''),
    addressEditorTitle: '新增收货地址',
    shippingFee: 10,
    packageFee: 2,
    goodsAmountText: '0.00',
    shippingFeeText: '10.00',
    packageFeeText: '2.00',
    payAmountText: '0.00',
    remarkText: '允许电话联系我；允许敲门/按门铃',
    saveAddress: true,
    savingAddress: false,
    submitting: false,
    successOrder: null,
    errorTitle: '',
    errorMessage: ''
  },

  onShow() {
    this.loadCart();
  },

  _syncAddressState(cart, rawAddresses = []) {
    const addresses = (rawAddresses || []).map(enrichAddress);
    const current =
      addresses.find((item) => item.isDefault) ||
      addresses[0] ||
      buildFallbackAddress();

    this.setData({
      cart,
      addresses,
      address: current,
      hasRealAddress: Boolean(current && current.id),
      activeAddressId: current.id || '',
      goodsAmountText: formatAmount(cart.totalAmount),
      shippingFeeText: formatAmount(this.data.shippingFee),
      packageFeeText: formatAmount(this.data.packageFee),
      payAmountText: formatAmount((cart.totalAmount || 0) + this.data.shippingFee + this.data.packageFee),
      remarkText: current.deliveryNote || '允许电话联系我；允许敲门/按门铃'
    });
  },

  async loadCart() {
    this.setData({ loading: true, errorTitle: '', errorMessage: '' });

    try {
      const cartPayload = await request({ url: '/api/cart' });
      let addressesPayload = { items: [] };

      try {
        addressesPayload = await request({ url: '/api/addresses' });
      } catch (addressError) {
        addressesPayload = { items: [] };
      }

      this.setData({
        loading: false,
        ready: true
      });
      this._syncAddressState(cartPayload.cart, addressesPayload.items || []);
    } catch (error) {
      this.setData({
        loading: false,
        ready: false,
        errorTitle: '订单页暂不可用',
        errorMessage: error.message === 'NETWORK_ERROR' ? '请先启动本地服务端。' : '购物袋数据读取失败。'
      });
    }
  },

  openAddressSheet() {
    this.setData({
      showAddressSheet: true,
      showAddressEditor: false,
      addressEditorTitle: '请选择收货地址'
    });
  },

  closeAddressSheet() {
    this.setData({
      showAddressSheet: false,
      showAddressEditor: false,
      editingAddressId: '',
      savingAddress: false
    });
  },

  openNewAddressEditor() {
    this.setData({
      showAddressSheet: true,
      showAddressEditor: true,
      editingAddressId: '',
      addressEditorTitle: '新增收货地址',
      addressDraft: emptyAddressDraft(this.data.hasRealAddress ? this.data.address.provinceCity : '')
    });
  },

  openEditAddress(event) {
    const { id } = event.currentTarget.dataset;
    const current = (this.data.addresses || []).find((item) => item.id === id) || this.data.address;
    if (!current) {
      return;
    }
    const detailParts = splitDetail(current.detail);

    this.setData({
      showAddressSheet: true,
      showAddressEditor: true,
      editingAddressId: current.id || '',
      addressEditorTitle: '编辑收货地址',
      addressDraft: {
        contactName: current.contactName || '',
        mobile: current.mobile || '',
        provinceCity: current.provinceCity || '',
        detail: detailParts.detail,
        houseNumber: detailParts.houseNumber,
        deliveryNote: current.deliveryNote || ''
      }
    });
  },

  closeAddressEditor() {
    this.setData({
      showAddressEditor: false,
      editingAddressId: '',
      savingAddress: false
    });
  },

  bindAddressInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) {
      return;
    }

    this.setData({
      [`addressDraft.${field}`]: event.detail.value
    });
  },

  useCurrentRegion() {
    if (!this.data.hasRealAddress) {
      return;
    }
    const provinceCity = this.data.address.provinceCity || '';
    const detail = this.data.address.detail || '';

    this.setData({
      'addressDraft.provinceCity': provinceCity,
      'addressDraft.detail': detail,
      'addressDraft.houseNumber': ''
    });
  },

  chooseAddress(event) {
    const { id } = event.currentTarget.dataset;
    const current = (this.data.addresses || []).find((item) => item.id === id);
    if (!current) {
      return;
    }

    this.setData({
      address: current,
      hasRealAddress: true,
      activeAddressId: current.id,
      remarkText: current.deliveryNote || '允许电话联系我；允许敲门/按门铃',
      showAddressSheet: false,
      showAddressEditor: false
    });
  },

  validateDraftAddress() {
    const address = this.data.addressDraft || {};
    if (!address.contactName || !address.mobile || !address.provinceCity || !address.detail) {
      wx.showToast({
        title: '请补全收货地址',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  async saveAddress() {
    if (!this.validateDraftAddress() || this.data.savingAddress) {
      return;
    }

    this.setData({ savingAddress: true });

    try {
      const detail = [this.data.addressDraft.detail, this.data.addressDraft.houseNumber]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .join(' ');
      const { houseNumber, ...draft } = this.data.addressDraft;
      const payload = {
        ...draft,
        detail,
        isDefault: true
      };
      const editingId = this.data.editingAddressId;
      const result = await request({
        url: editingId ? `/api/addresses/${editingId}` : '/api/addresses',
        method: editingId ? 'PUT' : 'POST',
        data: payload
      });
      const addresses = (result.items || []).map(enrichAddress);
      const current =
        addresses.find((item) => item.id === (result.item && result.item.id)) ||
        addresses.find((item) => item.isDefault) ||
        addresses[0] ||
        buildFallbackAddress();

      this.setData({
        addresses,
        address: current,
        hasRealAddress: true,
        activeAddressId: current.id || '',
        remarkText: current.deliveryNote || '允许电话联系我；允许敲门/按门铃',
        savingAddress: false,
        showAddressEditor: false,
        showAddressSheet: false,
        editingAddressId: ''
      });

      wx.showToast({
        title: '地址已保存',
        icon: 'success'
      });
    } catch (error) {
      this.setData({ savingAddress: false });
      wx.showToast({
        title: error.message === 'invalid_mobile' ? '手机号格式不正确' : '保存失败',
        icon: 'none'
      });
    }
  },

  validateAddress() {
    const address = this.data.address || {};
    const hasRequired = address.contactName && address.mobile && address.provinceCity && address.detail;
    const validMobile = /^[0-9+\-\s]{6,30}$/.test(address.mobile || '');

    if (!hasRequired || !validMobile || /请补充/.test(address.mobile || '') || /请补充/.test(address.detail || '')) {
      wx.showToast({
        title: '请先填写收货地址',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  async submitOrder() {
    if (!this.data.cart || !this.data.cart.items.length || this.data.submitting) {
      return;
    }

    if (!this.validateAddress()) {
      return;
    }

    this.setData({ submitting: true });

    try {
      const idempotencyKey = randomKey('order');
      const created = await request({
        url: '/api/orders',
        method: 'POST',
        data: {
          address: {
            contactName: this.data.address.contactName,
            mobile: this.data.address.mobile,
            provinceCity: this.data.address.provinceCity,
            detail: this.data.address.detail,
            deliveryNote: this.data.address.deliveryNote
          },
          saveAddress: this.data.saveAddress,
          clientRequestId: idempotencyKey
        }
      });
      getApp().setCartCount(created.cart.totalCount || 0);

      const paidPayload = await payPendingOrder(created.order, { idempotencyKey });
      const paidOrder = paidPayload.order;
      const nextCart = paidPayload.cart || { items: [], totalCount: 0, totalAmount: 0 };
      getApp().setCartCount(nextCart.totalCount || 0);

      this.setData({
        successOrder: normalizeOrder(paidOrder),
        cart: nextCart,
        goodsAmountText: formatAmount(nextCart.totalAmount),
        payAmountText: formatAmount((nextCart.totalAmount || 0) + this.data.shippingFee + this.data.packageFee),
        submitting: false
      });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({
        title:
          isPaymentCancelled(error)
            ? '已取消支付'
            : error.message === 'SKU_STOCK_NOT_ENOUGH'
              ? '库存不足'
              : error.message === 'WECHAT_AUTH_REQUIRED'
                ? '请先完成微信登录'
                : '下单失败',
        icon: 'none'
      });
    }
  }
});
