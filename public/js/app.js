// --- Firebase (Auth + Realtime Database)
const firebaseConfig = {
  apiKey: "AIzaSyBY52zMMQqsvssukui3TfQnMigWoOzeKGk",
  authDomain: "you-6bddf.firebaseapp.com",
  databaseURL: "https://you-6bddf-default-rtdb.firebaseio.com",
  projectId: "you-6bddf",
  storageBucket: "you-6bddf.appspot.com",
  messagingSenderId: "909622476838",
  appId: "1:909622476838:web:1a1fb221a6a79fcaf4a6e7",
  measurementId: "G-M8Q8EJ4T7Q"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// --- DOM helpers
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const notify = (msg, type='ok') => {
  const n = $('#notification'); if (!n) return;
  n.textContent = msg; n.className = `notification show ${type}`;
  setTimeout(()=> n.className='notification', 2200);
};
function save(key, val){
  localStorage.setItem(key, JSON.stringify(val));
  if (cloud.isOn()) cloud.saveKV(key, val).catch(()=>{});
}
function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

// --- Globals & Prefill
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];
let session = load('session', null);
let currentRoute = load('_route', 'home');
let searchQuery  = load('_searchQ', '');

// seed once
(function seedOnFirstRun(){
  if (load('_seeded', false)) return;
  const now = Date.now();
  const users = [
    { name:'Admin',   username:'admin',   email:'admin@sushi.com',        contact:'', role:'admin',   password:'', img:'' },
    { name:'Manager', username:'manager', email:'minmaung0307@gmail.com', contact:'', role:'manager', password:'', img:'' },
    { name:'Cashier', username:'cashier1',email:'cashier@sushi.com',      contact:'', role:'user',    password:'', img:'' },
  ];
  const inventory = [
    { id:'inv1', img:'', name:'Nori Sheets', code:'NOR-100', type:'Dry', price:3.00, stock:80, threshold:30 },
    { id:'inv2', img:'', name:'Sushi Rice',  code:'RIC-200', type:'Dry', price:1.50, stock:24, threshold:20 },
    { id:'inv3', img:'', name:'Fresh Salmon',code:'SAL-300', type:'Raw', price:7.80, stock:10, threshold:12 },
  ];
  const products = [
    { id:'p1', img:'', name:'Salmon Nigiri',   barcode:'11100001', price:5.99, type:'Nigiri', ingredients:'Rice, Salmon', instructions:'Brush with nikiri.' },
    { id:'p2', img:'', name:'California Roll', barcode:'11100002', price:7.49, type:'Roll',   ingredients:'Rice, Nori, Crab, Avocado', instructions:'8 pcs.' },
  ];
  const posts = [{ id:'post1', title:'Welcome to Inventory', body:'Track stock, manage products, and work faster.', img:'', createdAt: now }];
  const tasks = [
    { id:'t1', title:'Prep Salmon',        status:'todo' },
    { id:'t2', title:'Cook Rice',          status:'inprogress' },
    { id:'t3', title:'Sanitize Station',   status:'done' },
  ];
  const cogs = [
    { id:'c1', date:'2024-08-01', grossIncome: 1200, produceCost:280, itemCost:180, freight:45, delivery:30, other:20 },
    { id:'c2', date:'2024-08-02', grossIncome:  900, produceCost:220, itemCost:140, freight:30, delivery:25, other:10 }
  ];
  save('users', users); save('inventory', inventory); save('products', products);
  save('posts', posts); save('tasks', tasks); save('cogs', cogs);
  save('_seeded', true);
})();

// --- Theme
const THEME_MODES = [
  { key:'light', name:'Light' },
  { key:'dark',  name:'Dark'  },
  { key:'aqua',  name:'Aqua'  }
];
const THEME_SIZES = [
  { key:'small',  pct: 90, label:'Small' },
  { key:'medium', pct:100, label:'Medium' },
  { key:'large',  pct:112, label:'Large' }
];
function getTheme(){ return load('_theme2', { mode:'aqua', size:'medium' }); }
function applyTheme(){
  const t = getTheme();
  const size = THEME_SIZES.find(s=>s.key===t.size)?.pct ?? 100;
  document.documentElement.setAttribute('data-theme', t.mode==='light' ? 'light' : (t.mode==='dark' ? 'dark' : ''));
  document.documentElement.style.setProperty('--font-scale', size + '%');
}
applyTheme();

// --- Cloud Sync (RTDB)
const CLOUD_KEYS = ['inventory','products','posts','tasks','cogs','users','_theme2'];
const cloud = (function(){
  let liveRefs = [];
  function uid(){ return auth.currentUser?.uid; }
  function on(){ return !!load('_cloudOn', false); }
  function setOn(v){ save('_cloudOn', !!v); }
  function pathFor(key){ return db.ref(`tenants/${uid()}/kv/${key}`); }
  async function saveKV(key, val){
    if (!on() || !uid()) return;
    await pathFor(key).set({ key, val, updatedAt: firebase.database.ServerValue.TIMESTAMP });
  }
  async function pullAllOnce(){
    if (!uid()) return;
    const snap = await db.ref(`tenants/${uid()}/kv`).get();
    if (!snap.exists()) return;
    const all = snap.val() || {};
    Object.values(all).forEach(row=>{
      if (row && row.key && 'val' in row){
        localStorage.setItem(row.key, JSON.stringify(row.val));
      }
    });
  }
  function subscribeAll(){
    if (!uid()) return;
    unsubscribeAll();
    CLOUD_KEYS.forEach(key=>{
      const ref = pathFor(key);
      const handler = ref.on('value', (snap)=>{
        const data = snap.val();
        if (!data) return;
        const curr = load(key, null);
        if (JSON.stringify(curr) !== JSON.stringify(data.val)){
          localStorage.setItem(key, JSON.stringify(data.val));
          if (key==='_theme2') applyTheme();
          renderApp();
        }
      });
      liveRefs.push({ ref, handler });
    });
  }
  function unsubscribeAll(){
    liveRefs.forEach(({ref})=>{ try{ ref.off(); }catch{} });
    liveRefs = [];
  }
  async function pushAll(){
    if (!uid()) return;
    for (const k of CLOUD_KEYS){
      const v = load(k, null);
      if (v !== null && v !== undefined){
        await saveKV(k, v);
      }
    }
  }
  async function enable(){
    if (!uid()) throw new Error('Sign in first.');
    setOn(true);
    await pullAllOnce();
    await pushAll();
    subscribeAll();
  }
  function disable(){ setOn(false); unsubscribeAll(); }
  return { isOn:on, enable, disable, saveKV, pullAllOnce, subscribeAll, pushAll };
})();

// --- Router & Idle
function go(route){ currentRoute = route; save('_route', route); renderApp(); }
let idleTimer = null;
const IDLE_LIMIT = 10 * 60 * 1000;
function resetIdleTimer(){
  if (!session) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    try { await auth.signOut(); } finally { notify('Signed out due to inactivity','warn'); }
  }, IDLE_LIMIT);
}
['click','mousemove','keydown','touchstart','scroll'].forEach(evt => {
  window.addEventListener(evt, resetIdleTimer, { passive: true });
});

