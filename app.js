// PART 1 — app.js (Init, utils, auth, theme presets, modal helpers)
/* ========= Sushi POS — app.js ========= */

/* 1) Firebase config */
const firebaseConfig = {
  // TODO: replace with your Firebase config
  apiKey: "AIzaSyBY52zMMQqsvssukui3TfQnMigWoOzeKGk",
  authDomain: "sushi-pos.firebaseapp.com",
  projectId: "sushi-pos",
};

/* 2) Init Firebase */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* Firestore transport fix (stops WebChannel 400/Write 400 loops) */
try {
  db.settings({ experimentalForceLongPolling: true, useFetchStreams: false });
} catch (e) { console.warn('Firestore settings warning:', e); }

/* 3) Local Storage helpers */
const LS = {
  load(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

/* 4) Roles / Defaults */
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];
const THEME_PRESETS = [
  { name:'Teal (Default)', primary:'#0ea5a5', fontSize:16 },
  { name:'Blueberry',      primary:'#3b82f6', fontSize:16 },
  { name:'Grape',          primary:'#8b5cf6', fontSize:16 },
  { name:'Sunset',         primary:'#f97316', fontSize:16 },
  { name:'Mint',           primary:'#10b981', fontSize:16 },
  { name:'Rose',           primary:'#f43f5e', fontSize:16 },
  { name:'Compact Teal',   primary:'#0ea5a5', fontSize:14 },
  { name:'Large Teal',     primary:'#0ea5a5', fontSize:18 },
];
const DEFAULT_THEME = THEME_PRESETS[0];

const DEFAULT_DATA = {
  users: [
    { name:'Admin',   username:'admin',   email:'admin@sushi.com',        role:'admin',   contact:'', password:'', img:'' },
    { name:'Manager', username:'manager', email:'minmaung0307@gmail.com', role:'manager', contact:'', password:'', img:'' }
  ],
  products: [
    { id:'p1', name:'Salmon Nigiri', price:3.5, stock:12, low:5 },
    { id:'p2', name:'Tuna Roll',     price:6.0, stock:5,  low:5 },
    { id:'p3', name:'Avocado Roll',  price:4.0, stock:1,  low:3 },
  ],
  inventory: [
    { id:'i1', name:'Salmon (kg)',  qty:3,  low:2 },
    { id:'i2', name:'Nori (packs)', qty:12, low:6 },
    { id:'i3', name:'Rice (kg)',    qty:8,  low:5 },
  ],
  posts: [
    { id:'post1', title:'Welcome to Sushi POS', body:'Run the floor with ease. Track stock, tasks and costs.' }
  ],
  tasks: [
    { id:'t1', title:'Prep rice',  done:false },
    { id:'t2', title:'Check salmon freshness', done:false }
  ],
  cogs: [
    { id:'c1', item:'Salmon (kg)', qty:1, unit:25 },
    { id:'c2', item:'Nori (pack)', qty:2, unit:2.5 }
  ]
};

/* 5) Boot defaults (only once) */
(function seedLocal() {
  for (const k of Object.keys(DEFAULT_DATA)) {
    if (LS.load(k, null) == null) LS.save(k, DEFAULT_DATA[k]);
  }
})();

/* 6) Theme */
function applyTheme() {
  const theme = LS.load('theme', DEFAULT_THEME);
  document.documentElement.style.setProperty('--primary', theme.primary || DEFAULT_THEME.primary);
  document.documentElement.style.setProperty('--primary-600', shade(theme.primary || DEFAULT_THEME.primary, -10));
  document.documentElement.style.setProperty('--fs', `${theme.fontSize || DEFAULT_THEME.fontSize}px`);
}
function shade(hex, percent=-10) {
  const p = Math.max(-100, Math.min(100, percent)) / 100;
  const n = parseInt(hex.replace('#',''), 16);
  let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  r = Math.round(r + (p<0?r*p:(255-r)*p));
  g = Math.round(g + (p<0?g*p:(255-g)*p));
  b = Math.round(b + (p<0?b*p:(255-b)*p));
  return `#${(1<<24|r<<16|g<<8|b).toString(16).slice(1)}`;
}

/* 7) Session + role helpers */
function getSession(){ return LS.load('session', null); }
function isAdmin(s=getSession())   { return s?.role === 'admin'; }
function isManager(s=getSession()) { return s?.role === 'manager'; }
function isStaff(s=getSession())   { return s?.role === 'staff'; }
function canManage(s=getSession()) { return isAdmin(s) || isManager(s); }
function canAddPost(){ return canManage(); }

/* 8) Toast */
function showToast(msg) {
  const el = document.getElementById('notification');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 1800);
}

