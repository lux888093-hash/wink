const TOKEN_STORAGE_KEY = 'hongjiu_admin_token';
const USER_STORAGE_KEY = 'hongjiu_admin_user';

function readPersistedUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

const state = {
  token: localStorage.getItem(TOKEN_STORAGE_KEY) || '',
  user: readPersistedUser(),
  health: null,
  dashboard: null,
  siteContent: null,
  wines: [],
  wineries: [],
  tracks: [],
  codes: [],
  orders: [],
  auditLogs: [],
  redeemFailLogs: [],
  fixedQrcode: null,
  activeView: 'overview',
  loading: false,
  lastLoadedAt: null,
  selectedWineId: '',
  selectedCodeId: '',
  selectedOrderId: '',
  selectedCodeIds: new Set(),
  codePage: 1,
  codePageSize: 20,
  filters: {
    wineSearch: '',
    wineStatus: 'all',
    codeSearch: '',
    codeStatus: 'all',
    codeWine: 'all',
    codeBatch: 'all',
    shippingSearch: '',
    shippingStatus: 'all'
  },
  drawer: {
    type: '',
    data: null
  },
  modal: {
    type: '',
    data: null,
    onConfirm: null
  },
  copyDraft: null,
  copyActivePage: 'home',
  copyDirty: false,
  copySaving: false
};

const viewMeta = {
  overview: {
    kicker: '鸿玖酒庄 · 运营中台',
    title: '运营概览',
    description: '查看酒款、提取码、发货与小程序文案状态。'
  },
  wines: {
    kicker: '鸿玖酒庄 · 酒款管理',
    title: '酒款管理',
    description: '卡片式列表、右侧编辑与图片管理放在同一屏。'
  },
  codes: {
    kicker: '鸿玖酒庄 · 提取码管理',
    title: '提取码管理',
    description: '控制生成、状态更新、导出与异常码处理。'
  },
  shipping: {
    kicker: '鸿玖酒庄 · 发货履约',
    title: '发货管理',
    description: '查看订单、同步物流、处理异常与发货记录。'
  },
  copy: {
    kicker: '鸿玖酒庄 · 小程序文案',
    title: '小程序文案',
    description: '编辑页面文案、预览手机效果并发布到小程序。'
  }
};

const viewPermissions = {
  overview: 'dashboard.read',
  wines: 'wines.read',
  codes: 'codes.read',
  shipping: 'orders.read',
  copy: 'wineries.read'
};

const STATUS_COPY = {
  active: '启用中',
  archived: '已归档',
  ready: '待使用',
  claimed: '已使用',
  expired: '已过期',
  disabled: '已停用',
  pending_payment: '待支付',
  paid: '已支付',
  completed: '已完成',
  refund_pending: '退款中',
  refunded: '已退款',
  pending: '待发货',
  delivering: '已发货',
  closed: '已关闭',
  downloaded: '已领取',
  rights_issued: '已发放',
  failed: '异常',
  synced: '已同步'
};

const REASON_COPY = {
  INVALID_FORMAT: '格式错误',
  CODE_NOT_FOUND: '提取码不存在',
  CODE_EXPIRED: '提取码过期',
  CODE_DISABLED: '提取码停用',
  CODE_ALREADY_USED: '提取码已使用'
};

const els = {
  loginOverlay: document.getElementById('login-overlay'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  loginUsername: document.getElementById('login-username'),
  loginPassword: document.getElementById('login-password'),
  navItems: [...document.querySelectorAll('.nav-item')],
  topbarKicker: document.getElementById('topbar-kicker'),
  viewTitle: document.getElementById('view-title'),
  viewDescription: document.getElementById('view-description'),
  sessionPill: document.getElementById('session-pill'),
  sidebarAvatar: document.getElementById('sidebar-avatar'),
  sidebarUser: document.getElementById('sidebar-user'),
  sidebarRole: document.getElementById('sidebar-role'),
  sidebarSession: document.getElementById('sidebar-session'),
  sidebarHealth: document.getElementById('sidebar-health'),
  topbarActions: document.getElementById('topbar-actions'),
  statusBanner: document.getElementById('status-banner'),
  pages: {
    overview: document.getElementById('page-overview'),
    wines: document.getElementById('page-wines'),
    codes: document.getElementById('page-codes'),
    shipping: document.getElementById('page-shipping'),
    copy: document.getElementById('page-copy')
  }
  ,
  drawerLayer: document.getElementById('drawer-layer'),
  drawerPanel: document.getElementById('drawer-panel'),
  modalLayer: document.getElementById('modal-layer'),
  modalPanel: document.getElementById('modal-panel'),
  toastHost: document.getElementById('toast-host')
};

let statusTimer = 0;
let toastSeq = 0;
let sessionClockTimer = 0;

function can(permission) {
  if (!permission || !state.user || !Array.isArray(state.user.permissions) || !state.user.permissions.length) {
    return true;
  }

  return state.user.permissions.some((allowed) => {
    if (allowed === '*') {
      return true;
    }
    if (allowed === permission) {
      return true;
    }
    if (allowed.endsWith('.*')) {
      const prefix = allowed.slice(0, -2);
      return permission === prefix || permission.startsWith(`${prefix}.`);
    }
    return false;
  });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { 'x-admin-token': state.token } : {})
    },
    ...options
  });

  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.code || `HTTP_${response.status}`);
    error.status = response.status;
    error.meta = payload.meta || null;
    error.requestId = payload.requestId || '';
    throw error;
  }

  return payload;
}

async function maybeApi(permission, url, fallback) {
  if (!can(permission)) {
    return fallback;
  }

  try {
    return await api(url);
  } catch (error) {
    if (error.message === 'ADMIN_UNAUTHORIZED') {
      throw error;
    }
    return fallback;
  }
}

function rememberSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function clearSession() {
  state.token = '';
  state.user = null;
  state.fixedQrcode = null;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeSelector(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(String(value));
  }

  return String(value).replace(/["\\]/g, '\\$&');
}

function showStatus(message, tone = 'success') {
  window.clearTimeout(statusTimer);
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-banner is-visible is-${tone}`;
  statusTimer = window.setTimeout(() => {
    els.statusBanner.textContent = '';
    els.statusBanner.className = 'status-banner';
  }, 2800);
}

function showToast(message, tone = 'success') {
  if (!els.toastHost) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${tone}`;
  toast.dataset.toastId = `toast-${++toastSeq}`;
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icon(tone === 'error' ? 'alert' : tone === 'warning' ? 'clock' : 'check')}</span>
    <span class="toast-copy">${escapeHtml(message)}</span>
  `;
  els.toastHost.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 220);
  }, 2600);
}

function getErrorMessage(error) {
  const messages = {
    ADMIN_LOGIN_FAILED: '账号或密码错误。',
    ADMIN_UNAUTHORIZED: '登录态已失效，请重新登录。',
    LOGIN_RATE_LIMITED: '登录过于频繁，请稍后再试。',
    WRITE_RATE_LIMITED: '操作过于频繁，请稍后再试。',
    INVALID_INPUT: '提交内容未通过校验，请检查后重试。',
    UPLOAD_IMAGE_INVALID: '图片文件读取失败，请重新选择。',
    UPLOAD_IMAGE_TYPE_UNSUPPORTED: '仅支持 JPG、PNG、WebP、GIF 图片。',
    UPLOAD_IMAGE_TOO_LARGE: '图片过大，请压缩到 8MB 以内。',
    WINE_NOT_FOUND: '酒款不存在，可能已被其他人处理。',
    WINERY_NOT_FOUND: '酒庄不存在，请刷新后重试。',
    TRACK_NOT_FOUND: '暂无可用音乐资料。',
    TRACK_WINE_MISMATCH: '提取码与酒款信息不匹配。',
    CODE_NOT_FOUND: '提取码不存在。',
    BATCH_NO_EXISTS: '批次号已存在，请重新输入。',
    WECHAT_CREDENTIALS_REQUIRED: '缺少微信 AppID 或 AppSecret，暂不能生成入口码。',
    WECHAT_PAY_DISABLED: '微信支付未配置，暂不能执行该操作。',
    WECHAT_PAY_DISABLED_IN_DEVELOPMENT: '开发环境未开启微信支付能力。',
    ORDER_NOT_FOUND: '订单不存在。',
    ORDER_NOT_PHYSICAL: '当前订单不是实物订单。',
    ORDER_NOT_SHIPPABLE: '当前订单暂不支持发货。',
    ORDER_NOT_REFUNDABLE: '当前订单暂不支持退款。',
    ADMIN_FORBIDDEN: '当前账号无权限执行该操作。'
  };

  if (error && error.meta && error.meta.field && error.message === 'INVALID_INPUT') {
    return messages.INVALID_INPUT;
  }

  return messages[error.message] || error.message || '操作未完成，请稍后重试。';
}

async function runTask(task, successMessage, options = {}) {
  try {
    const result = await task();
    if (successMessage) {
      showToast(successMessage, 'success');
    }
    return result;
  } catch (error) {
    if (error.message === 'ADMIN_UNAUTHORIZED') {
      clearSession();
      toggleLogin(true);
    }
    showToast(getErrorMessage(error), 'error');
    if (options.rethrow) {
      throw error;
    }
    return null;
  }
}

function toggleLogin(visible) {
  if (!els.loginOverlay) {
    return;
  }

  els.loginOverlay.classList.toggle('is-hidden', !visible);
  els.loginOverlay.hidden = !visible;
}

function updateSessionPill() {
  const displayName = (state.user && state.user.displayName) || '未登录';
  const roleName = (state.user && state.user.roleName) || '未登录';
  const sessionLabel = state.user ? `${state.user.username || 'admin'} · ${roleName}` : '未登录';
  const nowLabel = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
  const onlineLabel = state.user ? `当前时间 · ${nowLabel}` : '离线';

  if (els.sessionPill) {
    els.sessionPill.hidden = !state.user;
    els.sessionPill.textContent = onlineLabel;
    els.sessionPill.title = state.lastLoadedAt ? `最近刷新 ${formatShortDate(state.lastLoadedAt)}` : '';
  }

  if (els.sidebarUser) {
    els.sidebarUser.textContent = displayName;
  }

  if (els.sidebarRole) {
    els.sidebarRole.textContent = roleName;
  }

  if (els.sidebarAvatar) {
    els.sidebarAvatar.textContent = (displayName || 'A').slice(0, 1);
  }

  if (els.sidebarSession) {
    els.sidebarSession.textContent = sessionLabel;
  }

  if (els.sidebarHealth) {
    const env = (state.health && state.health.env) || 'local';
    const redis = state.health && state.health.capabilities && state.health.capabilities.redis;
    els.sidebarHealth.textContent = redis ? `${env} · 在线` : `${env} · 连接中`;
  }
}

function startSessionClock() {
  if (sessionClockTimer) {
    window.clearInterval(sessionClockTimer);
  }
  sessionClockTimer = window.setInterval(() => {
    if (state.user) {
      updateSessionPill();
    }
  }, 30000);
}

function getFirstAllowedView() {
  return Object.keys(viewMeta).find((view) => can(viewPermissions[view])) || 'overview';
}

function updatePermissionUi() {
  els.navItems.forEach((item) => {
    if (!item.dataset.view) {
      return;
    }
    const allowed = can(viewPermissions[item.dataset.view]);
    item.hidden = !allowed;
    item.disabled = !allowed;
  });

  if (!can(viewPermissions[state.activeView])) {
    state.activeView = getFirstAllowedView();
  }
}

function setView(view) {
  if (!can(viewPermissions[view])) {
    return;
  }

  closeDrawer();
  closeModal();

  state.activeView = view;
  const meta = viewMeta[view];
  document.title = `${meta.title} · 鸿玖酒庄运营台`;
  if (els.topbarKicker) {
    els.topbarKicker.textContent = meta.kicker || '鸿玖酒庄 · 运营中台';
  }
  els.viewTitle.textContent = meta.title;
  els.viewDescription.textContent = meta.description;

  els.navItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === view);
    item.setAttribute('aria-current', item.dataset.view === view ? 'page' : 'false');
  });

  Object.entries(els.pages).forEach(([key, node]) => {
    node.classList.toggle('is-active', key === view);
  });

  renderTopbarActions();
}

function formatDateTime(value) {
  if (!value) {
    return '未记录';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未记录';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function formatDate(value) {
  if (!value) {
    return '未设置';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未设置';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function formatShortDate(value) {
  if (!value) {
    return '未设置';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未设置';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function getStatusTone(status) {
  const normalized = String(status || '').trim();
  if (['ready', 'claimed', 'paid', 'completed', 'delivering', 'synced', 'active', 'downloaded', 'rights_issued'].includes(normalized)) {
    return 'success';
  }
  if (['expired', 'pending', 'pending_payment', 'refund_pending'].includes(normalized)) {
    return 'warning';
  }
  if (['disabled', 'archived', 'closed', 'refunded'].includes(normalized)) {
    return 'neutral';
  }
  if (['failed'].includes(normalized)) {
    return 'danger';
  }
  return 'brand';
}

function renderStatusPill(status) {
  const tone = getStatusTone(status);
  return `<span class="status-pill status-pill--${tone}"><span class="status-pill-dot"></span><span>${escapeHtml(STATUS_COPY[status] || status || '未知')}</span></span>`;
}

function renderImagePreview(src, alt) {
  const normalized = String(src || '').trim();
  if (!normalized) {
    return `
      <div class="image-preview-empty">
        <span class="image-preview-icon" aria-hidden="true">${icon('image')}</span>
        <span>暂无图片</span>
      </div>
    `;
  }

  return `<img class="image-preview-img" src="${escapeHtml(normalized)}" alt="${escapeHtml(alt || 'preview')}" />`;
}

function renderWineVisual(src, alt, fallbackLabel = '酒款', className = 'wine-card-placeholder') {
  const normalized = String(src || '').trim();
  if (normalized) {
    return `<img src="${escapeHtml(normalized)}" alt="${escapeHtml(alt || fallbackLabel)}" />`;
  }

  return `
    <div class="${escapeHtml(className)}" aria-hidden="true">
      ${icon('wine', 24)}
      <span>${escapeHtml(String(fallbackLabel || '酒款').slice(0, 2))}</span>
    </div>
  `;
}

function renderImageField({ label, name, value = '', folder = 'wines', placeholder = '' }) {
  return `
    <label class="image-field">
      <span class="field-label">${escapeHtml(label)}</span>
      <div class="image-field-body">
        <div class="image-preview-slot">${renderImagePreview(value, label)}</div>
        <div class="image-field-controls">
          <label class="field">
            <span class="field-label field-label--sm">图片地址</span>
            <input
              class="input"
              name="${escapeHtml(name)}"
              value="${escapeHtml(value || '')}"
              placeholder="${escapeHtml(placeholder || '')}"
              data-image-source="true"
            />
          </label>
          <div class="field-actions">
            <button class="button button--secondary button--sm" type="button" data-action="pick-upload" data-upload-target="${escapeHtml(name)}">
              <span class="button-icon">${icon('upload')}</span>
              <span>上传</span>
            </button>
            <button class="button button--ghost button--sm" type="button" data-action="clear-image" data-target-field="${escapeHtml(name)}">
              <span class="button-icon">${icon('close')}</span>
              <span>清空</span>
            </button>
          </div>
          <input
            class="upload-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            data-upload-target="${escapeHtml(name)}"
            data-upload-folder="${escapeHtml(folder)}"
          />
        </div>
      </div>
    </label>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

async function uploadImageAsset(file, folder) {
  const dataUrl = await readFileAsDataUrl(file);
  return api('/api/admin/uploads/image', {
    method: 'POST',
    body: JSON.stringify({
      folder,
      filename: file.name,
      mimeType: file.type,
      dataUrl
    })
  });
}

function getCodeSummary(items = state.codes) {
  return items.reduce(
    (summary, code) => {
      const status = code.status || 'ready';
      summary.total += 1;
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    },
    { total: 0, ready: 0, claimed: 0, expired: 0, disabled: 0 }
  );
}

function renderCodeStatusOptions(currentStatus) {
  const normalizedStatus = currentStatus || 'ready';
  return ['ready', 'claimed', 'expired', 'disabled']
    .map(
      (status) =>
        `<option value="${status}" ${normalizedStatus === status ? 'selected' : ''}>${escapeHtml(STATUS_COPY[status])}</option>`
    )
    .join('');
}

function getCodeStatusGuide(status) {
  const guides = {
    ready: {
      title: '待使用',
      body: '该提取码可正常核销，适合新发放或恢复可用状态。'
    },
    claimed: {
      title: '已使用',
      body: '适合补录人工核销结果。更新后会作为已完成使用记录展示。'
    },
    expired: {
      title: '已过期',
      body: '过期状态会阻止后续核销，建议仅在确认失效后更新。'
    },
    disabled: {
      title: '已停用',
      body: '停用会立即阻止扫码使用，适合异常码、作废码或风控处理。'
    }
  };
  return guides[status] || guides.ready;
}

function getCodeStatusImpacts(status) {
  const impacts = {
    ready: [
      { label: '扫码结果', value: '可正常核销' },
      { label: '用户侧反馈', value: '展示可用入口' },
      { label: '统计归类', value: '计入待使用' }
    ],
    claimed: [
      { label: '扫码结果', value: '视为已完成使用' },
      { label: '用户侧反馈', value: '不再重复核销' },
      { label: '统计归类', value: '计入已使用' }
    ],
    expired: [
      { label: '扫码结果', value: '阻止继续核销' },
      { label: '用户侧反馈', value: '提示已过期' },
      { label: '统计归类', value: '计入已过期' }
    ],
    disabled: [
      { label: '扫码结果', value: '立即停用入口' },
      { label: '用户侧反馈', value: '提示不可使用' },
      { label: '统计归类', value: '计入停用 / 作废' }
    ]
  };
  return impacts[status] || impacts.ready;
}

function renderCodeStatusNote(status) {
  const guide = getCodeStatusGuide(status);
  return `
    <strong>${escapeHtml(guide.title)}</strong>
    <p>${escapeHtml(guide.body)}</p>
    <div class="action-well-list">
      ${getCodeStatusImpacts(status)
        .map(
          (item) => `
            <div class="action-well-list-row">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function getCodePagination(items) {
  const pageSize = Number(state.codePageSize) || 20;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  state.codePage = Math.min(Math.max(state.codePage, 1), totalPages);

  const start = (state.codePage - 1) * pageSize;
  const end = start + pageSize;
  return {
    pageSize,
    totalItems,
    totalPages,
    page: state.codePage,
    items: items.slice(start, end)
  };
}

function getPaginationTokens(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

function getMaskedUserId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '未使用';
  }

  return normalized.length > 7 ? `${normalized.slice(0, 5)}****${normalized.slice(-4)}` : normalized;
}

function getShortCode(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '空值';
  }

  return normalized.length > 10 ? `${normalized.slice(0, 4)}...${normalized.slice(-4)}` : normalized;
}

function copyText(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return Promise.reject(new Error('EMPTY_COPY'));
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(normalized);
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('textarea');
    input.value = normalized;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();

    try {
      const copied = document.execCommand('copy');
      document.body.removeChild(input);
      if (!copied) {
        reject(new Error('COPY_FAILED'));
        return;
      }
      resolve();
    } catch (error) {
      document.body.removeChild(input);
      reject(error);
    }
  });
}

