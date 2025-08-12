{/* <div class="logo">🍣</div> */}
// Full app.js (RTDB) — Part 1/6
// <!-- app.js — Part 1/6: Firebase + helpers + seed + theme + cloud (RTDB) -->
{/* // --- Firebase (Auth + Realtime Database) ------------------------------------- */}
// const firebaseConfig = {
//   apiKey: "AIzaSyBY52zMMQqsvssukui3TfQnMigWoOzeKGk",
//   // authDomain: "sushi-pos.firebaseapp.com",
//   authDomain: "you-6bddf.firebaseapp.com",
//   // projectId: "sushi-pos",
//   projectId: "you-6bddf",
//   // databaseURL: "https://sushi-pos-default-rtdb.firebaseio.com/",
//   databaseURL: "https://you-6bddf-default-rtdb.firebaseio.com",
//   // storageBucket: "sushi-pos.firebasestorage.app",
//   storageBucket: "you-6bddf.appspot.com",
//   messagingSenderId: "909622476838",
//   appId: "1:909622476838:web:1a1fb221a6a79fcaf4a6e7",
//   measurementId: "G-M8Q8EJ4T7Q"
// };
// firebase.initializeApp(firebaseConfig);

// Part 1/6 — Firebase + Utils + Cloud Sync (RTDB)
// --- Firebase (Auth + RTDB) --------------------------------------------------
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
const rtdb = firebase.database();

// --- DOM helpers --------------------------------------------------------------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const notify = (msg, type='ok') => {
  const n = $('#notification'); if (!n) return;
  n.textContent = msg; n.className = `notification show ${type}`;
  setTimeout(()=> n.className='notification', 2200);
};
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); if (cloud.isOn()) cloud.saveKV(key, val).catch(()=>{}); }
function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }

