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
  activeView: 'dashboard',
  health: null,
  dashboard: null,
  wines: [],
  wineries: [],
  tracks: [],
  codes: [],
  products: [],
  orders: [],
  members: [],
  auditLogs: [],
  membershipPlans: []
};

const els = {
  loginOverlay: document.getElementById('login-overlay'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  loginUsername: document.getElementById('login-username'),
  loginPassword: document.getElementById('login-password'),
  navItems: [...document.querySelectorAll('.nav-item')],
  viewTitle: document.getElementById('view-title'),
  sessionPill: document.getElementById('session-pill'),
  statusBanner: document.getElementById('status-banner'),
  refreshButton: document.getElementById('refresh-button'),
  logoutButton: document.getElementById('logout-button'),
  dashboardCards: document.getElementById('dashboard-cards'),
  ordersPreviewTable: document.getElementById('orders-preview-table'),
  codeHealth: document.getElementById('code-health'),
  winesList: document.getElementById('wines-list'),
  wineriesList: document.getElementById('wineries-list'),
  tracksList: document.getElementById('tracks-list'),
  batchForm: document.getElementById('batch-form'),
  batchWine: document.getElementById('batch-wine'),
  batchTrack: document.getElementById('batch-track'),
  batchQuantity: document.getElementById('batch-quantity'),
  batchBatchNo: document.getElementById('batch-batch-no'),
  fixedQrcodeButton: document.getElementById('fixed-qrcode-button'),
  fixedQrcodeResult: document.getElementById('fixed-qrcode-result'),
  exportCodesButton: document.getElementById('export-codes-button'),
  codesTable: document.getElementById('codes-table'),
  productsList: document.getElementById('products-list'),
  ordersTable: document.getElementById('orders-table'),
  reconciliationButton: document.getElementById('reconciliation-button'),
  exportOrdersButton: document.getElementById('export-orders-button'),
  closeExpiredOrdersButton: document.getElementById('close-expired-orders-button'),
  membersList: document.getElementById('members-list'),
  auditTable: document.getElementById('audit-table'),
  views: {
    dashboard: document.getElementById('view-dashboard'),
    wines: document.getElementById('view-wines'),
    wineries: document.getElementById('view-wineries'),
    tracks: document.getElementById('view-tracks'),
    codes: document.getElementById('view-codes'),
    products: document.getElementById('view-products'),
    orders: document.getElementById('view-orders'),
    members: document.getElementById('view-members'),
    audit: document.getElementById('view-audit')
  }
};

const viewTitles = {
  dashboard: '项目概览',
  wines: '酒款内容',
  wineries: '酒庄管理',
  tracks: '音乐资源',
  codes: '提取码管理',
  products: '商品与价格',
  orders: '订单管理',
  members: '会员权益',
  audit: '操作审计'
};

const viewPermissions = {
  dashboard: 'dashboard.read',
  wines: 'wines.read',
  wineries: 'wineries.read',
  tracks: 'tracks.read',
  codes: 'codes.read',
  products: 'products.read',
  orders: 'orders.read',
  members: 'memberships.read',
  audit: 'audit.read'
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOptions(items, currentValue) {
  return items
    .map((item) => {
      const value = typeof item === 'string' ? item : item.value;
      const label = typeof item === 'string' ? item : item.label;
      return `<option value="${escapeHtml(value)}" ${value === currentValue ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
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
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

function updateSessionPill() {
  const mode = state.health && state.health.persistence ? state.health.persistence.mode : '未连接';
  const role = state.user && state.user.roleName ? ` · ${state.user.roleName}` : '';
  els.sessionPill.textContent = state.user ? `${state.user.displayName}${role} · ${mode}` : mode;
}

function updatePermissionUi() {
  els.navItems.forEach((item) => {
    const permission = viewPermissions[item.dataset.view];
    item.hidden = !can(permission);
  });
  if (els.closeExpiredOrdersButton) {
    els.closeExpiredOrdersButton.hidden = !can('orders.write');
  }
  if (els.reconciliationButton) {
    els.reconciliationButton.hidden = !can('dashboard.read');
  }
  if (els.exportOrdersButton) {
    els.exportOrdersButton.hidden = !can('orders.read');
  }
}

function showStatus(message, tone = 'success') {
  window.clearTimeout(statusTimer);
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-banner is-visible is-${tone}`;
  statusTimer = window.setTimeout(() => {
    els.statusBanner.className = 'status-banner';
    els.statusBanner.textContent = '';
  }, 2600);
}

function getErrorMessage(error) {
  const messages = {
    ADMIN_LOGIN_FAILED: '账号或密码错误。',
    ADMIN_UNAUTHORIZED: '登录态已失效，请重新登录。',
    LOGIN_RATE_LIMITED: '登录尝试过于频繁，请稍后再试。',
    WRITE_RATE_LIMITED: '操作过于频繁，请稍后再试。',
    INVALID_INPUT: '提交内容未通过校验，请检查后重试。',
    PRODUCT_NOT_FOUND: '商品不存在，可能已被其他人处理。',
    WINE_NOT_FOUND: '酒款不存在，可能已被其他人处理。',
    CODE_NOT_FOUND: '提取码不存在。',
    ORDER_NOT_FOUND: '订单不存在。',
    PLAN_NOT_FOUND: '会员套餐不存在。',
    TRACK_NOT_FOUND: '当前酒款没有可绑定的曲目。',
    TRACK_WINE_MISMATCH: '歌曲不属于当前酒款。',
    WECHAT_CREDENTIALS_REQUIRED: '缺少微信 AppID/AppSecret，暂不能生成固定码。',
    ADMIN_PASSWORD_INVALID: '当前密码不正确。',
    ADMIN_PASSWORD_WEAK: '新密码强度不足，请使用大小写字母、数字和符号组合。',
    ADMIN_PASSWORD_REUSED: '新密码不能与当前密码相同。',
    ADMIN_FORBIDDEN: '当前账号没有执行该操作的权限。'
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
      els.loginOverlay.classList.remove('is-hidden');
    }
    showStatus(getErrorMessage(error), 'error');
    if (options.rethrow) {
      throw error;
    }
    return null;
  }
}

function setView(view) {
  if (!can(viewPermissions[view])) {
    return;
  }

  state.activeView = view;
  els.viewTitle.textContent = viewTitles[view];
  els.navItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === view);
  });
  Object.entries(els.views).forEach(([key, node]) => {
    node.classList.toggle('is-active', key === view);
  });
}

