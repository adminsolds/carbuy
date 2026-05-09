// ─── State ─────────────────────────────────────────────────────────────────────
const S = {
  token: localStorage.getItem('admin_token') || '',
  user: JSON.parse(localStorage.getItem('admin_user') || 'null'),

  // Inventory / Auction
  invPage: 1, invLimit: 10, invTotal: 0,
  aucPage: 1, aucLimit: 10, aucTotal: 0,

  // Agents
  agentPage: 1, agentLimit: 10, agentTotal: 0,
  editingAgentId: null,

  // Orders
  orderPage: 1, orderLimit: 10, orderTotal: 0,
  selectedOrderId: null,

  // Users
  userPage: 1, userLimit: 10, userTotal: 0,

  // Settings
  auctionEnabled: false,

  // Uploaded images (local URLs from server)
  carUploadedImages: [],
  aucUploadedImages: [],
};
const DEFAULT_AGENT_AVATAR = '/uploads/default-agent-avatar.svg';
let hasHandledUnauthorized = false;
const ADMIN_PANEL_ROLES = ['seller', 'agent'];
const ROLE_SECTION_ACCESS = {
  seller: ['dashboard', 'inventory', 'auction', 'agents', 'orders', 'users', 'settings'],
  agent: ['dashboard', 'inventory', 'orders']
};

const byId = (id) => document.getElementById(id);
const setText = (id, value) => {
  const el = byId(id);
  if (el) el.textContent = value;
};
const setTextFirst = (ids, value) => {
  for (const id of ids) {
    const el = byId(id);
    if (el) {
      el.textContent = value;
      return;
    }
  }
};
const normalizeAgentAvatar = (url) => (typeof url === 'string' && url.trim() ? url.trim() : DEFAULT_AGENT_AVATAR);

function renderAgentAvatarPreview(url) {
  const preview = byId('agentAvatarPreviewImg');
  const input = byId('agentAvatarUrl');
  const finalUrl = normalizeAgentAvatar(url);
  if (preview) preview.src = finalUrl;
  if (input) input.value = finalUrl;
}
const roleLabel = (role) => {
  if (role === 'seller') return 'Admin';
  if (role === 'agent') return 'Agent';
  return 'User';
};

function getAllowedSections() {
  const role = S.user?.role || '';
  return ROLE_SECTION_ACCESS[role] || [];
}

function canAccessSection(section) {
  return getAllowedSections().includes(section);
}

// ─── API helper ────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const hdrs = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (S.token) hdrs.Authorization = `Bearer ${S.token}`;
  const r = await fetch(path, { ...opts, headers: hdrs });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) {
    if (!hasHandledUnauthorized) {
      hasHandledUnauthorized = true;
      clearSession();
      showLogin('Session expired. Please sign in again.');
      setTimeout(() => { hasHandledUnauthorized = false; }, 1500);
    }
  }
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}

// ─── Image Upload ────────────────────────────────────────────────────────────────
async function uploadImages(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }
  const hdrs = {};
  if (S.token) hdrs.Authorization = `Bearer ${S.token}`;
  const r = await fetch('/api/upload', { method: 'POST', headers: hdrs, body: formData });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Upload failed');
  return d.urls; // array of URLs like ["/uploads/xxx.jpg"]
}

function renderUploadedImages(containerId, images, stateKey, removeFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = images.map((url, i) => `
    <div class="uploaded-image">
      <img src="${url}" alt="Uploaded ${i + 1}" />
      <button type="button" class="remove-img" data-url="${url}" data-key="${stateKey}">✕</button>
    </div>
  `).join('');
}

const uploadUiIdMap = {
  uploadDropzone: { progress: 'uploadProgress', fill: 'progressFill', status: 'uploadStatus' },
  aucUploadDropzone: { progress: 'aucUploadProgress', fill: 'aucProgressFill', status: 'aucUploadStatus' },
};

function getUploadUiIds(dropzoneId) {
  const mapped = uploadUiIdMap[dropzoneId];
  if (mapped) return mapped;
  return {
    progress: dropzoneId.replace('Dropzone', 'UploadProgress'),
    fill: dropzoneId.replace('Dropzone', 'ProgressFill'),
    status: dropzoneId.replace('Dropzone', 'UploadStatus'),
  };
}

function setupDropzone(dropzoneId, inputId, imagesStateKey, containerId) {
  const dropzone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);
  if (!dropzone || !input) return;

  dropzone.addEventListener('click', () => input.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) await handleImageFiles(files, imagesStateKey, containerId, dropzoneId);
  });

  input.addEventListener('change', async () => {
    const files = Array.from(input.files);
    if (files.length) await handleImageFiles(files, imagesStateKey, containerId, dropzoneId);
    input.value = '';
  });
}

async function handleImageFiles(files, stateKey, containerId, dropzoneId) {
  const ids = getUploadUiIds(dropzoneId);
  const progress = document.getElementById(ids.progress);
  const fill = document.getElementById(ids.fill);
  const status = document.getElementById(ids.status);

  if (progress) progress.classList.remove('hidden');
  if (fill) fill.style.width = '30%';
  if (status) status.textContent = 'Uploading...';

  try {
    const urls = await uploadImages(files);
    if (fill) fill.style.width = '100%';
    if (status) status.textContent = 'Upload complete!';

    if (stateKey === 'carUploadedImages') {
      S.carUploadedImages.push(...urls);
      renderUploadedImages('uploadedImages', S.carUploadedImages, 'carUploadedImages');
    } else {
      S.aucUploadedImages.push(...urls);
      renderUploadedImages('aucUploadedImages', S.aucUploadedImages, 'aucUploadedImages');
    }
  } catch (err) {
    if (status) status.textContent = err.message;
  } finally {
    if (progress) setTimeout(() => progress.classList.add('hidden'), 2000);
    if (fill) fill.style.width = '0%';
  }
}

function removeUploadedImage(url, stateKey) {
  if (stateKey === 'carUploadedImages') {
    S.carUploadedImages = S.carUploadedImages.filter(u => u !== url);
    renderUploadedImages('uploadedImages', S.carUploadedImages, 'carUploadedImages');
  } else {
    S.aucUploadedImages = S.aucUploadedImages.filter(u => u !== url);
    renderUploadedImages('aucUploadedImages', S.aucUploadedImages, 'aucUploadedImages');
  }
}

async function uploadAgentAvatar(file) {
  if (!file) return;
  const btn = byId('agentAvatarUploadBtn');
  const input = byId('agentAvatarFile');
  try {
    if (btn) btn.disabled = true;
    const urls = await uploadImages([file]);
    if (urls?.[0]) {
      renderAgentAvatarPreview(urls[0]);
      msg('Avatar uploaded successfully.');
    }
  } catch (err) {
    msg(err.message || 'Avatar upload failed.', 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (input) input.value = '';
  }
}

// Init dropzones after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  setupDropzone('uploadDropzone', 'carImageInput', 'carUploadedImages', 'uploadedImages');
  setupDropzone('aucUploadDropzone', 'aucImageInput', 'aucUploadedImages', 'aucUploadedImages');
  renderAgentAvatarPreview(DEFAULT_AGENT_AVATAR);

  byId('agentAvatarUploadBtn')?.addEventListener('click', () => byId('agentAvatarFile')?.click());
  byId('agentAvatarDefaultBtn')?.addEventListener('click', () => renderAgentAvatarPreview(DEFAULT_AGENT_AVATAR));
  byId('agentAvatarFile')?.addEventListener('change', async (e) => {
    const file = e.target?.files?.[0];
    await uploadAgentAvatar(file);
  });
  byId('agentAvatarUrl')?.addEventListener('input', (e) => {
    renderAgentAvatarPreview(e.target.value);
  });

  // Event delegation for remove image buttons (they are dynamically created)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-img');
    if (btn) {
      const url = btn.getAttribute('data-url');
      const key = btn.getAttribute('data-key');
      if (url && key) removeUploadedImage(url, key);
    }
  });
});