// CSV helpers
function toCSV(rows){
  if (!rows || !rows.length) return '';
  const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const esc = v => {
    const s = (v==null ? '' : String(v));
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const head = cols.join(',');
  const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}
function download(filename, text){
  const blob = new Blob([text], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display='none';
  document.body.appendChild(a); a.click();
  URL.revokeObjectURL(url); a.remove();
}

// --- Globals & Prefill --------------------------------------------------------
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];
let session = load('session', null);
let currentRoute = load('_route', 'home');    // show Home first after login
let searchQuery = load('_searchQ', '');

// Prefill local demo data once
(function seedOnFirstRun(){
  if (load('_seeded', false)) return;
  const now = Date.now();
  const users = [
    { name:'Admin', username:'admin', email:'admin@sushi.com', contact:'', role:'admin', password:'', img:'' },
    { name:'Manager', username:'manager', email:'minmaung0307@gmail.com', contact:'', role:'manager', password:'', img:'' },
    { name:'Cashier One', username:'cashier1', email:'cashier@sushi.com', contact:'', role:'user', password:'', img:'' },
  ];
  const inventory = [
    { id:'inv1', img:'', name:'Nori Sheets', code:'NOR-100', type:'Dry',   price:3.00, stock:80, threshold:30 },
    { id:'inv2', img:'', name:'Sushi Rice',  code:'RIC-200', type:'Dry',   price:1.50, stock:24, threshold:20 },
    { id:'inv3', img:'', name:'Fresh Salmon',code:'SAL-300', type:'Raw',   price:7.80, stock:10, threshold:12 },
  ];
  const products = [
    { id:'p1', img:'', name:'Salmon Nigiri', barcode:'11100001', price:5.99, type:'Nigiri', ingredients:'Rice, Salmon', instructions:'Brush with nikiri.', card:true },
    { id:'p2', img:'', name:'California Roll', barcode:'11100002', price:7.49, type:'Roll', ingredients:'Rice, Nori, Crab, Avocado', instructions:'8 pcs.', card:true },
  ];
  const posts = [
    { id:'post1', title:'Welcome to Inventory', body:'Create products, track stock, sell faster.', img:'', createdAt: now }
  ];
  const tasks = [
    { id:'t1', title:'Prep Salmon', status:'todo' },
    { id:'t2', title:'Cook Rice', status:'inprogress' },
    { id:'t3', title:'Sanitize Station', status:'done' },
  ];
  const cogs = [
    { id:'c1', date:'2025-08-01', grossIncome: 1200, produceCost: 280, itemCost: 180, freight: 45, delivery: 30, other: 20 },
    { id:'c2', date:'2025-08-02', grossIncome:  900, produceCost: 220, itemCost: 140, freight: 30, delivery: 25, other: 10 }
  ];
  save('users', users); save('inventory', inventory); save('products', products);
  save('posts', posts); save('tasks', tasks); save('cogs', cogs);
  save('_seeded', true);
})();

// --- Theme --------------------------------------------------------------------
const THEME_MODES = [
  { key:'light', name:'Light' },
  { key:'dark',  name:'Dark'  },
  { key:'aqua',  name:'Aqua'  } // default (dark aqua)
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

// --- Cloud Sync (RTDB) --------------------------------------------------------
const CLOUD_KEYS = ['inventory','products','posts','tasks','cogs','users','_theme2'];
const cloud = (function(){
  let unsubscribers = [];
  function uid(){ return auth.currentUser?.uid; }
  function on(){ return !!load('_cloudOn', false); }
  function setOn(v){ save('_cloudOn', !!v); }

  function pathFor(key){
    // RTDB path: /tenants/{uid}/kv/{key}
    const id = uid(); if (!id) throw new Error('No user');
    return rtdb.ref(`tenants/${id}/kv/${key}`);
  }

  async function saveKV(key, val){
    if (!on() || !uid()) return;
    await pathFor(key).set({ key, val, updatedAt: firebase.database.ServerValue.TIMESTAMP });
  }

  async function pullAllOnce(){
    if (!uid()) return;
    const snap = await rtdb.ref(`tenants/${uid()}/kv`).once('value');
    const data = snap.val() || {};
    Object.values(data).forEach(entry=>{
      if (entry && entry.key && ('val' in entry)) {
        localStorage.setItem(entry.key, JSON.stringify(entry.val));
      }
    });
  }

  function subscribeAll(){
    if (!uid()) return;
    unsubscribeAll();
    CLOUD_KEYS.forEach(key=>{
      const ref = pathFor(key);
      const cb = ref.on('value', (snap)=>{
        const data = snap.val();
        if (!data || !('val' in data)) return;
        const current = load(key, null);
        const incoming = data.val;
        if (JSON.stringify(current) !== JSON.stringify(incoming)){
          localStorage.setItem(key, JSON.stringify(incoming));
          if (key === '_theme2') applyTheme();
          renderApp();
        }
      });
      unsubscribers.push(()=> ref.off('value', cb));
    });
  }

  function unsubscribeAll(){
    unsubscribers.forEach(fn=>{ try{ fn(); }catch{} });
    unsubscribers = [];
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
    await pushAll();
    subscribeAll();
  }
  function disable(){ setOn(false); unsubscribeAll(); }

  return { isOn:on, enable, disable, saveKV, pullAllOnce, subscribeAll, pushAll };
})();

// Part 2/6 — Router, Idle, Auth, Login
// --- Router -------------------------------------------------------------------
function go(route){ currentRoute = route; save('_route', route); renderApp(); }

// --- Idle auto-logout (10 min) -----------------------------------------------
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

// --- Auth state ---------------------------------------------------------------
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
    currentRoute = load('_route','home'); renderApp();
  } else {
    session = null; save('session', null);
    if (idleTimer) clearTimeout(idleTimer);
    renderLogin();
  }
});

// --- Login / Logout -----------------------------------------------------------
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
    const pass = $('#li-pass').value;
    if (!email || !pass) { notify('Enter email & password','warn'); return; }
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      notify('Welcome!');
    } catch (e) { notify(e.message || 'Login failed','danger'); }
  };
}
async function doLogout(){ cloud.disable(); await auth.signOut(); notify('Signed out'); }