// --- Auth state
auth.onAuthStateChanged(async (user) => {
  applyTheme();
  if (user) {
    const email = (user.email || '').toLowerCase();
    let users = load('users', []);
    let prof = users.find(u => (u.email||'').toLowerCase() === email);
    if (!prof) {
      const role = SUPER_ADMINS.includes(email) ? 'admin' : 'user';
      prof = { name: role==='admin'?'Admin':'User', username: email.split('@')[0], email, contact:'', role, password:'', img:'' };
      users.push(prof); save('users', users);
    } else if (SUPER_ADMINS.includes(email) && prof.role!=='admin') {
      prof.role = 'admin'; save('users', users);
    }
    session = { ...prof }; save('session', session);

    if (cloud.isOn()){
      try { await cloud.pullAllOnce(); cloud.subscribeAll(); } catch (_) {}
    }

    resetIdleTimer();
    currentRoute = load('_route','home');
    renderApp();
  } else {
    session = null; save('session', null);
    if (idleTimer) clearTimeout(idleTimer);
    renderLogin();
  }
});

// --- Login / Logout
function renderLogin() {
  const root = $('#root');
  root.innerHTML = `
    <div class="login">
      <div class="card login-card">
        <div class="card-body">
          <div class="login-logo">
            <div class="logo">📦</div>
            <div class="login-badge hide-on-phone">Manager / Admin</div>
          </div>
          <h2 style="text-align:center;margin:6px 0 2px">Inventory</h2>
          <p class="login-note">Sign in with your email and password.</p>
          <div class="grid">
            <input id="li-email" class="input" type="email" placeholder="Email" />
            <input id="li-pass" class="input" type="password" placeholder="Password" />
            <button id="btnLogin" class="btn">Sign In</button>
          </div>
        </div>
      </div>
    </div>
  `;
  $('#btnLogin').onclick = async () => {
    const email = $('#li-email').value.trim();
    const pass  = $('#li-pass').value;
    if (!email || !pass) { notify('Enter email & password','warn'); return; }
    try { await auth.signInWithEmailAndPassword(email, pass); notify('Welcome!'); }
    catch (e) { notify(e.message || 'Login failed','danger'); }
  };
}
async function doLogout(){ cloud.disable(); await auth.signOut(); notify('Signed out'); }

// --- Sidebar + Topbar
function renderSidebar(active='home'){
  const links = [
    { route:'home',      icon:'ri-home-5-line',              label:'Home' },
    { route:'dashboard', icon:'ri-dashboard-line',           label:'Dashboard' },
    { route:'inventory', icon:'ri-archive-2-line',           label:'Inventory' },
    { route:'products',  icon:'ri-store-2-line',             label:'Products' },
    { route:'cogs',      icon:'ri-money-dollar-circle-line', label:'COGS' },
    { route:'tasks',     icon:'ri-list-check-2',             label:'Tasks' },
    { route:'settings',  icon:'ri-settings-3-line',          label:'Settings' }
  ];
  const pages = [
    { route:'policy',  icon:'ri-shield-check-line',    label:'Policy' },
    { route:'license', icon:'ri-copyright-line',       label:'License' },
    { route:'setup',   icon:'ri-guide-line',           label:'Setup Guide' },
    { route:'contact', icon:'ri-customer-service-2-line', label:'Contact' },
    { route:'guide',   icon:'ri-video-line',           label:'User Guide' },
  ];
  return `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="logo">📦</div>
        <div class="title">Inventory</div>
      </div>

      <div class="search-wrap">
        <input id="globalSearch" placeholder="Search everything…" autocomplete="off" />
        <div id="searchResults" class="search-results"></div>
      </div>

      <h6>Menu</h6>
      <nav class="nav">
        ${links.map(l => `
          <div class="item ${active===l.route?'active':''}" data-route="${l.route}">
            <i class="${l.icon}"></i> <span>${l.label}</span>
          </div>`).join('')}
      </nav>

      <h6>Links</h6>
      <div class="links">
        ${pages.map(p => `
          <div class="item" data-route="${p.route}">
            <i class="${p.icon}"></i> <span>${p.label}</span>
          </div>`).join('')}
      </div>

      <h6>Social</h6>
      <div class="socials-row">
        <a href="https://youtube.com" target="_blank" rel="noopener" title="YouTube"><i class="ri-youtube-fill"></i></a>
        <a href="https://facebook.com" target="_blank" rel="noopener" title="Facebook"><i class="ri-facebook-fill"></i></a>
        <a href="https://instagram.com" target="_blank" rel="noopener" title="Instagram"><i class="ri-instagram-line"></i></a>
        <a href="https://tiktok.com" target="_blank" rel="noopener" title="TikTok"><i class="ri-tiktok-fill"></i></a>
        <a href="https://twitter.com" target="_blank" rel="noopener" title="X/Twitter"><i class="ri-twitter-x-line"></i></a>
      </div>
    </aside>
  `;
}
function renderTopbar(){
  return `
    <div class="topbar">
      <div class="left">
        <div class="burger" id="burger"><i class="ri-menu-line"></i></div>
        <div><strong>${currentRoute[0].toUpperCase()+currentRoute.slice(1)}</strong></div>
      </div>
      <div class="right">
        <button class="btn ghost" id="btnHome"><i class="ri-home-5-line"></i> Home</button>
        <button class="btn secondary" id="btnLogout"><i class="ri-logout-box-r-line"></i> Logout</button>
      </div>
    </div>
    <div class="backdrop" id="backdrop"></div>
  `;
}

// --- Global delegated listeners

// Sidebar route clicks
document.addEventListener('click', (e)=>{
  const item = e.target.closest('.sidebar .item[data-route]');
  if (!item) return;
  const r = item.getAttribute('data-route');
  if (r) go(r);
}, { passive: true });

// Close modals
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-close]');
  if (!btn) return;
  const id = btn.getAttribute('data-close');
  if (id) closeModal(id);
}, { passive: true });

// NEW: Delegated navigation for ANY element with data-go inside #main
document.addEventListener('click', (e)=>{
  const el = e.target.closest('[data-go]');
  const main = $('#main');
  if (!el || !main || !main.contains(el)) return;
  const r  = el.getAttribute('data-go');
  const id = el.getAttribute('data-id');
  if (r) { go(r); if (id) setTimeout(()=> scrollToRow(id), 80); }
}, { passive:true });

// --- Render App
function renderApp(){
  if (!session) { renderLogin(); return; }
  const root = $('#root');
  root.innerHTML = `
    <div class="app">
      ${renderSidebar(currentRoute)}
      <div>
        ${renderTopbar()}
        <div class="main" id="main">
          ${
            currentRoute==='home'      ? viewHome()
          : currentRoute==='dashboard' ? viewDashboard()
          : currentRoute==='inventory' ? viewInventory()
          : currentRoute==='products'  ? viewProducts()
          : currentRoute==='cogs'      ? viewCOGS()
          : currentRoute==='tasks'     ? viewTasks()
          : currentRoute==='settings'  ? viewSettings()
          : currentRoute==='search'    ? viewSearch()
          : viewPage(currentRoute)
          }
        </div>
      </div>
    </div>
  `;

  hookSidebarInteractions();

  // Burger / backdrop / home / logout
  $('#burger')?.addEventListener('click', openSidebar, { passive:true });
  $('#backdrop')?.addEventListener('click', closeSidebar, { passive:true });
  $('#btnHome')?.addEventListener('click', ()=> go('home'));
  $('#btnLogout')?.addEventListener('click', doLogout);

  // Section wiring
  if (currentRoute==='dashboard')  wireDashboard?.();
  if (currentRoute==='inventory')  wireInventory?.();
  if (currentRoute==='products')   wireProducts?.();
  if (currentRoute==='cogs')       wireCOGS?.();
  if (currentRoute==='tasks')      { wireTasks?.(); setupDnD?.(); }
  if (currentRoute==='settings')   wireSettings?.();

  enableMobileImagePreview?.();
}
function openSidebar(){ $('#sidebar')?.classList.add('open'); $('#backdrop')?.classList.add('active'); }
function closeSidebar(){ $('#sidebar')?.classList.remove('open'); $('#backdrop')?.classList.remove('active'); }

