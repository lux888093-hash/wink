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
  wines: [],
  wineries: [],
  tracks: [],
  codes: [],
  redeemFailLogs: [],
  fixedQrcode: null,
  activeView: 'overview',
  selectedWineId: '',
  selectedCodeId: '',
  codePage: 1,
  codePageSize: 20,
  filters: {
    wineSearch: '',
    wineStatus: 'all',
    codeSearch: '',
    codeStatus: 'all',
    codeWine: 'all'
  }
};

const viewMeta = {
  overview: {
    title: '运营概览',
    description: ''
  },
  wines: {
    title: '酒款管理',
    description: ''
  },
  codes: {
    title: '提取码管理',
    description: ''
  }
};

const viewPermissions = {
  overview: 'dashboard.read',
  wines: 'wines.read',
  codes: 'codes.read'
};

const STATUS_COPY = {
  active: '启用中',
  archived: '已归档',
  ready: '待使用',
  claimed: '已使用',
  expired: '已过期',
  disabled: '已停用'
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
  viewTitle: document.getElementById('view-title'),
  viewDescription: document.getElementById('view-description'),
  sessionPill: document.getElementById('session-pill'),
  railAvatar: document.querySelector('.rail-avatar'),
  railUserName: document.querySelector('.rail-user-name'),
  statusBanner: document.getElementById('status-banner'),
  refreshButton: document.getElementById('refresh-button'),
  logoutButton: document.getElementById('logout-button'),
  overviewCanvas: document.getElementById('overview-canvas'),
  overviewDetailDialog: document.getElementById('overview-detail-dialog'),
  overviewDetailTitle: document.getElementById('overview-detail-title'),
  overviewDetailBody: document.getElementById('overview-detail-body'),
  wineSearch: document.getElementById('wine-search'),
  wineStatusTabs: document.getElementById('wine-status-tabs'),
  winesSummary: document.getElementById('wines-summary'),
  winesCollection: document.getElementById('wines-collection'),
  wineEditorDialog: document.getElementById('wine-editor-dialog'),
  wineEditor: document.getElementById('wine-editor'),
  openCreateWine: document.getElementById('open-create-wine'),
  createWineDialog: document.getElementById('create-wine-dialog'),
  createWineForm: document.getElementById('create-wine-form'),
  openBatchDialog: document.getElementById('open-batch-dialog'),
  batchDialog: document.getElementById('batch-dialog'),
  batchForm: document.getElementById('batch-form'),
  batchWine: document.getElementById('batch-wine'),
  batchQuantity: document.getElementById('batch-quantity'),
  batchBatchNo: document.getElementById('batch-batch-no'),
  batchExpireAt: document.getElementById('batch-expire-at'),
  openFixedDialog: document.getElementById('open-fixed-dialog'),
  fixedDialog: document.getElementById('fixed-dialog'),
  fixedQrcodeButton: document.getElementById('fixed-qrcode-button'),
  fixedQrcodePreview: document.getElementById('fixed-qrcode-preview'),
  fixedQrcodeResult: document.getElementById('fixed-qrcode-result'),
  fixedQrcodeDownload: document.getElementById('fixed-qrcode-download'),
  fixedQrcodeCopy: document.getElementById('fixed-qrcode-copy'),
  openFailDialog: document.getElementById('open-fail-dialog'),
  failLogsDialog: document.getElementById('fail-logs-dialog'),
  codeSearch: document.getElementById('code-search'),
  codeStatusFilter: document.getElementById('code-status-filter'),
  codeWineFilter: document.getElementById('code-wine-filter'),
  codesSummary: document.getElementById('codes-summary'),
  codesTable: document.getElementById('codes-table'),
  codesFooter: document.getElementById('codes-footer'),
  codesFailLogs: document.getElementById('codes-fail-logs'),
  codesFailBlock: document.getElementById('codes-fail-block'),
  exportCodesButton: document.getElementById('export-codes-button'),
  views: {
    overview: document.getElementById('view-overview'),
    wines: document.getElementById('view-wines'),
    codes: document.getElementById('view-codes')
  }
};

