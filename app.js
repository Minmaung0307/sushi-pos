/* ========= Sushi POS — app.js ========= */
// (A) Init, utils, auth flow, Firestore fixes
/* 1) Firebase config */
const firebaseConfig = {
  // TODO: put YOUR Firebase web app config here
  apiKey: "AIzaSyBY52zMMQqsvssukui3TfQnMigWoOzeKGk",
  authDomain: "sushi-pos.firebaseapp.com",
  projectId: "sushi-pos",
};

/* 2) Init Firebase */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* Firestore transport fix (stops WebChannel 400s) */
try {
  db.settings({
    experimentalForceLongPolling: true,
    useFetchStreams: false
  });
} catch (e) {
  console.warn('Firestore settings warning:', e);
}

/* 3) Local Storage helpers */
const LS = {
  load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del(key) { try { localStorage.removeItem(key); } catch {} }
};

/* 4) Roles & Defaults */
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];
const DEFAULT_THEME = { primary: '#0ea5a5', fontSize: 16 };

function showToast(msg) {
  const el = document.getElementById('notification');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 2000);
}

/* 5) Seed local people (so admin/manager exist) */
(function ensureDefaultPeople() {
  const existing = LS.load('users', []);
  const want = [
    { name: 'Admin',   username: 'admin',   email: 'admin@sushi.com',            role: 'admin'   },
    { name: 'Manager', username: 'manager', email: 'minmaung0307@gmail.com',     role: 'manager' }
  ];
  let changed = false;
  for (const w of want) {
    if (!existing.find(u => (u.email||'').toLowerCase() === w.email.toLowerCase())) {
      existing.push({ ...w, contact:'', password:'', img:'' });
      changed = true;
    }
  }
  if (changed) LS.save('users', existing);
})();

/* 6) Theme */
function applyTheme() {
  const theme = LS.load('theme', DEFAULT_THEME);
  document.documentElement.style.setProperty('--primary', theme.primary || DEFAULT_THEME.primary);
  document.documentElement.style.setProperty('--primary-600', shade(theme.primary || DEFAULT_THEME.primary, -10));
  document.documentElement.style.setProperty('--fs', `${theme.fontSize || DEFAULT_THEME.fontSize}px`);
}
function shade(hex, percent = -10) {
  // simple shade adjuster
  const p = Math.max(-100, Math.min(100, percent)) / 100;
  const n = parseInt(hex.replace('#',''), 16);
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  r = Math.round(r + (p < 0 ? r*p : (255 - r)*p));
  g = Math.round(g + (p < 0 ? g*p : (255 - g)*p));
  b = Math.round(b + (p < 0 ? b*p : (255 - b)*p));
  return `#${(1<<24 | r<<16 | g<<8 | b).toString(16).slice(1)}`;
}

/* 7) Session helpers + role checks */
function getSession() { return LS.load('session', null); }
function isAdmin(s=getSession())   { return !!s && s.role === 'admin'; }
function isManager(s=getSession()) { return !!s && s.role === 'manager'; }
function isStaff(s=getSession())   { return !!s && s.role === 'staff'; }
function isUser(s=getSession())    { return !!s && s.role === 'user'; }
function canAddPost() { const s = getSession(); return isAdmin(s) || isManager(s); }

/* 8) Auth state (instant render, background cloud) */
auth.onAuthStateChanged(async (user) => {
  applyTheme();

  if (!user) {
    LS.save('session', null);
    return renderLogin();
  }

  // Local profile (fast)
  const email = (user.email || '').toLowerCase();
  const users = LS.load('users', []);
  let prof = users.find(u => (u.email || '').toLowerCase() === email);

  if (!prof) {
    const role = SUPER_ADMINS.includes(email) ? 'admin' : 'user';
    prof = {
      name: role === 'admin' ? 'Admin' : (user.displayName || 'User'),
      username: (email.split('@')[0] || 'user'),
      email, contact:'', role, password:'', img:''
    };
    users.push(prof);
    LS.save('users', users);
  } else if (SUPER_ADMINS.includes(email) && prof.role !== 'admin') {
    prof.role = 'admin';
    LS.save('users', users);
  }

  LS.save('session', { ...prof });
  renderApp(); // render immediately from local

  // Load data in background
  try { await cloudLoadAll(); } catch (e) { console.warn('cloudLoadAll failed:', e); }
  try { cloudSubscribe(); }   catch (e) { console.warn('cloudSubscribe failed:', e); }
});

/* 9) Cloud loaders (resilient) */
function mapSnap(snap) { const arr=[]; snap.forEach(d => arr.push({ id:d.id, ...d.data() })); return arr; }