function enrichWine(wine) {
  const relatedCodes = state.codes.filter((code) => code.wineId === wine.id);
  const claimed = relatedCodes.filter((code) => code.status === 'claimed').length;
  const ready = relatedCodes.filter((code) => code.status === 'ready').length;
  const lastUsedAt = relatedCodes
    .map((code) => code.firstUsedAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

  return {
    ...wine,
    codeTotal: relatedCodes.length,
    claimedCodeTotal: claimed,
    readyCodeTotal: ready,
    lastUsedAt: lastUsedAt || ''
  };
}

function sortWines(items) {
  return [...items].sort((left, right) => {
    if ((left.status || 'active') !== (right.status || 'active')) {
      return (left.status || 'active') === 'active' ? -1 : 1;
    }

    if ((right.codeTotal || 0) !== (left.codeTotal || 0)) {
      return (right.codeTotal || 0) - (left.codeTotal || 0);
    }

    return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN');
  });
}

function getEnrichedWines() {
  return sortWines(state.wines.map(enrichWine));
}

function matchesText(haystack, query) {
  return String(haystack || '').toLowerCase().includes(String(query || '').trim().toLowerCase());
}

function getFilteredWines(items = getEnrichedWines()) {
  return items.filter((wine) => {
    const matchesStatus = state.filters.wineStatus === 'all' || (wine.status || 'active') === state.filters.wineStatus;
    const matchesQuery =
      !state.filters.wineSearch ||
      [
        wine.name,
        wine.title,
        wine.subtitle,
        wine.vintage,
        wine.region,
        wine.overview,
        wine.story,
        wine.quote
      ].some((field) => matchesText(field, state.filters.wineSearch));

    return matchesStatus && matchesQuery;
  });
}

function ensureSelectedWine() {
  const allWines = getEnrichedWines();
  if (!allWines.length) {
    state.selectedWineId = '';
    return null;
  }

  const filtered = getFilteredWines(allWines);
  const preferredPool = filtered.length ? filtered : allWines;
  if (!preferredPool.some((wine) => wine.id === state.selectedWineId)) {
    state.selectedWineId = preferredPool[0].id;
  }

  return allWines.find((wine) => wine.id === state.selectedWineId) || allWines[0];
}

function getFilteredCodes() {
  return [...state.codes]
    .filter((code) => {
      const matchesStatus = state.filters.codeStatus === 'all' || (code.status || 'ready') === state.filters.codeStatus;
      const matchesWine = state.filters.codeWine === 'all' || code.wineId === state.filters.codeWine;
      const matchesQuery =
        !state.filters.codeSearch ||
        [
          code.redeemCode,
          code.batchNo,
          code.firstUserId,
          code.wine && code.wine.name,
          code.wine && code.wine.subtitle
        ].some((field) => matchesText(field, state.filters.codeSearch));

      return matchesStatus && matchesWine && matchesQuery;
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function getFixedWinery() {
  return state.wineries[0] || null;
}

function getFixedTrack() {
  return state.tracks[0] || null;
}

function getIncompleteWines(items = getEnrichedWines()) {
  return items.filter(
    (wine) =>
      !wine.overview ||
      String(wine.overview).includes('待补充') ||
      String(wine.story || '').includes('待补充') ||
      String(wine.quote || '').includes('待补充')
  );
}

function showDialog(dialog) {
  if (!dialog || dialog.hasAttribute('open')) {
    return;
  }

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', 'open');
  }
}

function hideDialog(dialog) {
  if (!dialog || !dialog.hasAttribute('open')) {
    return;
  }

  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

function openOverviewDetailDialog(title, html) {
  if (!els.overviewDetailDialog || !els.overviewDetailTitle || !els.overviewDetailBody) {
    return;
  }

  els.overviewDetailTitle.textContent = title;
  els.overviewDetailBody.innerHTML = html;
  showDialog(els.overviewDetailDialog);
}

function closeOverviewDetailDialog() {
  hideDialog(els.overviewDetailDialog);
}

function openWineEditorDialog() {
  if (!els.wineEditorDialog) {
    return;
  }

  showDialog(els.wineEditorDialog);
}

function closeWineEditorDialog() {
  hideDialog(els.wineEditorDialog);
}

function openCreateWineDialog() {
  if (!els.createWineDialog) {
    return;
  }

  els.createWineForm.reset();
  showDialog(els.createWineDialog);
}

function closeCreateWineDialog() {
  hideDialog(els.createWineDialog);
}

function openBatchDialog() {
  showDialog(els.batchDialog);
}

function closeBatchDialog() {
  hideDialog(els.batchDialog);
}

function openFixedDialog() {
  showDialog(els.fixedDialog);
}

function closeFixedDialog() {
  hideDialog(els.fixedDialog);
}

function openFailLogsDialog() {
  showDialog(els.failLogsDialog);
}

function closeFailLogsDialog() {
  hideDialog(els.failLogsDialog);
}

function renderOverview() {
  const wines = getEnrichedWines();
  const dashboard = state.dashboard || {};
  const metrics = dashboard.metrics || {};
  const incompleteWines = getIncompleteWines(wines).slice(0, 4);
  const winery = getFixedWinery();
  const track = getFixedTrack();
  const recentOrders = (dashboard.recentOrders || []).filter(Boolean).slice(0, 5);
  const hotProducts = (dashboard.hotProducts || []).filter(Boolean).slice(0, 3);
  const summaryCards = (dashboard.cards || []).slice(0, 3);
  const heroImage = (winery && winery.heroImage) || '/assets/images/village-ancient-vine-sign.jpg';
  const pendingCount = incompleteWines.length + state.redeemFailLogs.length;
  const detailCards = [
    {
      type: 'pending',
      label: '待处理',
      value: formatNumber(pendingCount),
      copy: '资料与验证异常'
    },
    {
      type: 'orders',
      label: '订单',
      value: formatNumber(recentOrders.length),
      copy: '查看最新成交'
    },
    {
      type: 'products',
      label: '商品',
      value: formatNumber(hotProducts.length),
      copy: '查看主推礼盒'
    },
    {
      type: 'brand',
      label: '品牌',
      value: formatNumber(wines.length),
      copy: '酒庄、音乐、会员'
    }
  ];

  els.overviewCanvas.innerHTML = `
    <div class="overview-shell overview-shell-compact">
      <section class="surface overview-stage">
        <div class="overview-stage-copy">
          <span class="overview-stage-label">概览</span>
          <h3 class="overview-stage-title">先处理待办，再看订单、商品和品牌。</h3>
          <div class="overview-stage-actions">
            <button class="primary-button" type="button" data-view-target="codes">提取码</button>
            <button class="outline-button" type="button" data-view-target="wines">酒款</button>
          </div>
          <div class="overview-stage-metrics">
            ${
              summaryCards.length
                ? summaryCards
                    .map(
                      (card) => `
                        <article class="overview-stage-metric">
                          <span>${escapeHtml(card.label || '')}</span>
                          <strong>${escapeHtml(card.value || '--')}</strong>
                        </article>
                      `
                    )
                    .join('')
                : `
                  <article class="overview-stage-metric">
                    <span>订单转化</span>
                    <strong>${escapeHtml(`${metrics.orderRate || 0}%`)}</strong>
                  </article>
                  <article class="overview-stage-metric">
                    <span>会员转化</span>
                    <strong>${escapeHtml(`${metrics.memberRate || 0}%`)}</strong>
                  </article>
                  <article class="overview-stage-metric">
                    <span>24h 下载</span>
                    <strong>${escapeHtml(formatNumber(metrics.downloads24h || 0))}</strong>
                  </article>
                `
            }
          </div>
        </div>
        <button class="overview-stage-brand" type="button" data-overview-detail="brand">
          <img class="overview-stage-image" src="${escapeHtml(heroImage)}" alt="${escapeHtml((winery && winery.name) || '酒庄场景')}" />
          <div class="overview-stage-brand-copy">
            <span>${escapeHtml((winery && winery.tagline) || '酒庄')}</span>
            <strong>${escapeHtml((winery && winery.name) || '未设置')}</strong>
            <em>${escapeHtml((track && (track.cnTitle || track.title)) || '查看资料')}</em>
          </div>
        </button>
      </section>

      <section class="overview-launch-grid">
        ${detailCards
          .map(
            (card) => `
              <button class="surface overview-launch-card" type="button" data-overview-detail="${escapeHtml(card.type)}">
                <span class="overview-launch-label">${escapeHtml(card.label)}</span>
                <strong class="overview-launch-value">${escapeHtml(card.value)}</strong>
                <span class="overview-launch-copy">${escapeHtml(card.copy)}</span>
                <em class="overview-launch-cta">查看</em>
              </button>
            `
          )
          .join('')}
      </section>
    </div>
  `;
}

function renderOverviewDetail(type) {
  const wines = getEnrichedWines();
  const dashboard = state.dashboard || {};
  const metrics = dashboard.metrics || {};
  const codeSummary = dashboard.codeSummary || getCodeSummary();
  const recentOrders = (dashboard.recentOrders || []).filter(Boolean);
  const hotProducts = (dashboard.hotProducts || []).filter(Boolean);
  const incompleteWines = getIncompleteWines(wines);
  const winery = getFixedWinery();
  const track = getFixedTrack();
  const deliveryStatusCopy = {
    delivering: '配送中',
    shipped: '已发货',
    completed: '已完成',
    paid: '已支付'
  };

  if (type === 'pending') {
    openOverviewDetailDialog(
      '待处理',
      `
        <div class="overview-detail-stack">
          <section class="overview-detail-section">
            <h4>待补资料</h4>
            ${
              incompleteWines.length
                ? incompleteWines
                    .map(
                      (wine) => `
                        <button class="overview-detail-row" type="button" data-view-target="wines" data-wine-id="${escapeHtml(wine.id)}" data-action="close-overview-detail">
                          <span>${escapeHtml(wine.name)}</span>
                          <span>待补资料</span>
                        </button>
                      `
                    )
                    .join('')
                : '<div class="overview-empty">当前没有待补资料</div>'
            }
          </section>
          <section class="overview-detail-section">
            <h4>验证异常</h4>
            ${
              state.redeemFailLogs.length
                ? state.redeemFailLogs
                    .slice(0, 8)
                    .map(
                      (log) => `
                        <button class="overview-detail-row" type="button" data-view-target="codes" data-action="close-overview-detail">
                          <span>${escapeHtml(getShortCode(log.code))}</span>
                          <span>${escapeHtml(REASON_COPY[log.reason] || '验证失败')}</span>
                        </button>
                      `
                    )
                    .join('')
                : '<div class="overview-empty">当前没有验证异常</div>'
            }
          </section>
          <section class="overview-detail-grid">
            <article><span>待使用</span><strong>${escapeHtml(formatNumber(codeSummary.ready || 0))}</strong></article>
            <article><span>已使用</span><strong>${escapeHtml(formatNumber(codeSummary.claimed || 0))}</strong></article>
            <article><span>停用</span><strong>${escapeHtml(formatNumber(codeSummary.disabled || 0))}</strong></article>
            <article><span>过期</span><strong>${escapeHtml(formatNumber(codeSummary.expired || 0))}</strong></article>
          </section>
        </div>
      `
    );
    return;
  }

  if (type === 'orders') {
    openOverviewDetailDialog(
      '近期订单',
      `
        <div class="overview-detail-stack">
          ${
            recentOrders.length
              ? recentOrders
                  .map((order) => {
                    const firstItem = order.items && order.items[0];
                    return `
                      <article class="overview-detail-order">
                        <div>
                          <strong>${escapeHtml(firstItem ? firstItem.productName : order.orderNo)}</strong>
                          <p>${escapeHtml(order.addressSummary || '未填写地址')}</p>
                        </div>
                        <div>
                          <strong>${escapeHtml(formatCurrency(order.payAmount || order.amount || 0))}</strong>
                          <p>${escapeHtml(deliveryStatusCopy[order.deliveryStatus] || deliveryStatusCopy[order.status] || '处理中')}</p>
                        </div>
                      </article>
                    `;
                  })
                  .join('')
              : '<div class="overview-empty">当前没有订单数据</div>'
          }
        </div>
      `
    );
    return;
  }

  if (type === 'products') {
    openOverviewDetailDialog(
      '主推礼盒',
      `
        <div class="overview-detail-card-grid">
          ${
            hotProducts.length
              ? hotProducts
                  .map(
                    (product) => `
                      <article class="overview-detail-product">
                        <img src="${escapeHtml(product.coverImage || '/assets/images/wine-gift-set.jpg')}" alt="${escapeHtml(product.name || 'product')}" />
                        <div>
                          <strong>${escapeHtml(product.name || '未设置')}</strong>
                          <p>${escapeHtml(product.subtitle || product.story || '')}</p>
                          <span>${escapeHtml(formatCurrency(product.lowestPrice || 0))}</span>
                        </div>
                      </article>
                    `
                  )
                  .join('')
              : '<div class="overview-empty">当前没有商品数据</div>'
          }
        </div>
      `
    );
    return;
  }

  openOverviewDetailDialog(
    '品牌与会员',
    `
      <div class="overview-detail-stack">
        <section class="overview-detail-brand">
          <strong>${escapeHtml((winery && winery.name) || '未设置')}</strong>
          <p>${escapeHtml((winery && winery.intro) || '未设置')}</p>
        </section>
        <section class="overview-detail-grid">
          <article><span>会员</span><strong>${escapeHtml(formatNumber(metrics.activeMembers || 0))}</strong></article>
          <article><span>用户</span><strong>${escapeHtml(formatNumber(metrics.totalUsers || 0))}</strong></article>
          <article><span>下载</span><strong>${escapeHtml(formatNumber(metrics.totalDownloads || 0))}</strong></article>
          <article><span>酒款</span><strong>${escapeHtml(formatNumber(wines.length))}</strong></article>
        </section>
        <section class="overview-detail-brand secondary">
          <strong>${escapeHtml((track && (track.cnTitle || track.title)) || '未设置')}</strong>
          <p>${escapeHtml((track && track.description) || '未设置')}</p>
        </section>
      </div>
    `
  );
}

function renderWines() {
  const allWines = getEnrichedWines();
  const filteredWines = getFilteredWines(allWines);
  const selectedWine = ensureSelectedWine();

  els.winesCollection.innerHTML = filteredWines.length
    ? `
      <div class="wine-list-table-head" aria-hidden="true">
        <span>酒款</span>
        <span>内容</span>
        <span>指标</span>
      </div>
      ${filteredWines
        .map(
          (wine) => `
              <button class="selection-item ${wine.id === state.selectedWineId ? 'is-selected' : ''}" type="button" data-select-wine="${escapeHtml(wine.id)}">
                <span class="row-radio" aria-hidden="true"></span>
                <span class="selection-item-copy">
                  <span class="selection-item-head">
                    <strong>${escapeHtml(wine.name)}</strong>
                    ${renderStatusPill(wine.status || 'active')}
                  </span>
                  <span class="selection-item-subtitle">${escapeHtml(wine.subtitle || '未填写副标题')}</span>
                  <span class="selection-item-meta">
                    <span>${escapeHtml(wine.vintage || '未设置')} · ${escapeHtml(wine.region || '未设置')}</span>
                  </span>
                </span>
                <span class="selection-item-stats">
                  <span class="selection-stat">
                    <span>提取码</span>
                    <strong>${escapeHtml(wine.codeTotal)}</strong>
                  </span>
                  <span class="selection-stat">
                    <span>已使用</span>
                    <strong>${escapeHtml(wine.claimedCodeTotal)}</strong>
                  </span>
                  <span class="selection-stat selection-stat-wide">
                    <span>最近使用</span>
                    <strong>${escapeHtml(wine.lastUsedAt ? formatShortDate(wine.lastUsedAt) : '—')}</strong>
                  </span>
                </span>
              </button>
            `
        )
        .join('')}
    `
    : '<div class="empty-state">没有匹配的酒款，试试更换关键词或状态筛选。</div>';

  if (!selectedWine) {
    els.wineEditor.innerHTML = '<div class="empty-state">暂无酒款。</div>';
    return;
  }

  const winery = getFixedWinery();
  const track = getFixedTrack();
  els.wineEditor.innerHTML = `
    <form id="wine-editor-form" class="editor-form" data-wine-id="${escapeHtml(selectedWine.id)}">
      <div class="editor-hero">
        <div class="editor-hero-copy">
          <h3 class="editor-title">${escapeHtml(selectedWine.name)}</h3>
          <p class="editor-subtitle">${escapeHtml(selectedWine.subtitle || '未填写副标题')}</p>
        </div>
        <div class="editor-hero-meta">
          <div class="hero-stat">
            <span>提取码总数</span>
            <strong>${escapeHtml(selectedWine.codeTotal)}</strong>
          </div>
          <div class="hero-stat">
            <span>已使用</span>
            <strong>${escapeHtml(selectedWine.claimedCodeTotal)}</strong>
          </div>
          <div class="hero-stat">
            <span>最近使用</span>
            <strong>${escapeHtml(selectedWine.lastUsedAt ? formatShortDate(selectedWine.lastUsedAt) : '未核销')}</strong>
          </div>
        </div>
      </div>

      <div class="editor-layout">
        <section class="editor-section editor-section-basic">
          <div class="form-grid">
            <label>
              <span>酒款名称</span>
              <input name="name" value="${escapeHtml(selectedWine.name || '')}" />
            </label>
            <label>
              <span>英文标题</span>
              <input name="title" value="${escapeHtml(selectedWine.title || '')}" />
            </label>
            <label>
              <span>副标题</span>
              <input name="subtitle" value="${escapeHtml(selectedWine.subtitle || '')}" />
            </label>
            <label>
              <span>年份 / 版次</span>
              <input name="vintage" value="${escapeHtml(selectedWine.vintage || '')}" />
            </label>
            <label>
              <span>产区</span>
              <input name="region" value="${escapeHtml(selectedWine.region || '')}" />
            </label>
            <label>
              <span>状态</span>
              <select name="status">
                <option value="active" ${(selectedWine.status || 'active') === 'active' ? 'selected' : ''}>启用中</option>
                <option value="archived" ${(selectedWine.status || 'active') === 'archived' ? 'selected' : ''}>已归档</option>
              </select>
            </label>
          </div>
        </section>

        <section class="editor-section editor-section-copy">
          <div class="form-stack">
            <label>
              <span>酒款概述</span>
              <textarea name="overview" rows="5">${escapeHtml(selectedWine.overview || '')}</textarea>
            </label>
            <label>
              <span>引言</span>
              <textarea name="quote" rows="3">${escapeHtml(selectedWine.quote || '')}</textarea>
            </label>
            <label>
              <span>酒款故事</span>
              <textarea name="story" rows="6">${escapeHtml(selectedWine.story || '')}</textarea>
            </label>
          </div>
        </section>

        <section class="editor-section editor-section-media">
          <div class="form-stack">
            ${renderImageField({
              label: '瓶身图',
              name: 'bottleImage',
              value: selectedWine.bottleImage || '',
              folder: 'wines',
              placeholder: '/assets/images/wine-bottle-estate.jpg'
            })}
            ${renderImageField({
              label: '海报图',
              name: 'posterImage',
              value: selectedWine.posterImage || '',
              folder: 'wines',
              placeholder: '/assets/images/wine-bottle-poster.jpg'
            })}
            ${renderImageField({
              label: '礼盒图',
              name: 'giftImage',
              value: selectedWine.giftImage || '',
              folder: 'wines',
              placeholder: '/assets/images/wine-gift-set.jpg'
            })}
          </div>
        </section>

        <section class="editor-section editor-note">
          <div class="tag-row">
            <span class="tag">${escapeHtml((winery && winery.name) || '未设置')}</span>
            <span class="tag">${escapeHtml((track && (track.cnTitle || track.title)) || '未设置')}</span>
          </div>
        </section>
      </div>

      <div class="editor-actions">
        <button class="danger-button" type="button" data-action="delete-wine" data-wine-id="${escapeHtml(selectedWine.id)}">归档 / 删除</button>
        <button class="primary-button" type="submit">保存酒款</button>
      </div>
    </form>
  `;
}

function renderCodeFilters() {
  const wines = getEnrichedWines();
  const currentWineFilter = wines.some((wine) => wine.id === state.filters.codeWine) ? state.filters.codeWine : 'all';
  const wineOptions = [
    { value: 'all', label: '全部酒款' },
    ...wines.map((wine) => ({ value: wine.id, label: wine.name }))
  ];

  state.filters.codeWine = currentWineFilter;
  els.codeWineFilter.innerHTML = wineOptions
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}" ${option.value === currentWineFilter ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
    )
    .join('');
  els.codeStatusFilter.value = state.filters.codeStatus;
  els.codeSearch.value = state.filters.codeSearch;

  const currentBatchWine = wines.some((wine) => wine.id === els.batchWine.value) ? els.batchWine.value : '';
  els.batchWine.innerHTML = wines
    .map(
      (wine) =>
        `<option value="${escapeHtml(wine.id)}" ${wine.id === currentBatchWine ? 'selected' : ''}>${escapeHtml(wine.name)}</option>`
    )
    .join('');

  if (!els.batchWine.value && wines[0]) {
    els.batchWine.value = wines[0].id;
  }
}

function renderFixedQrcodePanel() {
  if (!els.fixedQrcodePreview || !els.fixedQrcodeResult) {
    return;
  }

  if (!state.fixedQrcode || !state.fixedQrcode.path) {
    els.fixedQrcodePreview.innerHTML = '<div class="fixed-qrcode-placeholder">待生成</div>';
    els.fixedQrcodeResult.textContent = '';
    els.fixedQrcodeDownload.hidden = true;
    els.fixedQrcodeDownload.removeAttribute('href');
    els.fixedQrcodeCopy.hidden = true;
    delete els.fixedQrcodeCopy.dataset.copyValue;
    return;
  }

  const previewPath = escapeHtml(state.fixedQrcode.path);
  const linkValue = state.fixedQrcode.url || `${window.location.origin}${state.fixedQrcode.path}`;

  els.fixedQrcodePreview.innerHTML = `
    <img
      class="fixed-qrcode-image"
      src="${previewPath}"
      alt="固定小程序码"
    />
  `;
  els.fixedQrcodeResult.innerHTML = `页面：${escapeHtml(state.fixedQrcode.page)} · <a href="${previewPath}" target="_blank" rel="noreferrer">打开二维码</a>`;
  els.fixedQrcodeDownload.hidden = false;
  els.fixedQrcodeDownload.href = state.fixedQrcode.path;
  els.fixedQrcodeCopy.hidden = false;
  els.fixedQrcodeCopy.dataset.copyValue = linkValue;
}

function renderCodes() {
  renderCodeFilters();
  renderFixedQrcodePanel();

  const filteredCodes = getFilteredCodes();
  if (state.selectedCodeId && !filteredCodes.some((code) => code.id === state.selectedCodeId)) {
    state.selectedCodeId = '';
  }

  const pagination = getCodePagination(filteredCodes);
  if (!state.selectedCodeId && pagination.items[0]) {
    state.selectedCodeId = pagination.items[0].id;
  }

  const summary = getCodeSummary(state.codes);
  const summaryCards = [
    { value: 'all', label: '全部', count: summary.total, tone: 'all' },
    { value: 'ready', label: '待使用', count: summary.ready, tone: 'ready' },
    { value: 'claimed', label: '已使用', count: summary.claimed, tone: 'claimed' },
    { value: 'expired', label: '已过期', count: summary.expired, tone: 'expired' },
    { value: 'disabled', label: '已停用', count: summary.disabled, tone: 'disabled' }
  ];

  els.codesSummary.innerHTML = summaryCards
    .map(
      (card) => `
        <button
          class="summary-card ${state.filters.codeStatus === card.value ? 'is-active' : ''}"
          type="button"
          data-code-status-tab="${escapeHtml(card.value)}"
        >
          <div class="summary-card-label">
            <span class="summary-card-dot is-${escapeHtml(card.tone)}"></span>
            <span>${escapeHtml(card.label)}</span>
          </div>
          <strong class="summary-card-value">${escapeHtml(formatNumber(card.count))}</strong>
        </button>
      `
    )
    .join('');

  els.codesFailLogs.innerHTML = state.redeemFailLogs.length
    ? state.redeemFailLogs
        .slice(0, 6)
        .map(
          (item) => `
            <article class="fail-log-item">
              <div class="fail-log-main">
                <span class="fail-log-dot" aria-hidden="true"></span>
                <div>
                  <strong>${escapeHtml(getShortCode(item.code))}</strong>
                  <p>${escapeHtml(REASON_COPY[item.reason] || item.reason || '未知原因')}</p>
                </div>
              </div>
              <span class="fail-log-time">${escapeHtml(formatShortDate(item.createdAt))}</span>
            </article>
          `
        )
        .join('')
    : '';
  if (els.codesFailBlock) {
    els.codesFailBlock.hidden = !state.redeemFailLogs.length;
  }
  if (els.openFailDialog) {
    els.openFailDialog.hidden = !state.redeemFailLogs.length;
  }

  els.codesTable.innerHTML = `
    <thead>
      <tr>
        <th class="check-column">
          <span class="visually-hidden">选中</span>
        </th>
        <th>提取码</th>
        <th>酒款</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${
        pagination.items.length
          ? pagination.items
              .map(
                (code) => `
                  <tr class="code-row ${code.id === state.selectedCodeId ? 'is-selected' : ''}" data-code-row="${escapeHtml(code.id)}">
                    <td class="check-column">
                      <button
                        class="row-check ${code.id === state.selectedCodeId ? 'is-selected' : ''}"
                        type="button"
                        data-select-code="${escapeHtml(code.id)}"
                        aria-pressed="${code.id === state.selectedCodeId ? 'true' : 'false'}"
                        aria-label="选中提取码 ${escapeHtml(code.redeemCode || code.token || '')}"
                      >
                        <span></span>
                      </button>
                    </td>
                    <td>
                      <div class="table-primary">${escapeHtml(code.redeemCode || code.token)}</div>
                      <div class="table-secondary">创建于 ${escapeHtml(formatDate(code.createdAt))}</div>
                    </td>
                    <td>
                      <button class="table-link" type="button" data-view-target="wines" data-wine-id="${escapeHtml(code.wineId || '')}">
                        ${escapeHtml((code.wine && code.wine.name) || '未绑定酒款')}
                      </button>
                    </td>
                    <td>
                      ${renderStatusPill(code.status || 'ready')}
                      <div class="table-secondary">${escapeHtml(code.batchNo || '未分批')}</div>
                      <div class="table-secondary">${escapeHtml(code.firstUsedAt ? formatDateTime(code.firstUsedAt) : formatDate(code.expiresAt))}</div>
                    </td>
                    <td class="table-action-cell">
                      <div class="table-actions">
                        <button class="table-link" type="button" data-view-target="wines" data-wine-id="${escapeHtml(code.wineId || '')}">
                          查看
                        </button>
                        <select class="inline-select inline-select-compact code-status-select" data-code-id="${escapeHtml(code.id)}">
                          ${renderCodeStatusOptions(code.status)}
                        </select>
                      </div>
                    </td>
                  </tr>
                `
              )
              .join('')
          : `
            <tr>
              <td colspan="5">
                <div class="empty-state empty-state-inline">没有匹配的提取码记录。</div>
              </td>
            </tr>
          `
      }
    </tbody>
  `;

  const paginationTokens = getPaginationTokens(pagination.page, pagination.totalPages);
  els.codesFooter.innerHTML = `
    <div class="table-footer-copy">共 ${escapeHtml(formatNumber(pagination.totalItems))} 条</div>
    <div class="table-footer-actions">
      <label class="footer-select">
        <select data-code-page-size>
          <option value="10" ${pagination.pageSize === 10 ? 'selected' : ''}>10 条 / 页</option>
          <option value="20" ${pagination.pageSize === 20 ? 'selected' : ''}>20 条 / 页</option>
          <option value="50" ${pagination.pageSize === 50 ? 'selected' : ''}>50 条 / 页</option>
          <option value="100" ${pagination.pageSize === 100 ? 'selected' : ''}>100 条 / 页</option>
        </select>
      </label>
      <div class="pagination-group">
        <button class="pagination-button" type="button" data-code-page="${pagination.page - 1}" ${pagination.page <= 1 ? 'disabled' : ''}>‹</button>
        ${paginationTokens
          .map((token) =>
            token === 'ellipsis'
              ? '<span class="pagination-ellipsis">…</span>'
              : `<button class="pagination-button ${token === pagination.page ? 'is-active' : ''}" type="button" data-code-page="${token}">${token}</button>`
          )
          .join('')}
        <button class="pagination-button" type="button" data-code-page="${pagination.page + 1}" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>›</button>
      </div>
    </div>
  `;
}

function updateWineStatusTabs() {
  [...els.wineStatusTabs.querySelectorAll('.segment')].forEach((button) => {
    button.classList.toggle('is-active', button.dataset.wineStatus === state.filters.wineStatus);
  });
}

function updateImagePreview(input) {
  const field = input.closest('.image-field');
  if (!field) {
    return;
  }

  const preview = field.querySelector('.image-preview-slot');
  if (!preview) {
    return;
  }

  preview.innerHTML = renderImagePreview(input.value, input.name || 'preview');
}

function serializeForm(form) {
  const payload = {};
  const formData = new FormData(form);

  for (const [key, value] of formData.entries()) {
    payload[key] = typeof value === 'string' ? value.trim() : value;
  }

  return payload;
}

function toIsoDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
}

async function loadData() {
  const [health, dashboard, wines, wineries, tracks, codes, redeemFailLogs] = await Promise.all([
    api('/api/health'),
    maybeApi('dashboard.read', '/api/admin/dashboard', { metrics: null }),
    maybeApi('wines.read', '/api/admin/wines', { items: [] }),
    maybeApi('wineries.read', '/api/admin/wineries', { items: [] }),
    maybeApi('tracks.read', '/api/admin/tracks', { items: [] }),
    maybeApi('codes.read', '/api/admin/codes', { items: [] }),
    maybeApi('codes.read', '/api/admin/redeem-fail-logs', { items: [] })
  ]);

  state.health = health;
  state.dashboard = dashboard;
  state.wines = wines.items || [];
  state.wineries = wineries.items || [];
  state.tracks = tracks.items || [];
  state.codes = codes.items || [];
  state.redeemFailLogs = redeemFailLogs.items || [];

  updateSessionPill();
  updatePermissionUi();
  setView(state.activeView);
  updateWineStatusTabs();
  renderOverview();
  renderWines();
  renderCodes();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  els.loginError.textContent = '';

  const payload = await runTask(
    () =>
      api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          username: els.loginUsername.value.trim(),
          password: els.loginPassword.value
        })
      }),
    null
  );

  if (!payload) {
    els.loginError.textContent = '账号或密码错误。';
    return;
  }

  rememberSession(payload.token, payload.user);
  toggleLogin(false);
  await loadData();
  showStatus('登录成功。', 'success');
}