// ─── Show / Hide screens ────────────────────────────────────────────────────────
function showLogin(msg = '') {
  byId('loginScreen')?.classList.remove('hidden');
  byId('adminLayout')?.classList.add('hidden');
  setText('authMessage', msg);
}

function showAdmin() {
  byId('loginScreen')?.classList.add('hidden');
  byId('adminLayout')?.classList.remove('hidden');
  setText('sidebarUserName', S.user?.name || '-');
  setText('sidebarUserRole', roleLabel(S.user?.role) || '-');
  setText('sidebarUserInitials', (S.user?.name || '-').charAt(0).toUpperCase());
  setTextFirst(['settingsUserName', 'settingsName'], S.user?.name || '-');
  setTextFirst(['settingsUserEmail', 'settingsEmail'], S.user?.email || '-');
  setTextFirst(['settingsUserRole', 'settingsRole'], roleLabel(S.user?.role) || '-');
  if (byId('accountName')) byId('accountName').value = S.user?.name || '';
  if (byId('accountEmail')) byId('accountEmail').value = S.user?.email || '';
  if (byId('accountPhone')) byId('accountPhone').value = S.user?.phone || '';
  applyRolePermissions();
}

function applyRolePermissions() {
  const allowed = new Set(getAllowedSections());
  const isSeller = S.user?.role === 'seller';

  document.querySelectorAll('.nav-item').forEach((item) => {
    const section = item.dataset.section;
    const permitted = allowed.has(section);
    item.classList.toggle('hidden', !permitted);
  });

  if (!allowed.has('users')) {
    byId('section-users')?.classList.add('hidden');
  }
  if (!allowed.has('settings')) {
    byId('section-settings')?.classList.add('hidden');
  }
  if (!allowed.has('agents')) {
    byId('section-agents')?.classList.add('hidden');
  }
  byId('qaAddVehicleBtn')?.classList.toggle('hidden', !allowed.has('inventory'));
  byId('qaAddAgentBtn')?.classList.toggle('hidden', !isSeller);
  byId('qaAuctionBtn')?.classList.toggle('hidden', !allowed.has('auction'));
  byId('qaOrdersBtn')?.classList.toggle('hidden', !allowed.has('orders'));
  byId('createOrderBtn')?.classList.toggle('hidden', !isSeller);
  byId('accountSettingsBtn')?.classList.toggle('hidden', !isSeller);
  if (!isSeller) {
    byId('orderFormPanel')?.classList.add('hidden');
  }
}

function showSection(name) {
  const allowed = getAllowedSections();
  if (!allowed.includes(name)) {
    const fallback = allowed[0] || 'dashboard';
    name = fallback;
  }
  document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.nav-item[data-section="${name}"]`)?.classList.add('active');
  const titles = { dashboard: 'Dashboard', inventory: 'Car Inventory', auction: 'Auction Vehicles', agents: 'Agents', orders: 'Orders', users: 'Users', settings: 'Settings' };
  document.getElementById('sectionTitle').textContent = titles[name] || name;
  return name;
}

function msg(text, type = 'success', duration = 3500) {
  const el = byId('globalMessage') || byId('globalMsg');
  if (!el) return;
  el.textContent = text;
  el.className = `global-msg ${type}`;
  el.style.opacity = '1';
  clearTimeout(el._tid);
  el._tid = setTimeout(() => { el.style.opacity = '0'; }, duration);
}

// ─── Session ────────────────────────────────────────────────────────────────────
function setSession(token, user) {
  S.token = token; S.user = user;
  localStorage.setItem('admin_token', token);
  localStorage.setItem('admin_user', JSON.stringify(user));
  hasHandledUnauthorized = false;
}

function clearSession() {
  S.token = ''; S.user = null;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const canReadAdminStats = S.user?.role === 'seller';
    const [carStats, userStats, orderStats] = await Promise.all([
      canReadAdminStats ? api('/api/admin/stats').catch(() => ({})) : Promise.resolve({}),
      canReadAdminStats ? api('/api/admin/users?limit=1').catch(() => ({})) : Promise.resolve({}),
      api('/api/orders/admin/stats').catch(() => ({})),
    ]);

    const cs = carStats.stats?.cars || {};
    const us = userStats.total ? { total: userStats.total } : (userStats.stats?.users || {});
    const os = orderStats.stats || {};

    document.getElementById('statsCards').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">🚗</div>
        <div class="stat-label">Total Vehicles</div>
        <div class="stat-value">${cs.total ?? '-'}</div>
        <div class="stat-sub">${cs.available ?? 0} available · ${cs.sold ?? 0} sold</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">🔨</div>
        <div class="stat-label">Auction Vehicles</div>
        <div class="stat-value">${cs.auction ?? '-'}</div>
        <div class="stat-sub">Active bidding</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">👥</div>
        <div class="stat-label">Total Users</div>
        <div class="stat-value">${us.total ?? '-'}</div>
        <div class="stat-sub">${us.buyers ?? 0} buyers · ${us.sellers ?? 0} sellers · ${us.agents ?? 0} agents</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">📋</div>
        <div class="stat-label">Total Orders</div>
        <div class="stat-value">${os.total ?? '-'}</div>
        <div class="stat-sub">RM ${Number(os.total_revenue || 0).toLocaleString()} revenue</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">⏳</div>
        <div class="stat-label">Pending Orders</div>
        <div class="stat-value">${os.by_status?.pending ?? '-'}</div>
        <div class="stat-sub">Awaiting deposit</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-label">Completed Orders</div>
        <div class="stat-value">${os.by_status?.completed ?? '-'}</div>
        <div class="stat-sub">Successfully delivered</div>
      </div>
    `;

    // Recent orders table
    const recentOrders = await api('/api/orders/admin/list?limit=5&sortBy=createdAt&sortOrder=DESC').catch(() => ({ orders: [] }));
    document.getElementById('recentOrdersTable').innerHTML = recentOrders.orders?.length
      ? `<table class="mini-table"><thead><tr><th>Order No</th><th>Buyer</th><th>Status</th><th>Amount</th></tr></thead><tbody>
        ${recentOrders.orders.map(o => `<tr><td>${o.order_no}</td><td>${o.buyer_name || '-'}</td><td><span class="status-pill pill-${o.status}">${o.status}</span></td><td>RM ${Number(o.amount||0).toLocaleString()}</td></tr>`).join('')}
       </tbody></table>`
      : '<p style="color:#64748b;text-align:center;padding:16px">No orders yet.</p>';
  } catch (e) { /* non-critical */ }
}

// ─── Settings ───────────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const d = await api('/api/settings');
    S.auctionEnabled = Boolean(d.auctionEnabled);
    refreshAuctionUI();
    // Load SMTP settings
    const smtp = d.smtp || {};
    document.getElementById('smtpHost').value = smtp.smtp_host || '';
    document.getElementById('smtpPort').value = smtp.smtp_port || '587';
    document.getElementById('smtpUser').value = smtp.smtp_user || '';
    document.getElementById('smtpPass').value = smtp.smtp_pass || '';
    document.getElementById('smtpFrom').value = smtp.smtp_from || '';
    document.getElementById('smtpAppUrl').value = smtp.app_url || '';
    document.getElementById('smtpSecure').value = smtp.smtp_secure || 'false';
  } catch { /* non-critical */ }
}

function refreshAuctionUI() {
  const badge = document.getElementById('auctionBadge');
  const btn = document.getElementById('toggleAuctionBtn');
  if (!badge || !btn) return;
  badge.textContent = S.auctionEnabled ? 'Enabled' : 'Disabled';
  badge.className = `badge ${S.auctionEnabled ? 'badge-success' : 'badge-secondary'}`;
  btn.textContent = S.auctionEnabled ? 'Disable' : 'Enable';
}

