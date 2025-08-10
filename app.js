/* =========================
   Sushi POS - App (Auth-only + LocalStorage data)
   ========================= */

/* ---------- Firebase Auth (ONLY) ---------- */
const firebaseConfig = {
  // TODO: replace with your Firebase config (keys here are examples)
  apiKey: "AIzaSyBY52zMMQqsvssukui3TfQnMigWoOzeKGk",
  authDomain: "sushi-pos.firebaseapp.com",
  projectId: "sushi-pos",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

/* ---------- Prefill data (LOCAL ONLY) ---------- */
/** Run once per browser to seed demo data */
(function prefillOnce() {
  const FLAG = 'prefill_v2_done';
  if (localStorage.getItem(FLAG)) return;

  const now = Date.now();

  const users = [
    { name: "Admin",   username: "admin",  email: "admin@sushi.com",        contact: "", role: "admin",   img: "" },
    { name: "Manager", username: "manager",email: "minmaung0307@gmail.com",  contact: "", role: "manager", img: "" },
    { name: "Cashier", username: "user",   email: "user@sushi.com",         contact: "", role: "user",    img: "" },
  ];

  const inventory = [
    { img: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=60", name: "Sushi Rice (10kg)", code: "ING-001", price: 22.5, stock: 8,  threshold: 10 },
    { img: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=60", name: "Nori Sheets (100)", code: "ING-002", price: 15.0, stock: 15, threshold: 12 },
    { img: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&q=60", name: "Salmon (kg)",        code: "ING-003", price: 19.8, stock: 3,  threshold: 6 },
    { img: "https://images.unsplash.com/photo-1617191519400-60b19fdc97df?w=400&q=60", name: "Avocado (box)", code: "ING-004", price: 12.3, stock: 5,  threshold: 5 },
  ];

  const products = [
    { img: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=60", name: "California Roll", barcode: "PRD-1001", price: 7.5, type: "Roll", ingredients: "Rice,Nori,Surimi,Avocado,Cucumber", instructions: "Slice 8 pcs" },
    { img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=60",   name: "Spicy Tuna Roll", barcode: "PRD-1002", price: 8.5, type: "Roll", ingredients: "Rice,Nori,Tuna,Chili Mayo", instructions: "Slice 8 pcs" },
    { img: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=600&q=60",   name: "Salmon Nigiri",   barcode: "PRD-1003", price: 5.5, type: "Nigiri", ingredients: "Rice,Salmon", instructions: "2 pcs / order" },
  ];

  const posts = [
    { id: `p-${now-40000}`, title: "Welcome to Sushi POS", body: "This is your dashboard. You can add posts (admin/manager).", img: "", createdAt: now-40000, author: "Admin" },
    { id: `p-${now-20000}`, title: "Daily Task", body: "Check low inventory and schedule prep.", img: "", createdAt: now-20000, author: "Manager" },
  ];

  const tasks = [
    { id: `t-${now-1}`, title: "Order salmon",   status: "todo" },
    { id: `t-${now-2}`, title: "Prep rice",      status: "progress" },
    { id: `t-${now-3}`, title: "Clean station",  status: "done" },
  ];

  const cogs = [
    { grossIncome: 450.00, produceCost: 80.00, itemCost: 120.00, freight: 20.00, delivery: 10.00, other: 5.00,  grossProfit: 215.00 },
    { grossIncome: 380.00, produceCost: 70.00, itemCost: 100.00, freight: 18.00, delivery:  8.00, other: 4.50, grossProfit: 179.50 },
  ];

  const settings = {
    theme: { preset: "teal-dark", fontScale: "100" },
  };

  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('inventory', JSON.stringify(inventory));
  localStorage.setItem('products', JSON.stringify(products));
  localStorage.setItem('posts', JSON.stringify(posts));
  localStorage.setItem('tasks', JSON.stringify(tasks));
  localStorage.setItem('cogs', JSON.stringify(cogs));
  localStorage.setItem('settings', JSON.stringify(settings));
  localStorage.setItem(FLAG, '1');
})();

/* ---------- Utilities ---------- */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
const money = (n) => `$${Number(n||0).toFixed(2)}`;
const uid = () => Math.random().toString(36).slice(2);

function toast(msg, ms=1800) {
  const n = $('#notification');
  if (!n) return;
  n.textContent = msg;
  n.style.display = 'block';
  setTimeout(()=> n.style.display = 'none', ms);
}

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return (v==null?fallback:v); }
  catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* ---------- Role + Session ---------- */
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];

let session = load('session', null);

/* ---------- Theme ---------- */
const THEME_PRESETS = {
  'teal-dark': { primary:'#0ea5a5', primary2:'#0891b2', accent:'#22c55e', bg:'#0a0f14', elev:'#0f1720' },
  'purple-dark': { primary:'#8b5cf6', primary2:'#7c3aed', accent:'#22c55e', bg:'#0b0a12', elev:'#151225' },
  'rose-dark': { primary:'#fb7185', primary2:'#f43f5e', accent:'#22c55e', bg:'#120a0b', elev:'#1d1214' },
  'sky-dark': { primary:'#38bdf8', primary2:'#0ea5e9', accent:'#22c55e', bg:'#061017', elev:'#0b1821' },
};

function applyTheme() {
  const s = load('settings', { theme:{preset:'teal-dark', fontScale:'100'} });
  const p = THEME_PRESETS[s.theme?.preset] || THEME_PRESETS['teal-dark'];
  document.documentElement.style.setProperty('--primary', p.primary);
  document.documentElement.style.setProperty('--primary-2', p.primary2);
  document.documentElement.style.setProperty('--accent', p.accent);
  document.documentElement.style.setProperty('--bg', p.bg);
  document.documentElement.style.setProperty('--bg-elev', p.elev);
  document.documentElement.style.fontSize = `${Number(s.theme?.fontScale||100)}%`;
}

/* ---------- Auth ---------- */
auth.onAuthStateChanged(async (user) => {
  applyTheme();
  if (user) {
    // Create/upgrade local role based on SUPER_ADMINS
    const users = load('users', []);
    const email = (user.email || '').toLowerCase();
    let prof = users.find(u => (u.email || '').toLowerCase() === email);

    if (!prof) {
      const role = SUPER_ADMINS.includes(email) ? 'admin' : 'user';
      prof = { name: role==='admin' ? 'Admin' : 'User', username: email.split('@')[0] || 'user', email, contact:'', role, img:'' };
      users.push(prof); save('users', users);
    } else if (SUPER_ADMINS.includes(email) && prof.role !== 'admin') {
      prof.role = 'admin'; save('users', users);
    }

    session = { ...prof };
    save('session', session);
    renderApp();
  } else {
    session = load('session', null);
    if (session) renderApp(); else renderLogin();
  }
});

/* ---------- Login / Logout ---------- */
function renderLogin() {
  const root = $('#root'); if (!root) return;
  root.innerHTML = `
    <div class="login">
      <div class="login-box">
        <div class="login-head">
          <img src="icons/icon-192.png" alt="Sushi POS" />
          <div>
            <div style="font-weight:700; font-size: var(--xl)">Sushi POS</div>
            <div class="login-sub">Manager / Admin</div>
          </div>
        </div>
        <div class="spacer"></div>
        <div class="row">
          <input id="email" type="email" class="input" placeholder="Email" />
          <input id="pass" type="password" class="input" placeholder="Password" />
        </div>
        <div class="spacer"></div>
        <button id="loginBtn" class="btn primary" style="width:100%">Sign In</button>
        <div class="spacer"></div>
        <div class="badge">Tip: Use <b>admin@sushi.com</b> or <b>minmaung0307@gmail.com</b> (create in Firebase Auth) for admin/manager roles.</div>
      </div>
    </div>
  `;
  $('#loginBtn').onclick = async () => {
    const email = $('#email').value.trim();
    const pass  = $('#pass').value.trim();
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      toast('Welcome back!');
    } catch(e) {
      toast(e.message || 'Login failed');
    }
  };
}

async function doLogout() {
  try { await auth.signOut(); localStorage.removeItem('session'); toast('Signed out'); }
  catch(e){ toast(e.message || 'Logout error'); }
}

/* ---------- App Shell ---------- */
function renderApp() {
  const root = $('#root'); if (!root) return;
  const role = session?.role || 'user';

  root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <img src="icons/icon-192.png" alt="logo" />
          <div class="title">Sushi POS</div>
        </div>
        <div class="badge"><i class="ri-user-3-line"></i>${session?.name || 'Guest'} <span style="opacity:.6">(${role})</span></div>
        <nav class="menu" id="menu">
          <a data-page="dashboard" class="active"><i class="ri-dashboard-line"></i>Dashboard</a>
          <a data-page="inventory"><i class="ri-archive-2-line"></i>Inventory</a>
          <a data-page="products"><i class="ri-restaurant-line"></i>Products</a>
          <a data-page="cogs"><i class="ri-calculator-line"></i>COGS</a>
          <a data-page="tasks"><i class="ri-list-check-2"></i>Tasks</a>
          <a data-page="settings"><i class="ri-settings-3-line"></i>Settings</a>
          <hr style="border-color:var(--border); opacity:.4" />
          <button id="logoutBtn"><i class="ri-logout-circle-r-line"></i>Logout</button>
        </nav>
      </aside>
      <main>
        <header class="header">
          <div class="left">
            <button class="burger" id="burger"><i class="ri-menu-2-line"></i></button>
            <div style="font-weight:700;">${titleForPage('dashboard')}</div>
          </div>
          <div class="right">
            <span class="role-tag">${session?.email || ''}</span>
          </div>
        </header>
        <section class="content" id="page"></section>
      </main>
    </div>

    <!-- Modal host -->
    <div class="modal-wrap" id="modalWrap">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="head"><div id="modalTitle">Modal</div><button class="btn ghost" id="modalClose"><i class="ri-close-line"></i></button></div>
        <div class="body" id="modalBody"></div>
        <div class="foot" id="modalFoot"></div>
      </div>
    </div>
  `;

  $('#logoutBtn').onclick = doLogout;
  $('#burger').onclick = () => document.body.classList.toggle('sidebar-open');

  // nav
  $$('#menu a').forEach(a => a.onclick = () => {
    $$('#menu a').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
    const p = a.dataset.page;
    $('.header .left div').textContent = titleForPage(p);
    renderPage(p);
    if (document.body.classList.contains('sidebar-open')) document.body.classList.remove('sidebar-open');
  });

  // modal close
  $('#modalClose').onclick = closeModal;
  $('#modalWrap').addEventListener('click', (e) => { if (e.target.id === 'modalWrap') closeModal(); });

  // start at dashboard
  renderPage('dashboard');
}

/* ---------- Modal helpers ---------- */
function openModal(title, bodyHTML, footHTML) {
  $('#modalTitle').innerHTML = title;
  $('#modalBody').innerHTML = bodyHTML;
  $('#modalFoot').innerHTML = footHTML || `<button class="btn" onclick="closeModal()">Close</button>`;
  $('#modalWrap').style.display = 'flex';
}
function closeModal() { $('#modalWrap').style.display = 'none'; }

/* ---------- Page routing ---------- */
function titleForPage(p) {
  return ({
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    products: 'Products',
    cogs: 'COGS',
    tasks: 'Tasks',
    settings: 'Settings',
  })[p] || 'Sushi POS';
}
function renderPage(p) {
  ({
    dashboard: renderDashboard,
    inventory: renderInventory,
    products: renderProducts,
    cogs: renderCogsPage,
    tasks: renderTasks,
    settings: renderSettings,
  }[p] || renderDashboard)();
}

/* =========================
   DASHBOARD (Posts + quick cards)
   ========================= */
function renderDashboard() {
  const page = $('#page');
  const role = session?.role || 'user';
  const posts = load('posts', []);

  page.innerHTML = `
    <div class="cards">
      <div class="card"><div style="opacity:.7">Products</div><div style="font-size:32px;font-weight:800">${load('products', []).length}</div></div>
      <div class="card"><div style="opacity:.7">Inventory Items</div><div style="font-size:32px;font-weight:800">${load('inventory', []).length}</div></div>
      <div class="card"><div style="opacity:.7">Tasks</div><div style="font-size:32px;font-weight:800">${load('tasks', []).length}</div></div>
      <div class="card"><div style="opacity:.7">Users</div><div style="font-size:32px;font-weight:800">${load('users', []).length}</div></div>
    </div>
    <div class="spacer"></div>

    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px">
        <div style="font-weight:700; font-size:var(--lg)">Posts</div>
        ${ (role==='admin' || role==='manager') ? `<button class="btn primary" id="addPostBtn"><i class="ri-add-line"></i> New Post</button>` : `<span class="badge">Read-only for Users</span>` }
      </div>
      <div class="spacer"></div>
      ${ posts.length ? posts.map(postRow).join('') : `<div style="opacity:.7">No posts yet.</div>` }
    </div>
  `;

  if (role==='admin' || role==='manager') {
    $('#addPostBtn').onclick = () => openPostModal();
  }

  function postRow(p) {
    return `
      <div class="card" style="background:#0b1220; border-color:var(--border); margin-bottom:10px">
        <div style="display:flex; gap:10px; align-items:center">
          ${ p.img ? `<img src="${p.img}" class="thumb" alt="">` : `<div class="thumb" style="display:grid;place-items:center;opacity:.6"><i class="ri-image-line"></i></div>` }
          <div style="flex:1">
            <div style="font-weight:700">${p.title}</div>
            <div style="opacity:.7">${p.body}</div>
            <div style="opacity:.5; font-size:var(--sm)">by ${p.author} • ${new Date(p.createdAt).toLocaleString()}</div>
          </div>
          ${ (session?.role==='admin' || session?.role==='manager') ? `
          <div class="actions">
            <button class="btn ghost" onclick="openPostModal('${p.id}')">Edit</button>
            <button class="btn danger" onclick="deletePost('${p.id}')">Delete</button>
          </div>` : `` }
        </div>
      </div>
    `;
  }
}

/* Post Modals */
window.openPostModal = (id=null) => {
  const editing = !!id;
  const posts = load('posts', []);
  const p = editing ? posts.find(x=>x.id===id) : { title:'', body:'', img:'' };
  const canWrite = (session?.role==='admin' || session?.role==='manager');
  if (!canWrite) { toast('Only manager/admin can add posts'); return; }

  openModal(editing ? 'Edit Post' : 'New Post', `
    <div class="row">
      <input id="postTitle" class="input" placeholder="Title" value="${p.title||''}">
      <input id="postImg" class="input" placeholder="Image URL (optional)" value="${p.img||''}">
    </div>
    <textarea id="postBody" class="textarea" rows="4" placeholder="Write something...">${p.body||''}</textarea>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn primary" onclick="savePost('${editing?id:''}')">${editing?'Save':'Create'}</button>
  `);
};
window.savePost = (id) => {
  const posts = load('posts', []);
  const title = $('#postTitle').value.trim();
  const body  = $('#postBody').value.trim();
  const img   = $('#postImg').value.trim();
  if (!title) { toast('Title is required'); return; }

  if (id) {
    const i = posts.findIndex(x=>x.id===id);
    if (i>-1) {
      posts[i] = { ...posts[i], title, body, img };
    }
  } else {
    posts.unshift({ id: `p-${uid()}`, title, body, img, createdAt: Date.now(), author: session?.name || 'Unknown' });
  }
  save('posts', posts);
  closeModal();
  renderDashboard();
};
window.deletePost = (id) => {
  const posts = load('posts', []).filter(x=>x.id!==id);
  save('posts', posts);
  renderDashboard();
};

/* =========================
   INVENTORY
   ========================= */
function renderInventory() {
  const page = $('#page');
  const items = load('inventory', []);

  page.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center" class="card">
      <div style="font-weight:700; font-size:var(--lg)">Inventory</div>
      ${(session?.role!=='user') ? `<button class="btn primary" id="addInv"><i class="ri-add-line"></i> Add Item</button>` : `<span class="badge">Read-only</span>`}
    </div>
    <div class="spacer"></div>
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Image</th><th>Name</th><th>Code</th><th>Price</th><th>Stock</th><th>Threshold</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="invBody"></tbody>
      </table>
    </div>
  `;

  const tbody = $('#invBody');
  tbody.innerHTML = items.map((r,i)=>{
    const rowClass =
      (r.stock <= r.threshold ? 'low' : (r.stock - r.threshold <= 2 ? 'warn' : ''));
    return `
      <tr class="${rowClass}">
        <td><img src="${r.img||'icons/icon-192.png'}" class="thumb" alt=""></td>
        <td>${r.name}</td>
        <td>${r.code}</td>
        <td>${money(r.price)}</td>
        <td>
          ${ (session?.role!=='user') ? `<button class="btn ghost" onclick="bumpStock(${i},-1)">−</button>` : '' }
          <b>${r.stock}</b>
          ${ (session?.role!=='user') ? `<button class="btn ghost" onclick="bumpStock(${i},1)">+</button>` : '' }
        </td>
        <td>
          ${ (session?.role!=='user') ? `<button class="btn ghost" onclick="bumpThreshold(${i},-1)">−</button>` : '' }
          <b>${r.threshold}</b>
          ${ (session?.role!=='user') ? `<button class="btn ghost" onclick="bumpThreshold(${i},1)">+</button>` : '' }
        </td>
        <td class="actions">
          ${ (session?.role!=='user') ? `
          <button class="btn ghost" onclick="openInvModal(${i})">Edit</button>
          <button class="btn danger" onclick="delInv(${i})">Delete</button>` : `<span class="badge">View</span>` }
        </td>
      </tr>
    `;
  }).join('');

  if (session?.role!=='user') $('#addInv').onclick = ()=>openInvModal(-1);
}

window.bumpStock = (i, d) => {
  const arr = load('inventory', []);
  arr[i].stock = Math.max(0, (arr[i].stock||0) + d);
  save('inventory', arr);
  renderInventory();
};
window.bumpThreshold = (i, d) => {
  const arr = load('inventory', []);
  arr[i].threshold = Math.max(0, (arr[i].threshold||0) + d);
  save('inventory', arr);
  renderInventory();
};

window.openInvModal = (idx) => {
  const editing = idx>-1;
  const arr = load('inventory', []);
  const r = editing ? arr[idx] : { img:'', name:'', code:'', price:0, stock:0, threshold:5 };

  openModal(editing?'Edit Inventory':'Add Inventory', `
    <div class="row">
      <input id="invImg" class="input" placeholder="Image URL" value="${r.img||''}">
      <input id="invName" class="input" placeholder="Name" value="${r.name||''}">
    </div>
    <div class="row">
      <input id="invCode" class="input" placeholder="Code" value="${r.code||''}">
      <input id="invPrice" class="input" type="number" step="0.01" placeholder="Price" value="${r.price||0}">
    </div>
    <div class="row">
      <input id="invStock" class="input" type="number" placeholder="Stock" value="${r.stock||0}">
      <input id="invThreshold" class="input" type="number" placeholder="Threshold" value="${r.threshold||5}">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn primary" onclick="saveInv(${idx})">${editing?'Save':'Create'}</button>
  `);
};
window.saveInv = (idx) => {
  const arr = load('inventory', []);
  const rec = {
    img: $('#invImg').value.trim(),
    name: $('#invName').value.trim(),
    code: $('#invCode').value.trim(),
    price: +$('#invPrice').value || 0,
    stock: +$('#invStock').value || 0,
    threshold: +$('#invThreshold').value || 0,
  };
  if (!rec.name) { toast('Name is required'); return; }
  if (idx>-1) arr[idx] = rec; else arr.unshift(rec);
  save('inventory', arr);
  closeModal();
  renderInventory();
};
window.delInv = (idx) => {
  const arr = load('inventory', []).filter((_,i)=>i!==idx);
  save('inventory', arr);
  renderInventory();
};

/* =========================
   PRODUCTS
   ========================= */
function renderProducts() {
  const page = $('#page');
  const items = load('products', []);
  page.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center" class="card">
      <div style="font-weight:700; font-size:var(--lg)">Products</div>
      ${(session?.role!=='user') ? `<button class="btn primary" id="addProd"><i class="ri-add-line"></i> Add Product</button>` : `<span class="badge">Read-only</span>`}
    </div>
    <div class="spacer"></div>
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Image</th><th>Name</th><th>Barcode</th><th>Price</th><th>Type</th><th>Ingredients</th><th>Instructions</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="prodBody"></tbody>
      </table>
    </div>
    <div class="spacer"></div>
    <div id="prodCard"></div>
  `;
  const tbody = $('#prodBody');
  tbody.innerHTML = items.map((r,i)=>`
    <tr>
      <td><img src="${r.img||'icons/icon-192.png'}" class="thumb" alt=""></td>
      <td>${r.name}</td>
      <td>${r.barcode}</td>
      <td>${money(r.price)}</td>
      <td>${r.type}</td>
      <td>${r.ingredients}</td>
      <td>${r.instructions}</td>
      <td class="actions">
        <button class="btn ghost" onclick="showProdCard(${i})">View</button>
        ${ (session?.role!=='user') ? `
        <button class="btn ghost" onclick="openProdModal(${i})">Edit</button>
        <button class="btn danger" onclick="delProd(${i})">Delete</button>` : `` }
      </td>
    </tr>
  `).join('');

  if (session?.role!=='user') $('#addProd').onclick = ()=>openProdModal(-1);
}
window.showProdCard = (i) => {
  const r = load('products', [])[i]; if (!r) return;
  $('#prodCard').innerHTML = `
    <div class="card" style="display:flex; gap:16px; align-items:flex-start">
      <img src="${r.img||'icons/icon-192.png'}" style="width:120px;height:120px;object-fit:cover;border-radius:14px;border:1px solid var(--border)" alt="">
      <div>
        <div style="font-size:var(--xl);font-weight:800">${r.name}</div>
        <div style="opacity:.7">Barcode: ${r.barcode}</div>
        <div style="font-weight:700">${money(r.price)}</div>
        <div class="spacer"></div>
        <div><b>Type:</b> ${r.type}</div>
        <div><b>Ingredients:</b> ${r.ingredients}</div>
        <div><b>Instructions:</b> ${r.instructions}</div>
      </div>
    </div>
  `;
};
window.openProdModal = (idx) => {
  const editing = idx>-1;
  const arr = load('products', []);
  const r = editing ? arr[idx] : { img:'', name:'', barcode:'', price:0, type:'Roll', ingredients:'', instructions:'' };

  openModal(editing?'Edit Product':'Add Product', `
    <div class="row">
      <input id="pImg" class="input" placeholder="Image URL" value="${r.img||''}">
      <input id="pName" class="input" placeholder="Name" value="${r.name||''}">
    </div>
    <div class="row">
      <input id="pBarcode" class="input" placeholder="Barcode" value="${r.barcode||''}">
      <input id="pPrice" type="number" step="0.01" class="input" placeholder="Price" value="${r.price||0}">
    </div>
    <div class="row">
      <input id="pType" class="input" placeholder="Type" value="${r.type||''}">
      <input id="pIngr" class="input" placeholder="Ingredients (comma separated)" value="${r.ingredients||''}">
    </div>
    <textarea id="pInstr" class="textarea" rows="3" placeholder="Instructions">${r.instructions||''}</textarea>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn primary" onclick="saveProd(${idx})">${editing?'Save':'Create'}</button>
  `);
};
window.saveProd = (idx) => {
  const arr = load('products', []);
  const rec = {
    img: $('#pImg').value.trim(),
    name: $('#pName').value.trim(),
    barcode: $('#pBarcode').value.trim(),
    price: +$('#pPrice').value || 0,
    type: $('#pType').value.trim(),
    ingredients: $('#pIngr').value.trim(),
    instructions: $('#pInstr').value.trim(),
  };
  if (!rec.name) { toast('Name is required'); return; }
  if (idx>-1) arr[idx] = rec; else arr.unshift(rec);
  save('products', arr);
  closeModal();
  renderProducts();
};
window.delProd = (idx) => {
  const arr = load('products', []).filter((_,i)=>i!==idx);
  save('products', arr);
  renderProducts();
};

/* =========================
   COGS (with totals)
   ========================= */
function computeGrossProfit(row) {
  const gi = +row.grossIncome || 0, pc = +row.produceCost || 0, ic = +row.itemCost || 0,
        fr = +row.freight || 0, dv = +row.delivery || 0, ot = +row.other || 0;
  return gi - (pc + ic + fr + dv + ot);
}
function cogsTotals(rows) {
  return rows.reduce((t, r) => {
    t.grossIncome += +r.grossIncome || 0;
    t.produceCost += +r.produceCost || 0;
    t.itemCost    += +r.itemCost || 0;
    t.freight     += +r.freight || 0;
    t.delivery    += +r.delivery || 0;
    t.other       += +r.other || 0;
    t.grossProfit += (r.grossProfit!=null ? +r.grossProfit || 0 : computeGrossProfit(r));
    return t;
  }, {grossIncome:0, produceCost:0, itemCost:0, freight:0, delivery:0, other:0, grossProfit:0});
}
function renderCogsPage() {
  const page = $('#page');
  const rows = load('cogs', []);
  page.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center" class="card">
      <div style="font-weight:700; font-size:var(--lg)">COGS</div>
      ${(session?.role!=='user') ? `<button class="btn primary" id="addCogs"><i class="ri-add-line"></i> Add Row</button>` : `<span class="badge">Read-only</span>`}
    </div>
    <div class="spacer"></div>
    <div class="card">
      <table class="table cogs">
        <thead>
          <tr>
            <th>Gross Income</th>
            <th>Produce Cost</th>
            <th>Item Cost</th>
            <th>Freight</th>
            <th>Delivery</th>
            <th>Other</th>
            <th>Gross Profit</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="cogsTableBody"></tbody>
        <tfoot id="cogsTableFoot"></tfoot>
      </table>
    </div>
  `;
  renderCogs();
  if (session?.role!=='user') $('#addCogs').onclick = ()=>openCogsModal(-1);
}

/* Shared with earlier snippet */
function getCogs() { return load('cogs', []); }
function setCogs(v){ save('cogs', v); }
function renderCogs() {
  const rows = getCogs();
  rows.forEach(r => r.grossProfit = computeGrossProfit(r));
  setCogs(rows);

  const t = cogsTotals(rows);
  const tbody = $('#cogsTableBody');
  const tfoot = $('#cogsTableFoot');
  tbody.innerHTML = rows.map((r,i)=>`
    <tr data-idx="${i}">
      <td>${money(r.grossIncome)}</td>
      <td>${money(r.produceCost)}</td>
      <td>${money(r.itemCost)}</td>
      <td>${money(r.freight)}</td>
      <td>${money(r.delivery)}</td>
      <td>${money(r.other)}</td>
      <td class="cogs-gp">${money(r.grossProfit)}</td>
      <td class="actions">
        ${ (session?.role!=='user') ? `
        <button class="btn ghost" onclick="openCogsModal(${i})">Edit</button>
        <button class="btn danger" onclick="delCogs(${i})">Delete</button>` : `<span class="badge">View</span>` }
      </td>
    </tr>
  `).join('');
  tfoot.innerHTML = `
    <tr class="totals-row">
      <th>${money(t.grossIncome)}</th>
      <th>${money(t.produceCost)}</th>
      <th>${money(t.itemCost)}</th>
      <th>${money(t.freight)}</th>
      <th>${money(t.delivery)}</th>
      <th>${money(t.other)}</th>
      <th>${money(t.grossProfit)}</th>
      <th>Totals</th>
    </tr>
  `;
}
window.openCogsModal = (idx) => {
  const editing = idx>-1;
  const arr = getCogs();
  const r = editing ? arr[idx] : { grossIncome:0, produceCost:0, itemCost:0, freight:0, delivery:0, other:0 };
  openModal(editing?'Edit COGS':'Add COGS', `
    <div class="row">
      <input id="gi" class="input" type="number" step="0.01" placeholder="Gross Income" value="${r.grossIncome||0}">
      <input id="pc" class="input" type="number" step="0.01" placeholder="Produce Cost" value="${r.produceCost||0}">
    </div>
    <div class="row">
      <input id="ic" class="input" type="number" step="0.01" placeholder="Item Cost" value="${r.itemCost||0}">
      <input id="fr" class="input" type="number" step="0.01" placeholder="Freight" value="${r.freight||0}">
    </div>
    <div class="row">
      <input id="dv" class="input" type="number" step="0.01" placeholder="Delivery" value="${r.delivery||0}">
      <input id="ot" class="input" type="number" step="0.01" placeholder="Other" value="${r.other||0}">
    </div>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn primary" onclick="saveCogs(${idx})">${editing?'Save':'Create'}</button>
  `);
};
window.saveCogs = (idx) => {
  const arr = getCogs();
  const rec = {
    grossIncome:+$('#gi').value||0, produceCost:+$('#pc').value||0, itemCost:+$('#ic').value||0,
    freight:+$('#fr').value||0, delivery:+$('#dv').value||0, other:+$('#ot').value||0,
  };
  rec.grossProfit = computeGrossProfit(rec);
  if (idx>-1) arr[idx] = rec; else arr.unshift(rec);
  setCogs(arr); closeModal(); renderCogs();
};
window.delCogs = (idx) => { setCogs(getCogs().filter((_,i)=>i!==idx)); renderCogs(); };

/* =========================
   TASKS (simple DnD)
   ========================= */
function renderTasks() {
  const page = $('#page');
  const tasks = load('tasks', []);
  const cols = ['todo','progress','done'];
  page.innerHTML = `
    <div class="card" style="font-weight:700; font-size:var(--lg)">Tasks</div>
    <div class="spacer"></div>
    <div style="display:grid; gap:14px; grid-template-columns: repeat(3,1fr);">
      ${cols.map(c=>`
        <div class="card" ondragover="event.preventDefault()" ondrop="dropTask(event,'${c}')">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-weight:700;text-transform:capitalize">${c.replace('progress','In Progress')}</div>
            ${(session?.role!=='user' && c==='todo') ? `<button class="btn primary" onclick="openTaskModal()"><i class="ri-add-line"></i></button>` : ``}
          </div>
          <div id="col-${c}" style="display:grid; gap:10px; margin-top:10px"></div>
        </div>
      `).join('')}
    </div>
  `;
  cols.forEach(c=>{
    const host = $(`#col-${c}`); host.innerHTML = '';
    tasks.filter(t=>t.status===c).forEach(t=>{
      const el = document.createElement('div');
      el.className = 'card';
      el.draggable = (session?.role!=='user');
      el.ondragstart = (e)=> { e.dataTransfer.setData('text/plain', t.id); };
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div>${t.title}</div>
          <div class="actions">
            ${(session?.role!=='user') ? `<button class="btn ghost" onclick="openTaskModal('${t.id}')">Edit</button>
            <button class="btn danger" onclick="delTask('${t.id}')">Delete</button>` : ``}
          </div>
        </div>
      `;
      host.appendChild(el);
    });
  });
}
window.dropTask = (e, dest) => {
  const id = e.dataTransfer.getData('text/plain');
  const arr = load('tasks', []);
  const i = arr.findIndex(x=>x.id===id);
  if (i>-1) { arr[i].status = dest; save('tasks', arr); renderTasks(); }
};
window.openTaskModal = (id=null) => {
  const editing = !!id;
  const arr = load('tasks', []);
  const r = editing ? arr.find(x=>x.id===id) : { title:'', status:'todo' };
  openModal(editing?'Edit Task':'Add Task', `
    <input id="tkTitle" class="input" placeholder="Title" value="${r.title||''}">
    <select id="tkStatus" class="select">
      <option value="todo" ${r.status==='todo'?'selected':''}>To Do</option>
      <option value="progress" ${r.status==='progress'?'selected':''}>In Progress</option>
      <option value="done" ${r.status==='done'?'selected':''}>Done</option>
    </select>
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn primary" onclick="saveTask('${editing?id:''}')">${editing?'Save':'Create'}</button>
  `);
};
window.saveTask = (id) => {
  const arr = load('tasks', []);
  const title = $('#tkTitle').value.trim();
  const status = $('#tkStatus').value;
  if (!title) { toast('Title is required'); return; }
  if (id) {
    const i = arr.findIndex(x=>x.id===id);
    if (i>-1) arr[i] = { ...arr[i], title, status };
  } else {
    arr.unshift({ id:`t-${uid()}`, title, status });
  }
  save('tasks', arr); closeModal(); renderTasks();
};
window.delTask = (id) => {
  save('tasks', load('tasks', []).filter(x=>x.id!==id)); renderTasks();
};

/* =========================
   SETTINGS (Users + Theme)
   ========================= */
function renderSettings() {
  const page = $('#page');
  const users = load('users', []);
  const s = load('settings', { theme:{preset:'teal-dark', fontScale:'100'} });

  page.innerHTML = `
    <div class="cards">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700; font-size:var(--lg)">Users</div>
          ${(session?.role!=='user') ? `<button class="btn primary" id="addUser"><i class="ri-add-line"></i> Add User</button>` : `<span class="badge">Read-only</span>`}
        </div>
        <div class="spacer"></div>
        <table class="table">
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>${ users.map((u,i)=>`
            <tr>
              <td>${u.name||''}</td>
              <td>${u.username||''}</td>
              <td>${u.email||''}</td>
              <td>${u.role||'user'}</td>
              <td class="actions">
                ${(session?.role!=='user') ? `
                <button class="btn ghost" onclick="openUserModal(${i})">Edit</button>
                <button class="btn danger" onclick="delUser(${i})">Delete</button>` : `<span class="badge">View</span>`}
              </td>
            </tr>
          `).join('') }</tbody>
        </table>
      </div>

      <div class="card">
        <div style="font-weight:700; font-size:var(--lg)">Theme</div>
        <div class="spacer"></div>
        <div class="row">
          <div>
            <label>Preset</label>
            <select id="themePreset" class="select">
              ${Object.keys(THEME_PRESETS).map(k=>`<option value="${k}" ${s.theme?.preset===k?'selected':''}>${k}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Font size (%)</label>
            <input id="fontScale" class="input" type="number" min="80" max="130" value="${s.theme?.fontScale||100}">
          </div>
        </div>
        <div class="spacer"></div>
        <button class="btn primary" id="saveTheme">Apply</button>
      </div>
    </div>
  `;
  if (session?.role!=='user') $('#addUser').onclick = ()=>openUserModal(-1);
  $('#saveTheme').onclick = () => {
    const next = load('settings', { theme:{} });
    next.theme = { preset: $('#themePreset').value, fontScale: $('#fontScale').value };
    save('settings', next);
    applyTheme();
    toast('Theme updated');
  };
}

window.openUserModal = (idx) => {
  const editing = idx>-1;
  const arr = load('users', []);
  const r = editing ? arr[idx] : { name:'', username:'', email:'', role:'user', contact:'', img:'' };

  openModal(editing?'Edit User':'Add User', `
    <div class="row">
      <input id="uName" class="input" placeholder="Name" value="${r.name||''}">
      <input id="uUsername" class="input" placeholder="Username" value="${r.username||''}">
    </div>
    <div class="row">
      <input id="uEmail" class="input" placeholder="Email" value="${r.email||''}">
      <select id="uRole" class="select">
        <option value="user" ${r.role==='user'?'selected':''}>User</option>
        <option value="manager" ${r.role==='manager'?'selected':''}>Manager</option>
        <option value="admin" ${r.role==='admin'?'selected':''}>Admin</option>
      </select>
    </div>
    <input id="uContact" class="input" placeholder="Contact" value="${r.contact||''}">
    <input id="uImg" class="input" placeholder="Avatar URL" value="${r.img||''}">
  `, `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn primary" onclick="saveUser(${idx})">${editing?'Save':'Create'}</button>
  `);
};
window.saveUser = (idx) => {
  const arr = load('users', []);
  const rec = {
    name: $('#uName').value.trim(),
    username: $('#uUsername').value.trim(),
    email: $('#uEmail').value.trim(),
    role: $('#uRole').value,
    contact: $('#uContact').value.trim(),
    img: $('#uImg').value.trim(),
  };
  if (!rec.email) { toast('Email is required'); return; }
  if (idx>-1) arr[idx] = rec; else arr.unshift(rec);
  save('users', arr);
  closeModal();
  renderSettings();
};
window.delUser = (idx) => {
  const arr = load('users', []).filter((_,i)=>i!==idx);
  save('users', arr);
  renderSettings();
};

/* ---------- Start (for direct reload during active session) ---------- */
if (session) renderApp(); else renderLogin();

/* ---------- Expose for inline handlers ---------- */
window.closeModal = closeModal;