// --- Sidebar search
function hookSidebarInteractions(){
  const input = $('#globalSearch');
  const results = $('#searchResults');
  const indexData = buildSearchIndex();
  let searchTimer;

  if (!input) return;
  input.removeAttribute('disabled');
  input.style.pointerEvents = 'auto';

  const openResultsPage = (q)=>{
    searchQuery = q; save('_searchQ', q);
    if (currentRoute !== 'search') go('search'); else renderApp();
  };

  input.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) { openResultsPage(q); results.classList.remove('active'); input.blur(); closeSidebar(); }
    }
  });

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('active'); results.innerHTML=''; return; }
    searchTimer = setTimeout(() => {
      const out = searchAll(indexData, q).slice(0, 12);
      if (!out.length) { results.classList.remove('active'); results.innerHTML=''; return; }
      results.innerHTML = out.map(r => `
        <div class="result" data-route="${r.route}" data-id="${r.id||''}">
          <strong>${r.label}</strong> <span style="color:var(--muted)">— ${r.section}</span>
        </div>`).join('');
      results.classList.add('active');

      $$('.search-results .result').forEach(row => {
        row.onclick = () => {
          const r = row.getAttribute('data-route');
          const id = row.getAttribute('data-id') || '';
          const label = row.textContent.trim();
          openResultsPage(label);
          results.classList.remove('active');
          input.value = '';
          closeSidebar();
          if (id) setTimeout(()=> scrollToRow(id), 80);
        };
      });
    }, 120);
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('active');
    }
  });
}

// --- Views
const USD = x => `$${Number(x||0).toFixed(2)}`;

function viewHome(){
  return `
    <div class="card">
      <div class="card-body">
        <h3 style="margin-top:0">Welcome 👋</h3>
        <p style="color:var(--muted)">Pick a section to get started, or watch a quick intro to inventory.</p>

        <div class="grid cols-4 auto" style="margin-bottom:12px">
          <div class="card tile" data-go="inventory">
            <div class="card-body" style="display:flex;gap:10px;align-items:center">
              <i class="ri-archive-2-line"></i><div><div>Inventory</div></div>
            </div>
          </div>
          <div class="card tile" data-go="products">
            <div class="card-body" style="display:flex;gap:10px;align-items:center">
              <i class="ri-store-2-line"></i><div><div>Products</div></div>
            </div>
          </div>
          <div class="card tile" data-go="cogs">
            <div class="card-body" style="display:flex;gap:10px;align-items:center">
              <i class="ri-money-dollar-circle-line"></i><div><div>COGS</div></div>
            </div>
          </div>
          <div class="card tile" data-go="tasks">
            <div class="card-body" style="display:flex;gap:10px;align-items:center">
              <i class="ri-list-check-2"></i><div><div>Tasks</div></div>
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-body">
              <h4 style="margin:0 0 10px 0">What is Inventory?</h4>
              <video
                style="width:100%;border-radius:12px;border:1px solid var(--card-border)"
                controls
                playsinline
                preload="metadata"
                poster="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.jpg">
                <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4" />
                Your browser does not support HTML5 video.
              </video>
              <div style="color:var(--muted);font-size:12px;margin-top:6px">
                If the video doesn't play, <a href="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" target="_blank" rel="noopener">open it in a new tab</a>.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function viewSearch(){
  const q = searchQuery || '';
  const index = buildSearchIndex();
  const out = q ? searchAll(index, q) : [];
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Search</h3>
          <div style="color:var(--muted)">Query: <strong>${q || '(empty)'}</strong></div>
        </div>
        ${out.length ? `
          <div class="grid">
            ${out.map(r => `
              <div class="card" data-go="${r.route}" data-id="${r.id||''}">
                <div class="card-body" style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-weight:700">${r.label}</div>
                    <div style="color:var(--muted);font-size:12px">${r.section}</div>
                  </div>
                  <button class="btn">Open</button>
                </div>
              </div>`).join('')}
          </div>` : `<p style="color:var(--muted)">No results.</p>`}
      </div>
    </div>
  `;
}