function renderDashboard() {
  const dashboard = state.dashboard;
  if (!dashboard) {
    return;
  }

  els.dashboardCards.innerHTML = dashboard.cards
    .map(
      (card) => `
        <article class="metric-card">
          <div class="metric-label">${card.label}</div>
          <div class="metric-value">${card.value}</div>
          <div class="metric-detail">${card.detail}</div>
        </article>
      `
    )
    .join('');

  const metrics = dashboard.metrics || {};
  const insightItems = [
    { label: '提取码验证成功率', value: `${metrics.codeSuccessRate || 0}%`, sub: `总计 ${metrics.codeTotal || 0} 个提取码` },
    { label: '会员转化率', value: `${metrics.memberRate || 0}%`, sub: `${metrics.activeMembers || 0}/${metrics.totalUsers || 0} 位用户` },
    { label: '下单转化率', value: `${metrics.orderRate || 0}%`, sub: '下单用户占总用户比例' },
    { label: '下载量', value: `${metrics.totalDownloads || 0}`, sub: `近24h ${metrics.downloads24h || 0} 次下载` }
  ];

  const insightsEl = document.getElementById('dashboard-insights');
  if (insightsEl) {
    insightsEl.innerHTML = insightItems
      .map(
        (item) => `
          <article class="insight-card">
            <div class="insight-label">${item.label}</div>
            <div class="insight-value">${item.value}</div>
            <div class="insight-detail">${item.sub}</div>
          </article>
        `
      )
      .join('');
  }

  const orderRows = dashboard.recentOrders
    .map(
      (order) => `
        <tr>
          <td>${order.orderNo}</td>
          <td>${order.orderType}</td>
          <td>¥${order.payAmount}</td>
          <td>${order.status}</td>
        </tr>
      `
    )
    .join('');

  els.ordersPreviewTable.innerHTML = `
    <thead>
      <tr>
        <th>订单号</th>
        <th>类型</th>
        <th>金额</th>
        <th>状态</th>
      </tr>
    </thead>
    <tbody>${orderRows}</tbody>
  `;

  const summary = dashboard.codeSummary;
  const total = Math.max(1, summary.ready + summary.claimed + summary.expired + summary.disabled);
  const items = [
    ['待消费', summary.ready],
    ['已使用', summary.claimed],
    ['已过期', summary.expired],
    ['已停用', summary.disabled]
  ];

  els.codeHealth.innerHTML = `
    <div class="bar-list">
      ${items
        .map(
          ([label, value]) => `
            <div class="bar-row">
              <div class="bar-top">
                <span>${label}</span>
                <span>${value}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${(value / total) * 100}%"></div>
              </div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderWines() {
  const createForm = `
    <article class="editor-card create-card">
      <div class="card-body">
        <form class="form-grid create-wine-form">
          <label><span>酒款名称</span><input name="name" placeholder="例如：月影珍藏" /></label>
          <label><span>副标题</span><input name="subtitle" placeholder="例如：庄园旗舰干红" /></label>
          <label><span>产区</span><input name="region" placeholder="例如：宁夏贺兰山东麓" /></label>
          <label><span>标签</span><input name="eyebrow" placeholder="例如：新上架" /></label>
          <button class="primary-button" type="submit">新增酒款</button>
        </form>
      </div>
    </article>
  `;

  els.winesList.innerHTML =
    createForm +
    state.wines
      .map(
        (wine) => `
        <article class="editor-card">
          <div class="editor-card-header">
            <img class="thumb" src="${escapeHtml(wine.posterImage)}" alt="${escapeHtml(wine.name)}" />
            <div>
              <h4 class="card-title">${escapeHtml(wine.name)}</h4>
              <p class="card-subtitle">${escapeHtml(wine.subtitle)}</p>
              <div class="tag-row">
                <span class="tag">${escapeHtml(wine.region)}</span>
                <span class="tag">${wine.trackCount} 首曲目</span>
                <span class="tag">${escapeHtml(wine.status || 'active')}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="danger-button delete-wine-button" data-wine-id="${wine.id}">删除 / 归档</button>
            </div>
          </div>
          <div class="card-body">
            <form class="form-grid wine-form" data-wine-id="${wine.id}">
              <label><span>标签</span><input name="eyebrow" value="${escapeHtml(wine.eyebrow || '')}" /></label>
              <label><span>名称</span><input name="name" value="${escapeHtml(wine.name || '')}" /></label>
              <label><span>副标题</span><input name="subtitle" value="${escapeHtml(wine.subtitle || '')}" /></label>
              <label><span>产区</span><input name="region" value="${escapeHtml(wine.region || '')}" /></label>
              <label><span>葡萄品种</span><input name="grapes" value="${escapeHtml(wine.grapes || '')}" /></label>
              <label><span>饮用建议</span><input name="serving" value="${escapeHtml(wine.serving || '')}" /></label>
              <label style="grid-column:1 / -1"><span>概述</span><input name="overview" value="${escapeHtml(wine.overview || '')}" /></label>
              <label style="grid-column:1 / -1"><span>引言</span><input name="quote" value="${escapeHtml(wine.quote || '')}" /></label>
              <button class="outline-button" type="submit">保存酒款内容</button>
            </form>
          </div>
        </article>
      `
      )
      .join('');
}

function renderWineries() {
  const createForm = `
    <article class="editor-card create-card">
      <div class="card-body">
        <form class="form-grid create-winery-form">
          <label><span>酒庄名称</span><input name="name" placeholder="例如：鸿玖酒庄" required /></label>
          <label><span>英文名称</span><input name="englishName" placeholder="例如：Hongjiu Estate" /></label>
          <label><span>标语</span><input name="tagline" placeholder="例如：Moonlit Vineyard Residency" /></label>
          <label style="grid-column:1 / -1"><span>简介</span><input name="intro" placeholder="酒庄品牌简介" /></label>
          <label style="grid-column:1 / -1"><span>品牌故事</span><input name="story" placeholder="酒庄品牌叙事" /></label>
          <label><span>主图</span><input name="heroImage" placeholder="酒庄主图 URL" /></label>
          <label><span>侧写图</span><input name="portraitImage" placeholder="侧写图 URL" /></label>
          <label><span>采摘图</span><input name="harvestImage" placeholder="采摘图 URL" /></label>
          <label><span>礼盒图</span><input name="giftImage" placeholder="礼盒图 URL" /></label>
          <button class="primary-button" type="submit">新增酒庄</button>
        </form>
      </div>
    </article>
  `;

  els.wineriesList.innerHTML =
    createForm +
    state.wineries
      .map(
        (winery) => `
        <article class="editor-card">
          <div class="editor-card-header">
            <img class="thumb" src="${escapeHtml(winery.heroImage)}" alt="${escapeHtml(winery.name)}" />
            <div>
              <h4 class="card-title">${escapeHtml(winery.name)}</h4>
              <p class="card-subtitle">${escapeHtml(winery.englishName || '')}</p>
              <div class="tag-row">
                <span class="tag">${escapeHtml(winery.tagline || '无标语')}</span>
                <span class="tag">${winery.wineCount || 0} 款酒</span>
              </div>
            </div>
          </div>
          <div class="card-body">
            <form class="form-grid winery-form" data-winery-id="${winery.id}">
              <label><span>酒庄名称</span><input name="name" value="${escapeHtml(winery.name || '')}" /></label>
              <label><span>英文名称</span><input name="englishName" value="${escapeHtml(winery.englishName || '')}" /></label>
              <label><span>标语</span><input name="tagline" value="${escapeHtml(winery.tagline || '')}" /></label>
              <label style="grid-column:1 / -1"><span>简介</span><input name="intro" value="${escapeHtml(winery.intro || '')}" /></label>
              <label style="grid-column:1 / -1"><span>品牌故事</span><input name="story" value="${escapeHtml(winery.story || '')}" /></label>
              <label><span>主图</span><input name="heroImage" value="${escapeHtml(winery.heroImage || '')}" /></label>
              <label><span>侧写图</span><input name="portraitImage" value="${escapeHtml(winery.portraitImage || '')}" /></label>
              <label><span>采摘图</span><input name="harvestImage" value="${escapeHtml(winery.harvestImage || '')}" /></label>
              <label><span>礼盒图</span><input name="giftImage" value="${escapeHtml(winery.giftImage || '')}" /></label>
              <button class="outline-button" type="submit">保存酒庄内容</button>
            </form>
          </div>
        </article>
      `
      )
      .join('');
}

function renderTracks() {
  const createForm = `
    <article class="editor-card create-card">
      <div class="card-body">
        <form class="form-grid create-track-form">
          <label>
            <span>绑定酒款</span>
            <select name="wineId">${state.wines
              .map((wine) => `<option value="${escapeHtml(wine.id)}">${escapeHtml(wine.name)}</option>`)
              .join('')}</select>
          </label>
          <label><span>曲名 (英文)</span><input name="title" placeholder="例如：A Transparent Dream" required /></label>
          <label><span>曲名 (中文)</span><input name="cnTitle" placeholder="例如：透明之梦" /></label>
          <label><span>氛围</span><input name="mood" placeholder="例如：Dreamscape" /></label>
          <label style="grid-column:1 / -1"><span>描述</span><input name="description" placeholder="曲目描述" /></label>
          <label><span>音频路径</span><input name="src" placeholder="/assets/audio/xxx.wav" /></label>
          <label><span>时长</span><input name="durationLabel" placeholder="00:24" /></label>
          <label><span>封面图</span><input name="cover" placeholder="封面图 URL" /></label>
          <label>
            <span>播放规则</span>
            <select name="playRule">${renderOptions(['trial', 'scan_or_member', 'member'], 'member')}</select>
          </label>
          <label><span>试听秒数</span><input name="previewSeconds" type="number" value="12" /></label>
          <label><span>解锁价格</span><input name="unlockPrice" type="number" value="29" /></label>
          <button class="primary-button" type="submit">新增曲目</button>
        </form>
      </div>
    </article>
  `;

  els.tracksList.innerHTML =
    createForm +
    state.tracks
      .map(
        (track) => `
        <article class="editor-card">
          <div class="editor-card-header">
            <img class="thumb" src="${escapeHtml(track.cover || '')}" alt="${escapeHtml(track.title)}" />
            <div>
              <h4 class="card-title">${escapeHtml(track.title)}</h4>
              <p class="card-subtitle">${escapeHtml(track.cnTitle || '')}</p>
              <div class="tag-row">
                <span class="tag">${escapeHtml(track.wineName || '-')}</span>
                <span class="tag">${escapeHtml(track.playRule)}</span>
                <span class="tag">${escapeHtml(track.mood || '')}</span>
              </div>
            </div>
          </div>
          <div class="card-body">
            <form class="form-grid track-form" data-track-id="${track.id}">
              <label>
                <span>绑定酒款</span>
                <select name="wineId">${state.wines
                  .map((wine) => `<option value="${escapeHtml(wine.id)}" ${wine.id === track.wineId ? 'selected' : ''}>${escapeHtml(wine.name)}</option>`)
                  .join('')}</select>
              </label>
              <label><span>曲名 (英文)</span><input name="title" value="${escapeHtml(track.title || '')}" /></label>
              <label><span>曲名 (中文)</span><input name="cnTitle" value="${escapeHtml(track.cnTitle || '')}" /></label>
              <label><span>氛围</span><input name="mood" value="${escapeHtml(track.mood || '')}" /></label>
              <label style="grid-column:1 / -1"><span>描述</span><input name="description" value="${escapeHtml(track.description || '')}" /></label>
              <label><span>音频路径</span><input name="src" value="${escapeHtml(track.src || '')}" /></label>
              <label><span>时长</span><input name="durationLabel" value="${escapeHtml(track.durationLabel || '')}" /></label>
              <label><span>封面图</span><input name="cover" value="${escapeHtml(track.cover || '')}" /></label>
              <label>
                <span>播放规则</span>
                <select name="playRule">${renderOptions(['trial', 'scan_or_member', 'member'], track.playRule)}</select>
              </label>
              <label><span>试听秒数</span><input name="previewSeconds" type="number" value="${track.previewSeconds || 12}" /></label>
              <label><span>解锁价格</span><input name="unlockPrice" type="number" value="${track.unlockPrice || 29}" /></label>
              <button class="outline-button" type="submit">保存曲目信息</button>
            </form>
          </div>
        </article>
      `
      )
      .join('');
}

function renderCodes() {
  els.batchWine.innerHTML = state.wines
    .map((wine) => `<option value="${escapeHtml(wine.id)}">${escapeHtml(wine.name)}</option>`)
    .join('');
  renderBatchTrackOptions();

  els.codesTable.innerHTML = `
    <thead>
      <tr>
        <th>提取码</th>
        <th>酒款</th>
        <th>歌曲</th>
        <th>批次</th>
        <th>状态</th>
        <th>使用时间</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${state.codes
        .slice(0, 30)
        .map(
          (code) => `
            <tr>
              <td><strong>${escapeHtml(code.redeemCode || code.token)}</strong></td>
              <td>${escapeHtml(code.wine ? code.wine.name : '-')}</td>
              <td>${escapeHtml(code.track ? code.track.cnTitle || code.track.title : '-')}</td>
              <td>${escapeHtml(code.batchNo)}</td>
              <td>${escapeHtml(code.status)}</td>
              <td>${escapeHtml(code.firstUsedAt || '-')}</td>
              <td>
                <form class="table-form code-status-form" data-code-id="${code.id}">
                  <select name="status">
                    ${renderOptions(['ready', 'claimed', 'expired', 'disabled'], code.status)}
                  </select>
                  <button type="submit">更新</button>
                </form>
              </td>
            </tr>
          `
        )
        .join('')}
    </tbody>
  `;
}

function renderBatchTrackOptions() {
  const wineId = els.batchWine.value || (state.wines[0] && state.wines[0].id) || '';
  const tracks = state.tracks.filter((track) => track.wineId === wineId);

  els.batchTrack.innerHTML = tracks.length
    ? tracks
        .map((track) => `<option value="${escapeHtml(track.id)}">${escapeHtml(track.cnTitle || track.title)}</option>`)
        .join('')
    : '<option value="">当前酒款无曲目</option>';
}

function renderProducts() {
  const createForm = `
    <article class="product-card create-card">
      <div class="card-body">
        <form class="form-grid create-product-form">
          <label>
            <span>绑定酒款</span>
            <select name="wineId">${state.wines
              .map((wine) => `<option value="${escapeHtml(wine.id)}">${escapeHtml(wine.name)}</option>`)
              .join('')}</select>
          </label>
          <label><span>商品名称</span><input name="name" placeholder="例如：月影庄园典藏礼盒" /></label>
          <label><span>副标题</span><input name="subtitle" placeholder="例如：提取码限定礼盒" /></label>
          <label><span>类目</span><input name="category" placeholder="例如：礼盒" /></label>
          <label><span>默认规格</span><input name="specName" placeholder="例如：单瓶礼盒" /></label>
          <label><span>销售价</span><input name="price" type="number" value="399" /></label>
          <label><span>划线价</span><input name="marketPrice" type="number" value="469" /></label>
          <label><span>库存</span><input name="stock" type="number" value="12" /></label>
          <button class="primary-button" type="submit">新增商品</button>
        </form>
      </div>
    </article>
  `;

  els.productsList.innerHTML =
    createForm +
    state.products
      .map(
        (product) => `
        <article class="product-card">
          <div class="product-card-header">
            <img class="thumb" src="${escapeHtml(product.coverImage)}" alt="${escapeHtml(product.name)}" />
            <div>
              <h4 class="card-title">${escapeHtml(product.name)}</h4>
              <p class="card-subtitle">${escapeHtml(product.subtitle)}</p>
              <div class="tag-row">
                <span class="tag">${escapeHtml(product.category)}</span>
                <span class="tag">${escapeHtml(product.badge)}</span>
                <span class="tag">${escapeHtml(product.status)}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="danger-button delete-product-button" data-product-id="${product.id}">删除 / 归档</button>
            </div>
          </div>
          <div class="card-body">
            <form class="form-grid product-form" data-product-id="${product.id}">
              <label><span>名称</span><input name="name" value="${escapeHtml(product.name)}" /></label>
              <label><span>副标题</span><input name="subtitle" value="${escapeHtml(product.subtitle)}" /></label>
              <label><span>类目</span><input name="category" value="${escapeHtml(product.category)}" /></label>
              <label>
                <span>状态</span>
                <select name="status">${renderOptions(['draft', 'published', 'archived'], product.status)}</select>
              </label>
              <button class="outline-button" type="submit">保存商品信息</button>
            </form>
            <div class="sku-list">
              ${product.skus
                .map(
                  (sku) => `
                    <form class="sku-row sku-form" data-sku-id="${sku.id}">
                      <div class="sku-name">
                        ${escapeHtml(sku.specName)}
                        <span class="sku-meta">可售 ${sku.availableStock ?? sku.stock} · 预占 ${sku.reservedStock || 0}</span>
                      </div>
                      <input name="price" type="number" value="${sku.price}" />
                      <input name="marketPrice" type="number" value="${sku.marketPrice}" />
                      <input name="stock" type="number" value="${sku.stock}" />
                      <button type="submit">更新 SKU</button>
                    </form>
                  `
                )
                .join('')}
              <form class="sku-row create-sku-form" data-product-id="${product.id}">
                <input name="specName" placeholder="新增规格名" />
                <input name="price" type="number" placeholder="价格" />
                <input name="marketPrice" type="number" placeholder="划线价" />
                <input name="stock" type="number" placeholder="库存" />
                <button type="submit">新增 SKU</button>
              </form>
            </div>
          </div>
        </article>
      `
      )
      .join('');
}

function renderOrders() {
  els.ordersTable.innerHTML = `
    <thead>
      <tr>
        <th>订单号</th>
        <th>用户</th>
        <th>类型</th>
        <th>金额</th>
        <th>状态</th>
        <th>履约</th>
        <th>收货 / 物流</th>
        <th>退款</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${state.orders
        .map(
          (order) => `
            <tr>
              <td>${escapeHtml(order.orderNo)}</td>
              <td>${escapeHtml(order.user.nickname)}</td>
              <td>${escapeHtml(order.orderType)}</td>
              <td>¥${order.payAmount}</td>
              <td>${escapeHtml(order.status)}</td>
              <td>
                <div>${escapeHtml(order.deliveryStatus)}</div>
                <div class="muted-inline">微信发货：${escapeHtml(order.wechatShippingSyncStatus || 'none')}</div>
              </td>
              <td>
                <div>${escapeHtml(order.addressSummary || '-')}</div>
                <div class="muted-inline">${escapeHtml(order.shippingCompany || '')} ${escapeHtml(order.trackingNo || '')}</div>
              </td>
              <td>${escapeHtml(order.refundStatus || (order.refund ? order.refund.status : 'none'))}</td>
              <td>
                <form class="table-form order-form" data-order-id="${order.id}">
                  <select name="status">
                    ${renderOptions(
                      ['pending_payment', 'paid', 'completed', 'closed', 'refund_pending', 'refunded'],
                      order.status
                    )}
                  </select>
                  <select name="deliveryStatus">
                    ${renderOptions(
                      ['pending', 'delivering', 'completed', 'rights_issued', 'downloaded', 'closed'],
                      order.deliveryStatus
                    )}
                  </select>
                  <input name="shippingCompany" placeholder="物流公司" value="${escapeHtml(order.shippingCompany || '')}" />
                  <input name="trackingNo" placeholder="物流单号" value="${escapeHtml(order.trackingNo || '')}" />
                  <input name="refundReason" placeholder="退款备注" value="${escapeHtml(order.refund ? order.refund.reason : '')}" />
                  <label class="inline-check">
                    <input name="restock" type="checkbox" value="true" />
                    <span>退款入库</span>
                  </label>
                  <button type="submit">保存</button>
                </form>
                <div class="table-actions">
                  <button type="button" class="sync-shipping-button" data-order-id="${order.id}">同步微信发货</button>
                  <button type="button" class="wechat-refund-button" data-order-id="${order.id}">微信退款</button>
                </div>
              </td>
            </tr>
          `
        )
        .join('')}
    </tbody>
  `;
}

function renderMembers() {
  const grantForm = `
    <article class="member-card create-card">
      <div class="card-body">
        <form class="form-grid grant-membership-form">
          <label>
            <span>用户</span>
            <select name="userId">${state.members
              .map((item) => `<option value="${escapeHtml(item.user.id)}">${escapeHtml(item.user.nickname)}</option>`)
              .join('')}</select>
          </label>
          <label>
            <span>套餐</span>
            <select name="planId">${state.membershipPlans
              .map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>`)
              .join('')}</select>
          </label>
          <button class="primary-button" type="submit">人工发放会员</button>
        </form>
      </div>
    </article>
  `;

  els.membersList.innerHTML =
    grantForm +
    state.members
      .map(
        (item) => `
        <article class="member-card">
          <div class="member-card-header">
            <div>
              <h4 class="card-title">${escapeHtml(item.user.nickname)}</h4>
              <p class="card-subtitle">${escapeHtml(item.user.tierLabel)}</p>
              <div class="tag-row">
                <span class="tag">${item.membership && item.membership.isActive ? '会员有效' : '普通用户'}</span>
                <span class="tag">${item.entitlements.length} 条下载权益</span>
                <span class="tag">${item.downloads} 次下载</span>
              </div>
            </div>
          </div>
          <div class="card-body">
            <p class="card-subtitle">${item.membership ? `有效期至 ${escapeHtml(item.membership.expireAt)}` : '尚未开通会员'}</p>
          </div>
        </article>
      `
      )
      .join('');
}

function renderAuditLogs() {
  els.auditTable.innerHTML = `
    <thead>
      <tr>
        <th>时间</th>
        <th>操作者</th>
        <th>动作</th>
        <th>目标</th>
      </tr>
    </thead>
    <tbody>
      ${state.auditLogs
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.createdAt)}</td>
              <td>${escapeHtml(item.actor)}</td>
              <td>${escapeHtml(item.action)}</td>
              <td>${escapeHtml(item.target)}</td>
            </tr>
          `
        )
        .join('')}
    </tbody>
  `;
}