async function cloudLoadAll() {
  const plan = [
    ['users',    () => db.collection('users').get(),    mapSnap, () => renderUsers()],
    ['products', () => db.collection('products').get(), mapSnap, () => renderProducts()],
    ['posts',    () => db.collection('posts').get(),    mapSnap, () => renderPosts()]
  ];

  const acts = plan.map(async ([key, get, map, on]) => {
    try {
      const snap = await get();
      const rows = map(snap);
      LS.save(key, rows);
      on?.(rows);
    } catch (e) {
      console.warn(`${key} get failed`, e);
    }
  });

  await Promise.allSettled(acts);
}

function cloudSubscribe() {
  const listen = (col, on) => {
    try {
      return db.collection(col).onSnapshot(
        (snap) => { LS.save(col, mapSnap(snap)); on?.(); },
        (err) => {
          console.error(`watch ${col} error:`, err);
          db.collection(col).get().then(s => {
            LS.save(col, mapSnap(s)); on?.();
          }).catch(e => console.error(`${col} get fallback failed:`, e));
        }
      );
    } catch (e) {
      console.error(`${col} subscribe failed:`, e);
      return () => {};
    }
  };

  const unUsers    = listen('users',    () => renderUsers());
  const unProducts = listen('products', () => renderProducts());
  const unPosts    = listen('posts',    () => renderPosts());

  return () => { try{unUsers();}catch{} try{unProducts();}catch{} try{unPosts();}catch{} };
}

/* 10) DOM refs & events */
const root = document.getElementById('root');
const sidebar = document.getElementById('sidebar');
const navToggle = document.getElementById('navToggle');
const logoutBtn = document.getElementById('logoutBtn');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try { await auth.signOut(); } catch (e) { console.error(e); }
  });
}

/* 11) Simple Router */
window.addEventListener('hashchange', () => renderApp());

// (B) Rendering UI (login, dashboard, products, posts, users, settings, pages)
/* ====== RENDERERS ====== */