let statusTimer = 0;

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
    throw new Error(payload.code || `HTTP_${response.status}`);
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
    TRACK_NOT_FOUND: '暂无可用音乐资料。',
    TRACK_WINE_MISMATCH: '提取码与酒款信息不匹配。',
    CODE_NOT_FOUND: '提取码不存在。',
    BATCH_NO_EXISTS: '批次号已存在，请重新输入。',
    WECHAT_CREDENTIALS_REQUIRED: '缺少微信 AppID 或 AppSecret，暂不能生成入口码。',
    ADMIN_FORBIDDEN: '当前账号无权限执行该操作。'
  };

  return messages[error.message] || '操作未完成，请稍后重试。';
}

async function runTask(task, successMessage, options = {}) {
  try {
    const result = await task();
    if (successMessage) {
      showStatus(successMessage, 'success');
    }
    return result;
  } catch (error) {
    if (error.message === 'ADMIN_UNAUTHORIZED') {
      clearSession();
      toggleLogin(true);
    }
    showStatus(getErrorMessage(error), 'error');
    if (options.rethrow) {
      throw error;
    }
    return null;
  }
}

function toggleLogin(visible) {
  els.loginOverlay.classList.toggle('is-hidden', !visible);
}

function updateSessionPill() {
  const sidebarName = state.user ? 'Admin' : '未登录';
  els.sessionPill.textContent = state.user ? '已登录' : '未登录';

  if (els.railUserName) {
    els.railUserName.textContent = sidebarName;
  }

  if (els.railAvatar) {
    els.railAvatar.textContent = sidebarName.slice(0, 1) || 'A';
  }
}

function getFirstAllowedView() {
  return Object.keys(viewMeta).find((view) => can(viewPermissions[view])) || 'overview';
}

function updatePermissionUi() {
  els.navItems.forEach((item) => {
    item.hidden = !can(viewPermissions[item.dataset.view]);
  });

  if (!can(viewPermissions[state.activeView])) {
    state.activeView = getFirstAllowedView();
  }
}

function setView(view) {
  if (!can(viewPermissions[view])) {
    return;
  }

  closeOverviewDetailDialog();
  closeWineEditorDialog();
  closeBatchDialog();
  closeFixedDialog();
  closeFailLogsDialog();

  state.activeView = view;
  const meta = viewMeta[view];
  els.viewTitle.textContent = meta.title;
  els.viewDescription.textContent = meta.description;
  els.viewDescription.hidden = !meta.description;

  els.navItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === view);
  });

  Object.entries(els.views).forEach(([key, node]) => {
    node.classList.toggle('is-active', key === view);
  });
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

function renderStatusPill(status) {
  return `<span class="status-pill is-${escapeHtml(status || 'default')}">${escapeHtml(STATUS_COPY[status] || status || '未知')}</span>`;
}

function renderImagePreview(src, alt) {
  const normalized = String(src || '').trim();
  if (!normalized) {
    return '<div class="image-preview-empty">暂无图片</div>';
  }

  return `<img class="image-preview-img" src="${escapeHtml(normalized)}" alt="${escapeHtml(alt || 'preview')}" />`;
}

function renderImageField({ label, name, value = '', folder = 'wines', placeholder = '' }) {
  return `
    <label class="image-field">
      <span>${escapeHtml(label)}</span>
      <div class="image-field-body">
        <div class="image-preview-slot">${renderImagePreview(value, label)}</div>
        <div class="image-field-controls">
          <input
            name="${escapeHtml(name)}"
            value="${escapeHtml(value || '')}"
            placeholder="${escapeHtml(placeholder || '')}"
            data-image-source="true"
          />
          <div class="inline-actions">
            <button class="outline-button" type="button" data-action="pick-upload" data-upload-target="${escapeHtml(name)}">上传图片</button>
            <button class="text-button" type="button" data-action="clear-image" data-target-field="${escapeHtml(name)}">清空</button>
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
        <span>酒款名称</span>
        <span>年份</span>
        <span>产区</span>
        <span>提取码数</span>
        <span>已使用</span>
        <span>最近使用</span>
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
                </span>
                <span class="selection-cell wine-cell-vintage">${escapeHtml(wine.vintage || '未设置')}</span>
                <span class="selection-cell wine-cell-region">${escapeHtml(wine.region || '未设置')}</span>
                <span class="selection-cell wine-cell-codes">${escapeHtml(wine.codeTotal)}</span>
                <span class="selection-cell wine-cell-claimed">${escapeHtml(wine.claimedCodeTotal)}</span>
                <span class="selection-cell wine-cell-last">${escapeHtml(wine.lastUsedAt ? formatShortDate(wine.lastUsedAt) : '—')}</span>
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

bootstrap();