function bindDynamicEvents() {
  document.querySelectorAll('.create-wine-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const created = await runTask(
        () =>
          api('/api/admin/wines', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '酒款已创建。'
      );
      if (!created) {
        return;
      }
      await loadData();
      form.reset();
      setView('wines');
    });
  });

  document.querySelectorAll('.wine-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const wineId = form.dataset.wineId;
      const formData = new FormData(form);
      const saved = await runTask(
        () =>
          api(`/api/admin/wines/${wineId}`, {
            method: 'PUT',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '酒款内容已保存。'
      );
      if (!saved) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.delete-wine-button').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('确认处理这个酒款？存在关联内容时会自动改为归档。')) {
        return;
      }
      const payload = await runTask(
        () =>
          api(`/api/admin/wines/${button.dataset.wineId}`, {
            method: 'DELETE'
          }),
        null
      );
      if (!payload) {
        return;
      }
      await loadData();
      showStatus(payload.result.mode === 'deleted' ? '酒款已删除。' : '酒款存在引用，已自动归档。', 'success');
    });
  });

  document.querySelectorAll('.create-winery-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const created = await runTask(
        () =>
          api('/api/admin/wineries', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '酒庄已创建。'
      );
      if (!created) {
        return;
      }
      await loadData();
      form.reset();
      setView('wineries');
    });
  });

  document.querySelectorAll('.winery-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const wineryId = form.dataset.wineryId;
      const formData = new FormData(form);
      const saved = await runTask(
        () =>
          api(`/api/admin/wineries/${wineryId}`, {
            method: 'PUT',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '酒庄内容已保存。'
      );
      if (!saved) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.create-track-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.previewSeconds = Number(data.previewSeconds) || 12;
      data.unlockPrice = Number(data.unlockPrice) || 29;
      const created = await runTask(
        () =>
          api('/api/admin/tracks', {
            method: 'POST',
            body: JSON.stringify(data)
          }),
        '曲目已创建。'
      );
      if (!created) {
        return;
      }
      await loadData();
      form.reset();
      setView('tracks');
    });
  });

  document.querySelectorAll('.track-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const trackId = form.dataset.trackId;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.previewSeconds = Number(data.previewSeconds) || 12;
      data.unlockPrice = Number(data.unlockPrice) || 29;
      const saved = await runTask(
        () =>
          api(`/api/admin/tracks/${trackId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
          }),
        '曲目信息已保存。'
      );
      if (!saved) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.create-product-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const created = await runTask(
        () =>
          api('/api/admin/products', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '商品已创建。'
      );
      if (!created) {
        return;
      }
      await loadData();
      form.reset();
      setView('products');
    });
  });

  document.querySelectorAll('.product-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const productId = form.dataset.productId;
      const formData = new FormData(form);
      const saved = await runTask(
        () =>
          api(`/api/admin/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '商品信息已保存。'
      );
      if (!saved) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.delete-product-button').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('确认处理这个商品？存在购物车或订单引用时会自动改为归档。')) {
        return;
      }
      const payload = await runTask(
        () =>
          api(`/api/admin/products/${button.dataset.productId}`, {
            method: 'DELETE'
          }),
        null
      );
      if (!payload) {
        return;
      }
      await loadData();
      showStatus(payload.result.mode === 'deleted' ? '商品已删除。' : '商品存在引用，已自动归档。', 'success');
    });
  });

  document.querySelectorAll('.sku-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const skuId = form.dataset.skuId;
      const formData = new FormData(form);
      const updated = await runTask(
        () =>
          api(`/api/admin/skus/${skuId}/price`, {
            method: 'PUT',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        'SKU 已更新。'
      );
      if (!updated) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.create-sku-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const created = await runTask(
        () =>
          api(`/api/admin/products/${form.dataset.productId}/skus`, {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '新规格已创建。'
      );
      if (!created) {
        return;
      }
      await loadData();
      form.reset();
    });
  });

  document.querySelectorAll('.code-status-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const updated = await runTask(
        () =>
          api(`/api/admin/codes/${form.dataset.codeId}/status`, {
            method: 'PUT',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '码状态已更新。'
      );
      if (!updated) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.order-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const updated = await runTask(
        () =>
          api(`/api/admin/orders/${form.dataset.orderId}`, {
            method: 'PUT',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '订单状态已保存。'
      );
      if (!updated) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.sync-shipping-button').forEach((button) => {
    button.addEventListener('click', async () => {
      const synced = await runTask(
        () =>
          api(`/api/admin/orders/${button.dataset.orderId}/shipping/wechat`, {
            method: 'POST',
            body: JSON.stringify({})
          }),
        '微信发货同步已提交。'
      );
      if (!synced) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.wechat-refund-button').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('确认向微信发起退款？生产环境会调用真实微信退款接口。')) {
        return;
      }
      const refunded = await runTask(
        () =>
          api(`/api/admin/orders/${button.dataset.orderId}/refund/wechat`, {
            method: 'POST',
            body: JSON.stringify({})
          }),
        '微信退款流程已提交。'
      );
      if (!refunded) {
        return;
      }
      await loadData();
    });
  });

  document.querySelectorAll('.grant-membership-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const granted = await runTask(
        () =>
          api('/api/admin/memberships/grant', {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(formData.entries()))
          }),
        '会员权益已发放。'
      );
      if (!granted) {
        return;
      }
      await loadData();
      setView('members');
    });
  });
}