function viewDashboard(){
  const posts = load('posts', []);
  const inv = load('inventory', []);
  const prods = load('products', []);
  const users = load('users', []);
  const tasks = load('tasks', []);

  const lowCt  = inv.filter(i => i.stock <= i.threshold && i.stock > Math.max(1, Math.floor(i.threshold*0.6))).length;
  const critCt = inv.filter(i => i.stock <= Math.max(1, Math.floor(i.threshold*0.6))).length;

  return `
    <div class="grid cols-4 auto">
      <div class="card tile" data-go="inventory"><div>Total Items</div><h2>${inv.length}</h2></div>
      <div class="card tile" data-go="products"><div>Products</div><h2>${prods.length}</h2></div>
      <div class="card tile" data-go="settings"><div>Users</div><h2>${users.length}</h2></div>
      <div class="card tile" data-go="tasks"><div>Tasks</div><h2>${tasks.length}</h2></div>
    </div>

    <div class="grid cols-4 auto" style="margin-top:12px">
      <div class="card" data-go="inventory" style="border-left:4px solid var(--warn)">
        <div class="card-body"><strong>Low stock</strong><div style="color:var(--muted)">${lowCt}</div></div>
      </div>
      <div class="card" data-go="inventory" style="border-left:4px solid var(--danger)">
        <div class="card-body"><strong>Critical</strong><div style="color:var(--muted)">${critCt}</div></div>
      </div>
      <div class="card" data-go="cogs"><div class="card-body"><strong>COGS</strong><div style="color:var(--muted)">View details</div></div></div>
      <div class="card" data-go="tasks"><div class="card-body"><strong>Tasks</strong><div style="color:var(--muted)">Manage lanes</div></div></div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Posts</h3>
          ${canCreate() ? `<button class="btn" id="addPost"><i class="ri-add-line"></i> Add Post</button>` : ''}
        </div>
        <div class="grid" data-section="posts" style="grid-template-columns: 1fr;">
          ${posts.map(p => `
            <div class="card" id="${p.id}">
              <div class="card-body">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div><strong>${p.title}</strong><div style="color:var(--muted);font-size:12px">${new Date(p.createdAt).toLocaleString()}</div></div>
                  <div>
                    ${canCreate()?`
                      <button class="btn ghost" data-edit="${p.id}"><i class="ri-edit-line"></i></button>
                      <button class="btn danger" data-del="${p.id}"><i class="ri-delete-bin-6-line"></i></button>`:''}
                  </div>
                </div>
                ${p.img?`<img src="${p.img}" style="width:100%;border-radius:12px;margin-top:10px;border:1px solid var(--card-border)"/>`:''}
                <p style="margin-top:8px">${p.body}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    ${postModal()}
  `;
}

function wireDashboard(){
  const addPostBtn = document.getElementById('addPost');
  if (addPostBtn) addPostBtn.onclick = () => openModal('m-post');
}

// Inventory
function viewInventory(){
  const items = load('inventory', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Inventory</h3>
          <div style="display:flex;gap:8px">
            <button class="btn ghost" id="export-inv"><i class="ri-download-2-line"></i> Export CSV</button>
            ${canCreate() ? `<button class="btn" id="addInv"><i class="ri-add-line"></i> Add Item</button>` : ''}
          </div>
        </div>
        <div class="table-wrap" data-section="inventory">
          <table class="table">
            <thead><tr>
              <th>Image</th><th>Name</th><th>Code</th><th>Type</th><th>Price</th><th>Stock</th><th>Threshold</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${items.map(it => {
                const warnClass = it.stock <= it.threshold ? (it.stock <= Math.max(1, Math.floor(it.threshold*0.6)) ? 'tr-danger' : 'tr-warn') : '';
                return `<tr id="${it.id}" class="${warnClass}">
                  <td>
                    <div class="thumb-wrap">
                      ${it.img?`<img class="thumb inv-preview" data-src="${it.img}" alt=""/>`:`<div class="thumb inv-preview" data-src="icons/icon-512.png" style="display:grid;place-items:center">📦</div>`}
                      <img class="thumb-large" src="${it.img||'icons/icon-512.png'}" alt=""/>
                    </div>
                  </td>
                  <td>${it.name}</td>
                  <td>${it.code}</td>
                  <td>${it.type||'-'}</td>
                  <td>${USD(it.price)}</td>
                  <td>
                    <button class="btn ghost" data-dec="${it.id}">–</button>
                    <span style="padding:0 10px">${it.stock}</span>
                    <button class="btn ghost" data-inc="${it.id}">+</button>
                  </td>
                  <td>
                    <button class="btn ghost" data-dec-th="${it.id}">–</button>
                    <span style="padding:0 10px">${it.threshold}</span>
                    <button class="btn ghost" data-inc-th="${it.id}">+</button>
                  </td>
                  <td>
                    ${canCreate() ? `
                      <button class="btn ghost" data-edit="${it.id}"><i class="ri-edit-line"></i></button>
                      <button class="btn danger" data-del="${it.id}"><i class="ri-delete-bin-6-line"></i></button>` : ''
                    }
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    ${invModal()}
    ${imgPreviewModal()}
  `;
}

// Products
function viewProducts(){
  const items = load('products', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Products</h3>
          <div style="display:flex;gap:8px">
            <button class="btn ghost" id="export-prod"><i class="ri-download-2-line"></i> Export CSV</button>
            ${canCreate() ? `<button class="btn" id="addProd"><i class="ri-add-line"></i> Add Product</button>` : ''}
          </div>
        </div>
        <div class="table-wrap" data-section="products">
          <table class="table">
            <thead><tr>
              <th>Image</th><th>Name</th><th>Barcode</th><th>Price</th><th>Type</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${items.map(it => `
                <tr id="${it.id}">
                  <td>
                    <div class="thumb-wrap">
                      ${it.img?`<img class="thumb prod-thumb prod-preview" data-card="${it.id}" data-src="${it.img}" alt=""/>`:`<div class="thumb prod-thumb prod-preview" data-card="${it.id}" data-src="icons/icon-512.png" style="display:grid;place-items:center;cursor:pointer">🍣</div>`}
                      <img class="thumb-large" src="${it.img||'icons/icon-512.png'}" alt=""/>
                    </div>
                  </td>
                  <td>${it.name}</td>
                  <td>${it.barcode}</td>
                  <td>${USD(it.price)}</td>
                  <td>${it.type||'-'}</td>
                  <td>
                    ${canCreate() ? `
                      <button class="btn ghost" data-edit="${it.id}"><i class="ri-edit-line"></i></button>
                      <button class="btn danger" data-del="${it.id}"><i class="ri-delete-bin-6-line"></i></button>` : ''
                    }
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    ${prodModal()}
    ${prodCardModal()}
    ${imgPreviewModal()}
  `;
}

// COGS
function viewCOGS(){
  const rows = load('cogs', []);
  const totals = rows.reduce((a,r)=>({
    grossIncome:a.grossIncome+r.grossIncome,
    produceCost:a.produceCost+r.produceCost,
    itemCost:a.itemCost+r.itemCost,
    freight:a.freight+r.freight,
    delivery:a.delivery+r.delivery,
    other:a.other+r.other
  }),{grossIncome:0,produceCost:0,itemCost:0,freight:0,delivery:0,other:0});
  const grossProfit = (r)=> r.grossIncome - (r.produceCost+r.itemCost+r.freight+r.delivery+r.other);
  const totalProfit = grossProfit(totals);

  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">COGS</h3>
          <div style="display:flex;gap:8px">
            <button class="btn ghost" id="export-cogs"><i class="ri-download-2-line"></i> Export CSV</button>
            ${canCreate() ? `<button class="btn" id="addCOGS"><i class="ri-add-line"></i> Add Row</button>` : ''}
          </div>
        </div>
        <div class="table-wrap" data-section="cogs">
          <table class="table">
            <thead><tr>
              <th>Date</th><th>Gross Income</th><th>Produce Cost</th><th>Item Cost</th>
              <th>Freight</th><th>Delivery</th><th>Other</th><th>Gross Profit</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${rows.map(r=>`
                <tr id="${r.id}">
                  <td>${r.date}</td>
                  <td>${USD(r.grossIncome)}</td>
                  <td>${USD(r.produceCost)}</td>
                  <td>${USD(r.itemCost)}</td>
                  <td>${USD(r.freight)}</td>
                  <td>${USD(r.delivery)}</td>
                  <td>${USD(r.other)}</td>
                  <td>${USD(grossProfit(r))}</td>
                  <td>
                    ${canCreate() ? `
                      <button class="btn ghost" data-edit="${r.id}"><i class="ri-edit-line"></i></button>
                      <button class="btn danger" data-del="${r.id}"><i class="ri-delete-bin-6-line"></i></button>` : ''
                    }
                  </td>
                </tr>`).join('')}
              <tr class="tr-total">
                <th>Total</th>
                <th>${USD(totals.grossIncome)}</th>
                <th>${USD(totals.produceCost)}</th>
                <th>${USD(totals.itemCost)}</th>
                <th>${USD(totals.freight)}</th>
                <th>${USD(totals.delivery)}</th>
                <th>${USD(totals.other)}</th>
                <th>${USD(totalProfit)}</th>
                <th></th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    ${cogsModal()}
  `;
}

// Tasks
function viewTasks(){
  const items = load('tasks', []);
  const lane = (key, label, color)=>`
    <div class="card lane-row" data-lane="${key}">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0;color:${color}">${label}</h3>
          ${key==='todo' && canCreate()? `<button class="btn" id="addTask"><i class="ri-add-line"></i> Add Task</button>`:''}
        </div>
        <div class="grid lane-grid" id="lane-${key}">
          <div class="lane-dropzone" data-dropzone="${key}"></div>
          ${items.filter(t=>t.status===key).map(t=>`
            <div class="card task-card" id="${t.id}" draggable="true" data-task="${t.id}">
              <div class="card-body" style="display:flex;justify-content:space-between;align-items:center">
                <div>${t.title}</div>
                <div>
                  ${canCreate() ? `
                    <button class="btn ghost" data-edit="${t.id}"><i class="ri-edit-line"></i></button>
                    <button class="btn danger" data-del="${t.id}"><i class="ri-delete-bin-6-line"></i></button>` : ''
                  }
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;
  return `
    <div data-section="tasks">
      ${lane('todo','To do','#f59e0b')}
      ${lane('inprogress','In progress','#3b82f6')}
      ${lane('done','Done','#10b981')}
    </div>
    ${taskModal()}
  `;
}