/* 9) Modal helpers */
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalFoot = document.getElementById('modalFoot');
document.getElementById('modalClose').onclick = closeModal;
modal.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) closeModal();
});
function openModal({ title, bodyHTML, footerHTML }) {
  modalTitle.textContent = title || '';
  modalBody.innerHTML = bodyHTML || '';
  modalFoot.innerHTML = footerHTML || '';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
}
function closeModal() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
}

/* 10) Auth (fast render, background cloud) */
auth.onAuthStateChanged(async (user) => {
  applyTheme();
  if (!user) {
    LS.save('session', null);
    return renderLogin();
  }
  const email = (user.email || '').toLowerCase();
  const users = LS.load('users', []);
  let prof = users.find(u => (u.email||'').toLowerCase() === email);
  if (!prof) {
    const role = SUPER_ADMINS.includes(email) ? 'admin' : 'user';
    prof = { name: role==='admin'?'Admin':(user.displayName||'User'), username:(email.split('@')[0]||'user'), email, role, contact:'', password:'', img:'' };
    users.push(prof); LS.save('users', users);
  } else if (SUPER_ADMINS.includes(email) && prof.role !== 'admin') {
    prof.role = 'admin'; LS.save('users', users);
  }
  LS.save('session', { ...prof });
  renderApp(); // instant

  // background sync (safe + resilient)
  try { await cloudLoadAll(); } catch (e) { console.warn('cloudLoadAll failed', e); }
  try { cloudSubscribe(); } catch (e) { console.warn('cloudSubscribe failed', e); }
});

/* 11) Cloud (optional; app works offline/local too) */
function mapSnap(snap){ const arr=[]; snap.forEach(d=>arr.push({id:d.id, ...d.data()})); return arr; }
async function cloudLoadAll() {
  const plan = [
    ['users',    () => db.collection('users').get(),    () => renderSettings()],
    ['products', () => db.collection('products').get(), () => renderProducts()],
    ['inventory',() => db.collection('inventory').get(),() => renderInventory()],
    ['posts',    () => db.collection('posts').get(),    () => renderDashboard()],
    ['tasks',    () => db.collection('tasks').get(),    () => renderTasks()],
    ['cogs',     () => db.collection('cogs').get(),     () => renderCOGS()]
  ];
  await Promise.allSettled(plan.map(async ([key, call, on])=>{
    try { const s=await call(); LS.save(key, mapSnap(s)); on?.(); } catch(e){ console.warn(key,'get failed',e); }
  }));
}
function cloudSubscribe() {
  const listen = (col, on) => {
    try {
      return db.collection(col).onSnapshot(
        s => { LS.save(col, mapSnap(s)); on?.(); },
        async e => { console.warn('watch',col,'error',e); try{const g=await db.collection(col).get(); LS.save(col, mapSnap(g)); on?.();}catch{} }
      );
    } catch (e) { console.warn(col,'subscribe failed',e); return ()=>{}; }
  };
  const u = listen('users', renderSettings);
  const p = listen('products', renderProducts);
  const i = listen('inventory', renderInventory);
  const t = listen('tasks', renderTasks);
  const c = listen('cogs', renderCOGS);
  const ps= listen('posts', renderDashboard);
  return ()=>{try{u()}catch{}try{p()}catch{}try{i()}catch{}try{t()}catch{}try{c()}catch{}try{ps()}catch{}};
}

/* 12) DOM refs & router */
const root = document.getElementById('root');
const sidebar = document.getElementById('sidebar');
const navToggle = document.getElementById('navToggle');
const logoutBtn = document.getElementById('logoutBtn');
if (navToggle) navToggle.addEventListener('click', ()=> sidebar.classList.toggle('open'));
if (logoutBtn) logoutBtn.addEventListener('click', async ()=> { try{ await auth.signOut(); }catch(e){ console.error(e); } });
window.addEventListener('hashchange', renderApp);