async function loadData() {
  const maybeApi = (permission, url, fallback) => (can(permission) ? api(url) : Promise.resolve(fallback));
  const [health, dashboard, wines, wineries, tracks, codes, products, orders, members, auditLogs, storeHome] = await Promise.all([
    api('/api/health'),
    maybeApi('dashboard.read', '/api/admin/dashboard', null),
    maybeApi('wines.read', '/api/admin/wines', { items: [] }),
    maybeApi('wineries.read', '/api/admin/wineries', { items: [] }),
    maybeApi('tracks.read', '/api/admin/tracks', { items: [] }),
    maybeApi('codes.read', '/api/admin/codes', { items: [] }),
    maybeApi('products.read', '/api/admin/products', { items: [] }),
    maybeApi('orders.read', '/api/admin/orders', { items: [] }),
    maybeApi('memberships.read', '/api/admin/memberships', { items: [] }),
    maybeApi('audit.read', '/api/admin/audit-logs', { items: [] }),
    api('/api/store/home')
  ]);

  state.health = health;
  state.dashboard = dashboard;
  state.wines = wines.items;
  state.wineries = wineries.items;
  state.tracks = tracks.items;
  state.codes = codes.items;
  state.products = products.items;
  state.orders = orders.items;
  state.members = members.items;
  state.auditLogs = auditLogs.items;
  state.membershipPlans = storeHome.membershipPlans || [];

  updateSessionPill();
  updatePermissionUi();

  renderDashboard();
  renderWines();
  renderWineries();
  renderTracks();
  renderCodes();
  renderProducts();
  renderOrders();
  renderMembers();
  renderAuditLogs();
  bindDynamicEvents();

  if (!can(viewPermissions[state.activeView])) {
    const firstAllowed = Object.keys(viewTitles).find((view) => can(viewPermissions[view]));
    if (firstAllowed) {
      setView(firstAllowed);
    }
  }
}