function renderApp() {
  const hash = location.hash || '#/dashboard';
  const session = getSession();

  // Update sidebar userbox
  const userbox = document.getElementById('userbox');
  if (userbox) {
    if (session) {
      userbox.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="avatar" style="width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;">
            <i class="ri-user-line"></i>
          </div>
          <div>
            <div style="font-weight:700;color:var(--text)">${session.name || session.username}</div>
            <div style="font-size:12px;color:var(--text-dim)">${session.role}</div>
          </div>
        </div>`;
    } else {
      userbox.innerHTML = `<div>Please sign in</div>`;
    }
  }

  if (!session) return renderLogin();

  const route = hash.replace(/^#\//, '');
  if (route.startsWith('page/')) {
    const slug = route.split('/')[1];
    return renderPage(slug);
  }

  switch (route) {
    case 'dashboard': return renderDashboard();
    case 'products':  return renderProducts();
    case 'posts':     return renderPosts();
    case 'users':     return renderUsers();
    case 'settings':  return renderSettings();
    default:          return renderDashboard();
  }
}

/* Login */
function renderLogin() {
  root.innerHTML = `
    <div class="card login-wrap">
      <div class="login-brand">
        <i class="ri-sushi-line"></i>
        <h1 style="margin:0;">Sushi POS</h1>
      </div>
      <p style="color:var(--text-dim)">Sign in with email & password.</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <input id="liEmail" class="input" placeholder="Email" type="email" />
        <input id="liPass"  class="input" placeholder="Password" type="password" />
        <button id="liBtn" class="btn"><i class="ri-login-circle-line"></i> Sign In</button>
      </div>
      <div style="margin-top:10px;color:var(--text-dim);font-size:12px;">
        Tip: first create user in Firebase Auth → Users. Super admins: admin@sushi.com, minmaung0307@gmail.com
      </div>
    </div>
  `;
  document.getElementById('liBtn').onclick = async () => {
    const email = document.getElementById('liEmail').value.trim();
    const pass  = document.getElementById('liPass').value;
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      showToast('Signed in');
    } catch (e) {
      console.error(e); showToast(e.message || 'Sign in failed');
    }
  };
}

/* Dashboard */
function renderDashboard() {
  const products = LS.load('products', []);
  const lowCount = products.filter(p => (p.stock ?? 0) <= (p.low ?? 5)).length;

  root.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 8px 0;">Dashboard</h2>
      <div style="display:grid;grid-template-columns: repeat(auto-fit,minmax(220px,1fr));gap:12px;">
        <div class="card" style="margin:0;">
          <div style="color:var(--text-dim);font-size:12px;">Products</div>
          <div style="font-size:28px;font-weight:800;">${products.length}</div>
        </div>
        <div class="card" style="margin:0;">
          <div style="color:var(--text-dim);font-size:12px;">Low stock items</div>
          <div style="font-size:28px;font-weight:800;color:${lowCount>0?'var(--warn)':'var(--ok)'}">${lowCount}</div>
        </div>
      </div>
    </div>
  `;
}

/* Products */
function renderProducts(rows = LS.load('products', [])) {
  const s = getSession();
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;">Products</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn ghost" onclick="refreshProducts()"><i class="ri-refresh-line"></i> Refresh</button>
          ${(isAdmin(s)||isManager(s)) ? `<button class="btn" onclick="openProductModal()"><i class="ri-add-line"></i> Add</button>` : ''}
        </div>
      </div>
      <div style="overflow:auto;margin-top:10px;">
        <table class="table">
          <thead>
            <tr><th>Name</th><th>Price</th><th>Stock</th><th>Low @</th><th></th></tr>
          </thead>
          <tbody id="prodBody"></tbody>
        </table>
      </div>
    </div>
  `;
  const tbody = document.getElementById('prodBody');
  tbody.innerHTML = rows.map(p => {
    const stock = Number(p.stock ?? 0);
    const low   = Number(p.low ?? 5);
    const cls   = stock <= 0 ? 'low-red' : (stock <= low ? 'low-orange' : '');
    return `
      <tr class="${cls}">
        <td>${p.name || ''}</td>
        <td>$${Number(p.price||0).toFixed(2)}</td>
        <td>${stock}</td>
        <td>${low}</td>
        <td style="text-align:right;">
          ${(isAdmin(s)||isManager(s)) ? `<button class="icon-btn" onclick="editProduct('${p.id}')"><i class="ri-edit-2-line"></i></button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}
window.refreshProducts = async () => {
  try {
    const snap = await db.collection('products').get();
    LS.save('products', mapSnap(snap));
    renderProducts();
  } catch (e) { console.error(e); showToast('Failed to refresh'); }
};
window.openProductModal = async () => {
  const name = prompt('Product name'); if (!name) return;
  const price= Number(prompt('Price', '0')) || 0;
  const stock= Number(prompt('Stock', '0')) || 0;
  const low  = Number(prompt('Low stock threshold', '5')) || 5;
  try {
    const doc = await db.collection('products').add({ name, price, stock, low });
    showToast('Product added');
  } catch (e) { console.error(e); showToast('Add failed'); }
};
window.editProduct = async (id) => {
  const list = LS.load('products', []);
  const item = list.find(x => x.id === id); if (!item) return;
  const name = prompt('Product name', item.name); if (!name) return;
  const price= Number(prompt('Price', item.price)) || 0;
  const stock= Number(prompt('Stock', item.stock)) || 0;
  const low  = Number(prompt('Low stock threshold', item.low)) || 5;
  try {
    await db.collection('products').doc(id).set({ name, price, stock, low }, { merge: true });
    showToast('Product updated');
  } catch (e) { console.error(e); showToast('Update failed'); }
};

/* Posts */
function renderPosts(rows = LS.load('posts', [])) {
  const s = getSession();
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;">Posts</h2>
        <div>
          ${canAddPost() ? `<button class="btn" id="btnAddPost"><i class="ri-add-line"></i> Add Post</button>` : ''}
        </div>
      </div>
      <div style="display:grid;gap:10px;margin-top:10px;">
        ${rows.map(p => `
          <div class="card" style="margin:0;">
            <div style="font-weight:700;">${p.title || 'Untitled'}</div>
            <div style="color:var(--text-dim);font-size:14px;">${p.body || ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  const add = document.getElementById('btnAddPost');
  if (add) add.onclick = onAddPost;
}
async function onAddPost() {
  if (!canAddPost()) { showToast('You do not have permission to add posts.'); return; }
  const title = prompt('Post title'); if (!title) return;
  const body  = prompt('Post body')  || '';
  try {
    await db.collection('posts').add({ title, body, createdAt: Date.now() });
    showToast('Post added');
  } catch (e) { console.error(e); showToast('Failed to add'); }
}

/* Users */
function renderUsers(rows = LS.load('users', [])) {
  const s = getSession();
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;">Users</h2>
        ${(isAdmin(s)||isManager(s)) ? `<button class="btn" onclick="addLocalUser()"><i class="ri-user-add-line"></i> Add</button>` : ''}
      </div>
      <div style="overflow:auto;margin-top:10px;">
        <table class="table"><thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
        </thead><tbody id="userBody"></tbody></table>
      </div>
    </div>
  `;
  const tb = document.getElementById('userBody');
  tb.innerHTML = rows.map(u => `
    <tr>
      <td>${u.name || u.username}</td>
      <td>${u.email || ''}</td>
      <td>${u.role}</td>
      <td style="text-align:right;">
        ${(isAdmin(s)||isManager(s)) ? `<button class="icon-btn" onclick="editLocalUser('${(u.email||'').toLowerCase()}')"><i class="ri-edit-2-line"></i></button>` : ''}
      </td>
    </tr>
  `).join('');
}
window.addLocalUser = () => {
  const list = LS.load('users', []);
  const name = prompt('Name'); if (!name) return;
  const email= prompt('Email'); if (!email) return;
  const role = prompt('Role (admin/manager/staff/user)', 'staff') || 'staff';
  list.push({ name, username: (email.split('@')[0]||name.toLowerCase()), email: email.toLowerCase(), contact:'', role, password:'', img:'' });
  LS.save('users', list);
  renderUsers(list);
  showToast('Local user added (remember to also create in Firebase Auth for login)');
};
window.editLocalUser = (email) => {
  const list = LS.load('users', []);
  const idx = list.findIndex(u => (u.email||'').toLowerCase() === email);
  if (idx < 0) return;
  const u = list[idx];
  const role = prompt('Role (admin/manager/staff/user)', u.role) || u.role;
  list[idx] = { ...u, role };
  LS.save('users', list);
  renderUsers(list);
  showToast('Role updated');
};

/* Settings (Theme & About) */
function renderSettings() {
  const theme = LS.load('theme', DEFAULT_THEME);
  root.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 10px;">Settings</h2>
      <div class="card" style="margin:0 0 10px;">
        <h3 style="margin:0 0 8px;">Theme</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label>Brand color</label>
            <input id="thColor" type="color" class="input" value="${theme.primary || DEFAULT_THEME.primary}">
          </div>
          <div>
            <label>Base font size</label>
            <input id="thFont" type="number" class="input" min="12" max="22" value="${theme.fontSize || DEFAULT_THEME.fontSize}">
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button class="btn" id="thSave"><i class="ri-save-3-line"></i> Save</button>
          <button class="btn ghost" id="thReset"><i class="ri-restart-line"></i> Reset</button>
        </div>
      </div>

      <div class="card" style="margin:0;">
        <h3 style="margin:0 0 8px;">Pages</h3>
        <div class="chip-links" style="display:flex;gap:8px;flex-wrap:wrap;">
          <a class="btn ghost" href="#/page/policy">Policy</a>
          <a class="btn ghost" href="#/page/license">License</a>
          <a class="btn ghost" href="#/page/setup">Setup Guide</a>
          <a class="btn ghost" href="#/page/contact">Contact</a>
        </div>
      </div>
    </div>
  `;
  document.getElementById('thSave').onclick = () => {
    const primary = document.getElementById('thColor').value || DEFAULT_THEME.primary;
    const fontSize = Number(document.getElementById('thFont').value) || DEFAULT_THEME.fontSize;
    LS.save('theme', { primary, fontSize });
    applyTheme();
    showToast('Theme saved');
  };
  document.getElementById('thReset').onclick = () => {
    LS.save('theme', DEFAULT_THEME);
    applyTheme(); renderSettings();
    showToast('Theme reset');
  };
}

/* Static Pages (with Back to Home) */
function renderPage(slug) {
  const pages = {
    policy: `
      <h2>Policy</h2>
      <p>Our POS stores essential business data. Keep your login safe. Data access is role-based.</p>
      <ul>
        <li>Admins and Managers manage inventory and posts.</li>
        <li>Staff handle daily operations.</li>
        <li>Users have limited access.</li>
      </ul>
    `,
    license: `
      <h2>License</h2>
      <p>Sushi POS is provided "as is", for your restaurant use. You may extend features for your venue.</p>
    `,
    setup: `
      <h2>Setup Guide</h2>
      <ol>
        <li>Create Firebase project and enable Email/Password auth.</li>
        <li>Add your web app config to <code>app.js</code>.</li>
        <li>In Auth → Users, create accounts (admin@sushi.com etc.).</li>
        <li>Sign in once; roles are mapped locally or via Firestore "users" collection.</li>
      </ol>
    `,
    contact: `
      <h2>Contact</h2>
      <p>Email: support@sushipos.example</p>
      <p>Follow us on social: links in the header.</p>
    `
  };
  const html = pages[slug] || `<h2>Not found</h2>`;
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div></div>
        <a class="btn ghost" href="#/dashboard"><i class="ri-arrow-left-line"></i> Back to Home</a>
      </div>
      <div class="card" style="margin:0;">${html}</div>
    </div>
  `;
}

// (C) Guards for clicks + initial route
/* ========== FINAL HOOKS / SAFE CLICKS ========== */

/* Prevent sidebar clicks from changing when closed on mobile */
document.addEventListener('click', (e) => {
  // Close sidebar if open and clicked outside on mobile overlay feel
  if (e.target === sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
  }
});

/* Initial route render */
applyTheme();
renderApp();