// Settings
function viewSettings(){
  const users = load('users', []);
  const theme = getTheme();
  const cloudOn = cloud.isOn();

  return `
    <div class="grid">
      <div class="card">
        <div class="card-body">
          <h3 style="margin-top:0">Cloud Sync</h3>
          <p style="color:var(--muted)">Store your data in Firebase RTDB to use it on any device. Local-first; works offline.</p>
          <div class="theme-inline">
            <div>
              <label style="font-size:12px;color:var(--muted)">Status</label>
              <select id="cloud-toggle" class="input">
                <option value="off" ${!cloudOn?'selected':''}>Off</option>
                <option value="on"  ${cloudOn?'selected':''}>On</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;color:var(--muted)">Actions</label><br/>
              <button class="btn" id="cloud-sync-now"><i class="ri-cloud-line"></i> Sync Now</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h3 style="margin-top:0">Theme</h3>
          <div class="theme-inline">
            <div>
              <label style="font-size:12px;color:var(--muted)">Mode</label>
              <select id="theme-mode" class="input">
                ${THEME_MODES.map(m=>`<option value="${m.key}" ${theme.mode===m.key?'selected':''}>${m.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:12px;color:var(--muted)">Font Size</label>
              <select id="theme-size" class="input">
                ${THEME_SIZES.map(s=>`<option value="${s.key}" ${theme.size===s.key?'selected':''}>${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="margin:0">Users</h3>
            ${canManage()? `<button class="btn" id="addUser"><i class="ri-add-line"></i> Add User</button>`:''}
          </div>
          <table class="table" data-section="users">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              ${users.map(u=>`
                <tr id="${u.email}">
                  <td>${u.name}</td>
                  <td>${u.email}</td>
                  <td>${u.role}</td>
                  <td>
                    ${canManage()? `
                      <button class="btn ghost" data-edit="${u.email}"><i class="ri-edit-line"></i></button>
                      <button class="btn danger" data-del="${u.email}"><i class="ri-delete-bin-6-line"></i></button>` : ''
                    }
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    ${typeof userModal === 'function' ? userModal() : ''}
  `;
}

// Static page container (unchanged)
const pageContent = {
  policy: `<h3>Policy</h3>
    <div style="border:1px solid var(--card-border);border-radius:12px;overflow:hidden">
      <iframe src="policy.html" style="width:100%;height:calc(100vh - 220px);border:none"></iframe>
    </div>`,
  license:`<h3>License</h3>
    <div style="border:1px solid var(--card-border);border-radius:12px;overflow:hidden">
      <iframe src="license.html" style="width:100%;height:calc(100vh - 220px);border:none"></iframe>
    </div>`,
  setup:  `<h3>Setup Guide</h3>
    <div style="border:1px solid var(--card-border); border-radius:12px; overflow:hidden;">
      <iframe src="setup-guide.html" style="width:100%; height: calc(100vh - 220px); border:none;"></iframe>
    </div>
    <p style="color:var(--muted); font-size:12px; margin-top:8px">
      Tip: open in a new tab if you want a full-page view.
    </p>`,
  contact:`<h3>Contact</h3>
    <p>Got a question? Send us a message.</p>
    <div class="grid cols-2">
      <input id="ct-name" class="input" placeholder="Your name" />
      <input id="ct-email" class="input" type="email" placeholder="Your email" />
    </div>
    <textarea id="ct-msg" class="input" rows="5" placeholder="Message"></textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:10px">
      <button id="ct-send" class="btn"><i class="ri-send-plane-line"></i> Send</button>
    </div>`,
  guide:`<h3>User Guide</h3>
    <div style="border:1px solid var(--card-border);border-radius:12px;overflow:hidden">
      <iframe src="guide.html" style="width:100%;height:calc(100vh - 220px);border:none"></iframe>
    </div>`
};
function viewPage(key){ return `<div class="card"><div class="card-body">${pageContent[key]||'<p>Page</p>'}</div></div>`; }

// --- Permission helpers
function canManage(){ return session && (session.role==='admin' || session.role==='manager'); }
function canCreate(){ return session && (session.role==='admin' || session.role==='manager'); }

// --- Modals
function postModal(){
  if (!canCreate()) return '';
  return `
  <div class="modal-backdrop" id="mb-post"></div>
  <div class="modal" id="m-post">
    <div class="dialog">
      <div class="head"><strong>Post</strong><button class="btn ghost" data-close="m-post">Close</button></div>
      <div class="body grid">
        <input id="post-id" type="hidden" />
        <input id="post-title" class="input" placeholder="Title" />
        <textarea id="post-body" class="input" placeholder="Body"></textarea>
        <input id="post-img" class="input" placeholder="Image URL (optional)" />
      </div>
      <div class="foot"><button class="btn" id="save-post">Save</button></div>
    </div>
  </div>`;
}
function invModal(){
  if (!canCreate()) return '';
  return `
  <div class="modal-backdrop" id="mb-inv"></div>
  <div class="modal" id="m-inv">
    <div class="dialog">
      <div class="head"><strong>Inventory Item</strong><button class="btn ghost" data-close="m-inv">Close</button></div>
      <div class="body grid">
        <input id="inv-id" type="hidden" />
        <input id="inv-name" class="input" placeholder="Name" />
        <input id="inv-code" class="input" placeholder="Code" />
        <select id="inv-type" class="input">
          <option>Raw</option><option>Cooked</option><option>Dry</option><option>Other</option>
        </select>
        <input id="inv-price" class="input" type="number" step="0.01" placeholder="Price" />
        <input id="inv-stock" class="input" type="number" placeholder="Stock" />
        <input id="inv-threshold" class="input" type="number" placeholder="Threshold" />
        <input id="inv-img" class="input" placeholder="Image URL (optional)" />
      </div>
      <div class="foot"><button class="btn" id="save-inv">Save</button></div>
    </div>
  </div>`;
}
function prodModal(){
  if (!canCreate()) return '';
  return `
  <div class="modal-backdrop" id="mb-prod"></div>
  <div class="modal" id="m-prod">
    <div class="dialog">
      <div class="head"><strong>Product</strong><button class="btn ghost" data-close="m-prod">Close</button></div>
      <div class="body grid">
        <input id="prod-id" type="hidden" />
        <input id="prod-name" class="input" placeholder="Name" />
        <input id="prod-barcode" class="input" placeholder="Barcode" />
        <input id="prod-price" class="input" type="number" step="0.01" placeholder="Price" />
        <input id="prod-type" class="input" placeholder="Type" />
        <textarea id="prod-ingredients" class="input" placeholder="Ingredients"></textarea>
        <textarea id="prod-instructions" class="input" placeholder="Instructions"></textarea>
        <input id="prod-img" class="input" placeholder="Image URL (optional)" />
      </div>
      <div class="foot"><button class="btn" id="save-prod">Save</button></div>
    </div>
  </div>`;
}
function prodCardModal(){
  return `
  <div class="modal-backdrop" id="mb-card"></div>
  <div class="modal" id="m-card">
    <div class="dialog">
      <div class="head"><strong id="pc-name">Product</strong><button class="btn ghost" data-close="m-card">Close</button></div>
      <div class="body grid cols-2">
        <div><img id="pc-img" style="width:100%;border-radius:12px;border:1px solid var(--card-border)" /></div>
        <div class="grid">
          <div><strong>Barcode:</strong> <span id="pc-barcode"></span></div>
          <div><strong>Price:</strong> <span id="pc-price"></span></div>
          <div><strong>Type:</strong> <span id="pc-type"></span></div>
          <div><strong>Ingredients:</strong><div id="pc-ingredients"></div></div>
          <div><strong>Instructions:</strong><div id="pc-instructions"></div></div>
        </div>
      </div>
    </div>
  </div>`;
}
function cogsModal(){
  if (!canCreate()) return '';
  return `
  <div class="modal-backdrop" id="mb-cogs"></div>
  <div class="modal" id="m-cogs">
    <div class="dialog">
      <div class="head"><strong>COGS Row</strong><button class="btn ghost" data-close="m-cogs">Close</button></div>
      <div class="body grid cols-2">
        <input id="cogs-id" type="hidden" />
        <input id="cogs-date" class="input" type="date" />
        <input id="cogs-grossIncome" class="input" type="number" step="0.01" placeholder="Gross Income" />
        <input id="cogs-produceCost" class="input" type="number" step="0.01" placeholder="Produce Cost" />
        <input id="cogs-itemCost" class="input" type="number" step="0.01" placeholder="Item Cost" />
        <input id="cogs-freight" class="input" type="number" step="0.01" placeholder="Freight" />
        <input id="cogs-delivery" class="input" type="number" step="0.01" placeholder="Delivery" />
        <input id="cogs-other" class="input" type="number" step="0.01" placeholder="Other" />
      </div>
      <div class="foot"><button class="btn" id="save-cogs">Save</button></div>
    </div>
  </div>`;
}
function taskModal(){
  if (!canCreate()) return '';
  return `
  <div class="modal-backdrop" id="mb-task"></div>
  <div class="modal" id="m-task">
    <div class="dialog">
      <div class="head"><strong>Task</strong><button class="btn ghost" data-close="m-task">Close</button></div>
      <div class="body grid">
        <input id="task-id" type="hidden" />
        <input id="task-title" class="input" placeholder="Title" />
        <select id="task-status">
          <option value="todo">To do</option>
          <option value="inprogress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div class="foot"><button class="btn" id="save-task">Save</button></div>
    </div>
  </div>`;
}
function userModal(){
  if (!canManage()) return '';
  return `
  <div class="modal-backdrop" id="mb-user"></div>
  <div class="modal" id="m-user">
    <div class="dialog">
      <div class="head"><strong>User</strong><button class="btn ghost" data-close="m-user">Close</button></div>
      <div class="body grid">
        <input id="user-name" class="input" placeholder="Name" />
        <input id="user-email" class="input" type="email" placeholder="Email" />
        <input id="user-username" class="input" placeholder="Username" />
        <select id="user-role">
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <input id="user-img" class="input" placeholder="Image URL (optional)" />
      </div>
      <div class="foot"><button class="btn" id="save-user">Save</button></div>
    </div>
  </div>`;
}

// Image preview modal (phones)
function imgPreviewModal(){
  return `
  <div class="modal-backdrop" id="mb-img"></div>
  <div class="modal img-modal" id="m-img">
    <div class="dialog">
      <div class="head"><strong>Preview</strong><button class="btn ghost" data-close="m-img">Close</button></div>
      <div class="body"><div class="imgbox"><img id="preview-img" src="" alt="Preview"/></div></div>
    </div>
  </div>`;
}
function openImg(src){ const img = $('#preview-img'); if (!img) return; img.src = src || 'icons/icon-512.png'; openModal('m-img'); }

// Modal helpers
function openModal(id){ $('#'+id)?.classList.add('active'); $('#mb-'+id.split('-')[1])?.classList.add('active'); }
function closeModal(id){ $('#'+id)?.classList.remove('active'); $('#mb-'+id.split('-')[1])?.classList.remove('active'); }

// --- Export helpers
function csvEscape(v){ return `"${String(v ?? '').replace(/"/g,'""')}"`; }
function toCSV(headers, rows){
  const head = headers.map(h=>csvEscape(h.label)).join(',');
  const body = rows.map(r => headers.map(h => {
    const val = typeof h.value === 'function' ? h.value(r) : (h.key ? r[h.key] : '');
    return csvEscape(val);
  }).join(',')).join('\n');
  return head + '\n' + body;
}
function download(filename, text){
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(text);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --- Wiring sections
function wireInventory(){
  if ($('#addInv')) $('#addInv').onclick = ()=> openModal('m-inv');
  const sec = $('[data-section="inventory"]'); if (!sec) return;

  // Export CSV
  $('#export-inv')?.addEventListener('click', ()=>{
    const items = load('inventory', []);
    const headers = [
      { label:'Name', key:'name' },
      { label:'Code', key:'code' },
      { label:'Type', key:'type' },
      { label:'Price', value: r => Number(r.price||0).toFixed(2) },
      { label:'Stock', key:'stock' },
      { label:'Threshold', key:'threshold' },
    ];
    download('inventory.csv', toCSV(headers, items));
  });

  $('#save-inv')?.addEventListener('click', ()=>{
    const items = load('inventory', []);
    const id = $('#inv-id').value || ('inv_'+Date.now());
    const obj = {
      id,
      name: $('#inv-name').value.trim(),
      code: $('#inv-code').value.trim(),
      type: $('#inv-type').value.trim(),
      price: parseFloat($('#inv-price').value||'0'),
      stock: parseInt($('#inv-stock').value||'0'),
      threshold: parseInt($('#inv-threshold').value||'0'),
      img: $('#inv-img').value.trim(),
    };
    if (!obj.name) return notify('Name required','warn');
    const i = items.findIndex(x=>x.id===id);
    if (i>=0) items[i]=obj; else items.push(obj);
    save('inventory', items); closeModal('m-inv'); notify('Saved'); renderApp();
  });

  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;

    if (btn.hasAttribute('data-edit')) {
      const id = btn.getAttribute('data-edit');
      const items = load('inventory', []);
      const it = items.find(x=>x.id===id); if (!it) return;
      openModal('m-inv');
      $('#inv-id').value=id; $('#inv-name').value=it.name; $('#inv-code').value=it.code;
      $('#inv-type').value=it.type||'Other';
      $('#inv-price').value=it.price; $('#inv-stock').value=it.stock;
      $('#inv-threshold').value=it.threshold; $('#inv-img').value=it.img||'';
      return;
    }
    if (btn.hasAttribute('data-del')) {
      const id = btn.getAttribute('data-del');
      let items = load('inventory', []).filter(x=>x.id!==id);
      save('inventory', items); notify('Deleted'); renderApp();
      return;
    }
    if (btn.hasAttribute('data-inc')) {
      const id = btn.getAttribute('data-inc');
      const items = load('inventory', []); const it = items.find(x=>x.id===id); if (!it) return;
      it.stock++; save('inventory', items); renderApp(); return;
    }
    if (btn.hasAttribute('data-dec')) {
      const id = btn.getAttribute('data-dec');
      const items = load('inventory', []); const it = items.find(x=>x.id===id); if (!it) return;
      it.stock=Math.max(0,it.stock-1); save('inventory', items); renderApp(); return;
    }
    if (btn.hasAttribute('data-inc-th')) {
      const id = btn.getAttribute('data-inc-th');
      const items = load('inventory', []); const it = items.find(x=>x.id===id); if (!it) return;
      it.threshold++; save('inventory', items); renderApp(); return;
    }
    if (btn.hasAttribute('data-dec-th')) {
      const id = btn.getAttribute('data-dec-th');
      const items = load('inventory', []); const it = items.find(x=>x.id===id); if (!it) return;
      it.threshold=Math.max(0,it.threshold-1); save('inventory', items); renderApp(); return;
    }
  });
}

function wireProducts(){
  if ($('#addProd')) $('#addProd').onclick = ()=> openModal('m-prod');
  const sec = $('[data-section="products"]'); if (!sec) return;

  // Export CSV
  $('#export-prod')?.addEventListener('click', ()=>{
    const items = load('products', []);
    const headers = [
      { label:'Name', key:'name' },
      { label:'Barcode', key:'barcode' },
      { label:'Price', value: r => Number(r.price||0).toFixed(2) },
      { label:'Type', key:'type' },
      { label:'Ingredients', key:'ingredients' },
      { label:'Instructions', key:'instructions' },
    ];
    download('products.csv', toCSV(headers, items));
  });

  $('#save-prod')?.addEventListener('click', ()=>{
    const items = load('products', []);
    const id = $('#prod-id').value || ('p_'+Date.now());
    const obj = {
      id,
      name: $('#prod-name').value.trim(),
      barcode: $('#prod-barcode').value.trim(),
      price: parseFloat($('#prod-price').value||'0'),
      type: $('#prod-type').value.trim(),
      ingredients: $('#prod-ingredients').value.trim(),
      instructions: $('#prod-instructions').value.trim(),
      img: $('#prod-img').value.trim()
    };
    if (!obj.name) return notify('Name required','warn');
    const i = items.findIndex(x=>x.id===id);
    if (i>=0) items[i]=obj; else items.push(obj);
    save('products', items); closeModal('m-prod'); notify('Saved'); renderApp();
  });

  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    if (btn.hasAttribute('data-edit')) {
      const items = load('products', []); const it = items.find(x=>x.id===id); if (!it) return;
      openModal('m-prod');
      $('#prod-id').value=id; $('#prod-name').value=it.name; $('#prod-barcode').value=it.barcode;
      $('#prod-price').value=it.price; $('#prod-type').value=it.type;
      $('#prod-ingredients').value=it.ingredients; $('#prod-instructions').value=it.instructions; $('#prod-img').value=it.img||'';
    } else {
      let items = load('products', []).filter(x=>x.id!==id);
      save('products', items); notify('Deleted'); renderApp();
    }
  });
}