async function login(username, password) {
  const payload = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  rememberSession(payload.token, payload.user);
  els.loginOverlay.classList.add('is-hidden');
  await loadData();
  showStatus('运营台已连接，可继续编辑内容与交易数据。', 'success');
}

async function logout() {
  if (state.token) {
    await api('/api/admin/logout', {
      method: 'POST'
    });
  }

  clearSession();
  els.loginOverlay.classList.remove('is-hidden');
  updateSessionPill();
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.loginError.textContent = '';

  try {
    await runTask(() => login(els.loginUsername.value, els.loginPassword.value), null, { rethrow: true });
  } catch (error) {
    els.loginError.textContent = getErrorMessage(error);
  }
});

els.navItems.forEach((item) => {
  item.addEventListener('click', () => {
    setView(item.dataset.view);
  });
});

els.refreshButton.addEventListener('click', async () => {
  if (!state.token) {
    return;
  }
  await runTask(() => loadData(), '数据已刷新。');
});

els.logoutButton.addEventListener('click', async () => {
  if (!state.token) {
    clearSession();
    els.loginOverlay.classList.remove('is-hidden');
    updateSessionPill();
    return;
  }

  await runTask(() => logout(), '已退出运营台。');
});

els.batchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const created = await runTask(
    () =>
      api('/api/admin/code-batches', {
        method: 'POST',
        body: JSON.stringify({
          wineId: els.batchWine.value,
          trackId: els.batchTrack.value,
          quantity: Number(els.batchQuantity.value),
          batchNo: els.batchBatchNo.value || undefined
        })
      }),
    '提取码批次已生成。'
  );
  if (!created) {
    return;
  }
  els.batchBatchNo.value = '';
  await loadData();
  setView('codes');
});