async function toggleAuction() {
  try {
    btn = document.getElementById('toggleAuctionBtn');
    btn.disabled = true;
    const d = await api('/api/settings/auction-enabled', {
      method: 'PUT', body: JSON.stringify({ enabled: !S.auctionEnabled })
    });
    S.auctionEnabled = Boolean(d.auctionEnabled);
    refreshAuctionUI();
    msg(S.auctionEnabled ? 'Auction system enabled.' : 'Auction system disabled.');
  } catch (e) { msg(e.message, 'error'); }
  finally { document.getElementById('toggleAuctionBtn').disabled = false; }
}

// ─── Inventory ─────────────────────────────────────────────────────────────────
async function loadInventory(page = 1) {
  S.invPage = page;
  try {
    const canReadAdminStats = S.user?.role === 'seller';
    const params = new URLSearchParams({
      limit: S.invLimit, offset: (S.invPage - 1) * S.invLimit,
      sortBy: document.getElementById('invSortBy')?.value || 'createdAt',
      sortOrder: document.getElementById('invSortOrder')?.value || 'DESC',
      status: document.getElementById('invStatus')?.value || 'all',
    });
    const s = document.getElementById('invSearch')?.value.trim();
    const mn = document.getElementById('invMinPrice')?.value;
    const mx = document.getElementById('invMaxPrice')?.value;
    if (s) params.set('search', s);
    if (mn) params.set('min_price', mn);
    if (mx) params.set('max_price', mx);

    const [d, statsData] = await Promise.all([
      api(`/api/cars?${params}`),
      canReadAdminStats ? api('/api/admin/stats').catch(() => ({})) : Promise.resolve({}),
    ]);
    S.invTotal = Number(d.total || 0);
    renderInventoryTable(d.cars || []);
    renderInventoryPager();

    // Inventory mini stats
    const cs = statsData.stats?.cars || {};
    document.getElementById('inventoryStats').innerHTML = `
      <div class="mini-stat">
        <div class="mini-stat-icon" style="background:#eff6ff;color:#3b82f6">🚗</div>
        <div>
          <div class="mini-stat-value">${cs.total ?? '-'}</div>
          <div class="mini-stat-label">Total</div>
        </div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-icon" style="background:#ecfdf5;color:#10b981">✅</div>
        <div>
          <div class="mini-stat-value">${cs.available ?? '-'}</div>
          <div class="mini-stat-label">Available</div>
        </div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-icon" style="background:#fffbeb;color:#f59e0b">🔨</div>
        <div>
          <div class="mini-stat-value">${cs.auction ?? '-'}</div>
          <div class="mini-stat-label">Auction</div>
        </div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-icon" style="background:#fef2f2;color:#ef4444">❌</div>
        <div>
          <div class="mini-stat-value">${cs.sold ?? '-'}</div>
          <div class="mini-stat-label">Sold</div>
        </div>
      </div>
    `;
  } catch (e) { msg(e.message, 'error'); }
}

function renderInventoryTable(cars) {
  const tb = document.getElementById('inventoryTable');
  if (!cars.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:24px">No vehicles found.</td></tr>';
    return;
  }
  tb.innerHTML = cars.map(car => `
    <tr>
      <td><strong>#${car.id}</strong></td>
      <td>${car.brand} ${car.model}</td>
      <td>${car.year || '-'}</td>
      <td>${Number(car.mileage||0).toLocaleString()} km</td>
      <td><span class="status-pill pill-${car.status}">${car.status}</span></td>
      <td>RM ${Number(car.price||0).toLocaleString()}</td>
      <td>${car.transmission || '-'}</td>
      <td>
        <div class="row-actions">
          <button class="btn-edit" data-inv-edit="${car.id}">Edit</button>
          <button class="btn-del" data-inv-delete="${car.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderInventoryPager() {
  const pages = Math.max(1, Math.ceil(S.invTotal / S.invLimit));
  document.getElementById('invPager').textContent = `Page ${S.invPage} / ${pages} — Total ${S.invTotal}`;
  document.getElementById('invPrev').disabled = S.invPage <= 1;
  document.getElementById('invNext').disabled = S.invPage >= pages;
}

function showCarForm() {
  document.getElementById('carFormPanel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideCarForm() {
  document.getElementById('carFormPanel').classList.add('hidden');
  resetCarForm();
}

function resetCarForm() {
  S.editingId = null;
  S.carUploadedImages = [];
  document.getElementById('carEditId').value = '';
  document.getElementById('carForm').reset();
  document.getElementById('carSaveBtn').textContent = 'Create Vehicle';
  document.getElementById('carFormTitle').textContent = 'Add New Vehicle';
  document.getElementById('carFormMsg').textContent = '';
  document.getElementById('uploadedImages').innerHTML = '';
}

async function submitCar(e) {
  e.preventDefault();
  const v = {};
  ['carBrand','carModel','carYear','carMileage','carColor','carPrice','carStatus',
   'carTransmission','carFuelType','carEngineCC','carChassisNo',
   'carOwnersCount','carDescription','carImages','carRepaired']
    .forEach(id => { const el = document.getElementById(id); if (el) v[id] = el.value; });

  // Merge uploaded server images with manually entered URL images
  const urlImages = (v.carImages || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const allImages = [...S.carUploadedImages, ...urlImages];
  const payload = {
    brand: v.carBrand.trim(), model: v.carModel.trim(),
    year: Number(v.carYear), mileage: Number(v.carMileage),
    color: v.carColor.trim() || null, price: Number(v.carPrice),
    description: v.carDescription.trim() || null,
    status: v.carStatus || 'available', images: allImages,
    repaired: v.carRepaired || 'no',
  };
  if (v.carTransmission?.trim()) payload.transmission = v.carTransmission.trim();
  if (v.carFuelType?.trim()) payload.fuel_type = v.carFuelType.trim();
  if (v.carEngineCC) payload.engine_cc = Number(v.carEngineCC);
  if (v.carChassisNo?.trim()) payload.chassis_no = v.carChassisNo.trim();
  if (v.carOwnersCount) payload.owners_count = Number(v.carOwnersCount);

  try {
    const editId = document.getElementById('carEditId').value;
    if (editId) {
      await api(`/api/cars/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      msg(`Vehicle #${editId} updated successfully.`);
    } else {
      const d = await api('/api/cars', { method: 'POST', body: JSON.stringify(payload) });
      msg(`Vehicle created successfully.`);
    }
    hideCarForm();
    await loadInventory();
  } catch (err) {
    document.getElementById('carFormMsg').textContent = err.message;
    document.getElementById('carFormMsg').className = 'form-msg error';
  }
}

// ─── Auction ─────────────────────────────────────────────────────────────────────
async function loadAuction(page = 1) {
  S.aucPage = page;
  try {
    const canReadAdminStats = S.user?.role === 'seller';
    const params = new URLSearchParams({
      limit: S.aucLimit, offset: (S.aucPage - 1) * S.aucLimit,
      sortBy: 'createdAt', sortOrder: 'DESC', status: 'auction', includeAuction: '1'
    });
    const [d, statsData] = await Promise.all([
      api(`/api/cars?${params}`),
      canReadAdminStats ? api('/api/admin/stats').catch(() => ({})) : Promise.resolve({}),
    ]);
    S.aucTotal = Number(d.total || 0);
    renderAuctionTable(d.cars || []);
    renderAuctionPager();

    const cs = statsData.stats?.cars || {};
    document.getElementById('auctionStats').innerHTML = `
      <div class="mini-stat">
        <div class="mini-stat-icon" style="background:#fffbeb;color:#f59e0b">🔨</div>
        <div>
          <div class="mini-stat-value">${cs.auction ?? '-'}</div>
          <div class="mini-stat-label">Active Auctions</div>
        </div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-icon" style="background:#eff6ff;color:#3b82f6">🚗</div>
        <div>
          <div class="mini-stat-value">${cs.total ?? '-'}</div>
          <div class="mini-stat-label">Total Vehicles</div>
        </div>
      </div>
    `;
  } catch (e) { msg(e.message, 'error'); }
}