function wireProductCardClicks(){
  $$('.prod-thumb').forEach(el=>{
    el.style.cursor = 'pointer';
    el.onclick = ()=>{
      const id = el.getAttribute('data-card');
      const items = load('products', []);
      const it = items.find(x=>x.id===id); if (!it) return;
      $('#pc-name').textContent = it.name;
      $('#pc-img').src = it.img || 'icons/icon-512.png';
      $('#pc-barcode').textContent = it.barcode||'-';
      $('#pc-price').textContent = USD(it.price);
      $('#pc-type').textContent = it.type||'-';
      $('#pc-ingredients').textContent = it.ingredients||'-';
      $('#pc-instructions').textContent = it.instructions||'-';
      openModal('m-card');
    };
  });
}

function enableMobileImagePreview(){
  const isPhone = window.matchMedia('(max-width: 740px)').matches;
  if (!isPhone) return;
  $$('.inv-preview, .prod-preview').forEach(el=>{
    el.style.cursor = 'pointer';
    el.addEventListener('click', ()=>{
      const src = el.getAttribute('data-src') || 'icons/icon-512.png';
      openImg(src);
    });
  });
}

function wireCOGS(){
  if ($('#addCOGS')) $('#addCOGS').onclick = ()=> openModal('m-cogs');
  const sec = $('[data-section="cogs"]'); if (!sec) return;

  // Export CSV
  $('#export-cogs')?.addEventListener('click', ()=>{
    const rows = load('cogs', []);
    const headers = [
      { label:'Date', key:'date' },
      { label:'Gross Income', value: r => Number(r.grossIncome||0).toFixed(2) },
      { label:'Produce Cost', value: r => Number(r.produceCost||0).toFixed(2) },
      { label:'Item Cost',    value: r => Number(r.itemCost||0).toFixed(2) },
      { label:'Freight',      value: r => Number(r.freight||0).toFixed(2) },
      { label:'Delivery',     value: r => Number(r.delivery||0).toFixed(2) },
      { label:'Other',        value: r => Number(r.other||0).toFixed(2) },
      { label:'Gross Profit', value: r => (Number(r.grossIncome||0) - (Number(r.produceCost||0)+Number(r.itemCost||0)+Number(r.freight||0)+Number(r.delivery||0)+Number(r.other||0))).toFixed(2) },
    ];
    download('cogs.csv', toCSV(headers, rows));
  });

  $('#save-cogs')?.addEventListener('click', ()=>{
    const rows = load('cogs', []);
    const id = $('#cogs-id').value || ('c_'+Date.now());
    const row = {
      id,
      date: $('#cogs-date').value || new Date().toISOString().slice(0,10),
      grossIncome: parseFloat($('#cogs-grossIncome').value||'0'),
      produceCost: parseFloat($('#cogs-produceCost').value||'0'),
      itemCost: parseFloat($('#cogs-itemCost').value||'0'),
      freight: parseFloat($('#cogs-freight').value||'0'),
      delivery: parseFloat($('#cogs-delivery').value||'0'),
      other: parseFloat($('#cogs-other').value||'0'),
    };
    const i = rows.findIndex(x=>x.id===id);
    if (i>=0) rows[i]=row; else rows.push(row);
    save('cogs', rows); closeModal('m-cogs'); notify('Saved'); renderApp();
  });

  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    if (btn.hasAttribute('data-edit')) {
      const rows = load('cogs', []); const r = rows.find(x=>x.id===id); if (!r) return;
      openModal('m-cogs');
      $('#cogs-id').value=id; $('#cogs-date').value=r.date;
      $('#cogs-grossIncome').value=r.grossIncome; $('#cogs-produceCost').value=r.produceCost;
      $('#cogs-itemCost').value=r.itemCost; $('#cogs-freight').value=r.freight;
      $('#cogs-delivery').value=r.delivery; $('#cogs-other').value=r.other;
    } else {
      let rows = load('cogs', []).filter(x=>x.id!==id);
      save('cogs', rows); notify('Deleted'); renderApp();
    }
  });
}