els.batchWine.addEventListener('change', () => {
  renderBatchTrackOptions();
});

els.fixedQrcodeButton.addEventListener('click', async () => {
  const payload = await runTask(
    () =>
      api('/api/admin/qrcode/fixed-redeem', {
        method: 'POST',
        body: JSON.stringify({})
      }),
    '固定小程序码已生成。'
  );

  if (!payload) {
    els.fixedQrcodeResult.textContent = '未生成。请确认微信 AppID/AppSecret 已配置。';
    return;
  }

  els.fixedQrcodeResult.innerHTML = `页面：${escapeHtml(payload.page)} · <a href="${escapeHtml(payload.path)}" target="_blank">打开固定码</a>`;
});

els.exportCodesButton.addEventListener('click', () => {
  window.open('/api/admin/codes/export', '_blank');
});

els.exportOrdersButton.addEventListener('click', () => {
  window.open('/api/admin/orders/export', '_blank');
});

els.reconciliationButton.addEventListener('click', async () => {
  const payload = await runTask(() => api('/api/admin/reports/reconciliation'), null);

  if (!payload) {
    return;
  }

  const summary = (payload.report && payload.report.summary) || {};
  showStatus(
    `对账完成：${summary.paidOrders || 0} 笔已支付，${summary.pendingRefunds || 0} 笔退款处理中，${summary.anomalies || 0} 个异常。`,
    summary.anomalies ? 'error' : 'success'
  );
});

els.closeExpiredOrdersButton.addEventListener('click', async () => {
  const payload = await runTask(
    () =>
      api('/api/admin/orders/close-expired', {
        method: 'POST',
        body: JSON.stringify({})
      }),
    '超时订单已检查。'
  );

  if (!payload) {
    return;
  }

  await loadData();
});

(async function init() {
  if (!state.token) {
    return;
  }

  try {
    await loadData();
    els.loginOverlay.classList.add('is-hidden');
  } catch (error) {
    clearSession();
  }
})();