function renderAuctionTable(cars) {
  const tb = document.getElementById('auctionTable');
  if (!cars.length) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:24px">No auction vehicles found.</td></tr>';
    return;
  }
  tb.innerHTML = cars.map(car => {
    const endTime = car.auction_end_time ? new Date(car.auction_end_time).toLocaleString('en-MY') : '-';
    const isEnded = car.auction_end_time && new Date(car.auction_end_time) < new Date();
    return `<tr>
      <td><strong>#${car.id}</strong></td>
      <td>${car.brand} ${car.model} (${car.year})</td>
      <td>RM ${Number(car.starting_bid||0).toLocaleString()}</td>
      <td>RM ${Number(car.highest_bid||car.starting_bid||0).toLocaleString()}</td>
      <td>${endTime}${isEnded ? ' <span class="badge badge-secondary">Ended</span>' : ''}</td>
      <td><span class="status-pill pill-${car.status}">${car.status}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn-edit" data-auc-edit="${car.id}">Edit</button>
          <button class="btn-del" data-auc-delete="${car.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderAuctionPager() {
  const pages = Math.max(1, Math.ceil(S.aucTotal / S.aucLimit));
  document.getElementById('aucPager').textContent = `Page ${S.aucPage} / ${pages} — Total ${S.aucTotal}`;
  document.getElementById('aucPrev').disabled = S.aucPage <= 1;
  document.getElementById('aucNext').disabled = S.aucPage >= pages;
}

function showAuctionForm() {
  document.getElementById('auctionFormPanel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideAuctionForm() {
  document.getElementById('auctionFormPanel').classList.add('hidden');
  resetAuctionForm();
}

function resetAuctionForm() {
  document.getElementById('auctionEditId').value = '';
  document.getElementById('auctionForm').reset();
  document.getElementById('aucSaveBtn').textContent = 'List for Auction';
  document.getElementById('auctionFormTitle').textContent = 'Add Auction Vehicle';
  document.getElementById('auctionFormMsg').textContent = '';
  S.aucUploadedImages = [];
  document.getElementById('aucUploadedImages').innerHTML = '';
}

async function submitAuction(e) {
  e.preventDefault();
  const v = {};
  ['aucBrand','aucModel','aucYear','aucMileage','aucColor','aucStartingBid',
   'aucReservePrice','aucEndTime','aucBuyNowPrice','aucDescription','aucImages']
    .forEach(id => { const el = document.getElementById(id); if (el) v[id] = el.value; });

  // Merge uploaded server images with manually entered URL images
  const urlImages = (v.aucImages || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const allImages = [...S.aucUploadedImages, ...urlImages];
  const payload = {
    brand: v.aucBrand.trim(), model: v.aucModel.trim(),
    year: Number(v.aucYear), mileage: Number(v.aucMileage),
    color: v.aucColor.trim() || null,
    description: v.aucDescription.trim() || null,
    images: allImages,
    status: 'auction',
    starting_bid: Number(v.aucStartingBid),
    auction_end_time: v.aucEndTime || null,
  };
  if (v.aucReservePrice) payload.reserve_price = Number(v.aucReservePrice);
  if (v.aucBuyNowPrice) payload.buy_now_price = Number(v.aucBuyNowPrice);

  try {
    const editId = document.getElementById('auctionEditId').value;
    if (editId) {
      await api(`/api/cars/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      msg(`Auction vehicle #${editId} updated.`);
    } else {
      await api('/api/cars', { method: 'POST', body: JSON.stringify(payload) });
      msg('Vehicle listed for auction.');
    }
    hideAuctionForm();
    await loadAuction();
  } catch (err) {
    document.getElementById('auctionFormMsg').textContent = err.message;
    document.getElementById('auctionFormMsg').className = 'form-msg error';
  }
}

// ─── Agents ─────────────────────────────────────────────────────────────────────
async function loadAgents(page = 1) {
  S.agentPage = page;
  try {
    const params = new URLSearchParams({
      limit: S.agentLimit, offset: (S.agentPage - 1) * S.agentLimit,
      sortBy: document.getElementById('agentSortBy')?.value || 'createdAt',
      sortOrder: document.getElementById('agentSortOrder')?.value || 'DESC',
    });
    const s = document.getElementById('agentSearch')?.value.trim();
    const fa = document.getElementById('agentFilterActive')?.value;
    if (s) params.set('search', s);
    if (fa && fa !== 'all') params.set('is_active', fa);

    const d = await api(`/api/agent/admin/list?${params}`);
    S.agentTotal = Number(d.total || 0);
    renderAgentTable(d.agents || []);
    renderAgentPager();
  } catch (e) { msg(e.message, 'error'); }
}

function renderAgentTable(agents) {
  const tb = document.getElementById('agentTable');
  if (!agents.length) {
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#64748b;padding:24px">No agents found.</td></tr>';
    return;
  }
  tb.innerHTML = agents.map(a => `
    <tr>
      <td><strong>#${a.id}</strong></td>
      <td><img class="agent-avatar-cell" src="${normalizeAgentAvatar(a.avatar_url)}" alt="${a.name || 'Agent'}" /></td>
      <td>${a.code}</td>
      <td>${a.name}</td>
      <td>${a.email || '-'}</td>
      <td>${a.phone || '-'}</td>
      <td>${a.company || '-'}</td>
      <td><span class="status-pill pill-${a.is_active ? 'active' : 'inactive'}">${a.is_active ? 'Active' : 'Inactive'}</span></td>
      <td><span class="status-pill pill-${a.access_enabled ? 'active' : 'inactive'}">${a.access_enabled ? 'Granted' : 'No Access'}</span></td>
      <td>
        <button class="btn-primary btn-sm" data-agent-access="${a.id}" data-agent-access-next="${a.access_enabled ? 'false' : 'true'}">
          ${a.access_enabled ? 'Revoke Access' : 'Grant Access'}
        </button>
      </td>
      <td>
        <div class="row-actions">
          <button class="btn-edit" data-agent-edit="${a.id}">Edit</button>
          <button class="btn-del" data-agent-delete="${a.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAgentPager() {
  const pages = Math.max(1, Math.ceil(S.agentTotal / S.agentLimit));
  document.getElementById('agentPager').textContent = `Page ${S.agentPage} / ${pages} — Total ${S.agentTotal}`;
  document.getElementById('agentPrev').disabled = S.agentPage <= 1;
  document.getElementById('agentNext').disabled = S.agentPage >= pages;
}

function showAgentForm() {
  document.getElementById('agentFormPanel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideAgentForm() {
  document.getElementById('agentFormPanel').classList.add('hidden');
  resetAgentForm();
}

function resetAgentForm() {
  S.editingAgentId = null;
  document.getElementById('agentEditId').value = '';
  document.getElementById('agentForm').reset();
  document.getElementById('agentSaveBtn').textContent = 'Create Agent';
  document.getElementById('agentFormTitle').textContent = 'Add New Agent';
  document.getElementById('agentFormMsg').textContent = '';
  document.getElementById('agentActive').value = 'true';
  document.getElementById('agentAccessEnabled').value = 'false';
  document.getElementById('agentAccessPassword').value = '';
  document.getElementById('agentPermAddCar').checked = true;
  document.getElementById('agentPermEditCar').checked = true;
  document.getElementById('agentPermUpdateOrder').checked = true;
  renderAgentAvatarPreview(DEFAULT_AGENT_AVATAR);
}

async function submitAgent(e) {
  e.preventDefault();
  const payload = {
    code: document.getElementById('agentCode').value.trim(),
    name: document.getElementById('agentName').value.trim(),
    email: document.getElementById('agentEmail').value.trim() || null,
    phone: document.getElementById('agentPhone').value.trim() || null,
    company: document.getElementById('agentCompany').value.trim() || null,
    avatar_url: normalizeAgentAvatar(document.getElementById('agentAvatarUrl')?.value),
    address: document.getElementById('agentAddress').value.trim() || null,
    is_active: document.getElementById('agentActive').value === 'true',
    notes: document.getElementById('agentNotes').value.trim() || null,
    can_add_car: document.getElementById('agentPermAddCar')?.checked !== false,
    can_edit_car: document.getElementById('agentPermEditCar')?.checked !== false,
    can_update_order_status: document.getElementById('agentPermUpdateOrder')?.checked !== false,
  };
  const shouldEnableAccess = document.getElementById('agentAccessEnabled')?.value === 'true';
  const accessPassword = document.getElementById('agentAccessPassword')?.value?.trim() || '';

  try {
    const editId = document.getElementById('agentEditId').value;
    let agentId = editId;
    if (editId) {
      await api(`/api/agent/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      msg(`Agent updated successfully.`);
    } else {
      const created = await api('/api/agent', { method: 'POST', body: JSON.stringify(payload) });
      agentId = created?.agent?.id;
      msg(`Agent created successfully.`);
    }
    if (agentId) {
      const accessRes = await api(`/api/agent/${agentId}/access`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled: shouldEnableAccess,
          password: accessPassword || undefined,
          can_add_car: payload.can_add_car,
          can_edit_car: payload.can_edit_car,
          can_update_order_status: payload.can_update_order_status
        })
      });
      if (accessRes?.temporary_password) {
        msg(`Agent access granted. Temporary password: ${accessRes.temporary_password}`);
      }
    }
    hideAgentForm();
    await loadAgents();
  } catch (err) {
    document.getElementById('agentFormMsg').textContent = err.message;
    document.getElementById('agentFormMsg').className = 'form-msg error';
  }
}