// Part 3/6 — Sidebar, Topbar, Views (incl. Dashboard & Export buttons)
// --- Sidebar + Search ---------------------------------------------------------
function renderSidebar(active='home'){
  const links = [
    { route:'home',      icon:'ri-home-5-line', label:'Home' },
    { route:'dashboard', icon:'ri-dashboard-line', label:'Dashboard' },
    { route:'inventory', icon:'ri-archive-2-line', label:'Inventory' },
    { route:'products',  icon:'ri-store-2-line',   label:'Products' },
    { route:'cogs',      icon:'ri-money-dollar-circle-line', label:'COGS' },
    { route:'tasks',     icon:'ri-list-check-2',   label:'Tasks' },
    { route:'settings',  icon:'ri-settings-3-line',label:'Settings' }
  ];
  const pages = [
    { route:'policy',  icon:'ri-shield-check-line', label:'Policy' },
    { route:'license', icon:'ri-copyright-line',    label:'License' },
    { route:'setup',   icon:'ri-guide-line',        label:'Setup Guide' },
    { route:'contact', icon:'ri-customer-service-2-line', label:'Contact' },
    { route:'guide',   icon:'ri-video-line',        label:'User Guide' },
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
function hookSidebarInteractions(){
  $$('.sidebar .item').forEach(a => {
    a.onclick = ()=> { const r = a.getAttribute('data-route'); if (r) { go(r); closeSidebar(); } };
    a.style.cursor = 'pointer';
  });

  const input = $('#globalSearch');
  const results = $('#searchResults');
  const indexData = buildSearchIndex();
  let searchTimer;

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
        row.style.cursor = 'pointer';
      });
    }, 120);
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('active');
    }
  });
}

// --- Topbar / Burger ----------------------------------------------------------
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
function openSidebar(){ $('#sidebar')?.classList.add('open'); $('#backdrop')?.classList.add('active'); }
function closeSidebar(){ $('#sidebar')?.classList.remove('open'); $('#backdrop')?.classList.remove('active'); }

// --- Views --------------------------------------------------------------------
const USD = x => `$${Number(x||0).toFixed(2)}`;