// Tasks DnD
function setupDnD(){
  const lanes = ['todo','inprogress','done'];
  const allow = {
    'todo':       new Set(['inprogress','done']),
    'inprogress': new Set(['todo','done']),
    'done':       new Set(['todo','inprogress'])
  };

  $$('[data-task]').forEach(card=>{
    card.ondragstart = (e)=> {
      e.dataTransfer.setData('text/plain', card.getAttribute('data-task'));
    };
  });

  lanes.forEach(k=>{
    const laneGrid = $('#lane-'+k);
    const parentCard = laneGrid?.closest('.lane-row');

    const over = (e)=>{
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/plain');
      if (!id) return parentCard?.classList.remove('drop');
      const items = load('tasks', []);
      const t = items.find(x=>x.id===id); if (!t) return parentCard?.classList.remove('drop');
      if (allow[t.status].has(k)) parentCard?.classList.add('drop'); else parentCard?.classList.remove('drop');
    };
    const leave = ()=> parentCard?.classList.remove('drop');
    const drop = (e)=>{
      e.preventDefault();
      parentCard?.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const items = load('tasks', []);
      const t = items.find(x=>x.id===id); if (!t) return;
      if (!allow[t.status].has(k)) { notify('Move not allowed','warn'); return; }
      t.status = k; save('tasks', items); renderApp();
    };

    if (laneGrid){
      laneGrid.ondragover  = over;
      laneGrid.ondragenter = (e)=> e.preventDefault();
      laneGrid.ondragleave = leave;
      laneGrid.ondrop      = drop;
    }
  });
}