// ─── Orders ─────────────────────────────────────────────────────────────────────
const VALID_NEXT_STATUS = {
  pending: ['deposit_paid', 'cancelled'],
  deposit_paid: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: ['refunded'],
  refunded: []
};

async function loadOrders(page = 1) {
  S.orderPage = page;
  try {
    const params = new URLSearchParams({
      limit: S.orderLimit, offset: (S.orderPage - 1) * S.orderLimit,
      sortBy: document.getElementById('orderSortBy')?.value || 'createdAt',
      sortOrder: document.getElementById('orderSortOrder')?.value || 'DESC',
    });
    const s = document.getElementById('orderSearch')?.value.trim();
    const st = document.getElementById('orderStatus')?.value;
    const ot = document.getElementById('orderType')?.value;
    if (s) params.set('search', s);
    if (st && st !== 'all') params.set('status', st);
    if (ot && ot !== 'all') params.set('order_type', ot);

    const d = await api(`/api/orders/admin/list?${params}`);
    S.orderTotal = Number(d.total || 0);
    renderOrderTable(d.orders || []);
    renderOrderPager();

    // Load order stats
    const stats = await api('/api/orders/admin/stats').catch(() => ({}));
    const s2 = stats.stats || {};
    document.getElementById('orderStats').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">📋</div>
        <div class="stat-label">Total Orders</div>
        <div class="stat-value">${s2.total ?? '-'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">⏳</div>
        <div class="stat-label">Pending</div>
        <div class="stat-value">${s2.by_status?.pending ?? '-'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div class="stat-label">Completed</div>
        <div class="stat-value">${s2.by_status?.completed ?? '-'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">💰</div>
        <div class="stat-label">Revenue</div>
        <div class="stat-value">RM ${Number(s2.total_revenue||0).toLocaleString()}</div>
      </div>
    `;
  } catch (e) { msg(e.message, 'error'); }
}

function renderOrderTable(orders) {
  const tb = document.getElementById('orderTable');
  if (!orders.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:24px">No orders found.</td></tr>';
    return;
  }
  tb.innerHTML = orders.map(o => `
    <tr>
      <td><strong>${o.order_no}</strong></td>
      <td>${o.buyer_name || '-'}</td>
      <td>${o.car ? `${o.car.brand} ${o.car.model}` : '-'}</td>
      <td><span class="status-pill pill-${o.order_type}">${o.order_type}</span></td>
      <td>RM ${Number(o.amount||0).toLocaleString()}</td>
      <td><span class="status-pill pill-${o.status}">${o.status}</span></td>
      <td>${new Date(o.createdAt).toLocaleDateString('en-MY')}</td>
      <td>
        <div class="row-actions">
          <button class="btn-edit" data-order-view="${o.id}">View</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderOrderPager() {
  const pages = Math.max(1, Math.ceil(S.orderTotal / S.orderLimit));
  document.getElementById('orderPager').textContent = `Page ${S.orderPage} / ${pages} — Total ${S.orderTotal}`;
  document.getElementById('orderPrev').disabled = S.orderPage <= 1;
  document.getElementById('orderNext').disabled = S.orderPage >= pages;
}

function showOrderForm() {
  document.getElementById('orderFormPanel').classList.remove('hidden');
  loadOrderFormDropdowns();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideOrderForm() {
  document.getElementById('orderFormPanel').classList.add('hidden');
  resetOrderForm();
}

function resetOrderForm() {
  document.getElementById('createOrderForm').reset();
  document.getElementById('orderFormMsg').textContent = '';
  document.getElementById('orderFormMsg').className = 'form-msg';
}

async function loadOrderFormDropdowns() {
  try {
    // Load available cars
    const carData = await api('/api/cars?status=available&limit=500');
    const carSelect = document.getElementById('orderCarId');
    const currentVal = carSelect.value;
    carSelect.innerHTML = '<option value="">-- Select Vehicle --</option>';
    (carData.cars || []).forEach(car => {
      carSelect.innerHTML += `<option value="${car.id}">${car.brand} ${car.model} (${car.year}) — RM ${Number(car.price||0).toLocaleString()}</option>`;
    });
    carSelect.value = currentVal;

    // Also load auction cars that are available
    const aucData = await api('/api/cars?status=auction&limit=500&includeAuction=1').catch(() => ({ cars: [] }));
    (aucData.cars || []).forEach(car => {
      if (!carData.cars?.find(c => c.id === car.id)) {
        carSelect.innerHTML += `<option value="${car.id}">${car.brand} ${car.model} (${car.year}) [Auction] — RM ${Number(car.starting_bid||car.price||0).toLocaleString()}</option>`;
      }
    });

    // Load agents
    const agentData = await api('/api/agent?is_active=true');
    const agentSelect = document.getElementById('orderAgentId');
    agentSelect.innerHTML = '<option value="">-- No Agent --</option>';
    (agentData.agents || []).forEach(a => {
      agentSelect.innerHTML += `<option value="${a.id}">${a.code} — ${a.name}</option>`;
    });
  } catch (e) { /* non-critical */ }
}

async function submitOrder(e) {
  e.preventDefault();
  const car_id = document.getElementById('orderCarId').value;
  const order_type = document.getElementById('orderTypeSelect').value;
  const amount = document.getElementById('orderAmount').value;
  const buyer_name = document.getElementById('orderBuyerName').value.trim();
  const buyer_email = document.getElementById('orderBuyerEmail').value.trim();
  const buyer_phone = document.getElementById('orderBuyerPhone').value.trim();
  const agent_id = document.getElementById('orderAgentId').value;
  const initial_status = document.getElementById('orderInitialStatus').value;
  const deposit_paid = Number(document.getElementById('orderDepositPaid').value) || 0;
  const delivery_address = document.getElementById('orderDeliveryAddress').value.trim();
  const notes = document.getElementById('orderNotes').value.trim();

  if (!car_id || !amount || !buyer_name) {
    document.getElementById('orderFormMsg').textContent = 'Vehicle, amount and buyer name are required.';
    document.getElementById('orderFormMsg').className = 'form-msg error';
    return;
  }

  const payload = {
    car_id: Number(car_id),
    order_type,
    amount: Number(amount),
    buyer_name,
    buyer_email: buyer_email || null,
    buyer_phone: buyer_phone || null,
    agent_id: agent_id ? Number(agent_id) : null,
    delivery_address: delivery_address || null,
    notes: notes || null,
  };

  try {
    // Step 1: Create order
    const d = await api('/api/orders/admin', { method: 'POST', body: JSON.stringify(payload) });
    const newOrder = d.order;

    // Step 2: If initial status is not pending, update status
    if (initial_status !== 'pending') {
      await api(`/api/orders/${newOrder.id}/status`, {
        method: 'PUT', body: JSON.stringify({ status: initial_status })
      });
    }

    // Step 3: If deposit paid, update it
    if (deposit_paid > 0) {
      await api(`/api/orders/${newOrder.id}`, {
        method: 'PUT', body: JSON.stringify({ deposit_paid })
      });
    }

    msg(`Order ${newOrder.order_no} created successfully.`);
    hideOrderForm();
    await loadOrders(1);
  } catch (err) {
    document.getElementById('orderFormMsg').textContent = err.message;
    document.getElementById('orderFormMsg').className = 'form-msg error';
  }
}

function hideOrderDetail() {
  document.getElementById('orderDetailPanel').classList.add('hidden');
  S.selectedOrderId = null;
}

async function viewOrder(orderId) {
  try {
    const d = await api(`/api/orders/${orderId}`);
    const o = d.order;
    S.selectedOrderId = orderId;

    // Build status progress bar
    const steps = ['pending','deposit_paid','paid','processing','shipped','delivered','completed'];
    const cancelledSteps = ['pending','deposit_paid','paid','processing','shipped','delivered'];
    const currentIndex = steps.indexOf(o.status);
    const isCancelled = ['cancelled','refunded'].includes(o.status);

    let progressHtml = '';
    if (isCancelled) {
      progressHtml = `<div class="order-status-bar">
        ${cancelledSteps.map((step, i) => {
          const done = i < cancelledSteps.indexOf('pending') + 1;
          return `<div class="status-step ${done ? 'done' : ''}"><div class="status-dot"></div><div class="status-step-label">${step.replace('_',' ')}</div></div>`;
        }).join('')}
        <div class="status-step ${['cancelled','refunded'].includes(o.status) ? 'current' : ''}"><div class="status-dot"></div><div class="status-step-label">${o.status}</div></div>
      </div>`;
    } else if (currentIndex >= 0) {
      progressHtml = `<div class="order-status-bar">
        ${steps.map((step, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          return `<div class="status-step ${done ? 'done' : ''} ${current ? 'current' : ''}"><div class="status-dot"></div><div class="status-step-label">${step.replace('_',' ')}</div></div>`;
        }).join('')}
      </div>`;
    }

    const nextStatuses = VALID_NEXT_STATUS[o.status] || [];
    const statusButtons = nextStatuses.length
      ? nextStatuses.map(ns => `<button class="btn-primary btn-sm" onclick="updateOrderStatus('${ns}')">${ns.replace('_',' ')} →</button>`).join(' ')
      : '<span style="color:#64748b;font-size:13px">No further actions available</span>';

    const agentInfo = o.agent ? `<tr><th>Agent</th><td>${o.agent.code} — ${o.agent.name}</td></tr>` : '';
    const paidInfo = o.paid_at ? `<tr><th>Paid At</th><td>${new Date(o.paid_at).toLocaleString('en-MY')}</td></tr>` : '';
    const deliveredInfo = o.delivered_at ? `<tr><th>Delivered At</th><td>${new Date(o.delivered_at).toLocaleString('en-MY')}</td></tr>` : '';

    document.getElementById('orderDetailNo').textContent = o.order_no;
    document.getElementById('orderDetailBody').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
        <div>
          <table class="detail-table">
            <tr><th>Order No</th><td><strong>${o.order_no}</strong></td></tr>
            <tr><th>Type</th><td><span class="status-pill pill-${o.order_type}">${o.order_type}</span></td></tr>
            <tr><th>Buyer Name</th><td>${o.buyer_name || '-'}</td></tr>
            <tr><th>Buyer Email</th><td>${o.buyer_email || '-'}</td></tr>
            <tr><th>Buyer Phone</th><td>${o.buyer_phone || '-'}</td></tr>
            ${agentInfo}
            <tr><th>Delivery Address</th><td>${o.delivery_address || '-'}</td></tr>
            <tr><th>Notes</th><td>${o.notes || '-'}</td></tr>
          </table>
        </div>
        <div>
          <table class="detail-table">
            <tr><th>Amount</th><td><strong style="color:var(--accent)">RM ${Number(o.amount||0).toLocaleString()}</strong></td></tr>
            <tr><th>Deposit Paid</th><td>RM ${Number(o.deposit_paid||0).toLocaleString()}</td></tr>
            <tr><th>Current Status</th><td><span class="status-pill pill-${o.status}">${o.status}</span></td></tr>
            ${paidInfo}
            ${deliveredInfo}
            <tr><th>Created</th><td>${new Date(o.createdAt).toLocaleString('en-MY')}</td></tr>
            <tr><th>Last Updated</th><td>${new Date(o.updatedAt).toLocaleString('en-MY')}</td></tr>
            ${o.car ? `<tr><th>Vehicle</th><td>${o.car.brand} ${o.car.model} (${o.car.year})</td></tr>` : ''}
          </table>
        </div>
      </div>
      ${progressHtml ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-light)">${progressHtml}</div>` : ''}
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-light);display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">Actions:</span>
        ${statusButtons}
      </div>
      <p id="orderStatusMsg" class="form-msg" style="margin-top:8px"></p>
    `;

    document.getElementById('orderDetailPanel').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    msg(e.message, 'error');
  }
}

async function updateOrderStatus(newStatus) {
  if (!S.selectedOrderId) return;
  try {
    await api(`/api/orders/${S.selectedOrderId}/status`, {
      method: 'PUT', body: JSON.stringify({ status: newStatus })
    });
    msg(`Order status updated to '${newStatus}'.`);
    const statusEl = byId('orderStatusMsg');
    if (statusEl) {
      statusEl.textContent = `Status changed to '${newStatus}'.`;
      statusEl.className = 'form-msg';
    }
    await viewOrder(S.selectedOrderId);
    await loadOrders(S.orderPage);
  } catch (e) {
    const statusEl = byId('orderStatusMsg');
    if (statusEl) {
      statusEl.textContent = e.message;
      statusEl.className = 'form-msg error';
    } else {
      msg(e.message, 'error');
    }
  }
}

// ─── Users ──────────────────────────────────────────────────────────────────────
async function loadUsers(page = 1) {
  S.userPage = page;
  try {
    const params = new URLSearchParams({
      limit: S.userLimit, offset: (S.userPage - 1) * S.userLimit,
      sortBy: document.getElementById('userSortBy')?.value || 'createdAt',
      sortOrder: document.getElementById('userSortOrder')?.value || 'DESC',
    });
    const s = document.getElementById('userSearch')?.value.trim();
    const a = document.getElementById('userActive')?.value;
    if (s) params.set('search', s);
    params.set('role', 'buyer');
    if (a && a !== 'all') params.set('is_active', a);

    const d = await api(`/api/admin/users?${params}`);
    S.userTotal = Number(d.total || 0);
    renderUserTable(d.users || []);
    renderUserPager();
  } catch (e) { msg(e.message, 'error'); }
}

function renderUserTable(users) {
  const tb = document.getElementById('userTable');
  if (!users.length) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:24px">No users found.</td></tr>';
    return;
  }
  tb.innerHTML = users.map(u => `
    <tr>
      <td><strong>#${u.id}</strong></td>
      <td>${u.name || '-'}</td>
      <td>${u.email || '-'}</td>
      <td>${u.phone || '-'}</td>
      <td><span class="status-pill pill-${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${new Date(u.createdAt).toLocaleDateString('en-MY')}</td>
      <td>
        <div class="row-actions">
          <button class="btn-toggle${u.is_active ? ' active' : ''}" data-user-toggle="${u.id}" data-user-next="${!u.is_active}">
            ${u.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button class="btn-del" data-user-delete="${u.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderUserPager() {
  const pages = Math.max(1, Math.ceil(S.userTotal / S.userLimit));
  document.getElementById('userPager').textContent = `Page ${S.userPage} / ${pages} — Total ${S.userTotal}`;
  document.getElementById('userPrev').disabled = S.userPage <= 1;
  document.getElementById('userNext').disabled = S.userPage >= pages;
}

// ─── Clock ─────────────────────────────────────────────────────────────────────
function startClock() {
  const el = byId('headerTime');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' }); };
  tick(); setInterval(tick, 1000);
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  startClock();
  if (!S.token || !S.user || !ADMIN_PANEL_ROLES.includes(S.user.role)) {
    showLogin('');
    return;
  }
  try {
    await api('/api/auth/me');
  } catch {
    return;
  }
  showAdmin();
  showSection('dashboard');
  if (S.user?.role === 'seller') {
    await loadSettings();
  }
  await loadDashboard();
}

// ─── Event: Login ──────────────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try {
    const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!ADMIN_PANEL_ROLES.includes(d.user?.role)) { showLogin('Only admin/agent accounts can access admin.'); clearSession(); return; }
    setSession(d.token, d.user);
    showAdmin();
    showSection('dashboard');
    if (S.user?.role === 'seller') {
      await loadSettings();
    }
    await loadDashboard();
  } catch (err) { showLogin(err.message); }
});

// ─── Event: Logout ─────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  clearSession(); showLogin('Logged out.');
});

document.getElementById('accountSettingsBtn')?.addEventListener('click', () => {
  const section = showSection('settings');
  if (section === 'settings') {
    loadSettings();
  }
});

// ─── Event: Nav ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const requested = el.dataset.section;
    const name = showSection(requested);
    if (name === 'dashboard') loadDashboard();
    if (name === 'inventory') loadInventory(1);
    if (name === 'auction') loadAuction(1);
    if (name === 'agents') loadAgents(1);
    if (name === 'orders') loadOrders(1);
    if (name === 'users') loadUsers(1);
  });
});