async function handleLogout() {
  await runTask(
    () =>
      api('/api/admin/logout', {
        method: 'POST'
      }),
    null
  );

  clearSession();
  toggleLogin(true);
  updateSessionPill();
}

async function handleWineSave(form) {
  const wineId = form.dataset.wineId;
  const payload = serializeForm(form);
  const saved = await runTask(
    () =>
      api(`/api/admin/wines/${wineId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      }),
    '酒款内容已保存。'
  );

  if (!saved) {
    return;
  }

  state.selectedWineId = wineId;
  closeWineEditorDialog();
  await loadData();
  setView('wines');
}

async function handleWineCreate(form) {
  const payload = serializeForm(form);
  const created = await runTask(
    () =>
      api('/api/admin/wines', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    '新酒款已创建。'
  );

  if (!created || !created.item) {
    return;
  }

  closeCreateWineDialog();
  state.selectedWineId = created.item.id;
  await loadData();
  setView('wines');
}

async function handleWineDelete(wineId) {
  const confirmed = window.confirm('确认要删除这款酒吗？如果已有关联数据，系统会自动转为归档。');
  if (!confirmed) {
    return;
  }

  const payload = await runTask(
    () =>
      api(`/api/admin/wines/${wineId}`, {
        method: 'DELETE'
      }),
    null
  );

  if (!payload || !payload.result) {
    return;
  }

  state.selectedWineId = '';
  closeWineEditorDialog();
  await loadData();
  setView('wines');
  showStatus(payload.result.mode === 'deleted' ? '酒款已删除。' : '酒款已归档。', 'success');
}

async function handleBatchCreate(event) {
  event.preventDefault();
  const payload = await runTask(
    () =>
      api('/api/admin/code-batches', {
        method: 'POST',
        body: JSON.stringify({
          wineId: els.batchWine.value,
          quantity: els.batchQuantity.value,
          batchNo: els.batchBatchNo.value.trim(),
          expiresAt: toIsoDateTime(els.batchExpireAt.value)
        })
      }),
    '提取码批次已生成。'
  );

  if (!payload) {
    return;
  }

  els.batchBatchNo.value = '';
  els.batchExpireAt.value = '';
  closeBatchDialog();
  state.codePage = 1;
  await loadData();
  setView('codes');
}

async function handleCodeStatusChange(select) {
  const codeId = select.dataset.codeId;
  const payload = await runTask(
    () =>
      api(`/api/admin/codes/${codeId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: select.value
        })
      }),
    '提取码状态已更新。'
  );

  if (!payload) {
    return;
  }

  await loadData();
  setView('codes');
}

async function handleFixedQrcode() {
  const payload = await runTask(
    () =>
      api('/api/admin/qrcode/fixed-redeem', {
        method: 'POST'
      }),
    '固定入口码已生成。'
  );

  if (!payload) {
    state.fixedQrcode = null;
    renderFixedQrcodePanel();
    els.fixedQrcodeResult.textContent = '未生成。请确认微信 AppID / AppSecret 已配置。';
    return;
  }

  state.fixedQrcode = payload;
  renderFixedQrcodePanel();
}

async function handleUploadChange(fileInput) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    return;
  }

  const uploaded = await runTask(
    () => uploadImageAsset(file, fileInput.dataset.uploadFolder || 'wines'),
    '图片已上传。'
  );

  if (!uploaded || !uploaded.item || !uploaded.item.url) {
    fileInput.value = '';
    return;
  }

  const field = fileInput.closest('.image-field');
  const targetName = fileInput.dataset.uploadTarget;
  const targetInput = field && field.querySelector(`input[name="${escapeSelector(targetName)}"]`);
  if (targetInput) {
    targetInput.value = uploaded.item.url;
    updateImagePreview(targetInput);
  }

  fileInput.value = '';
}

function wireStaticEvents() {
  els.loginForm.addEventListener('submit', handleLoginSubmit);
  els.refreshButton.addEventListener('click', async () => {
    await runTask(() => loadData(), '数据已刷新。');
  });
  els.logoutButton.addEventListener('click', handleLogout);
  els.openCreateWine.addEventListener('click', openCreateWineDialog);
  els.openBatchDialog.addEventListener('click', openBatchDialog);
  els.openFixedDialog.addEventListener('click', openFixedDialog);
  els.openFailDialog.addEventListener('click', openFailLogsDialog);
  els.batchForm.addEventListener('submit', handleBatchCreate);
  els.fixedQrcodeButton.addEventListener('click', handleFixedQrcode);
  els.exportCodesButton.addEventListener('click', () => {
    window.open('/api/admin/codes/export', '_blank', 'noopener');
  });

  els.wineSearch.addEventListener('input', () => {
    state.filters.wineSearch = els.wineSearch.value.trim();
    renderWines();
  });

  els.codeSearch.addEventListener('input', () => {
    state.filters.codeSearch = els.codeSearch.value.trim();
    state.codePage = 1;
    renderCodes();
  });

  els.codeStatusFilter.addEventListener('change', () => {
    state.filters.codeStatus = els.codeStatusFilter.value;
    state.codePage = 1;
    renderCodes();
  });

  els.codeWineFilter.addEventListener('change', () => {
    state.filters.codeWine = els.codeWineFilter.value;
    state.codePage = 1;
    renderCodes();
  });

  document.addEventListener('click', (event) => {
    const navItem = event.target.closest('.nav-item');
    if (navItem) {
      setView(navItem.dataset.view);
      return;
    }

    const viewButton = event.target.closest('[data-view-target]');
    if (viewButton) {
      const wineId = viewButton.dataset.wineId;
      if (wineId) {
        state.selectedWineId = wineId;
      }
      if (viewButton.dataset.action === 'close-overview-detail') {
        closeOverviewDetailDialog();
      }
      setView(viewButton.dataset.viewTarget);
      if (viewButton.dataset.viewTarget === 'wines') {
        renderWines();
        if (wineId) {
          openWineEditorDialog();
        }
      }
      return;
    }

    const overviewDetailButton = event.target.closest('[data-overview-detail]');
    if (overviewDetailButton) {
      renderOverviewDetail(overviewDetailButton.dataset.overviewDetail);
      return;
    }

    const codeStatusTab = event.target.closest('[data-code-status-tab]');
    if (codeStatusTab) {
      state.filters.codeStatus = codeStatusTab.dataset.codeStatusTab;
      state.codePage = 1;
      renderCodes();
      return;
    }

    const selectCodeButton = event.target.closest('[data-select-code]');
    if (selectCodeButton) {
      state.selectedCodeId = selectCodeButton.dataset.selectCode;
      renderCodes();
      return;
    }

    const codeRow = event.target.closest('[data-code-row]');
    if (codeRow && !event.target.closest('button, a, select, option, input, label')) {
      state.selectedCodeId = codeRow.dataset.codeRow;
      renderCodes();
      return;
    }

    const codePageButton = event.target.closest('[data-code-page]');
    if (codePageButton && !codePageButton.disabled) {
      state.codePage = Number(codePageButton.dataset.codePage) || 1;
      renderCodes();
      return;
    }

    const copyFixedQrcodeButton = event.target.closest('#fixed-qrcode-copy');
    if (copyFixedQrcodeButton && copyFixedQrcodeButton.dataset.copyValue) {
      copyText(copyFixedQrcodeButton.dataset.copyValue)
        .then(() => {
          showStatus('固定入口链接已复制。', 'success');
        })
        .catch(() => {
          showStatus('复制失败，请手动打开二维码链接。', 'error');
        });
      return;
    }

    const selectWineButton = event.target.closest('[data-select-wine]');
    if (selectWineButton) {
      state.selectedWineId = selectWineButton.dataset.selectWine;
      renderWines();
      openWineEditorDialog();
      return;
    }

    const statusButton = event.target.closest('[data-wine-status]');
    if (statusButton) {
      state.filters.wineStatus = statusButton.dataset.wineStatus;
      updateWineStatusTabs();
      renderWines();
      return;
    }

    const deleteButton = event.target.closest('[data-action="delete-wine"]');
    if (deleteButton) {
      handleWineDelete(deleteButton.dataset.wineId);
      return;
    }

    const closeDialogButton = event.target.closest('[data-action="close-create-wine"]');
    if (closeDialogButton) {
      closeCreateWineDialog();
      return;
    }

    const closeWineEditorButton = event.target.closest('[data-action="close-wine-editor"]');
    if (closeWineEditorButton) {
      closeWineEditorDialog();
      return;
    }

    const closeBatchButton = event.target.closest('[data-action="close-batch-dialog"]');
    if (closeBatchButton) {
      closeBatchDialog();
      return;
    }

    const closeFixedButton = event.target.closest('[data-action="close-fixed-dialog"]');
    if (closeFixedButton) {
      closeFixedDialog();
      return;
    }

    const closeFailButton = event.target.closest('[data-action="close-fail-dialog"]');
    if (closeFailButton) {
      closeFailLogsDialog();
      return;
    }

    const closeOverviewDetailButton = event.target.closest('[data-action="close-overview-detail"]');
    if (closeOverviewDetailButton) {
      closeOverviewDetailDialog();
      return;
    }

    const uploadButton = event.target.closest('[data-action="pick-upload"]');
    if (uploadButton) {
      const field = uploadButton.closest('.image-field');
      const targetName = uploadButton.dataset.uploadTarget;
      const fileInput =
        field && field.querySelector(`.upload-file-input[data-upload-target="${escapeSelector(targetName)}"]`);
      if (fileInput) {
        fileInput.click();
      }
      return;
    }

    const clearImageButton = event.target.closest('[data-action="clear-image"]');
    if (clearImageButton) {
      const field = clearImageButton.closest('.image-field');
      const targetName = clearImageButton.dataset.targetField;
      const targetInput = field && field.querySelector(`input[name="${escapeSelector(targetName)}"]`);
      if (targetInput) {
        targetInput.value = '';
        updateImagePreview(targetInput);
      }
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'wine-editor-form') {
      event.preventDefault();
      handleWineSave(event.target);
      return;
    }

    if (event.target.id === 'create-wine-form') {
      event.preventDefault();
      handleWineCreate(event.target);
    }
  });

  document.addEventListener('change', (event) => {
    const codeStatusSelect = event.target.closest('.code-status-select');
    if (codeStatusSelect) {
      handleCodeStatusChange(codeStatusSelect);
      return;
    }

    const codePageSizeSelect = event.target.closest('[data-code-page-size]');
    if (codePageSizeSelect) {
      state.codePageSize = Number(codePageSizeSelect.value) || 20;
      state.codePage = 1;
      renderCodes();
      return;
    }

    const uploadFileInput = event.target.closest('.upload-file-input');
    if (uploadFileInput) {
      handleUploadChange(uploadFileInput);
    }
  });

  document.addEventListener('input', (event) => {
    const imageInput = event.target.closest('input[data-image-source="true"]');
    if (imageInput) {
      updateImagePreview(imageInput);
    }
  });
}

async function bootstrap() {
  wireStaticEvents();
  updateSessionPill();
  updatePermissionUi();
  setView(state.activeView);

  if (!state.token) {
    toggleLogin(true);
    return;
  }

  toggleLogin(false);
  const loaded = await runTask(() => loadData(), null);
  if (loaded === null) {
    toggleLogin(true);
  }
}

// legacy bootstrap is replaced by the premium admin runtime below

const COPY_PAGES = [
  { key: 'home', label: '首页', helper: '品牌第一屏' },
  { key: 'activity', label: '活动页', helper: '活动与运营页' },
  { key: 'detail', label: '酒款详情', helper: '商品与故事页' },
  { key: 'buttons', label: '按钮文案', helper: '操作按钮' },
  { key: 'modal', label: '弹窗文案', helper: '确认与提示' },
  { key: 'share', label: '分享文案', helper: '分享与传播' }
];

const COPY_PAGE_IMAGES = {
  home: '/assets/images/winery-vineyard-moon.jpg',
  activity: '/assets/images/harvest-under-moon.jpg',
  detail: '/assets/images/wine-bottle-poster.jpg',
  buttons: '/assets/images/melody-phone-cover.jpg',
  modal: '/assets/images/wine-gift-set.jpg',
  share: '/assets/images/village-ancient-vine-sign.jpg'
};

const ICONS = {
  alert:
    '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 4.5h3.4L22 18H2L10.3 4.5Z"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  box: '<path d="M21 8.5 12 13 3 8.5"/><path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z"/><path d="M12 13v7"/>',
  calendar: '<path d="M8 3v3"/><path d="M16 3v3"/><path d="M4 8h16"/><path d="M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6 18 18"/><path d="m18 6-12 12"/>',
  code: '<path d="m9 9-4 3 4 3"/><path d="m15 9 4 3-4 3"/><path d="m13 7-2 10"/>',
  copy: '<path d="M9 9h10v10H9z"/><path d="M5 5h10v10"/><path d="M7 13H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M12 3v10"/><path d="m8 9 4 4 4-4"/><path d="M4 17h16"/>',
  edit: '<path d="M4 20h16"/><path d="M14.5 4.5a2.1 2.1 0 0 1 3 3L8 17l-4 1 1-4 9.5-9.5Z"/>',
  eye: '<path d="M2 12c2.5-4.5 6-7 10-7s7.5 2.5 10 7c-2.5 4.5-6 7-10 7s-7.5-2.5-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  filter: '<path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 14 3-3 4 4 2-2 3 3"/><circle cx="9" cy="9" r="1.5"/>',
  logout: '<path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2"/><path d="M3 12h11"/><path d="m7 8-4 4 4 4"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v6h-6"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><path d="M8 14h8"/>',
  search: '<path d="m21 21-4.3-4.3"/><circle cx="11" cy="11" r="7"/>',
  spark: '<path d="M12 2 9 9 2 12l7 3 3 7 3-7 7-3-7-3-3-7Z"/>',
  truck: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  upload: '<path d="M12 19V9"/><path d="m8 13 4-4 4 4"/><path d="M5 21h14"/>',
  user: '<path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="8" r="4"/>',
  wine: '<path d="M8 2h8v4a4 4 0 0 1-3 3.9V18h3v2H8v-2h3v-8.1A4 4 0 0 1 8 6Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>'
};