function wireTasks(){
  const root = $('[data-section="tasks"]'); if (!root) return;
  if ($('#addTask')) $('#addTask').onclick = ()=> openModal('m-task');

  $('#save-task')?.addEventListener('click', ()=>{
    const items = load('tasks', []);
    const id = $('#task-id').value || ('t_'+Date.now());
    const obj = { id, title: $('#task-title').value.trim(), status: $('#task-status').value };
    const i = items.findIndex(x=>x.id===id);
    if (i>=0) items[i]=obj; else items.push(obj);
    save('tasks',items); closeModal('m-task'); notify('Saved'); renderApp();
  });

  root.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    if (btn.hasAttribute('data-edit')) {
      const items = load('tasks', []); const t = items.find(x=>x.id===id); if (!t) return;
      openModal('m-task'); $('#task-id').value = t.id; $('#task-title').value = t.title; $('#task-status').value = t.status;
    } else {
      let items = load('tasks', []).filter(x=>x.id!==id);
      save('tasks', items); notify('Deleted'); renderApp();
    }
  });
}

function wireUsers(){
  if (!canManage()) return;
  if ($('#addUser')) $('#addUser').onclick = ()=> openModal('m-user');

  $('#save-user')?.addEventListener('click', ()=>{
    const users = load('users', []);
    const email = $('#user-email').value.trim().toLowerCase();
    if (!email) return notify('Email required','warn');
    const obj = {
      name: $('#user-name').value.trim() || email.split('@')[0],
      email,
      username: $('#user-username').value.trim() || email.split('@')[0],
      role: $('#user-role').value,
      img: $('#user-img').value.trim(),
      contact:'', password:''
    };
    const i = users.findIndex(x=>x.email.toLowerCase()===email);
    if (i>=0) users[i]=obj; else users.push(obj);
    save('users', users); closeModal('m-user'); notify('Saved'); renderApp();
  });

  const sec = $('[data-section="users"]'); if (!sec) return;
  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const email = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!email) return;
    if (btn.hasAttribute('data-edit')) {
      const users = load('users', []); const u = users.find(x=>x.email===email); if (!u) return;
      openModal('m-user');
      $('#user-name').value=u.name; $('#user-email').value=u.email;
      $('#user-username').value=u.username; $('#user-role').value=u.role;
      $('#user-img').value=u.img||'';
    } else {
      let users = load('users', []).filter(x=>x.email!==email);
      save('users', users); notify('Deleted'); renderApp();
    }
  });
}

function wireSettings(){
  // Theme instant-apply
  const mode = $('#theme-mode'); const size = $('#theme-size');
  if (mode && size){
    const apply = ()=>{
      const t = { mode: mode.value, size: size.value };
      save('_theme2', t); applyTheme(); renderApp();
    };
    mode.onchange = apply;
    size.onchange = apply;
  }

  // Cloud controls
  const toggle = $('#cloud-toggle');
  const syncNow = $('#cloud-sync-now');

  if (toggle){
    toggle.addEventListener('change', async (e)=>{
      const val = e.target.value;
      try {
        if (val === 'on'){
          if (!auth.currentUser){ notify('Sign in first.','warn'); toggle.value='off'; return; }
          await firebase.database().goOnline();
          await cloud.enable();
          notify('Cloud Sync ON');
        } else {
          cloud.disable();
          await firebase.database().goOffline();
          notify('Cloud Sync OFF');
        }
      } catch(err){
        notify(err?.message || 'Could not change sync','danger');
        toggle.value = cloud.isOn() ? 'on' : 'off';
      }
    });
  }

  if (syncNow){
    syncNow.addEventListener('click', async ()=>{
      try{
        if (!auth.currentUser){ notify('Sign in first.','warn'); return; }
        if (!cloud.isOn()){ notify('Turn Cloud Sync ON first in Settings.','warn'); return; }
        if (!navigator.onLine){ notify('You appear to be offline. Check your connection.','warn'); return; }
        await firebase.database().goOnline();
        await cloud.pushAll();
        notify('Synced');
      }catch(e){
        notify((e && e.message) || 'Sync failed','danger');
      }
    });
  }
}

// --- Search index + utils
function buildSearchIndex(){
  const posts = load('posts', []);
  const inv   = load('inventory', []);
  const prods = load('products', []);
  const cogs  = load('cogs', []);
  const users = load('users', []);

  const pages = [
    { id:'policy',  label:'Policy',  section:'Pages', route:'policy' },
    { id:'license', label:'License', section:'Pages', route:'license' },
    { id:'setup',   label:'Setup Guide', section:'Pages', route:'setup' },
    { id:'contact', label:'Contact', section:'Pages', route:'contact' },
    { id:'guide',   label:'User Guide', section:'Pages', route:'guide' },
  ];

  const ix = [];
  posts.forEach(p => ix.push({ id:p.id, label:p.title, section:'Posts', route:'dashboard', text:`${p.title} ${p.body}` }));
  inv.forEach(i => ix.push({ id:i.id, label:i.name, section:'Inventory', route:'inventory', text:`${i.name} ${i.code} ${i.type}` }));
  prods.forEach(p => ix.push({ id:p.id, label:p.name, section:'Products', route:'products', text:`${p.name} ${p.barcode} ${p.type} ${p.ingredients}` }));
  cogs.forEach(r => ix.push({ id:r.id, label:r.date, section:'COGS', route:'cogs', text:`${r.date} ${r.grossIncome} ${r.produceCost} ${r.itemCost} ${r.freight} ${r.delivery} ${r.other}` }));
  users.forEach(u => ix.push({ id:u.email, label:u.name, section:'Users', route:'settings', text:`${u.name} ${u.email} ${u.role}` }));
  pages.forEach(p => ix.push(p));
  return ix;
}
function searchAll(index, q){
  const term = q.toLowerCase();
  return index
    .map(item => {
      const labelHit = (item.label||'').toLowerCase().includes(term) ? 2 : 0;
      const textHit  = (item.text ||'').toLowerCase().includes(term) ? 1 : 0;
      return { item, score: labelHit + textHit };
    })
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score)
    .map(x => x.item);
}
function scrollToRow(id){ const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior:'smooth', block:'center' }); }

// Initial render
if (session) renderApp();
if (!session) renderLogin();

// Expose
window._inventory = { go, load, save, cloud };