// ─── Event: Toggle Auction ─────────────────────────────────────────────────────
document.getElementById('toggleAuctionBtn').addEventListener('click', toggleAuction);

// ─── Event: SMTP Form ─────────────────────────────────────────────────────────
document.getElementById('smtpForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('smtpSaveBtn');
  btn.disabled = true;
  try {
    const payload = {
      smtp_host: document.getElementById('smtpHost').value.trim(),
      smtp_port: document.getElementById('smtpPort').value.trim(),
      smtp_secure: document.getElementById('smtpSecure').value,
      smtp_user: document.getElementById('smtpUser').value.trim(),
      smtp_pass: document.getElementById('smtpPass').value,
      smtp_from: document.getElementById('smtpFrom').value.trim(),
      app_url: document.getElementById('smtpAppUrl').value.trim(),
    };
    await api('/api/settings/smtp', { method: 'PUT', body: JSON.stringify(payload) });
    document.getElementById('smtpMsg').textContent = 'SMTP settings saved.';
    document.getElementById('smtpMsg').className = 'form-msg';
  } catch (e) {
    document.getElementById('smtpMsg').textContent = e.message;
    document.getElementById('smtpMsg').className = 'form-msg error';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('smtpTestBtn').addEventListener('click', async () => {
  const btn = document.getElementById('smtpTestBtn');
  btn.disabled = true;
  try {
    await api('/api/settings/smtp/test', { method: 'POST' });
    document.getElementById('smtpMsg').textContent = 'Test email sent!';
    document.getElementById('smtpMsg').className = 'form-msg';
  } catch (e) {
    document.getElementById('smtpMsg').textContent = 'Failed: ' + e.message;
    document.getElementById('smtpMsg').className = 'form-msg error';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('accountForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = byId('accountSaveBtn');
  const msgEl = byId('accountMsg');
  if (!btn || !msgEl) return;
  btn.disabled = true;
  msgEl.textContent = '';
  try {
    const payload = {
      name: byId('accountName')?.value?.trim(),
      email: byId('accountEmail')?.value?.trim(),
      phone: byId('accountPhone')?.value?.trim() || null
    };
    const d = await api('/api/auth/account', { method: 'PUT', body: JSON.stringify(payload) });
    if (d.token && d.user) {
      setSession(d.token, d.user);
      showAdmin();
    }
    msgEl.textContent = 'Account updated successfully.';
    msgEl.className = 'form-msg';
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'form-msg error';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = byId('passwordSaveBtn');
  const msgEl = byId('passwordMsg');
  if (!btn || !msgEl) return;
  btn.disabled = true;
  msgEl.textContent = '';
  try {
    const payload = {
      currentPassword: byId('currentPassword')?.value || '',
      newPassword: byId('newPassword')?.value || ''
    };
    await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(payload) });
    if (byId('passwordForm')) byId('passwordForm').reset();
    msgEl.textContent = 'Password updated successfully.';
    msgEl.className = 'form-msg';
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = 'form-msg error';
  } finally {
    btn.disabled = false;
  }
});

// ─── Event: Car Form ────────────────────────────────────────────────────────────
document.getElementById('carForm').addEventListener('submit', submitCar);

// ─── Event: Auction Form ────────────────────────────────────────────────────────
document.getElementById('auctionForm').addEventListener('submit', submitAuction);

// ─── Event: Order Form ─────────────────────────────────────────────────────────
document.getElementById('createOrderForm').addEventListener('submit', submitOrder);

// ─── Event: Agent Form ─────────────────────────────────────────────────────────
document.getElementById('agentForm').addEventListener('submit', submitAgent);

// ─── Event: Inventory Table Click ───────────────────────────────────────────────
document.getElementById('inventoryTable').addEventListener('click', async (e) => {
  const editId = e.target.getAttribute('data-inv-edit');
  const deleteId = e.target.getAttribute('data-inv-delete');

  if (editId) {
    try {
      const d = await api(`/api/cars/${editId}`);
      const car = d.car;
      S.editingId = car.id;
      document.getElementById('carEditId').value = car.id;
      document.getElementById('carBrand').value = car.brand || '';
      document.getElementById('carModel').value = car.model || '';
      document.getElementById('carYear').value = car.year || '';
      document.getElementById('carMileage').value = car.mileage || '';
      document.getElementById('carColor').value = car.color || '';
      document.getElementById('carPrice').value = car.price || '';
      document.getElementById('carStatus').value = car.status || 'available';
      document.getElementById('carTransmission').value = car.transmission || '';
      document.getElementById('carFuelType').value = car.fuel_type || '';
      document.getElementById('carEngineCC').value = car.engine_cc || '';
      document.getElementById('carChassisNo').value = car.chassis_no || '';
      document.getElementById('carOwnersCount').value = car.owners_count || '';
      document.getElementById('carRepaired').value = car.repaired || 'no';
      document.getElementById('carDescription').value = car.description || '';
      // Separate server-hosted images (from uploads) from URL images
      const serverImages = (car.images || []).filter(url => url.startsWith('/uploads/'));
      const urlImages = (car.images || []).filter(url => !url.startsWith('/uploads/'));
      S.carUploadedImages = serverImages;
      document.getElementById('carImages').value = urlImages.join('\n');
      renderUploadedImages('uploadedImages', S.carUploadedImages, 'carUploadedImages');
      document.getElementById('carSaveBtn').textContent = 'Update Vehicle';
      document.getElementById('carFormTitle').textContent = `Edit Vehicle #${car.id}`;
      showCarForm();
    } catch (err) { msg(err.message, 'error'); }
    return;
  }

  if (deleteId) {
    if (!confirm(`Delete vehicle #${deleteId}? This cannot be undone.`)) return;
    try {
      await api(`/api/cars/${deleteId}`, { method: 'DELETE' });
      msg(`Vehicle #${deleteId} deleted.`);
      await loadInventory();
    } catch (err) { msg(err.message, 'error'); }
  }
});

// ─── Event: Auction Table Click ───────────────────────────────────────────────
document.getElementById('auctionTable').addEventListener('click', async (e) => {
  const editId = e.target.getAttribute('data-auc-edit');
  const deleteId = e.target.getAttribute('data-auc-delete');

  if (editId) {
    try {
      const d = await api(`/api/cars/${editId}`);
      const car = d.car;
      document.getElementById('auctionEditId').value = car.id;
      document.getElementById('aucBrand').value = car.brand || '';
      document.getElementById('aucModel').value = car.model || '';
      document.getElementById('aucYear').value = car.year || '';
      document.getElementById('aucMileage').value = car.mileage || '';
      document.getElementById('aucColor').value = car.color || '';
      document.getElementById('aucStartingBid').value = car.starting_bid || '';
      document.getElementById('aucDescription').value = car.description || '';
      // Separate server-hosted images (from uploads) from URL images
      const serverImages = (car.images || []).filter(url => url.startsWith('/uploads/'));
      const urlImages = (car.images || []).filter(url => !url.startsWith('/uploads/'));
      S.aucUploadedImages = serverImages;
      document.getElementById('aucImages').value = urlImages.join('\n');
      renderUploadedImages('aucUploadedImages', S.aucUploadedImages, 'aucUploadedImages');
      if (car.auction_end_time) {
        document.getElementById('aucEndTime').value = car.auction_end_time.slice(0, 16);
      }
      document.getElementById('aucSaveBtn').textContent = 'Update Auction';
      document.getElementById('auctionFormTitle').textContent = `Edit Auction #${car.id}`;
      showAuctionForm();
    } catch (err) { msg(err.message, 'error'); }
    return;
  }

  if (deleteId) {
    if (!confirm(`Delete auction vehicle #${deleteId}?`)) return;
    try {
      await api(`/api/cars/${deleteId}`, { method: 'DELETE' });
      msg(`Auction vehicle #${deleteId} deleted.`);
      await loadAuction();
    } catch (err) { msg(err.message, 'error'); }
  }
});

// ─── Event: Agent Table Click ─────────────────────────────────────────────────
document.getElementById('agentTable').addEventListener('click', async (e) => {
  const accessId = e.target.getAttribute('data-agent-access');
  const accessNext = e.target.getAttribute('data-agent-access-next');
  const editId = e.target.getAttribute('data-agent-edit');
  const deleteId = e.target.getAttribute('data-agent-delete');

  if (accessId) {
    try {
      let password = '';
      if (accessNext === 'true') {
        password = prompt('Set initial password for agent access (leave blank for auto-generated password):') || '';
      }
      const d = await api(`/api/agent/${accessId}/access`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: accessNext === 'true', password: password.trim() || undefined })
      });
      if (d?.temporary_password) {
        msg(`Access granted. Temporary password: ${d.temporary_password}`);
      } else {
        msg(accessNext === 'true' ? 'Agent access granted.' : 'Agent access revoked.');
      }
      await loadAgents(S.agentPage);
    } catch (err) { msg(err.message, 'error'); }
    return;
  }

  if (editId) {
    try {
      const d = await api(`/api/agent/${editId}`);
      const a = d.agent;
      S.editingAgentId = a.id;
      document.getElementById('agentEditId').value = a.id;
      document.getElementById('agentCode').value = a.code || '';
      document.getElementById('agentName').value = a.name || '';
      document.getElementById('agentEmail').value = a.email || '';
      document.getElementById('agentPhone').value = a.phone || '';
      document.getElementById('agentCompany').value = a.company || '';
      renderAgentAvatarPreview(a.avatar_url || DEFAULT_AGENT_AVATAR);
      document.getElementById('agentAddress').value = a.address || '';
      document.getElementById('agentActive').value = a.is_active ? 'true' : 'false';
      document.getElementById('agentNotes').value = a.notes || '';
      document.getElementById('agentAccessEnabled').value = a.access_enabled ? 'true' : 'false';
      document.getElementById('agentAccessPassword').value = '';
      document.getElementById('agentPermAddCar').checked = a.can_add_car !== false;
      document.getElementById('agentPermEditCar').checked = a.can_edit_car !== false;
      document.getElementById('agentPermUpdateOrder').checked = a.can_update_order_status !== false;
      document.getElementById('agentSaveBtn').textContent = 'Update Agent';
      document.getElementById('agentFormTitle').textContent = `Edit Agent ${a.code}`;
      showAgentForm();
    } catch (err) { msg(err.message, 'error'); }
    return;
  }

  if (deleteId) {
    if (!confirm(`Delete agent #${deleteId}?`)) return;
    try {
      await api(`/api/agent/${deleteId}`, { method: 'DELETE' });
      msg(`Agent #${deleteId} deleted.`);
      await loadAgents();
    } catch (err) { msg(err.message, 'error'); }
  }
});