// Home (after login)
function viewHome(){
  const quick = [
    {label:'Inventory', route:'inventory', icon:'ri-archive-2-line'},
    {label:'Products',  route:'products',  icon:'ri-store-2-line'},
    {label:'COGS',      route:'cogs',      icon:'ri-money-dollar-circle-line'},
    {label:'Tasks',     route:'tasks',     icon:'ri-list-check-2'}
  ];
  return `
    <div class="card">
      <div class="card-body">
        <h3 style="margin-top:0">Welcome 👋</h3>
        <p style="color:var(--muted)">Pick a section to get started.</p>
        <div class="grid cols-4 auto">
          ${quick.map(q=>`<div class="card tile" data-go="${q.route}">
              <div class="card-body" style="display:flex;gap:10px;align-items:center">
                <i class="${q.icon}"></i><div><div>${q.label}</div></div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// Search page
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
              <div class="card">
                <div class="card-body" style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-weight:700">${r.label}</div>
                    <div style="color:var(--muted);font-size:12px">${r.section}</div>
                  </div>
                  <button class="btn" data-go="${r.route}" data-id="${r.id||''}">Open</button>
                </div>
              </div>`).join('')}
          </div>` : `<p style="color:var(--muted)">No results.</p>`}
      </div>
    </div>
  `;
}

// Dashboard (low/critical, tasks snapshot, COGS compare, posts)
function viewDashboard(){
  const posts = load('posts', []);
  const inv = load('inventory', []);
  const prods = load('products', []);
  const users = load('users', []);
  const tasks = load('tasks', []);

  // Low/Critical
  let low = 0, critical = 0;
  inv.forEach(i=>{
    if (i.threshold > 0 && i.stock <= i.threshold){
      if (i.stock <= Math.max(1, Math.floor(i.threshold * 0.6))) critical++;
      else low++;
    }
  });

  // Task counts
  const tc = {
    todo: tasks.filter(t=>t.status==='todo').length,
    inprogress: tasks.filter(t=>t.status==='inprogress').length,
    done: tasks.filter(t=>t.status==='done').length,
  };

  // COGS comparison
  const rows = load('cogs', []);
  const sumWeek = (startISO)=>{
    const s = new Date(startISO); const e = new Date(s); e.setDate(s.getDate()+6);
    return rows.filter(r=>{
      const d = new Date(r.date);
      return d >= s && d <= e;
    }).reduce((a,r)=>a+(Number(r.grossIncome)||0),0);
  };
  const now = new Date(); const day = (now.getDay()+6)%7;
  const currMon = new Date(now); currMon.setDate(now.getDate()-day);
  const prevMon = new Date(currMon); prevMon.setDate(currMon.getDate()-7);
  const currentWeekTotal = sumWeek(currMon.toISOString().slice(0,10));
  const prevWeekTotal = sumWeek(prevMon.toISOString().slice(0,10));
  const baselineTotal = sumWeek('2024-08-01');

  const healthStrip = `
    <div class="grid cols-4 auto">
      <div class="card tile" data-go="inventory"><div>Total Items</div><h2>${inv.length}</h2></div>
      <div class="card tile" data-go="products"><div>Products</div><h2>${prods.length}</h2></div>
      <div class="card tile" data-go="settings"><div>Users</div><h2>${users.length}</h2></div>
      <div class="card tile" data-go="tasks"><div>Tasks</div><h2>${tasks.length}</h2></div>
    </div>
    <div class="grid" style="margin-top:12px">
      <div class="card">
        <div class="card-body" style="display:flex; gap:16px; align-items:center; flex-wrap:wrap">
          <div><strong>Inventory Health:</strong></div>
          <div class="badge badge-warn">Low: ${low}</div>
          <div class="badge badge-danger">Critical: ${critical}</div>
          <div style="flex:1"></div>
          <button class="btn ghost" data-go="inventory"><i class="ri-archive-2-line"></i> Review</button>
        </div>
      </div>
    </div>
  `;

  const tasksSnapshot = `
    <div class="grid cols-3 auto" style="margin-top:12px">
      <div class="card"><div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div><strong>To do</strong></div><div class="chip chip-todo">${tc.todo}</div></div>
        <div class="mini-list">
          ${tasks.filter(t=>t.status==='todo').slice(0,5).map(t=>`<div class="mini-item">${t.title}</div>`).join('') || '<div class="mini-empty">No tasks</div>'}
        </div>
      </div></div>
      <div class="card"><div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div><strong>In progress</strong></div><div class="chip chip-prog">${tc.inprogress}</div></div>
        <div class="mini-list">
          ${tasks.filter(t=>t.status==='inprogress').slice(0,5).map(t=>`<div class="mini-item">${t.title}</div>`).join('') || '<div class="mini-empty">No tasks</div>'}
        </div>
      </div></div>
      <div class="card"><div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div><strong>Done</strong></div><div class="chip chip-done">${tc.done}</div></div>
        <div class="mini-list">
          ${tasks.filter(t=>t.status==='done').slice(0,5).map(t=>`<div class="mini-item">${t.title}</div>`).join('') || '<div class="mini-empty">No tasks</div>'}
        </div>
      </div></div>
    </div>
  `;

  const cogsCompare = `
    <div class="card" style="margin-top:12px">
      <div class="card-body">
        <div style="display:flex; gap:18px; align-items:center; flex-wrap:wrap">
          <div><strong>Sales (Gross)</strong></div>
          <div class="pill">Current week: <strong>${USD(currentWeekTotal)}</strong></div>
          <div class="pill">Prev week: <strong>${USD(prevWeekTotal)}</strong></div>
          ${baselineTotal>0 ? `<div class="pill">Baseline (2024-08-01 wk): <strong>${USD(baselineTotal)}</strong></div>`:''}
          <div style="flex:1"></div>
          <button class="btn ghost" data-go="cogs"><i class="ri-money-dollar-circle-line"></i> Open COGS</button>
        </div>
      </div>
    </div>
  `;

  const postsBlock = `
    <div class="card" style="margin-top:16px">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Posts</h3>
          ${canCreate() ? `<button class="btn" id="addPost"><i class="ri-add-line"></i> New Post</button>` : ''}
        </div>
        <div class="grid" data-section="posts">
          ${posts.map(p => `
            <div class="card" id="${p.id}">
              <div class="card-body">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div><strong>${p.title}</strong><div style="color:var(--muted);font-size:12px">${new Date(p.createdAt).toLocaleString()}</div></div>
                  <div>
                    <button class="btn ghost" data-edit="${p.id}"><i class="ri-edit-line"></i></button>
                    <button class="btn danger" data-del="${p.id}"><i class="ri-delete-bin-6-line"></i></button>
                  </div>
                </div>
                ${p.img?`<img src="${p.img}" style="width:100%;border-radius:12px;margin-top:10px;border:1px solid var(--card-border)"/>`:''}
                <p style="margin-top:8px">${p.body}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;
  return healthStrip + tasksSnapshot + cogsCompare + postsBlock;
}

// Inventory (with Export)
function viewInventory(){
  const items = load('inventory', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Inventory</h3>
          <div style="display:flex; gap:8px">
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
                      ${it.img?`<img class="thumb inv-preview" data-src="${it.img}" alt=""/>`:`<div class="thumb inv-preview" data-src="icons/icon-512.png" style="display:grid;place-items:center">🍙</div>`}
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

// Products (with Export)
function viewProducts(){
  const items = load('products', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Products</h3>
          <div style="display:flex; gap:8px">
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
                      ${it.img?`<img class="thumb prod-thumb prod-preview" data-card="${it.id}" data-src="${it.img}" alt=""/>`:`<div class="thumb prod-thumb prod-preview" data-card="${it.id}" data-src="icons/icon-512.png" style="display:grid;place-items:center;cursor:pointer">🍤</div>`}
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

// COGS (with Export)
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
          <div style="display:flex; gap:8px">
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

// Tasks lanes
function viewTasks(){
  const items = load('tasks', []);
  const lane = (key, label)=>`
    <div class="card lane-row" data-lane="${key}">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">${label}</h3>
          ${key==='todo' && canCreate()? `<button class="btn" id="addTask"><i class="ri-add-line"></i> Add Task</button>`:''}
        </div>
        <div class="grid" id="lane-${key}">
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
      ${lane('todo','To do')}
      ${lane('inprogress','In progress')}
      ${lane('done','Done')}
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
          <p style="color:var(--muted)">Keep your data in Firebase to use it on any device. Local-first; works offline.</p>
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

    ${userModal()}
  `;
}

// Part 4/6 — Static pages + Modals
// Static pages + Contact form (iframes supported)
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

// --- Permission helpers -------------------------------------------------------
function canManage(){ return session && (session.role==='admin' || session.role==='manager'); }
function canCreate(){ return session && (session.role==='admin' || session.role==='manager'); }

// --- Modals -------------------------------------------------------------------
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

// Image preview modal (phones)
function imgPreviewModal(){
  return `
  <div class="modal-backdrop" id="mb-img"></div>
  <div class="modal img-modal" id="m-img">
    <div class="dialog">
      <div class="head"><strong>Preview</strong><button class="btn ghost" data-close="m-img">Close</button></div>
      <div class="body">
        <div class="imgbox"><img id="preview-img" src="" alt="Preview"/></div>
      </div>
    </div>
  </div>`;
}
function openImg(src){
  const img = $('#preview-img'); if (!img) return;
  img.src = src || 'icons/icon-512.png';
  openModal('m-img');
}

// Part 5/6 — Render + Wiring + Theme (immediate) + DnD
// --- Render App ---------------------------------------------------------------
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

  // Dashboard/Home tiles click-through
  $$('.tile').forEach(t=>{ t.onclick = ()=> { const r=t.getAttribute('data-go'); if (r) go(r); }; t.style.cursor='pointer'; });

  // Search "Open" buttons in main pane
  $$('#main [data-go]').forEach(btn=>{
    btn.onclick = ()=>{
      const r = btn.getAttribute('data-go'); const id = btn.getAttribute('data-id');
      go(r);
      if (id) setTimeout(()=> scrollToRow(id), 80);
    };
  });

  // Wire sections
  wirePosts?.();
  wireInventory?.();
  wireProducts?.();
  wireCOGS?.();
  wireTasks?.();
  wireUsers?.();
  wireTheme?.();
  wireProductCardClicks?.();
  setupDnD?.();

  // Contact form
  if (currentRoute==='contact') {
    $('#ct-send')?.addEventListener('click', ()=>{
      const name = $('#ct-name').value.trim();
      const email = $('#ct-email').value.trim();
      const msg = $('#ct-msg').value.trim();
      if (!name || !email || !msg) return notify('Please fill all fields','warn');
      const list = load('contact_msgs', []);
      list.push({ id: 'm_'+Date.now(), name, email, msg, at: Date.now() });
      save('contact_msgs', list);
      $('#ct-name').value=''; $('#ct-email').value=''; $('#ct-msg').value='';
      notify('Message sent! (stored locally)');
    });
  }

  // Close modal buttons
  $$('[data-close]').forEach(b=> b.onclick = ()=> closeModal(b.getAttribute('data-close')));

  // Mobile image preview
  enableMobileImagePreview?.();

  // Cloud controls
  if (currentRoute==='settings'){
    $('#cloud-toggle')?.addEventListener('change', async (e)=>{
      const val = e.target.value;
      try {
        if (val === 'on'){ await cloud.enable(); notify('Cloud Sync ON'); }
        else { cloud.disable(); notify('Cloud Sync OFF'); }
      } catch(err){ notify(err.message || 'Could not enable sync','danger'); e.target.value = 'off'; }
    });
    $('#cloud-sync-now')?.addEventListener('click', async ()=>{
      try { await cloud.pushAll(); notify('Synced'); } catch { notify('Sync failed','danger'); }
    });
  }
}

function openModal(id){ $('#'+id)?.classList.add('active'); $('#mb-'+id.split('-')[1])?.classList.add('active'); }
function closeModal(id){ $('#'+id)?.classList.remove('active'); $('#mb-'+id.split('-')[1])?.classList.remove('active'); }

// --- Section wiring -----------------------------------------------------------
// Posts
function wirePosts(){
  if ($('#addPost')) $('#addPost').onclick = ()=> openModal('m-post');
  const sec = $('[data-section="posts"]'); if (!sec) return;

  $('#save-post')?.addEventListener('click', ()=>{
    const posts = load('posts', []);
    const id = $('#post-id').value || ('post_'+Date.now());
    const obj = {
      id,
      title: $('#post-title').value.trim(),
      body: $('#post-body').value.trim(),
      img: $('#post-img').value.trim(),
      createdAt: Date.now()
    };
    if (!obj.title) return notify('Title required','warn');
    const i = posts.findIndex(x=>x.id===id);
    if (i>=0) posts[i]=obj; else posts.unshift(obj);
    save('posts', posts); closeModal('m-post'); notify('Saved'); renderApp();
  });

  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    if (btn.hasAttribute('data-edit')) {
      const posts = load('posts', []);
      const p = posts.find(x=>x.id===id); if (!p) return;
      openModal('m-post');
      $('#post-id').value = p.id;
      $('#post-title').value = p.title;
      $('#post-body').value = p.body;
      $('#post-img').value = p.img||'';
    } else {
      let posts = load('posts', []).filter(x=>x.id!==id);
      save('posts', posts); notify('Deleted'); renderApp();
    }
  });
}

// Inventory
function wireInventory(){
  if ($('#addInv')) $('#addInv').onclick = ()=> openModal('m-inv');
  const sec = $('[data-section="inventory"]'); if (!sec) return;

  // Export
  $('#export-inv')?.addEventListener('click', ()=>{
    const rows = load('inventory', []);
    download(`inventory-${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows));
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
    const t = e.target;
    const btn = t.closest('button');
    if (btn && btn.hasAttribute('data-edit')) {
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
    if (btn && btn.hasAttribute('data-del')) {
      const id = btn.getAttribute('data-del');
      let items = load('inventory', []).filter(x=>x.id!==id);
      save('inventory', items); notify('Deleted'); renderApp();
      return;
    }
    if (btn && btn.hasAttribute('data-inc')) {
      const id = btn.getAttribute('data-inc');
      const items = load('inventory', []); const it = items.find(x=>x.id===id); if (!it) return;
      it.stock++; save('inventory', items); renderApp(); return;
    }
    if (btn && btn.hasAttribute('data-dec')) {
      const id = btn.getAttribute('data-dec');
      const items = load('inventory', []); const it = items.find(x=>x.id===id); if (!it) return;
      it.stock=Math.max(0,it.stock-1); save('inventory', items); renderApp(); return;
    }
    if (btn && btn.hasAttribute('data-inc-th')) {
      const id = btn.getAttribute('data-inc-th');
      const items = load('inventory', []); const it = items.find(x=>x.id===id); if (!it) return;
      it.threshold++; save('inventory', items); renderApp(); return;
    }
    if (btn && btn.hasAttribute('data-dec-th')) {
      const id = btn.getAttribute('data-dec-th');
      const items = load('inventory', []); const it = items.find(x=>x.id===id); if (!it) return;
      it.threshold=Math.max(0,it.threshold-1); save('inventory', items); renderApp(); return;
    }
  });
}