function icon(name, size = 16, className = '') {
  return `<svg class="icon ${escapeHtml(className)}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.spark}</svg>`;
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function setHtml(nodeOrId, html) {
  const node = typeof nodeOrId === 'string' ? document.getElementById(nodeOrId) : nodeOrId;
  if (node) {
    node.innerHTML = html;
  }
}

function toggleHidden(node, hidden) {
  if (!node) {
    return;
  }
  node.hidden = hidden;
  node.classList.toggle('is-hidden', hidden);
}

function sameDay(left, right = new Date()) {
  if (!left) {
    return false;
  }
  const a = new Date(left);
  const b = new Date(right);
  return !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && a.toDateString() === b.toDateString();
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toLocalInputValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function downloadJson(filename, value) {
  downloadText(filename, `${JSON.stringify(value, null, 2)}\n`, 'application/json;charset=utf-8');
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function ensureCopyDraftSource() {
  const source = state.siteContent && state.siteContent.miniappCopy;
  if (source) {
    return clone(source);
  }

  return {
    activePage: 'home',
    pages: {
      home: {
        badge: '首页',
        title: '鸿玖酒庄',
        subtitle: '高端红酒品牌运营中台',
        body: '把酒款、提取码、发货和小程序文案放在一条清晰路径里。',
        primaryAction: '查看酒款',
        secondaryAction: '进入提取码',
        note: '理性饮酒，未成年人请勿饮酒。'
      },
      activity: {
        badge: '活动页',
        title: '庄园活动',
        subtitle: '上新、品鉴和会员日',
        body: '把时间、名额和报名按钮放在同一屏。',
        primaryAction: '预约活动',
        secondaryAction: '查看日历',
        note: '只保留一个主动作。'
      },
      detail: {
        badge: '酒款详情',
        title: '酒款详情',
        subtitle: '年份、产区与风味',
        body: '先讲年份和风味，再讲礼赠与扫码。',
        primaryAction: '立即购买',
        secondaryAction: '查看提取码',
        note: '详情页保持克制。'
      },
      buttons: {
        badge: '按钮文案',
        title: '按钮文案',
        subtitle: '动词优先',
        body: '主按钮统一用保存、发布、确认、生成。',
        primaryAction: '保存草稿',
        secondaryAction: '发布到小程序',
        note: '按钮尽量简短。'
      },
      modal: {
        badge: '弹窗文案',
        title: '弹窗文案',
        subtitle: '结果、风险和下一步',
        body: '删除、停用和发布都需要二次确认。',
        primaryAction: '确认',
        secondaryAction: '取消',
        note: '提示要直接。'
      },
      share: {
        badge: '分享文案',
        title: '分享文案',
        subtitle: '短标题，留品牌名',
        body: '分享标题只保留品牌名、酒款名和一个关键词。',
        primaryAction: '复制文案',
        secondaryAction: '预览卡片',
        note: '控制在两行之内。'
      }
    }
  };
}

function ensureCopyDraft() {
  if (!state.copyDraft) {
    state.copyDraft = ensureCopyDraftSource();
    state.copyActivePage = state.copyDraft.activePage || 'home';
    state.copyDirty = false;
  }

  if (!state.copyDraft.pages) {
    state.copyDraft.pages = ensureCopyDraftSource().pages;
  }

  COPY_PAGES.forEach((page) => {
    if (!state.copyDraft.pages[page.key]) {
      state.copyDraft.pages[page.key] = ensureCopyDraftSource().pages[page.key];
    }
  });

  if (!state.copyDraft.activePage || !state.copyDraft.pages[state.copyDraft.activePage]) {
    state.copyDraft.activePage = COPY_PAGES[0].key;
  }

  state.copyActivePage = state.copyDraft.activePage;
  return state.copyDraft;
}

function currentCopyPage() {
  const draft = ensureCopyDraft();
  return draft.pages[draft.activePage] || draft.pages.home;
}

function setActiveCopyPage(pageKey) {
  const draft = ensureCopyDraft();
  if (!draft.pages[pageKey]) {
    return;
  }
  draft.activePage = pageKey;
  state.copyActivePage = pageKey;
  renderCopyPage();
}

function markCopyDirty() {
  state.copyDirty = true;
  renderTopbarActions();
  renderCopyNav();
  updateCopyPreview();
}

function saveCopySnapshot(nextItem) {
  if (nextItem) {
    state.siteContent = clone(nextItem);
    state.copyDraft = clone(nextItem.miniappCopy || ensureCopyDraftSource());
    state.copyActivePage = state.copyDraft.activePage || 'home';
  }
  state.copyDirty = false;
  renderCopyNav();
  renderTopbarActions();
}

function renderActionButton({ action, label, iconName = '', variant = 'secondary', tone = '', disabled = false, title = '' }) {
  const iconHtml = iconName ? `<span class="button-icon">${icon(iconName)}</span>` : '';
  const toneClass = tone ? ` button--${tone}` : '';
  return `
    <button
      class="button button--${variant}${toneClass}"
      type="button"
      data-action="${escapeHtml(action)}"
      ${disabled ? 'disabled' : ''}
      ${title ? `title="${escapeHtml(title)}"` : ''}
    >
      ${iconHtml}
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function renderTableIconButton({ action, iconName, label, attrs = '' }) {
  return `
    <button class="table-icon-button" type="button" data-action="${escapeHtml(action)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${attrs}>
      ${icon(iconName)}
    </button>
  `;
}

function updateFieldCounter(input) {
  if (!input || !input.id) {
    return;
  }

  const counter = document.querySelector(`[data-field-counter="${escapeSelector(input.id)}"]`);
  if (!counter) {
    return;
  }

  const maxLength = Number(input.getAttribute('maxlength')) || 0;
  const currentLength = String(input.value || '').length;
  counter.textContent = maxLength ? `${currentLength}/${maxLength}` : `${currentLength}`;
  counter.classList.toggle('is-near-limit', Boolean(maxLength) && currentLength / maxLength >= 0.8);
}

function syncFieldCounters(root = document) {
  if (!root || !root.querySelectorAll) {
    return;
  }

  root.querySelectorAll('input[maxlength], textarea[maxlength]').forEach((input) => updateFieldCounter(input));
}

function renderField(label, name, value, options = {}) {
  const { type = 'text', rows = 4, placeholder = '', hint = '', maxlength = '', dataAttrs = '' } = options;
  const fieldId = `field-${name}-${Math.random().toString(36).slice(2, 8)}`;
  const counter = maxlength
    ? `<span class="field-counter" data-field-counter="${escapeHtml(fieldId)}">${String(value || '').length}/${escapeHtml(maxlength)}</span>`
    : '';
  const control =
    type === 'textarea'
      ? `<textarea class="input textarea" id="${fieldId}" name="${escapeHtml(name)}" rows="${rows}" ${dataAttrs} ${maxlength ? `maxlength="${maxlength}"` : ''} placeholder="${escapeHtml(placeholder)}">${escapeHtml(value || '')}</textarea>`
      : `<input class="input" id="${fieldId}" name="${escapeHtml(name)}" value="${escapeHtml(value || '')}" ${dataAttrs} ${maxlength ? `maxlength="${maxlength}"` : ''} placeholder="${escapeHtml(placeholder)}" type="${escapeHtml(type)}" />`;

  return `
    <label class="field" for="${fieldId}">
      <span class="field-label">${escapeHtml(label)}</span>
      ${control}
      ${hint || counter ? `<span class="field-meta">${hint ? `<span class="field-hint">${escapeHtml(hint)}</span>` : '<span></span>'}${counter}</span>` : ''}
    </label>
  `;
}

function renderSelectField(label, name, value, options, hint = '') {
  const fieldId = `field-${name}-${Math.random().toString(36).slice(2, 8)}`;
  return `
    <label class="field" for="${fieldId}">
      <span class="field-label">${escapeHtml(label)}</span>
      <select class="input select" id="${fieldId}" name="${escapeHtml(name)}">
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
          )
          .join('')}
      </select>
      ${hint ? `<span class="field-meta"><span class="field-hint">${escapeHtml(hint)}</span></span>` : ''}
    </label>
  `;
}

function renderEmptyState(title, body, action = '', className = '') {
  return `
    <div class="empty-state${className ? ` ${escapeHtml(className)}` : ''}">
      <div class="empty-state-icon">${icon('spark', 20)}</div>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
      ${action ? `<div class="empty-state-action">${action}</div>` : ''}
    </div>
  `;
}

function renderSkeletonCards(count = 4, className = 'metric-card') {
  return Array.from({ length: count }, () => `<div class="${className} skeleton-card"><span class="skeleton-line"></span><span class="skeleton-line skeleton-line--lg"></span><span class="skeleton-line skeleton-line--sm"></span></div>`).join('');
}

function renderMetricCard({ label, value, note = '', tone = 'brand', detail = '' }) {
  return `
    <article class="metric-card metric-card--${tone}">
      <span class="metric-kicker"></span>
      <div class="metric-head">
        <span class="metric-label">${escapeHtml(label)}</span>
        ${detail ? `<span class="metric-detail">${escapeHtml(detail)}</span>` : ''}
      </div>
      <strong class="metric-value">${escapeHtml(value)}</strong>
      ${note ? `<span class="metric-note">${escapeHtml(note)}</span>` : ''}
    </article>
  `;
}

function renderPanelHeader(title, note = '', actions = '') {
  return `
    <header class="panel-header">
      <div>
        <h3 class="panel-title">${escapeHtml(title)}</h3>
        ${note ? `<p class="panel-note">${escapeHtml(note)}</p>` : ''}
      </div>
      ${actions ? `<div class="panel-actions">${actions}</div>` : ''}
    </header>
  `;
}

function renderSectionNav(items, group = 'drawer') {
  return `
    <nav class="section-nav" aria-label="分区导航">
      ${items
        .map(
          (item, index) => `
            <button
              class="section-nav-button ${index === 0 ? 'is-active' : ''}"
              type="button"
              data-drawer-section-group="${escapeHtml(group)}"
              data-drawer-section-target="${escapeHtml(item.id)}"
            >
              <span class="section-nav-copy">
                <strong>${escapeHtml(item.label)}</strong>
                ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}
              </span>
              <span class="section-nav-index">${String(index + 1).padStart(2, '0')}</span>
            </button>
          `
        )
        .join('')}
    </nav>
  `;
}

function renderTag(label, tone = 'neutral') {
  return `<span class="tag tag--${tone}">${escapeHtml(label)}</span>`;
}

function renderTimeline(items, className = '') {
  if (!items.length) {
    return renderEmptyState('暂无时间线', '系统还没有记录可展示。');
  }

  return `
    <div class="timeline${className ? ` ${escapeHtml(className)}` : ''}">
      ${items
        .map(
          (item) => `
            <article class="timeline-item">
              <span class="timeline-dot timeline-dot--${escapeHtml(item.tone || 'neutral')}"></span>
              <div class="timeline-copy">
                <div class="timeline-head">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(item.time)}</span>
                </div>
                ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ''}
              </div>
            </article>
          `
        )
        .join('')}
    </div>
  `;
}

function renderTruncatedText(value, lines = 2) {
  return `<span class="truncate truncate-${lines}">${escapeHtml(value || '—')}</span>`;
}

function buildOverviewSeries() {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    days.push({
      key: dayKey(day),
      label: `${String(day.getMonth() + 1).padStart(2, '0')}/${String(day.getDate()).padStart(2, '0')}`,
      created: 0,
      used: 0
    });
  }

  state.codes.forEach((code) => {
    const createdKey = dayKey(code.createdAt);
    const usedKey = dayKey(code.firstUsedAt);
    const createdItem = days.find((day) => day.key === createdKey);
    const usedItem = days.find((day) => day.key === usedKey);
    if (createdItem) {
      createdItem.created += 1;
    }
    if (usedItem) {
      usedItem.used += 1;
    }
  });

  return days;
}

function getCodeSummaryCounts(items = state.codes) {
  return items.reduce(
    (summary, code) => {
      const status = code.status || 'ready';
      summary.total += 1;
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    },
    { total: 0, ready: 0, claimed: 0, expired: 0, disabled: 0 }
  );
}

function getShippingSummary() {
  const orders = state.orders || [];
  const pending = orders.filter((order) => isOrderPending(order)).length;
  const shipped = orders.filter((order) => isOrderShipped(order)).length;
  const abnormal = orders.filter((order) => isOrderAbnormal(order)).length;
  const signed = orders.filter((order) => ['completed', 'downloaded', 'rights_issued'].includes(order.deliveryStatus || '')).length;
  return { pending, shipped, abnormal, signed };
}

function isOrderPhysical(order) {
  return Boolean(order && order.orderType === 'physical');
}

function isOrderPending(order) {
  return isOrderPhysical(order) && ['paid', 'completed'].includes(order.status || '') && ['pending', '', null].includes(order.deliveryStatus);
}

function isOrderShipped(order) {
  return ['delivering', 'completed', 'downloaded', 'rights_issued'].includes(order.deliveryStatus || '');
}

function isOrderAbnormal(order) {
  return Boolean(order && (order.wechatShippingSyncStatus === 'failed' || order.status === 'closed' || order.refundStatus === 'failed'));
}

function getWineCodeStats(wine) {
  const related = state.codes.filter((code) => code.wineId === wine.id);
  const used = related.filter((code) => code.status === 'claimed').length;
  const ready = related.filter((code) => code.status === 'ready').length;
  const lastUsed = related
    .filter((code) => code.firstUsedAt)
    .sort((left, right) => new Date(right.firstUsedAt).getTime() - new Date(left.firstUsedAt).getTime())[0];

  return {
    total: related.length,
    used,
    ready,
      lastUsedAt: lastUsed ? lastUsed.firstUsedAt : ''
  };
}

function renderTopbarActions() {
  if (!els.topbarActions) {
    return;
  }

  const actions = state.activeView === 'codes' ? [] : [{ action: 'refresh-data', label: state.loading ? '刷新中' : '刷新数据', iconName: 'refresh', variant: 'ghost' }];

  if (state.activeView === 'overview') {
    actions.push({ action: 'export-current', label: '导出报告', iconName: 'download', variant: 'secondary' });
  } else if (state.activeView === 'shipping') {
    actions.push({ action: 'export-current', label: '导出订单', iconName: 'download', variant: 'secondary' });
  } else if (state.activeView === 'copy') {
    actions.push({ action: 'save-copy', label: state.copyDirty ? '保存草稿' : '保存草稿', iconName: 'save', variant: 'secondary' });
    actions.push({ action: 'publish-copy', label: '发布到小程序', iconName: 'spark', variant: 'primary' });
  }

  actions.push({ action: 'logout', label: '退出登录', iconName: 'logout', variant: 'ghost' });
  els.topbarActions.innerHTML = actions.map((action) => renderActionButton(action)).join('');
}

function renderPageShells() {
  renderOverviewPage();
  renderWinesShell();
  renderCodesShell();
  renderShippingShell();
  renderCopyShell();
}

function renderOverviewPage() {
  const page = els.pages.overview;
  if (!page) {
    return;
  }

  const summary = getCodeSummaryCounts();
  const shipping = getShippingSummary();
  const cards = [
    {
      label: '今日新增提取码',
      value: formatNumber(state.codes.filter((code) => sameDay(code.createdAt)).length),
      note: `总计 ${formatNumber(summary.total)} 条`,
      tone: 'brand',
      detail: '新增'
    },
    {
      label: '待使用提取码',
      value: formatNumber(summary.ready),
      note: `占比 ${summary.total ? Math.round((summary.ready / summary.total) * 100) : 0}%`,
      tone: 'wine',
      detail: '待核销'
    },
    {
      label: '已使用提取码',
      value: formatNumber(summary.claimed),
      note: `成功率 ${summary.total ? Math.round(((summary.claimed + summary.ready) / Math.max(summary.total, 1)) * 100) : 0}%`,
      tone: 'success',
      detail: '已领取'
    },
    {
      label: '待发货 / 异常',
      value: formatNumber(shipping.pending + shipping.abnormal),
      note: `待发货 ${formatNumber(shipping.pending)} · 异常 ${formatNumber(shipping.abnormal)}`,
      tone: 'warning',
      detail: '物流'
    }
  ];

  const series = buildOverviewSeries();
  const maxSeries = Math.max(...series.map((day) => Math.max(day.created, day.used)), 1);
  const created7d = series.reduce((sum, day) => sum + day.created, 0);
  const used7d = series.reduce((sum, day) => sum + day.used, 0);
  const activeCodes = state.codes.filter((code) => code.status === 'claimed').length;
  const donutTotal = Math.max(summary.total, 1);
  const donutSegments = [
    { label: '待使用', value: summary.ready, color: '#8B2F45' },
    { label: '已使用', value: summary.claimed, color: '#3F8F6B' },
    { label: '已过期', value: summary.expired, color: '#B9863B' },
    { label: '已停用', value: summary.disabled, color: '#9A9A9A' }
  ];
  let cursor = 0;
  const donut = donutSegments
    .map((segment) => {
      const size = Math.max((segment.value / donutTotal) * 100, 0);
      const start = cursor;
      cursor += size;
      return `${segment.color} ${start}% ${cursor}%`;
    })
    .join(', ');

  const recentActions = [...(state.auditLogs || []), ...(state.redeemFailLogs || [])]
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 5)
    .map((item) => {
      const actionLabel =
        item.action === 'codes.batch.created'
          ? '提取码批次创建'
          : item.action === 'code.status.updated'
            ? '提取码状态更新'
            : item.action === 'order.shipping.wechat.requested'
              ? '发货同步'
              : item.action === 'site.updated'
                ? '文案已保存'
                : item.action === 'code.redeem.failed'
                  ? '提取码异常'
                  : item.action === 'wine.updated'
                    ? '酒款已更新'
                    : item.action || '操作记录';
      const body =
        item.reason || item.meta
          ? item.reason || item.code || item.target || ''
          : item.target || '';
      return {
        title: actionLabel,
        body,
        time: formatShortDate(item.createdAt),
        tone: item.action === 'code.redeem.failed' ? 'danger' : 'brand'
      };
    });
  const recentShipping = [...(state.orders || [])]
    .filter((order) => isOrderPhysical(order))
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.shippedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.shippedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 6);

  page.innerHTML = `
    <div class="page-stack page-stack--overview">
      <section class="metric-grid metric-grid--four metric-grid--overview">
        ${state.loading ? renderSkeletonCards(4) : cards.map(renderMetricCard).join('')}
      </section>

      <section class="overview-grid">
        <article class="panel panel--overview overview-card overview-card--trend">
          ${renderPanelHeader('提取码使用趋势', '近 7 天新增与使用情况')}
          <div class="trend-card">
            <div class="trend-summary">
              <div class="trend-summary-item">
                <span>7日新增</span>
                <strong>${formatNumber(created7d)}</strong>
              </div>
              <div class="trend-summary-item">
                <span>7日使用</span>
                <strong>${formatNumber(used7d)}</strong>
              </div>
            </div>
            <div class="trend-bars">
              ${series
                .map(
                  (day) => `
                    <div class="trend-column">
                      <span class="trend-bar trend-bar--create" style="height:${Math.max((day.created / maxSeries) * 100, 4)}%"></span>
                      <span class="trend-bar trend-bar--used" style="height:${Math.max((day.used / maxSeries) * 100, 4)}%"></span>
                      <span class="trend-label">${escapeHtml(day.label)}</span>
                    </div>
                  `
                )
                .join('')}
            </div>
            <div class="trend-foot">
              <span>${renderTag(`累计使用 ${formatNumber(activeCodes)}`, 'success')}</span>
              <span>${renderTag(`7日使用 ${formatNumber(used7d)}`, 'warning')}</span>
              <span>${renderTag(`当前总数 ${formatNumber(summary.total)}`, 'neutral')}</span>
            </div>
          </div>
        </article>

        <article class="panel panel--overview overview-card overview-card--status">
          ${renderPanelHeader('状态分布', '当前提取码状态占比')}
          <div class="status-card-body">
            <div class="status-donut" style="--donut:${escapeHtml(`conic-gradient(${donut})`)}">
              <div class="status-donut-core">
                <strong>${formatNumber(summary.total)}</strong>
                <span>总提取码</span>
              </div>
            </div>
            <div class="status-legend">
              ${donutSegments
                .map((segment) => {
                  const percent = summary.total ? Math.round((segment.value / summary.total) * 100) : 0;
                  return `
                    <div class="status-legend-row">
                      <span class="status-legend-key"><i style="background:${segment.color}"></i>${escapeHtml(segment.label)}</span>
                      <strong>${formatNumber(segment.value)}</strong>
                      <span>${percent}%</span>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </article>

        <article class="panel panel--overview overview-card overview-card--shipping">
          ${renderPanelHeader('最近发货动态', '最近更新的履约订单')}
          <div class="shipping-table">
            <div class="shipping-table-head">
              <span>订单号</span>
              <span>商品</span>
              <span>状态</span>
              <span>更新时间</span>
            </div>
            <div class="shipping-table-body">
              ${recentShipping.length
                ? recentShipping
                    .map((order) => {
                      const product = (order.items && order.items[0] && (order.items[0].productName || order.items[0].trackTitle || order.items[0].specName)) || '待补充商品';
                      return `
                        <button class="shipping-table-row" type="button" data-action="open-shipping-drawer" data-order-id="${escapeHtml(order.id)}">
                          <div class="shipping-table-cell">
                            <strong>${escapeHtml(order.orderNo || '—')}</strong>
                            <p>${escapeHtml(order.address ? order.address.contactName || order.address.mobile : (order.user && (order.user.nickname || order.user.displayName || order.user.mobile)) || '—')}</p>
                          </div>
                          <div class="shipping-table-cell">
                            <strong>${escapeHtml(product)}</strong>
                            <p>${escapeHtml(order.shippingCompany || '待分配物流')}</p>
                          </div>
                          <div class="shipping-table-cell shipping-table-cell--status">
                            ${renderStatusPill(order.deliveryStatus || order.status || 'pending')}
                          </div>
                          <div class="shipping-table-cell shipping-table-cell--time">
                            <strong>${escapeHtml(formatShortDate(order.updatedAt || order.shippedAt || order.createdAt))}</strong>
                          </div>
                        </button>
                      `;
                    })
                    .join('')
                : renderEmptyState('暂无发货更新', '最近还没有新的发货变动。')}
            </div>
          </div>
        </article>

        <article class="panel panel--overview overview-card overview-card--activity">
          ${renderPanelHeader('最近操作', '提取码、发货和文案更新')}
          <div class="activity-list activity-list--scroll activity-list--overview">
            ${recentActions.length
              ? recentActions
                  .map(
                    (item) => `
                      <article class="activity-item">
                        <span class="activity-dot activity-dot--${escapeHtml(item.tone)}"></span>
                        <div class="activity-copy">
                          <strong>${escapeHtml(item.title)}</strong>
                          ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ''}
                        </div>
                        <time>${escapeHtml(item.time)}</time>
                      </article>
                    `
                  )
                  .join('')
              : renderEmptyState('暂无记录', '最近没有可展示的操作记录。')}
          </div>
        </article>
      </section>
    </div>
  `;
}

function renderWinesShell() {
  const page = els.pages.wines;
  if (!page) {
    return;
  }

  const wines = getEnrichedWines();
  const activeCount = wines.filter((wine) => (wine.status || 'active') === 'active').length;
  const archivedCount = wines.filter((wine) => (wine.status || 'active') === 'archived').length;
  const selected = ensureSelectedWine();
  page.innerHTML = `
    <div class="page-stack page-stack--wines">
      <section class="panel panel--wines-toolbar">
        <div class="wine-toolbar-tabs">
          ${[
            { value: 'all', label: '全部', count: formatNumber(wines.length) },
            { value: 'active', label: '启用中', count: formatNumber(activeCount) },
            { value: 'archived', label: '已归档', count: formatNumber(archivedCount) }
          ]
            .map(
              (item) => `
                <button class="wine-tab ${state.filters.wineStatus === item.value ? 'is-active' : ''}" type="button" data-wine-status="${escapeHtml(item.value)}">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(item.count)}</strong>
                </button>
              `
            )
            .join('')}
        </div>
        <div class="wines-toolbar-row">
          <div class="wines-toolbar-filters">
            <label class="search-bar search-bar--wines">
              <span class="search-bar-icon">${icon('search')}</span>
              <input class="input" id="wine-search" type="search" placeholder="搜索酒款、产区、年份或文案" value="${escapeHtml(state.filters.wineSearch)}" data-filter="wine-search" />
            </label>
          </div>
          <div class="wines-toolbar-actions">
            ${renderActionButton({ action: 'open-wine-create', label: '新增酒款', iconName: 'plus', variant: 'primary' })}
            ${renderActionButton({ action: 'clear-wine-filters', label: '清空筛选', iconName: 'close', variant: 'ghost' })}
          </div>
        </div>
      </section>

      <section class="panel panel--wines-list">
        ${renderPanelHeader('酒款列表', `共 ${formatNumber(wines.length)} 款，支持直接编辑和状态管理`)}
        <div class="wine-list-table-head" aria-hidden="true">
          <span>酒款信息</span>
          <span>关键数据</span>
          <span>操作</span>
        </div>
        <div id="wine-list" class="wine-list"></div>
      </section>
    </div>
  `;

  if (selected && !state.selectedWineId) {
    state.selectedWineId = selected.id;
  }
}

function renderWinesContent() {
  const listNode = document.getElementById('wine-list');
  if (!listNode) {
    return;
  }

  const allWines = getEnrichedWines();
  const filtered = getFilteredWines(allWines);
  const selected = ensureSelectedWine();

  if (state.loading && !allWines.length) {
    listNode.innerHTML = renderSkeletonCards(4, 'wine-card');
  } else if (!filtered.length) {
    listNode.innerHTML = renderEmptyState(
      '没有匹配的酒款',
      '试试放宽搜索关键词或切换到启用中 / 已归档。',
      renderActionButton({ action: 'clear-wine-filters', label: '清空筛选', iconName: 'close', variant: 'ghost' }),
      'empty-state--wines'
    );
  } else {
    listNode.innerHTML = filtered
      .map((wine) => {
        const stats = getWineCodeStats(wine);
        const active = wine.id === selected?.id;
        const image = wine.bottleImage || wine.posterImage || wine.giftImage || '';
        const winery = (state.wineries || []).find((item) => item.id === wine.wineryId) || null;
        const metaItems = [wine.vintage || '未设置年份', wine.region || '未设置产区', (winery && winery.name) || '未绑定酒庄'];
        return `
          <article class="wine-card wine-card--row ${active ? 'is-active' : ''}" data-wine-row="${escapeHtml(wine.id)}" tabindex="0" role="button" aria-label="${escapeHtml(`编辑 ${wine.name || '酒款'}`)}">
            <div class="wine-card-media">
              ${renderWineVisual(image, wine.name, wine.name, 'wine-card-placeholder')}
            </div>
            <div class="wine-card-copy">
              <div class="wine-card-head">
                <div>
                  <strong>${escapeHtml(wine.name)}</strong>
                  <span>${escapeHtml(wine.subtitle || '未填写副标题')}</span>
                </div>
              </div>
              <div class="wine-card-meta">
                ${metaItems.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
              </div>
            </div>
            <div class="wine-card-stats wine-card-stats--row">
              <span><b>${formatNumber(stats.total)}</b><em>提取码</em></span>
              <span><b>${formatNumber(stats.used)}</b><em>已使用</em></span>
              <span><b>${escapeHtml(stats.lastUsedAt ? formatShortDate(stats.lastUsedAt) : '—')}</b><em>最近使用</em></span>
            </div>
            <div class="wine-card-actions">
              ${renderStatusPill(wine.status || 'active')}
              ${renderActionButton({ action: 'open-wine-drawer', label: '编辑酒款', iconName: 'edit', variant: 'secondary', title: '编辑酒款' }).replace('<button', `<button data-wine-id="${escapeHtml(wine.id)}"`)}
            </div>
          </article>
        `;
      })
      .join('');
  }
}

function renderCodesShell() {
  const page = els.pages.codes;
  if (!page) {
    return;
  }

  const selectedStatus = state.filters.codeStatus;
  const selectedBatch = state.filters.codeBatch;
  const batches = Array.from(new Set((state.codes || []).map((code) => normalizeText(code.batchNo)).filter(Boolean))).sort((left, right) => right.localeCompare(left, 'zh-CN'));

  page.innerHTML = `
    <div class="page-stack page-stack--codes">
      <section class="panel panel--codes panel--codes-toolbar">
        <div id="codes-summary" class="code-tabs" role="tablist" aria-label="提取码状态"></div>
        <div class="codes-toolbar-row">
          <div class="codes-toolbar-filters">
            <label class="search-bar search-bar--codes">
              <span class="search-bar-icon">${icon('search')}</span>
              <input class="input" id="code-search" type="search" placeholder="搜索提取码、批次、酒款或用户" value="${escapeHtml(state.filters.codeSearch)}" data-filter="code-search" />
            </label>
            <label class="field field--compact">
              <span class="field-label">状态</span>
              <select class="input select" id="code-status-filter" data-filter="code-status">
                ${[
                  { value: 'all', label: '全部状态' },
                  { value: 'ready', label: '待使用' },
                  { value: 'claimed', label: '已使用' },
                  { value: 'expired', label: '已过期' },
                  { value: 'disabled', label: '已停用' }
                ]
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option.value)}" ${selectedStatus === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label class="field field--compact">
              <span class="field-label">批次</span>
              <select class="input select" id="code-batch-filter" data-filter="code-batch">
                <option value="all"${selectedBatch === 'all' ? ' selected' : ''}>全部批次</option>
                ${batches.map((batch) => `<option value="${escapeHtml(batch)}" ${selectedBatch === batch ? 'selected' : ''}>${escapeHtml(batch)}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="codes-toolbar-actions">
            ${renderActionButton({ action: 'open-code-batch', label: '生成提取码', iconName: 'plus', variant: 'primary' })}
            ${renderActionButton({ action: 'export-current', label: '导出数据', iconName: 'download', variant: 'secondary' })}
            ${renderActionButton({ action: 'open-fixed-code', label: '固定码管理', iconName: 'spark', variant: 'secondary' })}
            ${renderActionButton({ action: 'open-code-fail-logs', label: '异常记录', iconName: 'alert', variant: 'ghost' })}
            ${renderActionButton({ action: 'clear-code-filters', label: '清空筛选', iconName: 'close', variant: 'ghost' })}
          </div>
        </div>
      </section>

      <section class="panel panel--codes panel--codes-table">
        ${renderPanelHeader('提取码列表', '主表优先，固定码与异常记录改为弹出层查看')}
        <div class="table-shell table-shell--codes">
          <table class="data-table data-table--codes">
            <thead>
              <tr>
                <th class="table-check">
                  <input type="checkbox" class="checkbox" data-action="toggle-visible-codes" aria-label="全选当前列表" />
                </th>
                <th>提取码</th>
                <th>酒款</th>
                <th>状态</th>
                <th>批次 / 时间</th>
                <th class="table-actions-col">操作</th>
              </tr>
            </thead>
            <tbody id="codes-table-body"></tbody>
          </table>
        </div>
        <div id="codes-pagination" class="table-footer"></div>
      </section>

      <div id="codes-bulk-bar" class="bulk-bar" hidden></div>
    </div>
  `;
}

function renderCodesContent() {
  const summaryNode = document.getElementById('codes-summary');
  const bodyNode = document.getElementById('codes-table-body');
  const paginationNode = document.getElementById('codes-pagination');
  const bulkNode = document.getElementById('codes-bulk-bar');
  if (!summaryNode || !bodyNode || !paginationNode || !bulkNode) {
    return;
  }

  const filtered = getFilteredCodes();
  const summary = getCodeSummaryCounts(getFilteredCodes({ ignoreStatus: true }));
  if (state.selectedCodeId && !filtered.some((code) => code.id === state.selectedCodeId)) {
    state.selectedCodeId = filtered[0] ? filtered[0].id : '';
  }

  const pageSize = Number(state.codePageSize) || 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.codePage = Math.min(Math.max(state.codePage, 1), totalPages);
  const pagination = getCodePagination(filtered);
  const allVisibleSelected = pagination.items.length > 0 && pagination.items.every((code) => state.selectedCodeIds.has(code.id));

  summaryNode.innerHTML = [
    { label: '全部', count: summary.total, status: 'all' },
    { label: '待使用', count: summary.ready, status: 'ready' },
    { label: '已使用', count: summary.claimed, status: 'claimed' },
    { label: '已过期', count: summary.expired, status: 'expired' },
    { label: '已停用', count: summary.disabled, status: 'disabled' }
  ]
    .map(
      (item) => `
        <button class="code-tab ${state.filters.codeStatus === item.status ? 'is-active' : ''}" type="button" role="tab" aria-selected="${state.filters.codeStatus === item.status ? 'true' : 'false'}" data-code-status-tab="${escapeHtml(item.status)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${formatNumber(item.count)}</strong>
        </button>
      `
    )
    .join('');

  bodyNode.innerHTML = pagination.items.length
    ? pagination.items
        .map((code) => {
          const selected = state.selectedCodeId === code.id;
          const checked = state.selectedCodeIds.has(code.id);
          const wineName = (code.wine && code.wine.name) || '未绑定酒款';
          const status = code.status || 'ready';
          const statusMeta =
            status === 'claimed'
              ? `使用于 ${formatShortDate(code.firstUsedAt)}`
              : status === 'expired'
                ? `失效于 ${formatShortDate(code.expiresAt)}`
                : status === 'disabled'
                  ? '已停用'
                  : `截止 ${formatShortDate(code.expiresAt)}`;
          return `
            <tr class="${selected ? 'is-selected' : ''}" data-code-row="${escapeHtml(code.id)}">
              <td class="table-check">
                <input class="checkbox" type="checkbox" data-code-select="${escapeHtml(code.id)}" ${checked ? 'checked' : ''} aria-label="选择 ${escapeHtml(code.redeemCode || '')}" />
              </td>
              <td class="table-col-code">
                <div class="table-primary table-primary--code table-mono">${escapeHtml(code.redeemCode || code.token || '')}</div>
                <div class="table-secondary">${escapeHtml(code.label || '未命名')}</div>
              </td>
              <td class="table-col-wine">
                <button class="table-link table-link--wine" type="button" data-action="open-wine-drawer" data-wine-id="${escapeHtml(code.wineId || '')}">
                  ${escapeHtml(wineName)}
                </button>
                <div class="table-secondary truncate">${escapeHtml(code.track && (code.track.cnTitle || code.track.title) || '—')}</div>
              </td>
              <td class="table-col-status">
                <div class="table-stack table-stack--status">
                  ${renderStatusPill(status)}
                  <div class="table-secondary">${escapeHtml(statusMeta)}</div>
                </div>
              </td>
              <td class="table-col-batch">
                <div class="table-primary table-primary--subtle table-mono">${escapeHtml(code.batchNo || '—')}</div>
                <div class="table-secondary">创建于 ${escapeHtml(formatShortDate(code.createdAt))}</div>
              </td>
              <td class="table-actions-col">
                <div class="table-actions table-actions--codes">
                  ${renderTableIconButton({ action: 'open-code-drawer', iconName: 'eye', label: '查看详情', attrs: `data-code-id="${escapeHtml(code.id)}"` })}
                  ${renderTableIconButton({ action: 'copy-code', iconName: 'copy', label: '复制提取码', attrs: `data-code-id="${escapeHtml(code.id)}"` })}
                </div>
              </td>
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="6">${renderEmptyState('暂无提取码', '当前筛选条件下没有匹配结果。')}</td></tr>`;

  const tokens = getPaginationTokens(pagination.page, pagination.totalPages);
  paginationNode.innerHTML = `
    <div class="table-footer-copy">共 ${formatNumber(pagination.totalItems)} 条记录 · 第 ${formatNumber(pagination.page)} / ${formatNumber(pagination.totalPages)} 页</div>
    <div class="table-footer-actions">
      <div class="pagination-group">
        <button class="pagination-button pagination-button--prev" type="button" data-code-page="${pagination.page - 1}" ${pagination.page <= 1 ? 'disabled' : ''}>‹</button>
        ${tokens
          .map((token) =>
            token === 'ellipsis'
              ? '<span class="pagination-ellipsis">…</span>'
              : `<button class="pagination-button ${token === pagination.page ? 'is-active' : ''}" type="button" data-code-page="${token}">${token}</button>`
          )
          .join('')}
        <button class="pagination-button pagination-button--next" type="button" data-code-page="${pagination.page + 1}" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>›</button>
      </div>
      <label class="footer-select">
        <span>每页</span>
        <select class="input select" data-code-page-size>
          ${[10, 20, 50, 100]
            .map((size) => `<option value="${size}" ${pagination.pageSize === size ? 'selected' : ''}>${size} 条</option>`)
            .join('')}
        </select>
      </label>
    </div>
  `;

  if (state.selectedCodeIds.size > 0) {
    bulkNode.hidden = false;
    bulkNode.innerHTML = `
      <strong>${formatNumber(state.selectedCodeIds.size)} 项已选择</strong>
      <div class="bulk-bar-actions">
        ${renderActionButton({ action: 'bulk-export-codes', label: '批量导出', iconName: 'download', variant: 'secondary' })}
        ${renderActionButton({ action: 'bulk-disable-codes', label: '批量停用', iconName: 'trash', variant: 'danger' })}
        ${renderActionButton({ action: 'clear-code-selection', label: '取消选择', iconName: 'close', variant: 'ghost' })}
      </div>
    `;
  } else {
    bulkNode.hidden = true;
    bulkNode.innerHTML = '';
  }

  const visibleCheckbox = document.querySelector('[data-action="toggle-visible-codes"]');
  if (visibleCheckbox) {
    visibleCheckbox.checked = allVisibleSelected;
  }
}

function renderFixedCodeCard() {
  if (!state.fixedQrcode || !state.fixedQrcode.path) {
    return `
      ${renderPanelHeader('固定码管理', '创建一个长期有效的入口二维码')}
      <div class="fixed-code-blank">
        <div class="fixed-code-preview fixed-code-preview--empty">${icon('spark', 20)}</div>
        <p>尚未生成固定入口码。</p>
        ${renderActionButton({ action: 'open-fixed-code', label: '生成固定码', iconName: 'spark', variant: 'primary' })}
      </div>
    `;
  }

  return `
    ${renderPanelHeader('固定码管理', '长期入口二维码可直接复制和下载')}
    <div class="fixed-code-preview">
      <img src="${escapeHtml(state.fixedQrcode.path)}" alt="固定提取码" />
    </div>
    <div class="fixed-code-copy">
      <div>
        <span>页面</span>
        <strong>${escapeHtml(state.fixedQrcode.page || '')}</strong>
      </div>
      <div>
        <span>链接</span>
        <strong>${escapeHtml(state.fixedQrcode.url || '')}</strong>
      </div>
    </div>
    <div class="panel-actions panel-actions--stack">
      ${renderActionButton({ action: 'open-fixed-code', label: '重新生成', iconName: 'refresh', variant: 'secondary' })}
      ${renderActionButton({ action: 'copy-fixed-code', label: '复制链接', iconName: 'copy', variant: 'ghost' })}
      ${renderActionButton({ action: 'download-fixed-code', label: '下载二维码', iconName: 'download', variant: 'ghost' })}
    </div>
  `;
}

function renderFailLogCard() {
  const items = (state.redeemFailLogs || []).slice(0, 6);
  return `
    ${renderPanelHeader('异常码', '最近失败记录')}
    <div class="fail-list">
      ${items.length
        ? items
            .map(
              (item) => `
                <article class="fail-item">
                  <div>
                    <strong>${escapeHtml(getShortCode(item.code))}</strong>
                    <p>${escapeHtml(REASON_COPY[item.reason] || item.reason || '未知原因')}</p>
                  </div>
                  <time>${escapeHtml(formatShortDate(item.createdAt))}</time>
                </article>
              `
            )
            .join('')
        : renderEmptyState('没有异常记录', '当前没有失败提取码记录。')}
    </div>
  `;
}

function renderFailLogList(limit = 20) {
  const items = (state.redeemFailLogs || []).slice(0, limit);
  return `
    <div class="fail-list">
      ${items.length
        ? items
            .map(
              (item) => `
                <article class="fail-item">
                  <div>
                    <strong>${escapeHtml(getShortCode(item.code))}</strong>
                    <p>${escapeHtml(REASON_COPY[item.reason] || item.reason || '未知原因')}</p>
                  </div>
                  <time>${escapeHtml(formatShortDate(item.createdAt))}</time>
                </article>
              `
            )
            .join('')
        : renderEmptyState('没有异常记录', '当前没有失败提取码记录。')}
    </div>
  `;
}

function renderShippingShell() {
  const page = els.pages.shipping;
  if (!page) {
    return;
  }

  const shippingCounts = getShippingSummary();
  page.innerHTML = `
    <div class="page-stack page-stack--shipping">
      <section class="panel panel--shipping-toolbar">
        <div class="shipping-toolbar-tabs">
          ${[
            { value: 'all', label: '全部', count: formatNumber((state.orders || []).length) },
            { value: 'pending', label: '待发货', count: formatNumber(shippingCounts.pending) },
            { value: 'shipped', label: '已发货', count: formatNumber(shippingCounts.shipped) },
            { value: 'abnormal', label: '异常', count: formatNumber(shippingCounts.abnormal) },
            { value: 'closed', label: '已取消', count: formatNumber((state.orders || []).filter((order) => order.status === 'closed').length) }
          ]
            .map(
              (item) => `
                <button class="shipping-tab ${state.filters.shippingStatus === item.value ? 'is-active' : ''}" type="button" data-shipping-status="${escapeHtml(item.value)}">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(item.count)}</strong>
                </button>
              `
            )
            .join('')}
        </div>
        <div class="shipping-toolbar-row">
          <div class="shipping-toolbar-filters">
            <label class="search-bar search-bar--shipping">
            <span class="search-bar-icon">${icon('search')}</span>
            <input class="input" id="shipping-search" type="search" placeholder="搜索订单号、手机号、收货人或物流信息" value="${escapeHtml(state.filters.shippingSearch)}" data-filter="shipping-search" />
          </label>
          </div>
          <div class="shipping-toolbar-actions">
            ${renderActionButton({ action: 'export-current', label: '导出订单', iconName: 'download', variant: 'secondary' })}
            ${renderActionButton({ action: 'clear-shipping-filters', label: '清空筛选', iconName: 'close', variant: 'ghost' })}
          </div>
        </div>
      </section>

      <section class="metric-grid metric-grid--four metric-grid--shipping" id="shipping-stats"></section>

      <section class="panel panel--shipping-list">
        ${renderPanelHeader('订单列表', '点击行打开右侧详情')}
        <div class="table-shell">
          <table class="data-table data-table--shipping">
            <thead>
              <tr>
                <th>订单号</th>
                <th>用户</th>
                <th>酒款 / 商品</th>
                <th>收货信息</th>
                <th>物流</th>
                <th>状态</th>
                <th>更新时间</th>
                <th class="table-actions-col">操作</th>
              </tr>
            </thead>
            <tbody id="shipping-table-body"></tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderShippingContent() {
  const statsNode = document.getElementById('shipping-stats');
  const bodyNode = document.getElementById('shipping-table-body');
  if (!statsNode || !bodyNode) {
    return;
  }

  const orders = getFilteredOrders();
  const shippingCounts = getShippingSummary();
  statsNode.innerHTML = [
    { label: '待发货', value: formatNumber(shippingCounts.pending), note: '需要处理的实物订单', tone: 'warning' },
    { label: '今日发货', value: formatNumber((state.orders || []).filter((order) => sameDay(order.shippedAt)).length), note: '今天更新的发货记录', tone: 'brand' },
    { label: '异常订单', value: formatNumber(shippingCounts.abnormal), note: '同步失败或关闭状态', tone: 'danger' },
    { label: '已签收', value: formatNumber(shippingCounts.signed), note: '完成或已发放的订单', tone: 'success' }
  ]
    .map(renderMetricCard)
    .join('');

  bodyNode.innerHTML = orders.length
    ? orders
        .map((order) => {
          const user = order.user || {};
          const items = order.items || [];
          const shippingName = order.shippingCompany || '—';
          const shippingNo = order.trackingNo || '—';
          const statusTone = isOrderAbnormal(order) ? 'danger' : isOrderPending(order) ? 'warning' : isOrderShipped(order) ? 'success' : 'neutral';
          const itemSummary = items.map((item) => item.productName || item.trackTitle || order.orderNo).filter(Boolean).join('、') || '—';
          const addressSummary = order.address ? [order.address.contactName, order.address.mobile].filter(Boolean).join(' · ') : order.addressSummary || '—';
          const addressDetail = order.address ? [order.address.provinceCity, order.address.detail].filter(Boolean).join(' · ') : order.addressSummary || '—';

          return `
            <tr data-order-row="${escapeHtml(order.id)}">
              <td class="table-col-order">
                <div class="table-primary">${escapeHtml(order.orderNo || '—')}</div>
                <div class="table-secondary">${escapeHtml(formatShortDate(order.createdAt))}</div>
              </td>
              <td class="table-col-user">
                <div class="table-primary">${escapeHtml(user.nickname || user.displayName || '—')}</div>
                <div class="table-secondary">${escapeHtml(user.mobile || '—')}</div>
              </td>
              <td class="table-col-product">
                <div class="table-primary truncate-2">${escapeHtml(itemSummary)}</div>
                <div class="table-secondary">${escapeHtml(order.orderType === 'physical' ? '实物订单' : '数字权益')}</div>
              </td>
              <td class="table-col-address">
                <div class="table-primary">${escapeHtml(addressSummary)}</div>
                <div class="table-secondary truncate-2">${escapeHtml(addressDetail)}</div>
              </td>
              <td class="table-col-logistics">
                <div class="table-primary">${escapeHtml(shippingName)}</div>
                <div class="table-secondary">${escapeHtml(shippingNo)}</div>
              </td>
              <td class="table-col-order-status">
                <div class="table-stack">
                  <span class="status-pill status-pill--${statusTone}"><span class="status-pill-dot"></span><span>${escapeHtml(STATUS_COPY[order.deliveryStatus || order.status || 'pending'] || order.deliveryStatus || order.status || '待发货')}</span></span>
                  <div class="table-secondary">${escapeHtml(order.wechatShippingSyncStatus || '—')}</div>
                </div>
              </td>
              <td class="table-col-order-updated">
                <div class="table-primary">${escapeHtml(formatShortDate(order.updatedAt || order.shippedAt || order.completedAt || order.paidAt || order.createdAt))}</div>
                <div class="table-secondary">${escapeHtml(order.shippedAt ? `已发货 ${formatShortDate(order.shippedAt)}` : '—')}</div>
              </td>
              <td class="table-actions-col">
                <div class="table-actions table-actions--shipping">
                  ${renderTableIconButton({ action: 'open-shipping-drawer', iconName: 'eye', label: '查看详情', attrs: `data-order-id="${escapeHtml(order.id)}"` })}
                  ${isOrderPhysical(order) ? renderTableIconButton({ action: 'open-shipping-modal', iconName: 'truck', label: '发货', attrs: `data-order-id="${escapeHtml(order.id)}"` }) : ''}
                </div>
              </td>
            </tr>
          `;
        })
        .join('')
    : `<tr><td colspan="8">${renderEmptyState('暂无订单', '当前筛选下没有匹配的订单。')}</td></tr>`;
}

function renderCopyShell() {
  const page = els.pages.copy;
  if (!page) {
    return;
  }

  ensureCopyDraft();
  page.innerHTML = `
    <div class="page-stack page-stack--copy">
      <div class="copy-layout">
      <aside class="panel copy-nav-panel">
        <header class="panel-header">
          <div>
            <h3 class="panel-title">文案分类</h3>
            <p class="panel-note">选择左侧分类，中间编辑，右侧实时预览。</p>
          </div>
          <span class="copy-status-pill ${state.copyDirty ? 'is-dirty' : 'is-saved'}" id="copy-dirty-pill">${state.copyDirty ? '未保存' : '已保存'}</span>
        </header>
        <div id="copy-nav" class="copy-nav"></div>
      </aside>
      <section class="panel copy-editor-panel">
        <div id="copy-editor"></div>
      </section>
      <aside class="panel copy-preview-panel">
        <header class="panel-header">
          <div>
            <h3 class="panel-title">实时预览</h3>
            <p class="panel-note">模拟小程序页面布局和按钮文案。</p>
          </div>
        </header>
        <div id="copy-preview" class="copy-preview"></div>
      </aside>
      </div>
    </div>
  `;
}

function renderCopyNav() {
  const nav = document.getElementById('copy-nav');
  const pill = document.getElementById('copy-dirty-pill');
  if (!nav || !pill) {
    return;
  }

  ensureCopyDraft();
  pill.textContent = state.copyDirty ? '未保存' : '已保存';
  pill.classList.toggle('is-dirty', state.copyDirty);
  pill.classList.toggle('is-saved', !state.copyDirty);

  nav.innerHTML = COPY_PAGES.map((page) => {
    const active = state.copyActivePage === page.key;
    return `
      <button class="copy-nav-item ${active ? 'is-active' : ''}" type="button" data-copy-page="${escapeHtml(page.key)}">
        <strong>${escapeHtml(page.label)}</strong>
        <span>${escapeHtml(page.helper)}</span>
      </button>
    `;
  }).join('');
}

function renderCopyEditor() {
  const editor = document.getElementById('copy-editor');
  if (!editor) {
    return;
  }

  const draft = ensureCopyDraft();
  const pageData = currentCopyPage();
  editor.innerHTML = `
    <form class="copy-form" id="copy-form">
      <header class="panel-header">
        <div>
          <h3 class="panel-title">${escapeHtml(pageData.badge || '文案编辑')}</h3>
          <p class="panel-note">字符数受限，保存前会统一校验。</p>
        </div>
        <div class="panel-actions">
          ${renderTag(`当前页：${COPY_PAGES.find((page) => page.key === draft.activePage)?.label || '首页'}`, 'brand')}
        </div>
      </header>

      <div class="copy-form-grid">
        ${renderField('页签标识', 'badge', pageData.badge, { hint: '建议 2 - 8 个字。', maxlength: 40, dataAttrs: 'data-copy-field="badge"' })}
        ${renderField('标题', 'title', pageData.title, { hint: '建议 6 - 16 个字。', maxlength: 80, dataAttrs: 'data-copy-field="title"' })}
        ${renderField('副标题', 'subtitle', pageData.subtitle, { hint: '建议 8 - 20 个字。', maxlength: 120, dataAttrs: 'data-copy-field="subtitle"' })}
        ${renderField('正文', 'body', pageData.body, { type: 'textarea', hint: '最多 420 字。', maxlength: 420, dataAttrs: 'data-copy-field="body"' })}
        ${renderField('主按钮', 'primaryAction', pageData.primaryAction, { hint: '建议使用动词。', maxlength: 32, dataAttrs: 'data-copy-field="primaryAction"' })}
        ${renderField('次按钮', 'secondaryAction', pageData.secondaryAction, { hint: '作为次级动作。', maxlength: 32, dataAttrs: 'data-copy-field="secondaryAction"' })}
        ${renderField('备注', 'note', pageData.note, { type: 'textarea', hint: '补充运营说明或字数提醒。', maxlength: 120, dataAttrs: 'data-copy-field="note"' })}
      </div>

      <footer class="copy-form-footer">
        ${renderActionButton({ action: 'save-copy', label: '保存草稿', iconName: 'save', variant: 'secondary' })}
        ${renderActionButton({ action: 'publish-copy', label: '发布到小程序', iconName: 'spark', variant: 'primary' })}
      </footer>
    </form>
  `;
}

function updateCopyPreview() {
  const preview = document.getElementById('copy-preview');
  if (!preview) {
    return;
  }

  const draft = ensureCopyDraft();
  const pageData = currentCopyPage();
  const image = COPY_PAGE_IMAGES[draft.activePage] || COPY_PAGE_IMAGES.home;
  preview.innerHTML = `
    <div class="phone-shell">
      <div class="phone-notch"></div>
      <div class="phone-screen">
        <header class="phone-top">
          <span>9:41</span>
          <div class="phone-top-icons"><span></span><span></span><span></span></div>
        </header>
        <div class="miniapp-preview">
          <div class="miniapp-cover">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(pageData.title || pageData.badge || 'preview')}" />
          </div>
          <div class="miniapp-card">
            <span class="miniapp-badge">${escapeHtml(pageData.badge || '页面')}</span>
            <strong>${escapeHtml(pageData.title || '')}</strong>
            <p>${escapeHtml(pageData.subtitle || '')}</p>
            <span class="miniapp-body">${escapeHtml(pageData.body || '')}</span>
            <div class="miniapp-actions">
              <button type="button" class="miniapp-primary">${escapeHtml(pageData.primaryAction || '确定')}</button>
              <button type="button" class="miniapp-secondary">${escapeHtml(pageData.secondaryAction || '返回')}</button>
            </div>
            <small>${escapeHtml(pageData.note || '')}</small>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getFilteredOrders() {
  const query = normalizeText(state.filters.shippingSearch).toLowerCase();
  return [...(state.orders || [])]
    .filter((order) => {
      const status = normalizeText(state.filters.shippingStatus);
      const matchesStatus =
        status === 'all' ||
        (status === 'pending' && isOrderPending(order)) ||
        (status === 'shipped' && isOrderShipped(order)) ||
        (status === 'abnormal' && isOrderAbnormal(order)) ||
        (status === 'closed' && order.status === 'closed');

      const user = order.user || {};
      const searchHaystack = [
        order.orderNo,
        order.addressSummary,
        order.shippingCompany,
        order.trackingNo,
        user.nickname,
        user.mobile,
        user.displayName,
        ...(order.items || []).map((item) => item.productName || item.trackTitle || item.specName || '')
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesQuery = !query || searchHaystack.includes(query);
      return matchesStatus && matchesQuery;
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function getFilteredCodes(options = {}) {
  const { ignoreStatus = false } = options;
  const query = normalizeText(state.filters.codeSearch).toLowerCase();
  return [...(state.codes || [])]
    .filter((code) => {
      const matchesStatus = ignoreStatus || state.filters.codeStatus === 'all' || (code.status || 'ready') === state.filters.codeStatus;
      const matchesBatch = state.filters.codeBatch === 'all' || normalizeText(code.batchNo) === state.filters.codeBatch;
      const searchHaystack = [
        code.redeemCode,
        code.label,
        code.batchNo,
        code.firstUserId,
        code.wine && code.wine.name,
        code.wine && code.wine.subtitle,
        code.track && (code.track.cnTitle || code.track.title)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = !query || searchHaystack.includes(query);
      return matchesStatus && matchesBatch && matchesQuery;
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function getSelectedCodeRows() {
  return (state.codes || []).filter((code) => state.selectedCodeIds.has(code.id));
}

function getCodeTimeline(code) {
  const items = [
    {
      title: '创建提取码',
      body: `${code.batchNo || '无批次'} · ${formatShortDate(code.createdAt)}`,
      time: formatShortDate(code.createdAt),
      tone: 'brand'
    }
  ];

  if (code.firstUsedAt) {
    items.push({
      title: '首次使用',
      body: `用户 ${escapeHtml(code.firstUserId || '—')}`,
      time: formatShortDate(code.firstUsedAt),
      tone: 'success'
    });
  }

  if (code.expiresAt) {
    items.push({
      title: code.status === 'expired' ? '已过期' : '到期时间',
      body: formatShortDate(code.expiresAt),
      time: formatShortDate(code.expiresAt),
      tone: code.status === 'expired' ? 'warning' : 'neutral'
    });
  }

  (state.auditLogs || [])
    .filter((item) => item.target === code.id || (normalizeText(item.meta && item.meta.requestId).includes(code.id) && item.action.includes('code')))
    .slice(0, 4)
    .forEach((item) => {
      items.push({
        title:
          item.action === 'code.status.updated'
            ? '状态更新'
            : item.action === 'codes.batch.created'
              ? '批次创建'
              : item.action === 'code.redeem.failed'
                ? '使用失败'
                : item.action || '操作',
        body: item.target || '',
        time: formatShortDate(item.createdAt),
        tone: item.action === 'code.redeem.failed' ? 'danger' : 'brand'
      });
    });

  return items;
}

function getOrderTimeline(order) {
  const items = [
    {
      title: '订单创建',
      body: formatShortDate(order.createdAt),
      time: formatShortDate(order.createdAt),
      tone: 'brand'
    }
  ];

  if (order.paidAt) {
    items.push({ title: '支付完成', body: formatShortDate(order.paidAt), time: formatShortDate(order.paidAt), tone: 'success' });
  }

  if (order.shippedAt) {
    items.push({ title: '发货', body: `${order.shippingCompany || '—'} · ${order.trackingNo || '—'}`, time: formatShortDate(order.shippedAt), tone: 'wine' });
  }

  if (order.completedAt) {
    items.push({ title: '签收 / 完成', body: formatShortDate(order.completedAt), time: formatShortDate(order.completedAt), tone: 'success' });
  }

  if (order.refundRequestedAt) {
    items.push({ title: '退款申请', body: formatShortDate(order.refundRequestedAt), time: formatShortDate(order.refundRequestedAt), tone: 'warning' });
  }

  if (order.closedAt) {
    items.push({ title: '已关闭', body: formatShortDate(order.closedAt), time: formatShortDate(order.closedAt), tone: 'neutral' });
  }

  (state.auditLogs || [])
    .filter((item) => item.target === order.id)
    .slice(0, 4)
    .forEach((item) => {
      items.push({
        title:
          item.action === 'order.shipping.wechat.requested'
            ? '请求发货同步'
            : item.action === 'order.shipping.wechat.synced'
              ? '发货同步成功'
              : item.action === 'order.shipping.wechat.failed'
                ? '发货同步失败'
                : item.action === 'order.updated'
                  ? '订单更新'
                  : item.action || '操作',
        body: item.target || '',
        time: formatShortDate(item.createdAt),
        tone: item.action === 'order.shipping.wechat.failed' ? 'danger' : 'brand'
      });
    });

  return items.sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());
}

function findOrderById(orderId) {
  return (state.orders || []).find((order) => order.id === orderId) || null;
}

function findWineById(wineId) {
  return (state.wines || []).find((wine) => wine.id === wineId) || null;
}

function findCodeById(codeId) {
  return (state.codes || []).find((code) => code.id === codeId) || null;
}

function getActiveSelectedWine() {
  const allWines = getEnrichedWines();
  if (!allWines.length) {
    return null;
  }
  const filtered = getFilteredWines(allWines);
  const pool = filtered.length ? filtered : allWines;
  if (!pool.some((wine) => wine.id === state.selectedWineId)) {
    state.selectedWineId = pool[0].id;
  }
  return allWines.find((wine) => wine.id === state.selectedWineId) || pool[0];
}

function setButtonLoading(button, label) {
  if (!button) {
    return () => {};
  }

  const original = button.innerHTML;
  button.disabled = true;
  button.dataset.originalHtml = original;
  button.innerHTML = `<span class="button-spinner"></span><span>${escapeHtml(label || '处理中')}</span>`;

  return () => {
    button.disabled = false;
    button.innerHTML = button.dataset.originalHtml || original;
    delete button.dataset.originalHtml;
  };
}

function getActionButton(event) {
  return event && event.target ? event.target.closest('button[data-action]') : null;
}

function renderAllData() {
  renderTopbarActions();
  renderOverviewPage();
  renderWinesContent();
  renderCodesContent();
  renderShippingContent();
  renderCopyNav();
  renderCopyEditor();
  updateCopyPreview();
  syncFieldCounters();
}

async function loadAdminData() {
  state.loading = true;
  renderTopbarActions();
  renderAllData();

  const [
    health,
    dashboard,
    siteContent,
    wines,
    wineries,
    tracks,
    codes,
    orders,
    auditLogs,
    redeemFailLogs
  ] = await Promise.all([
    api('/api/health'),
    maybeApi('dashboard.read', '/api/admin/dashboard', { cards: [], metrics: {}, recentOrders: [], hotProducts: [], codeSummary: {} }),
    maybeApi('wineries.read', '/api/admin/site-content', { item: null }),
    maybeApi('wines.read', '/api/admin/wines', { items: [] }),
    maybeApi('wineries.read', '/api/admin/wineries', { items: [] }),
    maybeApi('tracks.read', '/api/admin/tracks', { items: [] }),
    maybeApi('codes.read', '/api/admin/codes', { items: [] }),
    maybeApi('orders.read', '/api/admin/orders', { items: [] }),
    maybeApi('audit.read', '/api/admin/audit-logs?limit=120', { items: [] }),
    maybeApi('codes.read', '/api/admin/redeem-fail-logs?limit=120', { items: [] })
  ]);

  state.health = health;
  state.dashboard = dashboard;
  state.siteContent = siteContent.item || state.siteContent;
  state.wines = wines.items || [];
  state.wineries = wineries.items || [];
  state.tracks = tracks.items || [];
  state.codes = codes.items || [];
  state.orders = orders.items || [];
  state.auditLogs = auditLogs.items || [];
  state.redeemFailLogs = redeemFailLogs.items || [];
  state.lastLoadedAt = new Date().toISOString();
  state.selectedWineId = getActiveSelectedWine() ? state.selectedWineId : (state.wines[0] && state.wines[0].id) || '';
  if (!state.selectedCodeId && state.codes[0]) {
    state.selectedCodeId = state.codes[0].id;
  }
  if (!state.selectedOrderId && state.orders[0]) {
    state.selectedOrderId = state.orders[0].id;
  }

  if (!state.copyDirty) {
    state.copyDraft = clone((state.siteContent && state.siteContent.miniappCopy) || ensureCopyDraftSource());
    state.copyActivePage = state.copyDraft.activePage || 'home';
  }

  state.loading = false;
  updateSessionPill();
  updatePermissionUi();
  renderPageShells();
  setView(state.activeView);
  renderAllData();
}

function renderWineCreateModal() {
  openModal('wine-create');
}

function renderCodeBatchModal() {
  openModal('code-batch', {});
}

function renderFixedCodeModal() {
  openModal('fixed-code');
}

function renderShippingModal(orderId) {
  openModal('shipping', { orderId });
}

function renderConfirmDialog({ title, body, confirmLabel = '确认', tone = 'primary', eyebrow = '确认操作', onConfirm }) {
  openModal('confirm', { title, body, confirmLabel, tone, eyebrow }, onConfirm);
}

function openWineDrawerById(wineId) {
  const wine = findWineById(wineId) || getActiveSelectedWine();
  if (!wine) {
    showToast('暂无可编辑的酒款。', 'warning');
    return;
  }
  state.selectedWineId = wine.id;
  openDrawer('wine', { wineId: wine.id });
  renderWinesContent();
}

function openCodeDrawerById(codeId) {
  const code = findCodeById(codeId) || state.codes[0];
  if (!code) {
    showToast('暂无可查看的提取码。', 'warning');
    return;
  }
  state.selectedCodeId = code.id;
  openDrawer('code', { codeId: code.id });
  renderCodesContent();
}

function openShippingDrawerById(orderId) {
  const order = findOrderById(orderId) || state.orders[0];
  if (!order) {
    showToast('暂无可查看的订单。', 'warning');
    return;
  }
  state.selectedOrderId = order.id;
  openDrawer('shipping', { orderId: order.id });
  renderShippingContent();
}

function renderWinesPageIfNeeded() {
  renderWinesShell();
  renderWinesContent();
}

function renderCodesPageIfNeeded() {
  renderCodesShell();
  renderCodesContent();
}

function renderShippingPageIfNeeded() {
  renderShippingShell();
  renderShippingContent();
}

function renderCopyPage() {
  renderCopyNav();
  renderCopyEditor();
  updateCopyPreview();
}

function openCodeFailPanel() {
  openModal('code-fails');
}

function exportCurrentView() {
  if (state.activeView === 'overview') {
    downloadJson('hongjiu-dashboard-report.json', {
      exportedAt: new Date().toISOString(),
      health: state.health,
      dashboard: state.dashboard,
      wines: state.wines.length,
      codes: state.codes.length,
      orders: state.orders.length
    });
    showToast('运营报告已导出。', 'success');
    return;
  }

  if (state.activeView === 'wines') {
    downloadJson('hongjiu-wines.json', state.wines);
    showToast('酒款数据已导出。', 'success');
    return;
  }

  if (state.activeView === 'codes') {
    window.open('/api/admin/codes/export', '_blank', 'noopener');
    showToast('提取码 CSV 已开始下载。', 'success');
    return;
  }

  if (state.activeView === 'shipping') {
    window.open('/api/admin/orders/export', '_blank', 'noopener');
    showToast('订单 CSV 已开始下载。', 'success');
    return;
  }

  if (state.activeView === 'copy') {
    downloadJson('hongjiu-miniapp-copy.json', ensureCopyDraft());
    showToast('文案草稿已导出。', 'success');
  }
}

async function withButtonTask(button, loadingLabel, task) {
  const restore = setButtonLoading(button, loadingLabel);
  try {
    return await task();
  } finally {
    restore();
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  els.loginError.textContent = '';
  const button = event.submitter;

  const payload = await withButtonTask(button, '登录中', () =>
    api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: els.loginUsername.value.trim(),
        password: els.loginPassword.value
      })
    })
  );

  if (!payload) {
    els.loginError.textContent = '账号或密码错误。';
    return;
  }

  rememberSession(payload.token, payload.user);
  toggleLogin(false);
  updateSessionPill();
  await loadAdminData();
  showToast('登录成功。', 'success');
}

async function handleLogout() {
  await runTask(() => api('/api/admin/logout', { method: 'POST' }), null);
  clearSession();
  toggleLogin(true);
  updateSessionPill();
}

async function handleRefreshData(button) {
  if (state.activeView === 'copy' && state.copyDirty) {
    renderConfirmDialog({
      title: '放弃未保存内容',
      body: '刷新数据会覆盖当前未保存的文案改动。是否继续？',
      confirmLabel: '继续刷新',
      tone: 'warning',
      onConfirm: async () => {
        closeModal();
        await withButtonTask(button, '刷新中', () => loadAdminData());
        showToast('数据已刷新。', 'success');
      }
    });
    return;
  }

  await withButtonTask(button, '刷新中', () => loadAdminData());
  showToast('数据已刷新。', 'success');
}

function clearWineFilters() {
  state.filters.wineSearch = '';
  state.filters.wineStatus = 'all';
  renderWinesShell();
  renderWinesContent();
}

function clearCodeFilters() {
  state.filters.codeSearch = '';
  state.filters.codeStatus = 'all';
  state.filters.codeWine = 'all';
  state.filters.codeBatch = 'all';
  state.codePage = 1;
  state.selectedCodeIds.clear();
  renderCodesShell();
  renderCodesContent();
}

function clearShippingFilters() {
  state.filters.shippingSearch = '';
  state.filters.shippingStatus = 'all';
  renderShippingShell();
  renderShippingContent();
}

function handleTopbarAction(action, button) {
  if (action === 'refresh-data') {
    handleRefreshData(button);
    return;
  }

  if (action === 'export-current') {
    exportCurrentView();
    return;
  }

  if (action === 'logout') {
    handleLogout();
    return;
  }

  if (action === 'open-wine-create') {
    openModal('wine-create');
    return;
  }

  if (action === 'open-code-batch') {
    openModal('code-batch', {});
    return;
  }

  if (action === 'open-fixed-code') {
    openModal('fixed-code');
    return;
  }

  if (action === 'open-code-fail-logs') {
    openCodeFailPanel();
    return;
  }

  if (action === 'save-copy') {
    handleCopySave(button);
    return;
  }

  if (action === 'publish-copy') {
    handleCopyPublish(button);
    return;
  }
}

async function handleWineCreateSubmit(form, button) {
  const payload = serializeForm(form);
  const result = await withButtonTask(button, '创建中', () =>
    api('/api/admin/wines', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

  if (!result || !result.item) {
    return;
  }

  state.selectedWineId = result.item.id;
  closeModal();
  await loadAdminData();
  setView('wines');
  showToast('新酒款已创建。', 'success');
}

async function handleWineSaveSubmit(form, button) {
  const wineId = form.dataset.wineId;
  const payload = serializeForm(form);
  const result = await withButtonTask(button, '保存中', () =>
    api(`/api/admin/wines/${wineId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  );

  if (!result) {
    return;
  }

  closeDrawer();
  await loadAdminData();
  setView('wines');
  showToast('酒款已保存。', 'success');
}

function confirmWineDelete(wineId) {
  renderConfirmDialog({
    title: '归档或删除酒款',
    body: '如果这款酒已经关联提取码或订单，系统会自动改为归档。是否继续？',
    confirmLabel: '继续',
    tone: 'danger',
    onConfirm: async () => {
      closeModal();
      const result = await runTask(
        () =>
          api(`/api/admin/wines/${wineId}`, {
            method: 'DELETE'
          }),
        null
      );
      if (!result) {
        return;
      }
      closeDrawer();
      await loadAdminData();
      setView('wines');
      showToast(result.result && result.result.mode === 'deleted' ? '酒款已删除。' : '酒款已归档。', 'success');
    }
  });
}

async function handleCodeBatchSubmit(form, button) {
  const payload = serializeForm(form);
  const result = await withButtonTask(button, '生成中', () =>
    api('/api/admin/code-batches', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  );

  if (!result) {
    return;
  }

  closeModal();
  state.codePage = 1;
  state.selectedCodeIds.clear();
  await loadAdminData();
  setView('codes');
  showToast('提取码批次已生成。', 'success');
}

function promptCodeStatusUpdate(form) {
  const codeId = form.dataset.codeId;
  const status = form.status.value;
  const destructive = ['expired', 'disabled'].includes(status);
  const submit = async () => {
    const result = await runTask(
      () =>
        api(`/api/admin/codes/${codeId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status })
        }),
      '提取码状态已更新。'
    );
    if (!result) {
      return;
    }
    closeDrawer();
    await loadAdminData();
    setView('codes');
  };

  if (destructive) {
    renderConfirmDialog({
      title: '更新提取码状态',
      body: '该状态变更会影响核销结果，是否继续？',
      confirmLabel: '继续更新',
      tone: 'warning',
      onConfirm: async () => {
        closeModal();
        await submit();
      }
    });
    return;
  }

  submit();
}

async function handleFixedCodeGenerate(button) {
  const result = await withButtonTask(button, '生成中', () =>
    api('/api/admin/qrcode/fixed-redeem', {
      method: 'POST'
    })
  );

  if (!result) {
    return;
  }

  state.fixedQrcode = result;
  renderCodesContent();
  renderModal();
  showToast('固定入口码已生成。', 'success');
}

async function handleShippingSubmit(form, button) {
  const orderId = form.dataset.orderId;
  const payload = serializeForm(form);
  const result = await withButtonTask(button, '同步中', () =>
    api(`/api/admin/orders/${orderId}/shipping/wechat`, {
      method: 'POST',
      body: JSON.stringify({
        shippingCompany: payload.shippingCompany,
        trackingNo: payload.trackingNo,
        transactionId: payload.transactionId
      })
    })
  );

  if (!result) {
    return;
  }

  if (payload.deliveryStatus && payload.deliveryStatus !== 'delivering') {
    await runTask(
      () =>
        api(`/api/admin/orders/${orderId}`, {
          method: 'PUT',
          body: JSON.stringify({
            deliveryStatus: payload.deliveryStatus,
            shippingCompany: payload.shippingCompany,
            trackingNo: payload.trackingNo
          })
        }),
      null
    );
  }

  closeModal();
  await loadAdminData();
  setView('shipping');
  showToast('发货信息已同步。', 'success');
}

async function handleCopySave(button, options = {}) {
  const { showToast: shouldToast = true } = options;
  ensureCopyDraft();
  const restore = button ? setButtonLoading(button, '保存中') : () => {};
  try {
    const result = await api('/api/admin/site-content', {
      method: 'PUT',
      body: JSON.stringify({
        miniappCopyJson: JSON.stringify(state.copyDraft)
      })
    });

    saveCopySnapshot(result.item);
    renderCopyPage();
    if (shouldToast) {
      showToast('文案草稿已保存。', 'success');
    }
    return result;
  } catch (error) {
    showToast(getErrorMessage(error), 'error');
    return null;
  } finally {
    restore();
  }
}

async function handleCopyPublish(button) {
  renderConfirmDialog({
    title: '发布到小程序',
    body: '发布后小程序会读取最新的文案配置。是否继续？',
    confirmLabel: '发布',
    tone: 'primary',
    onConfirm: async () => {
      closeModal();
      const saved = await handleCopySave(button, { showToast: false });
      if (!saved) {
        return;
      }
      showToast('文案已发布到小程序。', 'success');
    }
  });
}

function toggleCodeSelection(codeId) {
  if (state.selectedCodeIds.has(codeId)) {
    state.selectedCodeIds.delete(codeId);
  } else {
    state.selectedCodeIds.add(codeId);
  }
  renderCodesContent();
}

function toggleVisibleCodes(selected) {
  const visible = getCodePagination(getFilteredCodes()).items;
  if (selected) {
    visible.forEach((code) => state.selectedCodeIds.add(code.id));
  } else {
    visible.forEach((code) => state.selectedCodeIds.delete(code.id));
  }
  renderCodesContent();
}

function clearCodeSelection() {
  state.selectedCodeIds.clear();
  renderCodesContent();
}

function exportSelectedCodes() {
  const codes = getSelectedCodeRows();
  if (!codes.length) {
    showToast('请先选择提取码。', 'warning');
    return;
  }

  const header = '提取码,酒款,批次,状态,创建时间,使用时间,使用用户';
  const rows = codes.map((code) => {
    const wineName = (code.wine && code.wine.name) || '';
    return [
      code.redeemCode || code.token || '',
      wineName,
      code.batchNo || '',
      code.status || '',
      code.createdAt || '',
      code.firstUsedAt || '',
      code.firstUserId || ''
    ].join(',');
  });
  downloadText('selected-redeem-codes.csv', `\ufeff${[header, ...rows].join('\n')}`, 'text/csv;charset=utf-8');
  showToast('已导出选中提取码。', 'success');
}

function disableSelectedCodes() {
  const codes = getSelectedCodeRows();
  if (!codes.length) {
    showToast('请先选择提取码。', 'warning');
    return;
  }

  renderConfirmDialog({
    title: '批量停用提取码',
    body: `将停用 ${codes.length} 项提取码，是否继续？`,
    confirmLabel: '批量停用',
    tone: 'danger',
    onConfirm: async () => {
      closeModal();
      for (const code of codes) {
        await runTask(
          () =>
            api(`/api/admin/codes/${code.id}/status`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'disabled' })
            }),
          null
        );
      }
      state.selectedCodeIds.clear();
      await loadAdminData();
      setView('codes');
      showToast('已批量停用提取码。', 'success');
    }
  });
}

async function handleWineUpload(fileInput) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    return;
  }

  const uploaded = await runTask(
    () => uploadImageAsset(file, fileInput.dataset.uploadFolder || 'wines'),
    '图片已上传。'
  );

  if (!uploaded || !uploaded.item || !uploaded.item.url) {
    fileInput.value = '';
    return;
  }

  const field = fileInput.closest('.image-field');
  const targetName = fileInput.dataset.uploadTarget;
  const targetInput = field && field.querySelector(`input[name="${escapeSelector(targetName)}"]`);
  if (targetInput) {
    targetInput.value = uploaded.item.url;
    updateImagePreview(targetInput);
  }

  fileInput.value = '';
}



function openLayer(layer) {
  if (!layer) {
    return;
  }
  layer.hidden = false;
  syncFieldCounters(layer);
  requestAnimationFrame(() => layer.classList.add('is-open'));
}

function closeLayer(layer) {
  if (!layer) {
    return;
  }
  layer.classList.remove('is-open');
  window.setTimeout(() => {
    layer.hidden = true;
  }, 220);
}

function openDrawer(type, data = {}) {
  state.drawer = { type, data };
  renderDrawer();
}

function closeDrawer() {
  state.drawer = { type: '', data: null };
  closeLayer(els.drawerLayer);
}

function openModal(type, data = {}, onConfirm = null) {
  state.modal = { type, data, onConfirm };
  renderModal();
}

function closeModal() {
  state.modal = { type: '', data: null, onConfirm: null };
  closeLayer(els.modalLayer);
}

function renderDrawer() {
  if (!els.drawerPanel) {
    return;
  }

  const { type, data } = state.drawer;
  els.drawerPanel.className = type ? `drawer-panel drawer-panel--${type}` : 'drawer-panel';
  if (!type) {
    closeLayer(els.drawerLayer);
    return;
  }

  if (type === 'wine') {
    const wine = findWineById(data.wineId) || getActiveSelectedWine();
    if (!wine) {
      closeDrawer();
      return;
    }
    const winery = (state.wineries || []).find((item) => item.id === wine.wineryId) || {};
    const stats = getWineCodeStats(wine);
    const tracks = (state.tracks || []).filter((track) => track.wineId === wine.id);
    const wineSections = [
      { id: 'wine-section-basics', label: '基础信息', note: '名称、产区与状态' },
      { id: 'wine-section-copy', label: '文案', note: '故事、摘要与品牌口径' },
      { id: 'wine-section-visual', label: '视觉', note: '封面、瓶身与礼盒图片' },
      { id: 'wine-section-related', label: '关联', note: '音乐与扩展内容' }
    ];
    els.drawerPanel.innerHTML = `
      <header class="drawer-head drawer-head--wine">
        <div class="drawer-head-copy">
          <span class="drawer-eyebrow">酒款编辑</span>
          <h3>编辑酒款</h3>
          <p>左侧固定导航，右侧滚动编辑详情和视觉内容。</p>
        </div>
        <button class="icon-button" type="button" data-close-drawer aria-label="关闭">${icon('close')}</button>
      </header>

      <div class="drawer-body drawer-body--wine">
        <aside class="drawer-rail">
          <div class="drawer-rail-card">
            <span class="drawer-rail-label">编辑分区</span>
            ${renderSectionNav(wineSections, 'wine')}
          </div>
        </aside>

        <div class="drawer-main drawer-main--wine">
          <div class="drawer-content-scroll">
            <div class="drawer-hero drawer-hero--wine">
              <div class="drawer-hero-media">${renderWineVisual(wine.bottleImage || wine.posterImage || wine.giftImage || '', wine.name, wine.name, 'drawer-hero-placeholder')}</div>
              <div class="drawer-hero-copy">
                <div class="drawer-hero-top">
                  <div class="drawer-hero-copy-block">
                    <strong>${escapeHtml(wine.name)}</strong>
                    <p>${escapeHtml(wine.subtitle || '未填写副标题')}</p>
                  </div>
                  <div class="drawer-hero-row">
                    ${renderStatusPill(wine.status || 'active')}
                    ${renderTag(winery.name || '未绑定酒庄', 'neutral')}
                  </div>
                </div>
                <div class="drawer-hero-stats">
                  <div><strong>${formatNumber(stats.total)}</strong><span>提取码</span></div>
                  <div><strong>${formatNumber(stats.used)}</strong><span>已使用</span></div>
                  <div><strong>${escapeHtml(stats.lastUsedAt ? formatShortDate(stats.lastUsedAt) : '—')}</strong><span>最近使用</span></div>
                </div>
              </div>
            </div>
            <form id="wine-form" class="drawer-form" data-wine-id="${escapeHtml(wine.id)}">
            <section class="drawer-section drawer-section--anchored" id="wine-section-basics" data-drawer-section>
              ${renderPanelHeader('基础信息', '优先整理主名称、年份、产区和启用状态。')}
              <div class="form-grid">
                ${renderSelectField('酒庄', 'wineryId', wine.wineryId, (state.wineries || []).map((item) => ({ value: item.id, label: item.name })), '切换酒庄关联')}
                ${renderField('酒款名称', 'name', wine.name, { hint: '对外显示的主名称。', maxlength: 80 })}
                ${renderField('英文标题', 'title', wine.title, { hint: '用于列表和详情页。', maxlength: 100 })}
                ${renderField('副标题', 'subtitle', wine.subtitle, { hint: '建议 8 - 20 个字。', maxlength: 120 })}
                ${renderField('年份 / 版次', 'vintage', wine.vintage, { hint: '例如 2022 Reserve。', maxlength: 80 })}
                ${renderField('产区', 'region', wine.region, { hint: '用于列表展示。', maxlength: 80 })}
                ${renderSelectField('状态', 'status', wine.status || 'active', [
                  { value: 'active', label: '启用中' },
                  { value: 'archived', label: '已归档' }
                ])}
              </div>
            </section>

            <section class="drawer-section drawer-section--anchored" id="wine-section-copy" data-drawer-section>
              ${renderPanelHeader('文案', '保持品牌感，同时控制语气克制、信息清晰。')}
              <div class="form-grid">
                ${renderField('引言', 'quote', wine.quote, { type: 'textarea', hint: '一句话概括风味。', maxlength: 160 })}
                ${renderField('概述', 'overview', wine.overview, { type: 'textarea', hint: '列表页摘要。', maxlength: 800 })}
                ${renderField('故事标题', 'storyTitle', wine.storyTitle, { hint: '详情页章节标题。', maxlength: 80 })}
                ${renderField('故事正文', 'story', wine.story, { type: 'textarea', hint: '完整故事段落。', maxlength: 3000 })}
                ${renderField('场景描述', 'moodLine', wine.moodLine, { hint: '页面氛围文案。', maxlength: 160 })}
                ${renderField('酒庄名称', 'estateName', wine.estateName, { hint: '庄园名称。', maxlength: 120 })}
                ${renderField('酒庄标语', 'estateTagline', wine.estateTagline, { hint: '品牌一句话。', maxlength: 160 })}
                ${renderField('酒庄简介', 'estateIntro', wine.estateIntro, { type: 'textarea', hint: '品牌简介。', maxlength: 1000 })}
              </div>
            </section>

            <section class="drawer-section drawer-section--anchored" id="wine-section-visual" data-drawer-section>
              ${renderPanelHeader('视觉', '统一管理封面、瓶身、礼盒与酒庄图片。')}
              <div class="form-grid">
                ${renderImageField({ label: '酒庄主视觉', name: 'estateHeroImage', value: wine.estateHeroImage || '', folder: 'wineries', placeholder: '/assets/images/winery-vineyard-moon.jpg' })}
                ${renderImageField({ label: '人物 / 场景', name: 'estatePortraitImage', value: wine.estatePortraitImage || '', folder: 'wineries', placeholder: '/assets/images/village-ancient-vine-cellar.jpg' })}
                ${renderImageField({ label: '封面图', name: 'posterImage', value: wine.posterImage || '', folder: 'wines', placeholder: '/assets/images/wine-bottle-poster.jpg' })}
                ${renderImageField({ label: '瓶身图', name: 'bottleImage', value: wine.bottleImage || '', folder: 'wines', placeholder: '/assets/images/wine-bottle-estate.jpg' })}
                ${renderImageField({ label: '礼盒图', name: 'giftImage', value: wine.giftImage || '', folder: 'wines', placeholder: '/assets/images/wine-gift-set.jpg' })}
              </div>
            </section>

            <section class="drawer-section drawer-section--anchored" id="wine-section-related" data-drawer-section>
              ${renderPanelHeader('关联', '预留给音乐、活动和后续扩展内容。')}
              <div class="related-list">
                ${tracks.length
                  ? tracks
                      .map(
                        (track) => `
                          <article class="related-item">
                            <div>
                              <strong>${escapeHtml(track.cnTitle || track.title)}</strong>
                              <p>${escapeHtml(track.description || '—')}</p>
                            </div>
                            <span>${escapeHtml(track.durationLabel || '—')}</span>
                          </article>
                        `
                      )
                      .join('')
                  : renderEmptyState('暂无关联曲目', '这款酒还没有绑定音乐内容。')}
              </div>
            </section>
            </form>
          </div>
        </div>
      </div>

      <footer class="drawer-foot drawer-foot--wine">
        ${renderActionButton({ action: 'archive-wine', label: '归档 / 删除', iconName: 'trash', variant: 'danger', tone: 'danger' })}
        <div class="drawer-foot-actions">
          ${renderActionButton({ action: 'close-drawer', label: '取消', iconName: 'close', variant: 'ghost' })}
          ${renderActionButton({ action: 'save-wine', label: '保存酒款', iconName: 'save', variant: 'primary' })}
        </div>
      </footer>
    `;
    els.drawerPanel.scrollTop = 0;
    openLayer(els.drawerLayer);
    return;
  }

  if (type === 'code') {
    const code = findCodeById(data.codeId) || state.codes[0];
    if (!code) {
      closeDrawer();
      return;
    }
    const userOrder = (state.orders || []).find((order) => order.user && order.user.id === code.firstUserId) || null;
    const user = userOrder ? userOrder.user : null;
    const wineName = (code.wine && code.wine.name) || '未绑定酒款';
    const trackTitle = (code.track && (code.track.cnTitle || code.track.title)) || '未关联曲目';
    const userLabel = user ? user.nickname || user.displayName || user.mobile : code.firstUserId || '未核销';
    const orderStatusLabel = userOrder ? STATUS_COPY[userOrder.deliveryStatus || userOrder.status || 'pending'] || '处理中' : '未关联订单';
    const codeSections = [
      { id: 'code-section-user', label: '使用与用户', note: '核销人与会话信息' },
      { id: 'code-section-fulfillment', label: '履约信息', note: '关联订单与物流状态' },
      { id: 'code-section-timeline', label: '操作记录', note: '创建、更新与异常记录' }
    ];
    els.drawerPanel.innerHTML = `
      <header class="drawer-head">
        <div>
          <span class="drawer-eyebrow">提取码详情</span>
          <h3>${escapeHtml(code.redeemCode || code.token || '')}</h3>
          <p>${escapeHtml(code.label || code.batchNo || '—')}</p>
        </div>
        <button class="icon-button" type="button" data-close-drawer aria-label="关闭">${icon('close')}</button>
      </header>

      <div class="drawer-toolbar">
        ${renderSectionNav(codeSections, 'code')}
        <div class="drawer-toolbar-actions">
          ${renderActionButton({ action: 'copy-code', label: '复制提取码', iconName: 'copy', variant: 'secondary' })}
        </div>
      </div>

      <div class="drawer-overview drawer-overview--code">
        <article class="summary-shell">
          <div class="summary-shell-top">
            <div class="summary-shell-copy">
              <div class="drawer-hero-row">
                ${renderStatusPill(code.status || 'ready')}
                ${renderTag(code.batchNo || '未分配批次', 'neutral')}
              </div>
              <strong>${escapeHtml(wineName)}</strong>
              <p>${escapeHtml(code.label || '当前提取码尚未添加补充标识。')}</p>
            </div>
          </div>
          <div class="summary-inline-grid summary-inline-grid--code">
            <article class="summary-inline-card">
              <span>提取码</span>
              <strong class="table-mono">${escapeHtml(code.redeemCode || code.token || '—')}</strong>
              <small>${escapeHtml(code.batchNo || '未分配批次')}</small>
            </article>
            <article class="summary-inline-card">
              <span>首次使用用户</span>
              <strong>${escapeHtml(userLabel)}</strong>
              <small>${escapeHtml(code.firstUserId || '未记录用户标识')}</small>
            </article>
            <article class="summary-inline-card">
              <span>关联曲目</span>
              <strong>${escapeHtml(trackTitle)}</strong>
              <small>${escapeHtml(code.sessionId || '未生成会话')}</small>
            </article>
            <article class="summary-inline-card">
              <span>履约状态</span>
              <strong>${escapeHtml(orderStatusLabel)}</strong>
              <small>${escapeHtml(userOrder ? userOrder.orderNo || '已生成订单' : '尚未关联订单')}</small>
            </article>
          </div>
          <div class="detail-grid">
            <article class="detail-card">
              <span>创建时间</span>
              <strong>${escapeHtml(formatShortDate(code.createdAt))}</strong>
            </article>
            <article class="detail-card">
              <span>过期时间</span>
              <strong>${escapeHtml(formatShortDate(code.expiresAt))}</strong>
            </article>
            <article class="detail-card">
              <span>首次使用</span>
              <strong>${escapeHtml(code.firstUsedAt ? formatShortDate(code.firstUsedAt) : '—')}</strong>
            </article>
            <article class="detail-card">
              <span>物流状态</span>
              <strong>${escapeHtml(userOrder ? STATUS_COPY[userOrder.deliveryStatus || userOrder.status || 'pending'] || '处理中' : '未关联订单')}</strong>
            </article>
          </div>
        </article>

        <aside class="action-well action-well--${escapeHtml(getStatusTone(code.status || 'ready'))}">
          <div class="action-well-head">
            <span class="drawer-eyebrow">状态调整</span>
            <h4>更新提取码状态</h4>
            <p>提交后会同步影响扫码结果、用户侧反馈和提取码统计。</p>
          </div>
          <form id="code-status-form" class="action-form" data-code-id="${escapeHtml(code.id)}">
            ${renderSelectField('状态', 'status', code.status || 'ready', [
              { value: 'ready', label: '待使用' },
              { value: 'claimed', label: '已使用' },
              { value: 'expired', label: '已过期' },
              { value: 'disabled', label: '已停用' }
            ])}
            <div class="drawer-inline-actions">
              ${renderActionButton({ action: 'save-code-status', label: '更新状态', iconName: 'save', variant: 'primary' })}
            </div>
          </form>
          <div class="action-well-note" data-code-status-note>
            ${renderCodeStatusNote(code.status || 'ready')}
          </div>
        </aside>
      </div>

      <div class="drawer-split">
        <section class="drawer-section drawer-section--anchored" id="code-section-user" data-drawer-section>
          ${renderPanelHeader('使用与用户', '核销结果、用户标识与会话轨迹。')}
          <div class="detail-list detail-list--code">
            <div class="detail-row"><span>首次使用用户</span><strong>${escapeHtml(user ? user.nickname || user.displayName || user.mobile : code.firstUserId || '—')}</strong></div>
            <div class="detail-row"><span>用户标识</span><strong>${escapeHtml(code.firstUserId || '—')}</strong></div>
            <div class="detail-row"><span>手机号</span><strong>${escapeHtml(user ? user.mobile || '—' : '—')}</strong></div>
            <div class="detail-row"><span>会话</span><strong>${escapeHtml(code.sessionId || '—')}</strong></div>
            <div class="detail-row"><span>关联曲目</span><strong>${escapeHtml((code.track && (code.track.cnTitle || code.track.title)) || '—')}</strong></div>
          </div>
        </section>

        <section class="drawer-section drawer-section--anchored" id="code-section-fulfillment" data-drawer-section>
          ${renderPanelHeader('履约信息', '订单、收货和物流状态在这里集中查看。')}
          ${
            userOrder
              ? `
                <div class="detail-list detail-list--code">
                  <div class="detail-row"><span>订单号</span><strong>${escapeHtml(userOrder.orderNo || '—')}</strong></div>
                  <div class="detail-row"><span>发货状态</span><strong>${escapeHtml(STATUS_COPY[userOrder.deliveryStatus || userOrder.status || 'pending'] || '处理中')}</strong></div>
                  <div class="detail-row"><span>物流公司</span><strong>${escapeHtml(userOrder.shippingCompany || '—')}</strong></div>
                  <div class="detail-row"><span>物流单号</span><strong>${escapeHtml(userOrder.trackingNo || '—')}</strong></div>
                  <div class="detail-row"><span>收货信息</span><strong>${escapeHtml(userOrder.address ? [userOrder.address.contactName, userOrder.address.mobile].filter(Boolean).join(' · ') : userOrder.addressSummary || '—')}</strong></div>
                </div>
              `
              : renderEmptyState('暂无履约信息', '当前提取码还没有关联到订单或物流记录。')
          }
        </section>
      </div>

      <div class="drawer-section drawer-section--anchored" id="code-section-timeline" data-drawer-section>
        ${renderPanelHeader('操作时间线', '展示创建、核销、到期和后台处理记录。')}
        ${renderTimeline(getCodeTimeline(code), 'timeline--code')}
      </div>

      <footer class="drawer-foot">
        ${isOrderPhysical(userOrder) && !isOrderShipped(userOrder) ? renderActionButton({ action: 'open-shipping-modal', label: '发货', iconName: 'truck', variant: 'primary' }) : ''}
        ${renderActionButton({ action: 'close-drawer', label: '关闭', iconName: 'close', variant: 'ghost' })}
      </footer>
    `;
    els.drawerPanel.scrollTop = 0;
    openLayer(els.drawerLayer);
    return;
  }

  if (type === 'shipping') {
    const order = findOrderById(data.orderId) || state.orders[0];
    if (!order) {
      closeDrawer();
      return;
    }
    const user = order.user || {};
    const timeline = getOrderTimeline(order);
    const receiverLabel = order.address ? [order.address.contactName, order.address.mobile].filter(Boolean).join(' · ') : user.mobile || '—';
    const productLabel = (order.items || []).map((item) => item.productName || item.trackTitle || '订单项').filter(Boolean).join('、') || '—';
    const addressLine = order.address ? [order.address.provinceCity, order.address.detail].filter(Boolean).join(' · ') : order.addressSummary || '—';
    const shippingStatusLabel = STATUS_COPY[order.deliveryStatus || order.status || 'pending'] || order.deliveryStatus || order.status || '待发货';
    const timelineLead = isOrderShipped(order)
      ? `已发货 ${formatShortDate(order.shippedAt || order.updatedAt || order.createdAt)}`
      : `最近更新 ${formatShortDate(order.updatedAt || order.createdAt)}`;
    const shippingSections = [
      { id: 'shipping-section-receiver', label: '收货信息', note: '地址、联系人与备注' },
      { id: 'shipping-section-items', label: '商品明细', note: '订单项与金额' },
      { id: 'shipping-section-timeline', label: '物流时间线', note: '发货、签收与异常' }
    ];
    els.drawerPanel.innerHTML = `
      <header class="drawer-head">
        <div>
          <span class="drawer-eyebrow">发货详情</span>
          <h3>${escapeHtml(order.orderNo || '—')}</h3>
          <p>${escapeHtml(user.nickname || user.displayName || user.mobile || '—')}</p>
        </div>
        <button class="icon-button" type="button" data-close-drawer aria-label="关闭">${icon('close')}</button>
      </header>

      <div class="drawer-toolbar">
        ${renderSectionNav(shippingSections, 'shipping')}
        <div class="drawer-toolbar-actions">
          ${isOrderPhysical(order) && !isOrderShipped(order) ? renderActionButton({ action: 'open-shipping-modal', label: '发货', iconName: 'truck', variant: 'primary' }) : ''}
        </div>
      </div>

      <div class="drawer-overview drawer-overview--shipping">
        <article class="summary-shell">
          <div class="summary-shell-top">
            <div class="summary-shell-copy">
              <div class="drawer-hero-row">
                ${renderStatusPill(order.deliveryStatus || order.status || 'pending')}
                ${renderTag(STATUS_COPY[order.status || 'pending_payment'] || order.status || '—', 'neutral')}
              </div>
              <strong>${escapeHtml(receiverLabel || user.nickname || user.displayName || '未绑定用户')}</strong>
              <p>${escapeHtml(addressLine || '当前订单尚未补充完整的收货摘要。')}</p>
            </div>
          </div>
          <div class="summary-inline-grid summary-inline-grid--shipping">
            <article class="summary-inline-card">
              <span>收货联系人</span>
              <strong>${escapeHtml(receiverLabel)}</strong>
              <small>${escapeHtml(order.address ? order.address.provinceCity || '未补充省市' : '未填写地址')}</small>
            </article>
            <article class="summary-inline-card">
              <span>物流信息</span>
              <strong>${escapeHtml(order.trackingNo || '待录入单号')}</strong>
              <small>${escapeHtml(order.shippingCompany || '待分配物流')}</small>
            </article>
            <article class="summary-inline-card">
              <span>履约进度</span>
              <strong>${escapeHtml(shippingStatusLabel)}</strong>
              <small>${escapeHtml(timelineLead)}</small>
            </article>
          </div>
        </article>

        <aside class="action-well action-well--${escapeHtml(getStatusTone(order.deliveryStatus || order.status || 'pending'))}">
          <div class="action-well-head">
            <span class="drawer-eyebrow">履约摘要</span>
            <h4>当前物流状态</h4>
            <p>${escapeHtml(isOrderShipped(order) ? '当前订单已进入配送流程，可在时间线中查看同步记录。' : '当前订单仍待发货，可在这里直接发起物流同步。')}</p>
          </div>
          <div class="action-well-note">
            <strong>${escapeHtml(order.orderNo || '—')}</strong>
            <p>${escapeHtml(order.address ? [order.address.contactName, order.address.mobile].filter(Boolean).join(' · ') : user.mobile || '—')}</p>
            <div class="action-well-list">
              <div class="action-well-list-row">
                <span>物流同步</span>
                <strong>${escapeHtml(order.wechatShippingSyncStatus || '待同步')}</strong>
              </div>
              <div class="action-well-list-row">
                <span>当前操作</span>
                <strong>${escapeHtml(isOrderShipped(order) ? '查看物流进度' : '提交发货信息')}</strong>
              </div>
              <div class="action-well-list-row">
                <span>商品数量</span>
                <strong>${escapeHtml(`${(order.items || []).length} 项`)}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div class="drawer-split">
        <section class="drawer-section drawer-section--anchored" id="shipping-section-receiver" data-drawer-section>
          ${renderPanelHeader('收货信息', '地址信息较长时优先保留联系人、手机号和详细地址。')}
          <div class="detail-list">
            <div class="detail-row"><span>收货信息</span><strong>${escapeHtml(receiverLabel)}</strong></div>
            <div class="detail-row"><span>详细地址</span><strong>${escapeHtml(addressLine)}</strong></div>
            <div class="detail-row"><span>备注</span><strong>${escapeHtml(order.address ? order.address.deliveryNote || '—' : '—')}</strong></div>
          </div>
        </section>

        <section class="drawer-section drawer-section--anchored" id="shipping-section-items" data-drawer-section>
          ${renderPanelHeader('商品明细', '保留商品名、规格和价格，便于客服与履约核对。')}
          <div class="product-list">
            ${(order.items || [])
              .map(
                (item) => `
                  <article class="product-item">
                    <div>
                      <strong>${escapeHtml(item.productName || item.trackTitle || '订单项')}</strong>
                      <p>${escapeHtml(item.specName || item.trackTitle || '—')}</p>
                    </div>
                    <span>¥${escapeHtml(formatNumber(item.price || 0))}</span>
                  </article>
                `
              )
              .join('')}
          </div>
        </section>
      </div>

      <div class="drawer-section drawer-section--anchored" id="shipping-section-timeline" data-drawer-section>
        ${renderPanelHeader('时间线', '展示订单创建、支付、发货、签收和异常同步记录。')}
        ${renderTimeline(timeline, 'timeline--shipping')}
      </div>

      <footer class="drawer-foot">
        ${isOrderPhysical(order) && !isOrderShipped(order) ? renderActionButton({ action: 'open-shipping-modal', label: '发货', iconName: 'truck', variant: 'primary' }) : ''}
        ${renderActionButton({ action: 'close-drawer', label: '关闭', iconName: 'close', variant: 'ghost' })}
      </footer>
    `;
    els.drawerPanel.scrollTop = 0;
    openLayer(els.drawerLayer);
    return;
  }

  closeDrawer();
}

function renderModal() {
  if (!els.modalPanel) {
    return;
  }

  const { type, data } = state.modal;
  els.modalPanel.className = type ? `modal-panel modal-panel--${type}` : 'modal-panel';
  if (!type) {
    closeLayer(els.modalLayer);
    return;
  }

  if (type === 'confirm') {
    els.modalPanel.innerHTML = `
      <header class="modal-head">
        <div>
          <span class="drawer-eyebrow">${escapeHtml(data.eyebrow || '确认操作')}</span>
          <h3>${escapeHtml(data.title || '请确认')}</h3>
          ${data.body ? `<p>${escapeHtml(data.body || '')}</p>` : ''}
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="关闭">${icon('close')}</button>
      </header>
      <div class="modal-body">
        <div class="modal-callout modal-callout--${escapeHtml(data.tone || 'primary')}">
          <span class="modal-callout-icon">${icon(data.tone === 'danger' ? 'alert' : 'check')}</span>
          <div>
            <strong>${escapeHtml(data.confirmLabel || '确认继续')}</strong>
            <p>提交后会立即生效。</p>
          </div>
        </div>
      </div>
      <footer class="modal-foot">
        ${renderActionButton({ action: 'cancel-modal', label: '取消', iconName: 'close', variant: 'ghost' })}
        ${renderActionButton({ action: 'confirm-modal', label: data.confirmLabel || '确认', iconName: 'check', variant: 'primary', tone: data.tone || 'primary' })}
      </footer>
    `;
    els.modalPanel.scrollTop = 0;
    openLayer(els.modalLayer);
    return;
  }

  if (type === 'wine-create') {
    const defaultWinery = (state.wineries || [])[0] || {};
    els.modalPanel.innerHTML = `
      <header class="modal-head">
        <div>
          <span class="drawer-eyebrow">新增酒款</span>
          <h3>创建一款新的酒</h3>
          <p>先建立基础档案，详情页与视觉素材可在创建后继续完善。</p>
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="关闭">${icon('close')}</button>
      </header>
      <div class="modal-summary">
        <article class="modal-summary-card">
          <span>默认酒庄</span>
          <strong>${escapeHtml(defaultWinery.name || '未设置')}</strong>
        </article>
        <article class="modal-summary-card">
          <span>创建后动作</span>
          <strong>进入酒款详情</strong>
        </article>
      </div>
      <form id="wine-create-form" class="modal-form">
        <div class="form-grid">
          ${renderSelectField('酒庄', 'wineryId', defaultWinery.id || '', (state.wineries || []).map((item) => ({ value: item.id, label: item.name })), '默认使用第一个酒庄')}
          ${renderField('酒款名称', 'name', '', { hint: '至少 2 个字。', maxlength: 80 })}
          ${renderField('英文标题', 'title', '', { hint: '列表展示标题。', maxlength: 100 })}
          ${renderField('副标题', 'subtitle', '', { hint: '简短描述。', maxlength: 120 })}
          ${renderField('产区', 'region', '', { hint: '例如核心产区。', maxlength: 80 })}
          ${renderSelectField('状态', 'status', 'active', [
            { value: 'active', label: '启用中' },
            { value: 'archived', label: '已归档' }
          ])}
        </div>
      </form>
      <footer class="modal-foot">
        ${renderActionButton({ action: 'submit-wine-create', label: '创建酒款', iconName: 'plus', variant: 'primary' })}
        ${renderActionButton({ action: 'cancel-modal', label: '取消', iconName: 'close', variant: 'ghost' })}
      </footer>
    `;
    els.modalPanel.scrollTop = 0;
    openLayer(els.modalLayer);
    return;
  }

  if (type === 'code-batch') {
    const wines = getEnrichedWines();
    const defaultWine = wines[0] || {};
    const defaultBatchNo = `HJ${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const defaultWineStats = defaultWine.id ? getWineCodeStats(defaultWine) : { total: 0, ready: 0 };
    els.modalPanel.innerHTML = `
      <header class="modal-head">
        <div>
          <span class="drawer-eyebrow">生成提取码</span>
          <h3>批量生成一组提取码</h3>
          <p>适用于门店发放、活动兑换或礼盒附码，生成后可继续批量导出。</p>
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="关闭">${icon('close')}</button>
      </header>
      <div class="modal-summary">
        <article class="modal-summary-card">
          <span>默认酒款</span>
          <strong>${escapeHtml(defaultWine.name || '未设置')}</strong>
        </article>
        <article class="modal-summary-card">
          <span>当前提取码</span>
          <strong>${formatNumber(defaultWineStats.total)}</strong>
        </article>
        <article class="modal-summary-card">
          <span>待使用</span>
          <strong>${formatNumber(defaultWineStats.ready)}</strong>
        </article>
      </div>
      <form id="code-batch-form" class="modal-form">
        <div class="form-grid">
          ${renderSelectField('酒款', 'wineId', defaultWine.id || '', wines.map((wine) => ({ value: wine.id, label: wine.name })), '选择要绑定的酒款')}
          ${renderField('数量', 'quantity', data.quantity || 20, { type: 'number', hint: '建议 20 - 100。', maxlength: 4 })}
          ${renderField('批次号', 'batchNo', data.batchNo || defaultBatchNo, { hint: '例如 HJ202605。', maxlength: 80 })}
          ${renderField('过期时间', 'expiresAt', data.expiresAt || toLocalInputValue(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)), { type: 'datetime-local', hint: '默认 180 天后。' })}
        </div>
      </form>
      <footer class="modal-foot">
        ${renderActionButton({ action: 'submit-code-batch', label: '生成提取码', iconName: 'code', variant: 'primary' })}
        ${renderActionButton({ action: 'cancel-modal', label: '取消', iconName: 'close', variant: 'ghost' })}
      </footer>
    `;
    els.modalPanel.scrollTop = 0;
    openLayer(els.modalLayer);
    return;
  }

  if (type === 'shipping') {
    const order = findOrderById(data.orderId);
    if (!order) {
      closeModal();
      return;
    }
    const transactionId = (order.payment && order.payment.transactionId) || data.transactionId || '';
    els.modalPanel.innerHTML = `
      <header class="modal-head">
        <div>
          <span class="drawer-eyebrow">发货</span>
          <h3>${escapeHtml(order.orderNo || '')}</h3>
          <p>${escapeHtml((order.user && (order.user.nickname || order.user.displayName || order.user.mobile)) || '—')}</p>
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="关闭">${icon('close')}</button>
      </header>
      <div class="modal-summary">
        <article class="modal-summary-card">
          <span>收货人</span>
          <strong>${escapeHtml(order.address ? order.address.contactName || order.address.mobile : '—')}</strong>
        </article>
        <article class="modal-summary-card">
          <span>当前状态</span>
          <strong>${escapeHtml(STATUS_COPY[order.deliveryStatus || order.status || 'pending'] || '待发货')}</strong>
        </article>
        <article class="modal-summary-card">
          <span>地址</span>
          <strong>${escapeHtml(order.address ? order.address.provinceCity || '—' : '—')}</strong>
        </article>
      </div>
      <form id="shipping-form" class="modal-form" data-order-id="${escapeHtml(order.id)}">
        <div class="form-grid">
          ${renderField('物流公司', 'shippingCompany', data.shippingCompany || order.shippingCompany || '', { hint: '例如 顺丰速运。', maxlength: 80 })}
          ${renderField('物流单号', 'trackingNo', data.trackingNo || order.trackingNo || '', { hint: '填写快递单号。', maxlength: 80 })}
          ${renderField('交易单号', 'transactionId', transactionId, { hint: '用于同步微信发货。', maxlength: 80 })}
          ${renderSelectField('同步模式', 'deliveryStatus', order.deliveryStatus || 'delivering', [
            { value: 'delivering', label: '已发货' },
            { value: 'completed', label: '已签收' },
            { value: 'pending', label: '待发货' }
          ])}
        </div>
      </form>
      <footer class="modal-foot">
        ${renderActionButton({ action: 'submit-shipping', label: '发货并同步', iconName: 'truck', variant: 'primary' })}
        ${renderActionButton({ action: 'cancel-modal', label: '取消', iconName: 'close', variant: 'ghost' })}
      </footer>
    `;
    els.modalPanel.scrollTop = 0;
    openLayer(els.modalLayer);
    return;
  }

  if (type === 'fixed-code') {
    const fixed = state.fixedQrcode;
    els.modalPanel.innerHTML = `
      <header class="modal-head">
        <div>
          <span class="drawer-eyebrow">固定码管理</span>
          <h3>长期入口二维码</h3>
          <p>用于长期入口或门店海报，生成后可复制链接或重新生成。</p>
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="关闭">${icon('close')}</button>
      </header>
      <div class="modal-body">
        <div class="fixed-code-modal">
          ${fixed && fixed.path ? `<img src="${escapeHtml(fixed.path)}" alt="固定二维码" />` : `<div class="fixed-code-modal-empty">${icon('spark', 20)}<span>尚未生成固定码</span></div>`}
          <div class="fixed-code-modal-copy">
            <div><span>页面</span><strong>${escapeHtml((fixed && fixed.page) || 'pages/redeem/index')}</strong></div>
            <div><span>路径</span><strong>${escapeHtml((fixed && fixed.path) || '—')}</strong></div>
          </div>
        </div>
      </div>
      <footer class="modal-foot">
        ${renderActionButton({ action: 'generate-fixed-code', label: fixed && fixed.path ? '重新生成' : '生成固定码', iconName: 'spark', variant: 'primary' })}
        ${fixed && fixed.url ? renderActionButton({ action: 'copy-fixed-code', label: '复制链接', iconName: 'copy', variant: 'secondary' }) : ''}
        ${renderActionButton({ action: 'cancel-modal', label: '关闭', iconName: 'close', variant: 'ghost' })}
      </footer>
    `;
    els.modalPanel.scrollTop = 0;
    openLayer(els.modalLayer);
    return;
  }

  if (type === 'code-fails') {
    const items = state.redeemFailLogs || [];
    const latest = items[0] || null;
    els.modalPanel.innerHTML = `
      <header class="modal-head">
        <div>
          <span class="drawer-eyebrow">异常记录</span>
          <h3>提取码异常记录</h3>
          <p>查看最近失败核销记录，定位格式错误、失效码和停用码。</p>
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="关闭">${icon('close')}</button>
      </header>
      <div class="modal-summary">
        <article class="modal-summary-card">
          <span>异常总数</span>
          <strong>${formatNumber(items.length)}</strong>
        </article>
        <article class="modal-summary-card">
          <span>最近原因</span>
          <strong>${escapeHtml(latest ? REASON_COPY[latest.reason] || latest.reason || '未知原因' : '暂无记录')}</strong>
        </article>
        <article class="modal-summary-card">
          <span>最近时间</span>
          <strong>${escapeHtml(latest ? formatShortDate(latest.createdAt) : '—')}</strong>
        </article>
      </div>
      <div class="modal-body">
        ${renderFailLogList(20)}
      </div>
      <footer class="modal-foot">
        ${renderActionButton({ action: 'cancel-modal', label: '关闭', iconName: 'close', variant: 'ghost' })}
      </footer>
    `;
    els.modalPanel.scrollTop = 0;
    openLayer(els.modalLayer);
    return;
  }

  closeModal();
}

function handleAdminActionButtonClick(button) {
  const action = button.dataset.action;

  if (action === 'refresh-data') {
    handleRefreshData(button);
    return;
  }

  if (action === 'export-current') {
    exportCurrentView();
    return;
  }

  if (action === 'logout') {
    handleLogout();
    return;
  }

  if (action === 'open-wine-create') {
    renderWineCreateModal();
    return;
  }

  if (action === 'open-code-batch') {
    renderCodeBatchModal();
    return;
  }

  if (action === 'open-fixed-code') {
    renderFixedCodeModal();
    return;
  }

  if (action === 'open-code-fail-logs') {
    openCodeFailPanel();
    return;
  }

  if (action === 'save-copy') {
    handleCopySave(button);
    return;
  }

  if (action === 'publish-copy') {
    handleCopyPublish(button);
    return;
  }

  if (action === 'open-wine-drawer') {
    openWineDrawerById(button.dataset.wineId);
    return;
  }

  if (action === 'open-code-drawer') {
    openCodeDrawerById(button.dataset.codeId || state.selectedCodeId);
    return;
  }

  if (action === 'open-shipping-drawer') {
    openShippingDrawerById(button.dataset.orderId || state.selectedOrderId);
    return;
  }

  if (action === 'open-shipping-modal') {
    renderShippingModal(button.dataset.orderId || state.selectedOrderId);
    return;
  }

  if (action === 'copy-code') {
    const code = findCodeById(button.dataset.codeId || state.selectedCodeId);
    if (code && code.redeemCode) {
      copyText(code.redeemCode)
        .then(() => showToast('提取码已复制。', 'success'))
        .catch(() => showToast('复制失败。', 'error'));
    }
    return;
  }

  if (action === 'copy-fixed-code') {
    if (state.fixedQrcode && state.fixedQrcode.url) {
      copyText(state.fixedQrcode.url)
        .then(() => showToast('固定码链接已复制。', 'success'))
        .catch(() => showToast('复制失败。', 'error'));
    }
    return;
  }

  if (action === 'download-fixed-code') {
    if (state.fixedQrcode && state.fixedQrcode.path) {
      window.open(state.fixedQrcode.path, '_blank', 'noopener');
    }
    return;
  }

  if (action === 'clear-wine-filters') {
    clearWineFilters();
    return;
  }

  if (action === 'clear-code-filters') {
    clearCodeFilters();
    return;
  }

  if (action === 'clear-shipping-filters') {
    clearShippingFilters();
    return;
  }

  if (action === 'bulk-export-codes') {
    exportSelectedCodes();
    return;
  }

  if (action === 'bulk-disable-codes') {
    disableSelectedCodes();
    return;
  }

  if (action === 'clear-code-selection') {
    clearCodeSelection();
    return;
  }

  if (action === 'toggle-visible-codes') {
    toggleVisibleCodes(Boolean(button.checked));
    return;
  }

  if (action === 'close-drawer') {
    closeDrawer();
    return;
  }

  if (action === 'close-modal' || action === 'cancel-modal') {
    closeModal();
    return;
  }

  if (action === 'confirm-modal') {
    const callback = state.modal.onConfirm;
    if (typeof callback === 'function') {
      callback();
    }
    return;
  }

  if (action === 'generate-fixed-code') {
    handleFixedCodeGenerate(button);
    return;
  }

  if (action === 'save-wine') {
    const form = document.getElementById('wine-form');
    if (form) {
      handleWineSaveSubmit(form, button);
    }
    return;
  }

  if (action === 'archive-wine') {
    const form = document.getElementById('wine-form');
    if (form) {
      confirmWineDelete(form.dataset.wineId);
    }
    return;
  }

  if (action === 'save-code-status') {
    const form = document.getElementById('code-status-form');
    if (form) {
      promptCodeStatusUpdate(form);
    }
  }
}

function updateCodeStatusNote(status) {
  const note = document.querySelector('[data-code-status-note]');
  if (!note) {
    return;
  }
  note.innerHTML = renderCodeStatusNote(status);
}

function handleDrawerSectionNav(button) {
  const group = button.dataset.drawerSectionGroup;
  const targetId = button.dataset.drawerSectionTarget;
  const panel = button.closest('.drawer-panel');
  if (!group || !targetId || !panel) {
    return;
  }

  panel.querySelectorAll(`[data-drawer-section-group="${escapeSelector(group)}"]`).forEach((item) => {
    item.classList.toggle('is-active', item === button);
  });

  const target = panel.querySelector(`#${escapeSelector(targetId)}`);
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function handleAdminDocumentClick(event) {
  const navItem = event.target.closest('.nav-item[data-view]');
  if (navItem && !navItem.disabled) {
    setView(navItem.dataset.view);
    return;
  }

  const copyPage = event.target.closest('[data-copy-page]');
  if (copyPage) {
    state.copyDraft.activePage = copyPage.dataset.copyPage;
    state.copyActivePage = copyPage.dataset.copyPage;
    renderCopyPage();
    return;
  }

  const codeStatusTab = event.target.closest('[data-code-status-tab]');
  if (codeStatusTab) {
    state.filters.codeStatus = codeStatusTab.dataset.codeStatusTab;
    state.codePage = 1;
    renderCodesShell();
    renderCodesContent();
    return;
  }

  const wineStatus = event.target.closest('[data-wine-status]');
  if (wineStatus) {
    state.filters.wineStatus = wineStatus.dataset.wineStatus;
    renderWinesShell();
    renderWinesContent();
    return;
  }

  const shippingStatus = event.target.closest('[data-shipping-status]');
  if (shippingStatus) {
    state.filters.shippingStatus = shippingStatus.dataset.shippingStatus;
    renderShippingShell();
    renderShippingContent();
    return;
  }

  const sectionButton = event.target.closest('[data-drawer-section-target]');
  if (sectionButton) {
    handleDrawerSectionNav(sectionButton);
    return;
  }

  const actionButton = getActionButton(event);
  if (actionButton) {
    handleAdminActionButtonClick(actionButton);
    return;
  }

  const codeRow = event.target.closest('[data-code-row]');
  if (codeRow && !event.target.closest('button, input, select, label')) {
    openCodeDrawerById(codeRow.dataset.codeRow);
    return;
  }

  const orderRow = event.target.closest('[data-order-row]');
  if (orderRow && !event.target.closest('button, input, select, label')) {
    openShippingDrawerById(orderRow.dataset.orderRow);
    return;
  }

  const wineRow = event.target.closest('[data-wine-row]');
  if (wineRow && !event.target.closest('button, input, select, label')) {
    openWineDrawerById(wineRow.dataset.wineRow);
    return;
  }

  if (event.target.closest('[data-close-drawer]')) {
    closeDrawer();
    return;
  }

  if (event.target.closest('[data-close-modal]')) {
    closeModal();
  }
}

function handleAdminDocumentInput(event) {
  const input = event.target;
  updateFieldCounter(input);

  if (input.matches('[data-filter="wine-search"]')) {
    state.filters.wineSearch = input.value.trim();
    renderWinesContent();
    return;
  }

  if (input.matches('[data-filter="code-search"]')) {
    state.filters.codeSearch = input.value.trim();
    state.codePage = 1;
    renderCodesContent();
    return;
  }

  if (input.matches('[data-filter="shipping-search"]')) {
    state.filters.shippingSearch = input.value.trim();
    renderShippingContent();
    return;
  }

  if (input.matches('[data-copy-field]')) {
    ensureCopyDraft();
    const page = state.copyDraft.pages[state.copyDraft.activePage];
    if (page) {
      page[input.dataset.copyField] = input.value;
      state.copyDirty = true;
      renderCopyNav();
      updateCopyPreview();
    }
    return;
  }

  if (input.matches('input[data-image-source="true"]')) {
    updateImagePreview(input);
  }
}

function handleAdminDocumentChange(event) {
  const input = event.target;

  if (input.matches('[data-filter="code-status"]')) {
    state.filters.codeStatus = input.value;
    state.codePage = 1;
    renderCodesContent();
    return;
  }

  if (input.matches('[data-filter="code-batch"]')) {
    state.filters.codeBatch = input.value;
    state.codePage = 1;
    renderCodesContent();
    return;
  }

  if (input.matches('[data-filter="shipping-status"]')) {
    state.filters.shippingStatus = input.value;
    renderShippingContent();
    return;
  }

  if (input.matches('#code-status-form select[name="status"]')) {
    updateCodeStatusNote(input.value);
    return;
  }

  if (input.matches('[data-code-page-size]')) {
    state.codePageSize = Number(input.value) || 20;
    state.codePage = 1;
    renderCodesContent();
    return;
  }

  if (input.matches('input[data-code-select]')) {
    toggleCodeSelection(input.dataset.codeSelect);
    return;
  }

  if (input.matches('.upload-file-input')) {
    handleWineUpload(input);
  }
}

function handleAdminDocumentSubmit(event) {
  const form = event.target;

  if (form.id === 'login-form') {
    handleLoginSubmit(event);
    return;
  }

  if (form.id === 'wine-form') {
    event.preventDefault();
    handleWineSaveSubmit(form, event.submitter || null);
    return;
  }

  if (form.id === 'wine-create-form') {
    event.preventDefault();
    handleWineCreateSubmit(form, event.submitter || null);
    return;
  }

  if (form.id === 'code-batch-form') {
    event.preventDefault();
    handleCodeBatchSubmit(form, event.submitter || null);
    return;
  }

  if (form.id === 'code-status-form') {
    event.preventDefault();
    promptCodeStatusUpdate(form);
    return;
  }

  if (form.id === 'shipping-form') {
    event.preventDefault();
    handleShippingSubmit(form, event.submitter || null);
  }
}

function wireAdminRuntime() {
  document.addEventListener('click', handleAdminDocumentClick);
  document.addEventListener('input', handleAdminDocumentInput);
  document.addEventListener('change', handleAdminDocumentChange);
  document.addEventListener('submit', handleAdminDocumentSubmit);
  document.addEventListener('keydown', (event) => {
    const wineRow = event.target.closest && event.target.closest('[data-wine-row]');
    if (wineRow && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openWineDrawerById(wineRow.dataset.wineRow);
      return;
    }
    if (event.key !== 'Escape') {
      return;
    }
    if (state.drawer.type) {
      closeDrawer();
      return;
    }
    if (state.modal.type) {
      closeModal();
    }
  });
}

async function bootstrapAdminRuntime() {
  wireAdminRuntime();
  startSessionClock();
  updateSessionPill();
  updatePermissionUi();
  renderPageShells();
  renderTopbarActions();
  setView(state.activeView);

  if (!state.token) {
    toggleLogin(true);
    return;
  }

  toggleLogin(false);
  const loaded = await runTask(() => loadAdminData(), null);
  if (loaded === null) {
    toggleLogin(true);
  }
}

bootstrapAdminRuntime();