// ─── Event: Order Table Click ──────────────────────────────────────────────────
document.getElementById('orderTable').addEventListener('click', async (e) => {
  const viewId = e.target.getAttribute('data-order-view');
  if (viewId) {
    await viewOrder(viewId);
  }
});

// ─── Event: User Table Click ───────────────────────────────────────────────────
document.getElementById('userTable').addEventListener('click', async (e) => {
  const toggleId = e.target.getAttribute('data-user-toggle');
  const toggleNext = e.target.getAttribute('data-user-next');
  const deleteId = e.target.getAttribute('data-user-delete');

  if (toggleId) {
    try {
      await api(`/api/admin/users/${toggleId}/active`, {
        method: 'PUT', body: JSON.stringify({ is_active: toggleNext === 'true' })
      });
      msg(`User #${toggleId} ${toggleNext === 'true' ? 'activated' : 'deactivated'}.`);
      await loadUsers(S.userPage);
    } catch (err) { msg(err.message, 'error'); }
    return;
  }

  if (deleteId) {
    if (!confirm(`Delete user #${deleteId}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/users/${deleteId}`, { method: 'DELETE' });
      msg(`User #${deleteId} deleted.`);
      await loadUsers(S.userPage);
    } catch (err) { msg(err.message, 'error'); }
  }
});