// Products
function wireProducts(){
  if ($('#addProd')) $('#addProd').onclick = ()=> openModal('m-prod');
  const sec = $('[data-section="products"]'); if (!sec) return;

  // Export
  $('#export-prod')?.addEventListener('click', ()=>{
    const rows = load('products', []);
    download(`products-${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows));
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
    const btn = e.target.closest('button'); if (btn) {
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
    }
  });
}

// Product card modal trigger
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

// Mobile image preview
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

// COGS
function wireCOGS(){
  if ($('#addCOGS')) $('#addCOGS').onclick = ()=> openModal('m-cogs');
  const sec = $('[data-section="cogs"]'); if (!sec) return;

  // Export
  $('#export-cogs')?.addEventListener('click', ()=>{
    const rows = load('cogs', []);
    download(`cogs-${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows));
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

// Tasks DnD with empty-lane dropping
function setupDnD(){
  const lanes = ['todo','inprogress','done'];
  const allow = {
    'todo':       new Set(['inprogress','done']),
    'inprogress': new Set(['todo','done']),
    'done':       new Set(['todo','inprogress'])
  };

  lanes.forEach(k=>{
    const lane = $('#lane-'+k); if (!lane) return;
    const parentCard = lane.closest('.lane-row');

    lane.ondragover = (e)=>{
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/plain');
      if (!id) { parentCard?.classList.remove('drop'); return; }
      const items = load('tasks', []); const t = items.find(x=>x.id===id);
      if (!t) return;
      if (allow[t.status].has(k)) parentCard?.classList.add('drop');
      else parentCard?.classList.remove('drop');
    };
    lane.ondragenter = (e)=>{ e.preventDefault(); };
    lane.ondragleave = ()=> { parentCard?.classList.remove('drop'); };
    lane.ondrop = (e)=>{
      e.preventDefault();
      parentCard?.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const items = load('tasks', []);
      const t = items.find(x=>x.id===id); if (!t) return;
      if (!allow[t.status].has(k)) { notify('Move not allowed','warn'); return; }
      t.status = k; save('tasks', items); renderApp();
    };
  });

  $$('[data-task]').forEach(card=>{
    card.ondragstart = (e)=> { e.dataTransfer.setData('text/plain', card.getAttribute('data-task')); };
  });
}

// Users
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

// Theme dropdowns (IMMEDIATE apply; no full re-render)
function wireTheme(){
  const mode = $('#theme-mode'); const size = $('#theme-size');
  if (!mode || !size) return;
  const apply = ()=>{
    const t = { mode: mode.value, size: size.value };
    save('_theme2', t);
    applyTheme(); // instant via CSS vars
  };
  mode.onchange = apply;
  size.onchange = apply;
}

// Part 6/6 — Search, Scroll, Initial render
// --- Search helpers & jump ----------------------------------------------------
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

function scrollToRow(id){
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
}

// Initial render
if (session) renderApp();
if (!session) renderLogin();

// Expose for debugging
window._inventory = { go, load, save };