// PART 2 — app.js (UI renderers: login, dashboard+posts, inventory, products with +/− & warnings, tasks, COGS, settings with users + theme presets, static pages, modals)
/* ===== RENDERERS ===== */

function renderApp() {
  const hash = location.hash || '#/dashboard';
  const session = getSession();

  // Sidebar user info
  const userbox = document.getElementById('userbox');
  if (userbox) {
    if (session) {
      userbox.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;">
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

  const route = hash.replace(/^#\//,'');
  if (route.startsWith('page/')) return renderPage(route.split('/')[1]);

  switch (route) {
    case 'dashboard': return renderDashboard();
    case 'inventory': return renderInventory();
    case 'products':  return renderProducts();
    case 'cogs':      return renderCOGS();
    case 'tasks':     return renderTasks();
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
        Tip: create accounts in Firebase Auth. Super admins: admin@sushi.com, minmaung0307@gmail.com
      </div>
    </div>
  `;
  document.getElementById('liBtn').onclick = async () => {
    const email = document.getElementById('liEmail').value.trim();
    const pass  = document.getElementById('liPass').value;
    try { await auth.signInWithEmailAndPassword(email, pass); showToast('Signed in'); }
    catch (e) { console.error(e); showToast(e.message || 'Sign in failed'); }
  };
}

/* Dashboard (includes Posts) */
function renderDashboard() {
  const products = LS.load('products', []);
  const posts = LS.load('posts', []);
  const lowCount = products.filter(p => (p.stock??0) <= (p.low??5)).length;

  root.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 8px;">Dashboard</h2>
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

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;">Posts</h3>
        ${canAddPost() ? `<button class="btn" id="btnAddPost"><i class="ri-add-line"></i> Add Post</button>` : ''}
      </div>
      <div style="display:grid;gap:10px;margin-top:10px;">
        ${posts.map(p => `
          <div class="card" style="margin:0;">
            <div style="font-weight:700;">${p.title || 'Untitled'}</div>
            <div style="color:var(--text-dim);font-size:14px;">${p.body || ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  const add = document.getElementById('btnAddPost');
  if (add) add.onclick = () => openPostModal();
}

/* Inventory */
function renderInventory(rows = LS.load('inventory', [])) {
  const s = getSession();
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;">Inventory</h2>
        ${canManage(s) ? `<button class="btn" onclick="openInventoryModal()"><i class="ri-add-line"></i> Add Item</button>` : ''}
      </div>
      <div style="overflow:auto;margin-top:10px;">
        <table class="table">
          <thead><tr><th>Name</th><th>Qty</th><th>Low @</th><th>Adjust</th><th></th></tr></thead>
          <tbody id="invBody"></tbody>
        </table>
      </div>
    </div>
  `;
  const tb = document.getElementById('invBody');
  tb.innerHTML = rows.map(r => {
    const cls = (r.qty??0) <= 0 ? 'low-red' : ((r.qty??0) <= (r.low??1) ? 'low-orange' : '');
    return `
      <tr class="${cls}">
        <td>${r.name}</td>
        <td>${r.qty??0}</td>
        <td>${r.low??1}</td>
        <td>
          <button class="icon-btn" onclick="adjustInventory('${r.id}','dec')"><i class="ri-subtract-line"></i></button>
          <button class="icon-btn" onclick="adjustInventory('${r.id}','inc')"><i class="ri-add-line"></i></button>
        </td>
        <td style="text-align:right;">
          ${canManage(s) ? `<button class="icon-btn" onclick="openInventoryModal('${r.id}')"><i class="ri-edit-2-line"></i></button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}
window.adjustInventory = async (id, dir) => {
  const list = LS.load('inventory', []);
  const idx = list.findIndex(x=>x.id===id); if (idx<0) return;
  let qty = Number(list[idx].qty||0);
  qty = dir==='inc' ? qty+1 : Math.max(0, qty-1);
  list[idx].qty = qty;
  LS.save('inventory', list);
  renderInventory(list);
  try { await db.collection('inventory').doc(id).set({ qty }, { merge:true }); } catch {}
};
window.openInventoryModal = (id=null) => {
  const list = LS.load('inventory', []);
  const item = id ? list.find(x=>x.id===id) : { name:'', qty:0, low:1 };
  openModal({
    title: id ? 'Edit Inventory' : 'Add Inventory',
    bodyHTML: `
      <label>Name</label><input id="miName" class="input" value="${item.name||''}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label>Qty</label><input id="miQty" class="input" type="number" value="${item.qty??0}"></div>
        <div><label>Low @</label><input id="miLow" class="input" type="number" value="${item.low??1}"></div>
      </div>
    `,
    footerHTML: `
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="saveInventory('${id||''}')">Save</button>
    `
  });
};
window.saveInventory = async (id) => {
  const name = document.getElementById('miName').value.trim();
  const qty  = Number(document.getElementById('miQty').value)||0;
  const low  = Number(document.getElementById('miLow').value)||1;
  if (!name) return showToast('Name is required');
  const list = LS.load('inventory', []);
  if (id) {
    const idx = list.findIndex(x=>x.id===id); if (idx<0) return;
    list[idx] = { ...list[idx], name, qty, low };
    try { await db.collection('inventory').doc(id).set({ name, qty, low }, { merge:true }); } catch {}
  } else {
    const doc = db.collection('inventory').doc();
    const rec = { id:doc.id, name, qty, low };
    list.push(rec);
    try { await doc.set(rec); } catch {}
  }
  LS.save('inventory', list);
  closeModal();
  renderInventory(list);
  showToast('Saved');
};

/* Products (with + / − & low-stock rows) */
function renderProducts(rows = LS.load('products', [])) {
  const s = getSession();
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;">Products</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn ghost" onclick="refreshProducts()"><i class="ri-refresh-line"></i> Refresh</button>
          ${canManage(s) ? `<button class="btn" onclick="openProductModal()"><i class="ri-add-line"></i> Add</button>` : ''}
        </div>
      </div>
      <div style="overflow:auto;margin-top:10px;">
        <table class="table">
          <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Low @</th><th>Adjust</th><th></th></tr></thead>
          <tbody id="prodBody"></tbody>
        </table>
      </div>
    </div>
  `;
  const tb = document.getElementById('prodBody');
  tb.innerHTML = rows.map(p=>{
    const stock = Number(p.stock??0);
    const low   = Number(p.low??5);
    const cls = stock<=0 ? 'low-red' : (stock<=low ? 'low-orange' : '');
    return `
      <tr class="${cls}">
        <td>${p.name||''}</td>
        <td>$${Number(p.price||0).toFixed(2)}</td>
        <td>${stock}</td>
        <td>${low}</td>
        <td>
          <button class="icon-btn" onclick="adjustProduct('${p.id}','dec')"><i class="ri-subtract-line"></i></button>
          <button class="icon-btn" onclick="adjustProduct('${p.id}','inc')"><i class="ri-add-line"></i></button>
        </td>
        <td style="text-align:right;">
          ${canManage() ? `<button class="icon-btn" onclick="openProductModal('${p.id}')"><i class="ri-edit-2-line"></i></button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}
window.refreshProducts = async ()=>{
  try { const s=await db.collection('products').get(); LS.save('products', mapSnap(s)); renderProducts(); }
  catch(e){ console.error(e); showToast('Refresh failed'); }
};
window.adjustProduct = async (id, dir) => {
  const list = LS.load('products', []);
  const idx = list.findIndex(x=>x.id===id); if (idx<0) return;
  let stock = Number(list[idx].stock||0);
  stock = dir==='inc' ? stock+1 : Math.max(0, stock-1);
  list[idx].stock = stock;
  LS.save('products', list);
  renderProducts(list);
  try { await db.collection('products').doc(id).set({ stock }, { merge:true }); } catch {}
};
window.openProductModal = (id=null)=>{
  const list = LS.load('products', []);
  const item = id ? list.find(x=>x.id===id) : { name:'', price:0, stock:0, low:5 };
  openModal({
    title: id ? 'Edit Product' : 'Add Product',
    bodyHTML: `
      <label>Name</label><input id="mpName" class="input" value="${item.name||''}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label>Price</label><input id="mpPrice" class="input" type="number" step="0.01" value="${item.price??0}"></div>
        <div><label>Low @</label><input id="mpLow" class="input" type="number" value="${item.low??5}"></div>
      </div>
      <div><label>Stock</label><input id="mpStock" class="input" type="number" value="${item.stock??0}"></div>
    `,
    footerHTML: `
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="saveProduct('${id||''}')">Save</button>
    `
  });
};
window.saveProduct = async (id)=>{
  const name  = document.getElementById('mpName').value.trim();
  const price = Number(document.getElementById('mpPrice').value)||0;
  const low   = Number(document.getElementById('mpLow').value)||5;
  const stock = Number(document.getElementById('mpStock').value)||0;
  if (!name) return showToast('Name is required');
  const list = LS.load('products', []);
  if (id) {
    const idx = list.findIndex(x=>x.id===id); if (idx<0) return;
    list[idx] = { ...list[idx], name, price, low, stock };
    try { await db.collection('products').doc(id).set({ name, price, low, stock }, { merge:true }); } catch {}
  } else {
    const doc = db.collection('products').doc();
    const rec = { id:doc.id, name, price, low, stock };
    list.push(rec);
    try { await doc.set(rec); } catch {}
  }
  LS.save('products', list);
  closeModal(); renderProducts(list); showToast('Saved');
};

/* Tasks */
function renderTasks(rows = LS.load('tasks', [])) {
  const s = getSession();
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;">Tasks</h2>
        ${canManage(s) ? `<button class="btn" onclick="openTaskModal()"><i class="ri-add-line"></i> Add Task</button>` : ''}
      </div>
      <div class="card" style="margin-top:10px;">
        <div style="display:grid;gap:8px;" id="taskList"></div>
      </div>
    </div>
  `;
  const list = document.getElementById('taskList');
  list.innerHTML = rows.map(t => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:12px;">
      <label style="display:flex;gap:8px;align-items:center;">
        <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask('${t.id}', this.checked)">
        <span>${t.title}</span>
      </label>
      ${canManage() ? `<button class="icon-btn" onclick="openTaskModal('${t.id}')"><i class="ri-edit-2-line"></i></button>` : ''}
    </div>
  `).join('');
}
window.toggleTask = async (id, done) => {
  const list = LS.load('tasks', []);
  const idx = list.findIndex(x=>x.id===id); if (idx<0) return;
  list[idx].done = !!done; LS.save('tasks', list); renderTasks(list);
  try { await db.collection('tasks').doc(id).set({ done: !!done }, { merge:true }); } catch {}
};
window.openTaskModal = (id=null) => {
  const list = LS.load('tasks', []);
  const item = id ? list.find(x=>x.id===id) : { title:'' };
  openModal({
    title: id ? 'Edit Task' : 'Add Task',
    bodyHTML: `<label>Title</label><input id="mtTitle" class="input" value="${item.title||''}">`,
    footerHTML: `
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="saveTask('${id||''}')">Save</button>
    `
  });
};
window.saveTask = async (id)=>{
  const title = document.getElementById('mtTitle').value.trim();
  if (!title) return showToast('Title is required');
  const list = LS.load('tasks', []);
  if (id) {
    const idx = list.findIndex(x=>x.id===id); if (idx<0) return;
    list[idx] = { ...list[idx], title };
    try { await db.collection('tasks').doc(id).set({ title }, { merge:true }); } catch {}
  } else {
    const doc = db.collection('tasks').doc();
    const rec = { id:doc.id, title, done:false };
    list.push(rec);
    try { await doc.set(rec); } catch {}
  }
  LS.save('tasks', list);
  closeModal(); renderTasks(list); showToast('Saved');
};

/* COGS */
function renderCOGS(rows = LS.load('cogs', [])) {
  const total = rows.reduce((sum,r)=> sum + (Number(r.qty||0)*Number(r.unit||0)), 0);
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;">COGS</h2>
        ${canManage() ? `<button class="btn" onclick="openCOGSModal()"><i class="ri-add-line"></i> Add Entry</button>` : ''}
      </div>
      <div style="overflow:auto;margin-top:10px;">
        <table class="table">
          <thead><tr><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.item}</td>
                <td>${r.qty}</td>
                <td>$${Number(r.unit).toFixed(2)}</td>
                <td>$${(Number(r.qty)*Number(r.unit)).toFixed(2)}</td>
                <td style="text-align:right;">${canManage()?`<button class="icon-btn" onclick="openCOGSModal('${r.id}')"><i class="ri-edit-2-line"></i></button>`:''}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr><th colspan="3" style="text-align:right;">Total</th><th>$${total.toFixed(2)}</th><th></th></tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}
window.openCOGSModal = (id=null) => {
  const list = LS.load('cogs', []);
  const item = id ? list.find(x=>x.id===id) : { item:'', qty:1, unit:0 };
  openModal({
    title: id ? 'Edit COGS' : 'Add COGS',
    bodyHTML: `
      <label>Item</label><input id="cgItem" class="input" value="${item.item||''}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label>Qty</label><input id="cgQty" class="input" type="number" value="${item.qty??1}"></div>
        <div><label>Unit Cost</label><input id="cgUnit" class="input" type="number" step="0.01" value="${item.unit??0}"></div>
      </div>
    `,
    footerHTML: `
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="saveCOGS('${id||''}')">Save</button>
    `
  });
};
window.saveCOGS = async (id)=>{
  const item = document.getElementById('cgItem').value.trim();
  const qty  = Number(document.getElementById('cgQty').value)||0;
  const unit = Number(document.getElementById('cgUnit').value)||0;
  if (!item) return showToast('Item is required');
  const list = LS.load('cogs', []);
  if (id) {
    const idx = list.findIndex(x=>x.id===id); if (idx<0) return;
    list[idx] = { ...list[idx], item, qty, unit };
    try { await db.collection('cogs').doc(id).set({ item, qty, unit }, { merge:true }); } catch {}
  } else {
    const doc = db.collection('cogs').doc();
    const rec = { id:doc.id, item, qty, unit };
    list.push(rec);
    try { await doc.set(rec); } catch {}
  }
  LS.save('cogs', list);
  closeModal(); renderCOGS(list); showToast('Saved');
};

/* Settings (Users + Theme presets) */
function renderSettings() {
  const theme = LS.load('theme', DEFAULT_THEME);
  const users = LS.load('users', []);
  const s = getSession();

  root.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 10px;">Settings</h2>

      <div class="card" style="margin:0 0 10px;">
        <h3 style="margin:0 0 8px;">Theme Presets</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
          ${THEME_PRESETS.map((t,i)=>`
            <label style="border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;display:flex;gap:10px;align-items:center;">
              <input type="radio" name="themePick" value="${i}" ${ (t.primary===theme.primary && t.fontSize===theme.fontSize) ? 'checked' : '' }>
              <span style="display:inline-flex;align-items:center;gap:8px;">
                <span style="width:18px;height:18px;border-radius:6px;background:${t.primary};display:inline-block;"></span>
                ${t.name} (${t.fontSize}px)
              </span>
            </label>
          `).join('')}
        </div>
        <div style="margin-top:10px;">
          <button class="btn" id="thApply"><i class="ri-paint-fill"></i> Apply</button>
        </div>
      </div>

      <div class="card" style="margin:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;">Users</h3>
          ${canManage(s) ? `<button class="btn" onclick="openUserModal()"><i class="ri-user-add-line"></i> Add User</button>` : ''}
        </div>
        <div style="overflow:auto;margin-top:10px;">
          <table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
            <tbody>
              ${users.map(u=>`
                <tr>
                  <td>${u.name || u.username}</td>
                  <td>${u.email || ''}</td>
                  <td>${u.role}</td>
                  <td style="text-align:right;">
                    ${canManage()?`<button class="icon-btn" onclick="openUserModal('${(u.email||'').toLowerCase()}')"><i class="ri-edit-2-line"></i></button>`:''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('thApply').onclick = () => {
    const pick = [...document.querySelectorAll('input[name=themePick]')].find(r=>r.checked);
    const idx = Number(pick?.value || 0);
    const t = THEME_PRESETS[idx] || DEFAULT_THEME;
    LS.save('theme', t); applyTheme(); showToast('Theme applied');
  };
}
window.openUserModal = (email='')=>{
  const list = LS.load('users', []);
  const item = email ? list.find(u=>(u.email||'').toLowerCase()===email) : { name:'', email:'', role:'staff' };
  openModal({
    title: email ? 'Edit User' : 'Add User',
    bodyHTML: `
      <label>Name</label><input id="usName" class="input" value="${item.name||''}">
      <label>Email</label><input id="usEmail" class="input" value="${item.email||''}">
      <label>Role</label>
      <select id="usRole" class="input">
        ${['admin','manager','staff','user'].map(r=>`<option ${item.role===r?'selected':''}>${r}</option>`).join('')}
      </select>
      <div style="color:var(--text-dim);font-size:12px;">(Remember to also create credentials in Firebase Auth for login.)</div>
    `,
    footerHTML: `
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="saveUser('${email}')">Save</button>
    `
  });
};
window.saveUser = async (emailOld)=>{
  const name  = document.getElementById('usName').value.trim();
  const email = document.getElementById('usEmail').value.trim().toLowerCase();
  const role  = document.getElementById('usRole').value;
  if (!name || !email) return showToast('Name & email required');
  const list = LS.load('users', []);
  if (emailOld) {
    const idx = list.findIndex(u=>(u.email||'').toLowerCase()===emailOld); if (idx<0) return;
    list[idx] = { ...list[idx], name, email, role };
    try {
      const q = await db.collection('users').where('email','==',emailOld).get();
      if (!q.empty) await db.collection('users').doc(q.docs[0].id).set({ name, email, role }, { merge:true });
    } catch {}
  } else {
    list.push({ name, username:(email.split('@')[0]||name.toLowerCase()), email, contact:'', role, password:'', img:'' });
    try { await db.collection('users').add({ name, email, role }); } catch {}
  }
  LS.save('users', list);
  closeModal(); renderSettings(); showToast('Saved');
};

/* Posts modal (Dashboard) */
function openPostModal(id=null){
  const list = LS.load('posts', []);
  const item = id ? list.find(x=>x.id===id) : { title:'', body:'' };
  openModal({
    title: id ? 'Edit Post' : 'Add Post',
    bodyHTML: `
      <label>Title</label><input id="poTitle" class="input" value="${item.title||''}">
      <label>Body</label><textarea id="poBody" class="input" rows="5">${item.body||''}</textarea>
    `,
    footerHTML: `
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="savePost('${id||''}')">Save</button>
    `
  });
}
async function savePost(id){
  if (!canAddPost()) return showToast('No permission to add posts.');
  const title = document.getElementById('poTitle').value.trim();
  const body  = document.getElementById('poBody').value.trim();
  if (!title) return showToast('Title is required');
  const list = LS.load('posts', []);
  if (id) {
    const idx = list.findIndex(x=>x.id===id); if (idx<0) return;
    list[idx] = { ...list[idx], title, body };
    try { await db.collection('posts').doc(id).set({ title, body }, { merge:true }); } catch {}
  } else {
    const doc = db.collection('posts').doc();
    const rec = { id:doc.id, title, body, createdAt: Date.now() };
    list.push(rec);
    try { await doc.set(rec); } catch {}
  }
  LS.save('posts', list);
  closeModal(); renderDashboard(); showToast('Saved');
}

/* Static Pages (with Back to Home) */
function renderPage(slug) {
  const pages = {
    policy: `<h2>Policy</h2><p>Data access is role-based. Keep your login safe.</p>`,
    license:`<h2>License</h2><p>Provided “as is”. Customize for your venue.</p>`,
    setup:  `<h2>Setup Guide</h2><ol><li>Create Firebase project + enable Email/Password.</li><li>Paste web config in <code>app.js</code>.</li><li>Create users in Auth.</li><li>Assign roles in Settings.</li></ol>`,
    contact:`<h2>Contact</h2><p>Email: support@sushipos.example</p>`
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

/* Safety: click outside modal-close & mobile sidebar overlay feel */
document.addEventListener('click', (e) => {
  if (e.target === sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
  }
});

/* Boot */
applyTheme();
renderApp();