// ─── Pagination ────────────────────────────────────────────────────────────────
document.getElementById('invPrev').addEventListener('click', () => { if (S.invPage > 1) loadInventory(S.invPage - 1); });
document.getElementById('invNext').addEventListener('click', () => { if (S.invPage < Math.max(1, Math.ceil(S.invTotal / S.invLimit))) loadInventory(S.invPage + 1); });
document.getElementById('aucPrev').addEventListener('click', () => { if (S.aucPage > 1) loadAuction(S.aucPage - 1); });
document.getElementById('aucNext').addEventListener('click', () => { if (S.aucPage < Math.max(1, Math.ceil(S.aucTotal / S.aucLimit))) loadAuction(S.aucPage + 1); });
document.getElementById('agentPrev').addEventListener('click', () => { if (S.agentPage > 1) loadAgents(S.agentPage - 1); });
document.getElementById('agentNext').addEventListener('click', () => { if (S.agentPage < Math.max(1, Math.ceil(S.agentTotal / S.agentLimit))) loadAgents(S.agentPage + 1); });
document.getElementById('orderPrev').addEventListener('click', () => { if (S.orderPage > 1) loadOrders(S.orderPage - 1); });
document.getElementById('orderNext').addEventListener('click', () => { if (S.orderPage < Math.max(1, Math.ceil(S.orderTotal / S.orderLimit))) loadOrders(S.orderPage + 1); });
document.getElementById('userPrev').addEventListener('click', () => { if (S.userPage > 1) loadUsers(S.userPage - 1); });
document.getElementById('userNext').addEventListener('click', () => { if (S.userPage < Math.max(1, Math.ceil(S.userTotal / S.userLimit))) loadUsers(S.userPage + 1); });

// ─── Sidebar toggle ───────────────────────────────────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});

// ─── Missing helper aliases (called from inline onclick) ─────────────────────
function hideInventoryForm() { hideCarForm(); }

// ─── Start ─────────────────────────────────────────────────────────────────────
bootstrap();
