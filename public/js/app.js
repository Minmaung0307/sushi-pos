// Part A — Firebase init, low-level helpers, theme, Cloud Sync (RTDB), seed, auth, router/idle
/* =========================
   Part A — Core bootstrap
   ========================= */

// --- Firebase (v8) -----------------------------------------------------------
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

// --- Tiny DOM helpers & notifier --------------------------------------------
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const notify = (msg, type='ok')=>{
  const n = $('#notification'); if (!n) return;
  n.textContent = msg; n.className = `notification show ${type}`;
  setTimeout(()=>{ n.className='notification'; }, 2400);
};

// --- LocalStorage raw helpers (no Cloud dependency) --------------------------
const _lsGet = (k, f)=>{ try{ const v=localStorage.getItem(k); return v==null?f:JSON.parse(v);}catch{ return f; } };
const _lsSet = (k, v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };

// --- Theme definitions --------------------------------------------------------
const THEME_MODES = [
  { key:'light', name:'Light' },
  { key:'dark',  name:'Dark'  },
  { key:'aqua',  name:'Aqua'  },
];
const THEME_SIZES = [
  { key:'small',  pct: 90, label:'Small' },
  { key:'medium', pct:100, label:'Medium' },
  { key:'large',  pct:112, label:'Large' }
];
function getTheme(){ return _lsGet('_theme2', { mode:'aqua', size:'medium' }); }
function applyTheme(){
  const t = getTheme();
  const size = THEME_SIZES.find(s=>s.key===t.size)?.pct ?? 100;
  document.documentElement.setAttribute('data-theme', t.mode==='light' ? 'light' : (t.mode==='dark' ? 'dark' : ''));
  document.documentElement.style.setProperty('--font-scale', size + '%');
}
applyTheme();

// --- Cloud Sync (Realtime Database) ------------------------------------------
const CLOUD_KEYS = ['inventory','products','posts','tasks','cogs','users','_theme2'];
const cloud = (function(){
  let liveRefs = [];
  const on      = ()=> !!_lsGet('_cloudOn', false);
  const setOn   = v => _lsSet('_cloudOn', !!v);
  const uid     = ()=> auth.currentUser?.uid;
  const pathFor = key => db.ref(`tenants/${uid()}/kv/${key}`);

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
      if (row && row.key && 'val' in row) _lsSet(row.key, row.val);
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
        const curr = _lsGet(key, null);
        if (JSON.stringify(curr) !== JSON.stringify(data.val)){
          _lsSet(key, data.val);
          if (key==='_theme2') applyTheme();
          renderApp();
        }
      });
      liveRefs.push({ ref, handler });
    });
  }
  function unsubscribeAll(){ liveRefs.forEach(({ref})=>{ try{ref.off();}catch{} }); liveRefs=[]; }
  async function pushAll(){
    if (!uid()) return;
    for (const k of CLOUD_KEYS){
      const v = _lsGet(k, null);
      if (v !== null && v !== undefined) await saveKV(k, v);
    }
  }
  async function enable(){
    if (!uid()) throw new Error('Sign in first.');
    setOn(true);
    await firebase.database().goOnline();
    await pullAllOnce();
    await pushAll();
    subscribeAll();
  }
  function disable(){ setOn(false); unsubscribeAll(); }

  return { isOn:on, enable, disable, saveKV, pullAllOnce, subscribeAll, pushAll };
})();

// --- Friendly save/load wrappers (use Cloud if ON) ---------------------------
function load(k, f){ return _lsGet(k, f); }
function save(k, v){
  _lsSet(k, v);
  try{ if (cloud.isOn() && auth.currentUser) cloud.saveKV(k, v); }catch{}
}

// --- Globals + seed ----------------------------------------------------------
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];
let session      = load('session', null);
let currentRoute = load('_route', 'home');
let searchQuery  = load('_searchQ', '');
(function seedOnFirstRun(){
  if (load('_seeded', false)) return;
  const now = Date.now();
  save('users', [
    { name:'Admin', username:'admin', email:'admin@sushi.com', contact:'', role:'admin', password:'', img:'' },
    { name:'Manager', username:'manager', email:'minmaung0307@gmail.com', contact:'', role:'manager', password:'', img:'' },
    { name:'Cashier One', username:'cashier1', email:'cashier@sushi.com', contact:'', role:'user', password:'', img:'' },
  ]);
  save('inventory', [
    { id:'inv1', img:'', name:'Nori Sheets', code:'NOR-100', type:'Dry', price:3.00, stock:80, threshold:30 },
    { id:'inv2', img:'', name:'Sushi Rice',  code:'RIC-200', type:'Dry', price:1.50, stock:24, threshold:20 },
    { id:'inv3', img:'', name:'Fresh Salmon',code:'SAL-300', type:'Raw', price:7.80, stock:10, threshold:12 },
  ]);
  save('products', [
    { id:'p1', img:'', name:'Salmon Nigiri', barcode:'11100001', price:5.99, type:'Nigiri', ingredients:'Rice, Salmon', instructions:'Brush with nikiri.' },
    { id:'p2', img:'', name:'California Roll', barcode:'11100002', price:7.49, type:'Roll', ingredients:'Rice, Nori, Crab, Avocado', instructions:'8 pcs.' },
  ]);
  save('posts', [{ id:'post1', title:'Welcome to Inventory', body:'Track stock, manage products, and work faster.', img:'', createdAt: now }]);
  save('tasks', [
    { id:'t1', title:'Prep Salmon', status:'todo' },
    { id:'t2', title:'Cook Rice', status:'inprogress' },
    { id:'t3', title:'Sanitize Station', status:'done' },
  ]);
  save('cogs', [
    { id:'c1', date:'2024-08-01', grossIncome:1200, produceCost:280, itemCost:180, freight:45, delivery:30, other:20 },
    { id:'c2', date:'2024-08-02', grossIncome: 900, produceCost:220, itemCost:140, freight:30, delivery:25, other:10 }
  ]);
  save('_seeded', true);
})();

// --- Router + idle logout ----------------------------------------------------
function go(route){ currentRoute = route; save('_route', route); renderApp(); }
let idleTimer = null;
const IDLE_LIMIT = 10*60*1000;
function resetIdleTimer(){
  if (!session) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async ()=>{ try{ await auth.signOut(); } finally { notify('Signed out due to inactivity','warn'); } }, IDLE_LIMIT);
}
['click','mousemove','keydown','touchstart','scroll'].forEach(evt=> window.addEventListener(evt, resetIdleTimer, {passive:true}));

// --- Auth state --------------------------------------------------------------
auth.onAuthStateChanged(async (user)=>{
  applyTheme();
  if (user){
    const email = (user.email||'').toLowerCase();
    let users = load('users', []);
    let prof = users.find(u => (u.email||'').toLowerCase()===email);
    if (!prof){
      const role = SUPER_ADMINS.includes(email) ? 'admin':'user';
      prof = { name: role==='admin'?'Admin':'User', username: email.split('@')[0], email, contact:'', role, password:'', img:'' };
      users.push(prof); save('users', users);
    } else if (SUPER_ADMINS.includes(email) && prof.role!=='admin'){
      prof.role='admin'; save('users', users);
    }
    session = {...prof}; save('session', session);

    if (cloud.isOn()){ try{ await cloud.pullAllOnce(); cloud.subscribeAll(); }catch{} }
    resetIdleTimer();
    currentRoute = load('_route','home');
    renderApp();
  } else {
    session = null; save('session', null);
    if (idleTimer) clearTimeout(idleTimer);
    renderLogin();
  }
});

// Part B — Login UI + Sidebar/Topbar + renderApp + global listeners + sidebar search shell
// ===================== Part B =====================
// Login UI + Sidebar/Topbar + renderApp + global listeners + sidebar search shell
// This part depends on Part A providing: auth, save(), load(), notify(), applyTheme(),
// session, currentRoute, go(route), and (optionally) cloud.

// ---------- Login / Logout ----------
function renderLogin() {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="login">
      <div class="card login-card">
        <div class="card-body">
          <div class="login-logo" style="display:grid;place-items:center;gap:10px;margin-bottom:10px">
            <div class="logo" style="
                width:84px;height:84px;border-radius:22px;
                display:grid;place-items:center;
                background: radial-gradient(ellipse at 30% 30%, var(--brand), var(--brand-2));
                color: #fff; font-size:34px; font-weight:800; box-shadow: var(--shadow);
            ">📦</div>
          </div>
          <h2 style="text-align:center;margin:6px 0 2px">Inventory</h2>
          <p class="login-note" style="text-align:center;color:var(--muted);margin-bottom:12px">Sign in to continue</p>

          <div class="grid">
            <input id="li-email" class="input" type="email" placeholder="Email" autocomplete="username" />
            <input id="li-pass" class="input" type="password" placeholder="Password" autocomplete="current-password" />
            <button id="btnLogin" class="btn"><i class="ri-login-box-line"></i> Sign In</button>

            <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--muted)">
              <a id="link-forgot" href="#" style="text-decoration:none">Forgot password?</a>
              <a id="link-register" href="#" style="text-decoration:none">Create account</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const doSignIn = async () => {
    const email = (document.getElementById('li-email')?.value || '').trim();
    const pass  = document.getElementById('li-pass')?.value || '';
    if (!email || !pass) { notify('Enter email & password', 'warn'); return; }

    // Be nice on mobile when offline
    if (!navigator.onLine) {
      notify('You appear to be offline. Connect to the internet and try again.', 'warn');
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      notify('Welcome!');
    } catch (e) {
      // Very common mobile error strings become clearer:
      const msg = e && e.message ? e.message : 'Login failed';
      if (/network/i.test(msg)) {
        notify('Network error: please check your connection and try again.', 'danger');
      } else if (/password/i.test(msg)) {
        notify('Incorrect email or password.', 'danger');
      } else {
        notify(msg, 'danger');
      }
    }
  };

  document.getElementById('btnLogin')?.addEventListener('click', doSignIn);
  document.getElementById('li-pass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSignIn();
  });

  // These are “hooks”; Part E wires them to password reset / registration modals
  document.getElementById('link-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    // If Part E forgot-password modal exists, open it, else just hint
    if (typeof openModal === 'function' && document.getElementById('m-forgot')) openModal('m-forgot');
    else notify('Password reset is available in Settings > Account (coming up).', 'ok');
  });
  document.getElementById('link-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof openModal === 'function' && document.getElementById('m-register')) openModal('m-register');
    else notify('Registration is disabled in this demo. Ask an admin to invite you.', 'ok');
  });
}

async function doLogout(){
  try { cloud?.disable?.(); } catch {}
  await auth.signOut();
  notify('Signed out');
}

// ---------- Sidebar + Topbar ----------
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
    { route:'policy',  icon:'ri-shield-check-line',       label:'Policy' },
    { route:'license', icon:'ri-copyright-line',          label:'License' },
    { route:'setup',   icon:'ri-guide-line',              label:'Setup Guide' },
    { route:'contact', icon:'ri-customer-service-2-line', label:'Contact' },
    { route:'guide',   icon:'ri-video-line',              label:'User Guide' },
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
        <div><strong>${(currentRoute||'home').slice(0,1).toUpperCase()+ (currentRoute||'home').slice(1)}</strong></div>
      </div>
      <div class="right">
        <button class="btn ghost" id="btnHome"><i class="ri-home-5-line"></i> Home</button>
        <button class="btn secondary" id="btnLogout"><i class="ri-logout-box-r-line"></i> Logout</button>
      </div>
    </div>
    <div class="backdrop" id="backdrop"></div>
  `;
}

// ---------- Global delegated listeners (safe across re-renders) ----------
// Sidebar route click
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
  if (id && typeof closeModal === 'function') { closeModal(id); }
}, { passive: true });

// ---------- Sidebar search (shell; won’t crash if Part F isn’t loaded yet) ----------
function hookSidebarInteractions(){
  const input   = document.getElementById('globalSearch');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  let searchTimer;

  const openResultsPage = (q)=>{
    // Only if helpers are present; otherwise fall back to a “search” route if you have one
    window.searchQuery = q; save && save('_searchQ', q);
    if (window.currentRoute !== 'search') go('search'); else renderApp();
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
      // If Part F’s buildSearchIndex/searchAll exist, use them; else show a mini “fake” result
      let out = [];
      if (typeof buildSearchIndex === 'function' && typeof searchAll === 'function') {
        const indexData = buildSearchIndex();
        out = searchAll(indexData, q).slice(0, 12);
      } else {
        out = [{ route:'search', id:'', label:`Search "${q}"`, section:'All' }];
      }

      if (!out.length) { results.classList.remove('active'); results.innerHTML=''; return; }
      results.innerHTML = out.map(r => `
        <div class="result" data-route="${r.route}" data-id="${r.id||''}">
          <strong>${r.label}</strong> <span style="color:var(--muted)">— ${r.section||''}</span>
        </div>`).join('');
      results.classList.add('active');

      results.querySelectorAll('.result').forEach(row => {
        row.onclick = () => {
          const r = row.getAttribute('data-route');
          const id = row.getAttribute('data-id') || '';
          const label = row.textContent.trim();
          openResultsPage(label);
          results.classList.remove('active');
          input.value = '';
          closeSidebar();
          if (id && typeof scrollToRow === 'function') setTimeout(()=> scrollToRow(id), 80);
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

// ---------- App shell / renderer (defensive) ----------
function renderApp(){
  if (!window.session) { renderLogin(); return; }

  const root = document.getElementById('root');
  // Choose a safe view renderer: use viewX() if it exists; else fallback content
  const safeView = (route) => {
    const m = {
      home:       typeof viewHome === 'function'      ? viewHome
                 : ()=> `<div class="card"><div class="card-body"><h3>Home</h3><p>Content coming soon.</p></div></div>`,
      dashboard:  typeof viewDashboard === 'function' ? viewDashboard
                 : ()=> `<div class="card"><div class="card-body"><h3>Dashboard</h3><p>Content coming soon.</p></div></div>`,
      inventory:  typeof viewInventory === 'function' ? viewInventory
                 : ()=> `<div class="card"><div class="card-body"><h3>Inventory</h3><p>Content coming soon.</p></div></div>`,
      products:   typeof viewProducts === 'function'  ? viewProducts
                 : ()=> `<div class="card"><div class="card-body"><h3>Products</h3><p>Content coming soon.</p></div></div>`,
      cogs:       typeof viewCOGS === 'function'      ? viewCOGS
                 : ()=> `<div class="card"><div class="card-body"><h3>COGS</h3><p>Content coming soon.</p></div></div>`,
      tasks:      typeof viewTasks === 'function'     ? viewTasks
                 : ()=> `<div class="card"><div class="card-body"><h3>Tasks</h3><p>Content coming soon.</p></div></div>`,
      settings:   typeof viewSettings === 'function'  ? viewSettings
                 : ()=> `<div class="card"><div class="card-body"><h3>Settings</h3><p>Content coming soon.</p></div></div>`,
      search:     typeof viewSearch === 'function'    ? viewSearch
                 : ()=> `<div class="card"><div class="card-body"><h3>Search</h3><p>Type in the sidebar.</p></div></div>`,
      policy:     ()=> typeof viewPage === 'function' ? viewPage('policy')  : `<div class="card"><div class="card-body"><h3>Policy</h3></div></div>`,
      license:    ()=> typeof viewPage === 'function' ? viewPage('license') : `<div class="card"><div class="card-body"><h3>License</h3></div></div>`,
      setup:      ()=> typeof viewPage === 'function' ? viewPage('setup')   : `<div class="card"><div class="card-body"><h3>Setup Guide</h3></div></div>`,
      contact:    ()=> typeof viewPage === 'function' ? viewPage('contact') : `<div class="card"><div class="card-body"><h3>Contact</h3></div></div>`,
      guide:      ()=> typeof viewPage === 'function' ? viewPage('guide')   : `<div class="card"><div class="card-body"><h3>User Guide</h3></div></div>`,
    };
    const fn = m[route] || m.home;
    return typeof fn === 'function' ? fn() : fn;
  };

  root.innerHTML = `
    <div class="app">
      ${renderSidebar(currentRoute)}
      <div>
        ${renderTopbar()}
        <div class="main" id="main">
          ${safeView(currentRoute)}
        </div>
      </div>
    </div>
  `;

  // Wire chrome
  hookSidebarInteractions();

  // Burger / backdrop / home / logout
  document.getElementById('burger')?.addEventListener('click', openSidebar, { passive:true });
  document.getElementById('backdrop')?.addEventListener('click', closeSidebar, { passive:true });
  document.getElementById('btnHome')?.addEventListener('click', ()=> go('home'));
  document.getElementById('btnLogout')?.addEventListener('click', doLogout);

  // Clickable dashboard tiles that have data-go (robust)
  document.querySelectorAll('.card.tile[data-go]').forEach(t => {
    t.style.cursor = 'pointer';
    t.onclick = () => { const r = t.getAttribute('data-go'); if (r) go(r); };
  });

  // Any button/link inside main that navigates
  document.querySelectorAll('#main [data-go]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const r = btn.getAttribute('data-go'); const id = btn.getAttribute('data-id');
      if (r) go(r);
      if (id && typeof scrollToRow === 'function') setTimeout(()=> scrollToRow(id), 80);
    });
  });

  // Don’t break if later parts haven’t defined this yet
  if (typeof enableMobileImagePreview === 'function') enableMobileImagePreview();
}

function openSidebar(){ document.getElementById('sidebar')?.classList.add('open'); document.getElementById('backdrop')?.classList.add('active'); }
function closeSidebar(){ document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('backdrop')?.classList.remove('active'); }
// =================== End Part B ===================

// Part C — Home (hot weekly videos + Shuffle), Search, Dashboard (YoY & MoM), Posts
// ===================== Part C =====================
// Home (hot weekly videos + Shuffle), Search page, Dashboard (YoY & MoM), Posts

// ---------- Small utilities (safe, idempotent) ----------
(function(){
  if (!window.USD) window.USD = (x)=> `$${Number(x||0).toFixed(2)}`;

  // Parse "YYYY-MM-DD" -> { y, m, d }
  if (!window.parseYMD) {
    window.parseYMD = (s)=>{
      if (!s || typeof s !== 'string') return null;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      return { y: +m[1], m: +m[2], d: +m[3] };
    };
  }

  // ISO week number (Mon-based), deterministic weekly pick
  if (!window.getISOWeek) {
    window.getISOWeek = (date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    };
  }

  // Hot videos pool (CC MP4s that play on iOS with user gesture)
  if (!window.HOT_VIDEOS) {
    window.HOT_VIDEOS = [
      {
        title: 'Countryside (CC0)',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        poster: 'https://i.imgur.com/7v2C8bX.jpeg'
      },
      {
        title: 'Big Buck Bunny (CC)',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        poster: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217'
      },
      {
        title: 'Sintel Trailer (CC)',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        poster: 'https://durian.blender.org/wp-content/uploads/2010/05/sintel_poster.jpg'
      },
      {
        title: 'Flower Close-ups (CC0)',
        src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        poster: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.jpg'
      }
    ];
  }

  // Pick a weekly video (stable per week), but allow shuffle
  if (!window.pickWeeklyVideoIndex) {
    window.pickWeeklyVideoIndex = ()=>{
      const now = new Date();
      const w = getISOWeek(now);
      return w % HOT_VIDEOS.length;
    };
  }
})();

// ---------- Home ----------
function viewHome(){
  // Pick stable weekly video index
  const weeklyIdx = pickWeeklyVideoIndex();
  // Track index in DOM via data attr (we set it in wireHome)
  return `
    <div class="card">
      <div class="card-body">
        <h3 style="margin-top:0">Welcome 👋</h3>
        <p style="color:var(--muted)">Pick a section or watch a quick hot pick video (updates weekly). Tap Shuffle to change.</p>

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
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <h4 style="margin:0">Hot Weekly Video</h4>
                <div style="display:flex;gap:8px">
                  <button class="btn ghost" id="btnShuffleVideo"><i class="ri-shuffle-line"></i> Shuffle</button>
                </div>
              </div>
              <div id="videoWrap" data-video-index="${weeklyIdx}">
                <div id="videoTitle" style="font-weight:700;margin-bottom:8px"></div>
                <video
                  id="hotVideo"
                  style="width:100%;border-radius:12px;border:1px solid var(--card-border)"
                  controls
                  playsinline
                  preload="metadata"
                  poster="">
                  <source id="hotVideoSrc" src="" type="video/mp4" />
                  Your browser does not support HTML5 video.
                </video>
                <div style="color:var(--muted);font-size:12px;margin-top:6px">
                  On iPhone, videos require a tap to play (autoplay is restricted).
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

// Wire the Home video after render
function wireHome(){
  const wrap = document.getElementById('videoWrap');
  const vEl  = document.getElementById('hotVideo');
  const src  = document.getElementById('hotVideoSrc');
  const title= document.getElementById('videoTitle');
  const btn  = document.getElementById('btnShuffleVideo');
  if (!wrap || !vEl || !src || !title) return;

  const setVideo = (idx)=>{
    const pool = window.HOT_VIDEOS || [];
    if (!pool.length) return;
    const i = ((idx % pool.length) + pool.length) % pool.length;
    const item = pool[i];
    title.textContent = item.title || 'Hot pick';
    src.src = item.src;
    vEl.poster = item.poster || '';
    try{ vEl.load(); }catch(_){}
    // Do not autoplay (iOS)
  };

  // initial
  const startIdx = parseInt(wrap.getAttribute('data-video-index') || '0', 10) || 0;
  setVideo(startIdx);

  // shuffle
  btn?.addEventListener('click', ()=>{
    const pool = window.HOT_VIDEOS || [];
    if (!pool.length) return;
    const curr = parseInt(wrap.getAttribute('data-video-index') || '0', 10) || 0;
    let next = Math.floor(Math.random()*pool.length);
    if (pool.length > 1 && next === curr) next = (next+1) % pool.length;
    wrap.setAttribute('data-video-index', String(next));
    setVideo(next);
    notify('Shuffled video', 'ok');
  });
}

// ---------- Search ----------
function viewSearch(){
  const q = (window.searchQuery || '').trim();
  const hasSearch = (typeof buildSearchIndex === 'function' && typeof searchAll === 'function');
  const index = hasSearch ? buildSearchIndex() : [];
  const out = q && hasSearch ? searchAll(index, q) : (q ? [{route:'dashboard', id:'', label:`Search for “${q}”`, section:'General'}] : []);

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
                    <div style="color:var(--muted);font-size:12px">${r.section || ''}</div>
                  </div>
                  <button class="btn" data-go="${r.route}" data-id="${r.id||''}">Open</button>
                </div>
              </div>`).join('')}
          </div>` : `<p style="color:var(--muted)">No results.</p>`}
      </div>
    </div>
  `;
}

// ---------- Dashboard (tiles + Low/Critical + MoM + YoY + Posts full-width) ----------
function viewDashboard(){
  const posts = load('posts', []);
  const inv   = load('inventory', []);
  const prods = load('products', []);
  const users = load('users', []);
  const tasks = load('tasks', []);
  const cogs  = load('cogs', []);

  // Low/Critical counts
  const lowCt  = inv.filter(i => i.stock <= i.threshold && i.stock > Math.max(1, Math.floor(i.threshold*0.6))).length;
  const critCt = inv.filter(i => i.stock <= Math.max(1, Math.floor(i.threshold*0.6))).length;

  // Month totals helpers
  const sumForMonth = (year, month)=> cogs
    .filter(r => {
      const p = parseYMD(r.date);
      return p && p.y===year && p.m===month;
    })
    .reduce((s, r)=> s + Number(r.grossIncome||0), 0);

  const today = new Date();
  const cy = today.getFullYear(), cm = today.getMonth()+1;
  const py = cm === 1 ? (cy-1) : cy;
  const pm = cm === 1 ? 12 : (cm-1);
  const ly = cy-1, lm = cm;

  const totalThisMonth = sumForMonth(cy, cm);
  const totalPrevMonth = sumForMonth(py, pm);
  const totalLastYearSameMonth = sumForMonth(ly, lm);

  const pct = (a,b)=> (b>0 ? ((a-b)/b)*100 : (a>0? 100 : 0));
  const mom = pct(totalThisMonth, totalPrevMonth);
  const yoy = pct(totalThisMonth, totalLastYearSameMonth);

  const fmtPct = (v)=> `${v>=0?'+':''}${v.toFixed(1)}%`;
  const trendColor = (v)=> v>=0 ? 'var(--ok)' : 'var(--danger)';

  return `
    <div class="grid cols-4 auto">
      <div class="card tile" data-go="inventory" style="cursor:pointer"><div>Total Items</div><h2>${inv.length}</h2></div>
      <div class="card tile" data-go="products"  style="cursor:pointer"><div>Products</div><h2>${prods.length}</h2></div>
      <div class="card tile" data-go="settings"  style="cursor:pointer"><div>Users</div><h2>${users.length}</h2></div>
      <div class="card tile" data-go="tasks"     style="cursor:pointer"><div>Tasks</div><h2>${tasks.length}</h2></div>
    </div>

    <div class="grid cols-4 auto" style="margin-top:12px">
      <div class="card" style="border-left:4px solid var(--warn)">
        <div class="card-body"><strong>Low stock</strong><div style="color:var(--muted)">${lowCt}</div></div>
      </div>
      <div class="card" style="border-left:4px solid var(--danger)">
        <div class="card-body"><strong>Critical</strong><div style="color:var(--muted)">${critCt}</div></div>
      </div>

      <div class="card">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>Sales (Month-to-Date)</strong>
            <button class="btn ghost" data-go="cogs"><i class="ri-line-chart-line"></i> Details</button>
          </div>
          <div style="margin-top:6px"><span style="color:var(--muted)">This month:</span> <strong>${USD(totalThisMonth)}</strong></div>
          <div><span style="color:var(--muted)">Prev month:</span> ${USD(totalPrevMonth)} <span style="color:${trendColor(mom)}">${fmtPct(mom)} MoM</span></div>
          <div><span style="color:var(--muted)">Same month last year:</span> ${USD(totalLastYearSameMonth)} <span style="color:${trendColor(yoy)}">${fmtPct(yoy)} YoY</span></div>
        </div>
      </div>

      <div class="card" data-go="tasks" style="cursor:pointer">
        <div class="card-body"><strong>Tasks</strong><div style="color:var(--muted)">Manage lanes</div></div>
      </div>
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
  `;
}

// Extra wiring for Home + Dashboard + Posts
function wireDashboard(){
  // Add Post button (if Part E modals exist)
  const addPostBtn = document.getElementById('addPost');
  if (addPostBtn) {
    addPostBtn.onclick = () => {
      if (typeof openModal === 'function' && document.getElementById('m-post')) {
        openModal('m-post');
      } else {
        notify('Post modal not available yet.', 'warn');
      }
    };
  }

  // Make sure tiles are clickable even if Part B missed it
  document.querySelectorAll('.card.tile[data-go]').forEach(t => {
    t.style.cursor = 'pointer';
    t.onclick = () => { const r = t.getAttribute('data-go'); if (r) go(r); };
  });
}

function wirePosts(){
  const sec = document.querySelector('[data-section="posts"]'); 
  if (!sec) return;

  // Save (works if Part E injected the modal fields)
  document.getElementById('save-post')?.addEventListener('click', ()=>{
    const posts = load('posts', []);
    const id = document.getElementById('post-id')?.value || ('post_'+Date.now());
    const obj = {
      id,
      title: (document.getElementById('post-title')?.value || '').trim(),
      body: (document.getElementById('post-body')?.value || '').trim(),
      img:  (document.getElementById('post-img')?.value || '').trim(),
      createdAt: Date.now()
    };
    if (!obj.title) return notify('Title required','warn');
    const i = posts.findIndex(x=>x.id===id);
    if (i>=0) posts[i]=obj; else posts.unshift(obj);
    save('posts', posts);
    if (typeof closeModal === 'function') closeModal('m-post');
    notify('Saved'); renderApp();
  });

  // Edit/Delete
  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;

    if (btn.hasAttribute('data-edit')) {
      const posts = load('posts', []);
      const p = posts.find(x=>x.id===id); if (!p) return;
      if (typeof openModal === 'function' && document.getElementById('m-post')) {
        openModal('m-post');
        document.getElementById('post-id').value = p.id;
        document.getElementById('post-title').value = p.title;
        document.getElementById('post-body').value = p.body;
        document.getElementById('post-img').value = p.img||'';
      } else {
        notify('Post modal not available yet.', 'warn');
      }
    } else {
      let posts = load('posts', []).filter(x=>x.id!==id);
      save('posts', posts); notify('Deleted'); renderApp();
    }
  });
}

// After each render, Part B calls these conditionally.
// We add a tiny router hook here to wire Home/Dashboard/Posts when relevant.
(function(){
  const _oldRenderApp = window.renderApp;
  // Only wrap once
  if (!_oldRenderApp || _oldRenderApp.__wrappedByPartC) return;

  window.renderApp = function(){
    _oldRenderApp.call(this);

    // Home video
    if (window.currentRoute === 'home') wireHome?.();

    // Dashboard + Posts
    if (window.currentRoute === 'dashboard') {
      wireDashboard?.();
      wirePosts?.();
    }
  };
  window.renderApp.__wrappedByPartC = true;
})();
// =================== End Part C ===================

// Part D — Inventory / Products / COGS (+ CSV export), Tasks (free DnD even with empty lanes)
// ===================== Part D =====================
// Inventory / Products / COGS (+ CSV export), Tasks (free DnD even with empty lanes)

// ---------- Reusable CSV export ----------
function downloadCSV(filename, rows, headers) {
  try {
    const csvRows = [];
    if (headers && headers.length) csvRows.push(headers.join(','));
    for (const r of rows) {
      const vals = headers.map(h => {
        const v = r[h];
        const s = (v === undefined || v === null) ? '' : String(v);
        const needsQuotes = /[",\n]/.test(s);
        const escaped = s.replace(/"/g, '""');
        return needsQuotes ? `"${escaped}"` : escaped;
      });
      csvRows.push(vals.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
    notify('Exported CSV', 'ok');
  } catch (e) {
    notify('Export failed', 'danger');
  }
}

// ---------- Inventory ----------
function viewInventory(){
  const items = load('inventory', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Inventory</h3>
          <div style="display:flex;gap:8px">
            <button class="btn ok" id="export-inventory"><i class="ri-download-2-line"></i> Export CSV</button>
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
                const warnClass =
                  it.stock <= it.threshold
                    ? (it.stock <= Math.max(1, Math.floor(it.threshold * 0.6)) ? 'tr-danger' : 'tr-warn')
                    : '';
                return `<tr id="${it.id}" class="${warnClass}">
                  <td>
                    <div class="thumb-wrap">
                      ${
                        it.img
                          ? `<img class="thumb inv-preview" data-src="${it.img}" alt=""/>`
                          : `<div class="thumb inv-preview" data-src="icons/icon-512.png" style="display:grid;place-items:center">📦</div>`
                      }
                      <img class="thumb-large" src="${it.img || 'icons/icon-512.png'}" alt=""/>
                    </div>
                  </td>
                  <td>${it.name}</td>
                  <td>${it.code}</td>
                  <td>${it.type || '-'}</td>
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
                    ${
                      canCreate()
                        ? `
                      <button class="btn ghost" data-edit="${it.id}"><i class="ri-edit-line"></i></button>
                      <button class="btn danger" data-del="${it.id}"><i class="ri-delete-bin-6-line"></i></button>`
                        : ''
                    }
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function wireInventory(){
  const sec = document.querySelector('[data-section="inventory"]');
  if (!sec) return;

  // Export
  document.getElementById('export-inventory')?.addEventListener('click', ()=>{
    const items = load('inventory', []);
    downloadCSV('inventory.csv', items, ['id','name','code','type','price','stock','threshold','img']);
  });

  // Add
  document.getElementById('addInv')?.addEventListener('click', ()=>{
    if (typeof openModal === 'function' && document.getElementById('m-inv')) {
      openModal('m-inv');
      return;
    }
    // Fallback (no modal yet)
    const nm = prompt('Name?'); if (!nm) return;
    const items = load('inventory', []);
    const id = 'inv_'+Date.now();
    items.push({ id, name:nm, code:'', type:'Other', price:0, stock:0, threshold:0, img:'' });
    save('inventory', items); renderApp();
  });

  // Save (modal path; safe if modal exists in Part E)
  document.getElementById('save-inv')?.addEventListener('click', ()=>{
    const items = load('inventory', []);
    const id = document.getElementById('inv-id').value || ('inv_'+Date.now());
    const obj = {
      id,
      name: document.getElementById('inv-name').value.trim(),
      code: document.getElementById('inv-code').value.trim(),
      type: document.getElementById('inv-type').value.trim(),
      price: parseFloat(document.getElementById('inv-price').value || '0'),
      stock: parseInt(document.getElementById('inv-stock').value || '0'),
      threshold: parseInt(document.getElementById('inv-threshold').value || '0'),
      img: document.getElementById('inv-img').value.trim(),
    };
    if (!obj.name) return notify('Name required','warn');
    const i = items.findIndex(x=>x.id===id);
    if (i>=0) items[i]=obj; else items.push(obj);
    save('inventory', items);
    if (typeof closeModal === 'function') closeModal('m-inv');
    notify('Saved'); renderApp();
  });

  // Row actions
  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const items = load('inventory', []);
    const get = (id)=> items.find(x=>x.id===id);

    if (btn.hasAttribute('data-edit')) {
      const id = btn.getAttribute('data-edit');
      const it = get(id); if (!it) return;

      if (typeof openModal === 'function' && document.getElementById('m-inv')) {
        openModal('m-inv');
        document.getElementById('inv-id').value=id;
        document.getElementById('inv-name').value=it.name;
        document.getElementById('inv-code').value=it.code;
        document.getElementById('inv-type').value=it.type || 'Other';
        document.getElementById('inv-price').value=it.price;
        document.getElementById('inv-stock').value=it.stock;
        document.getElementById('inv-threshold').value=it.threshold;
        document.getElementById('inv-img').value=it.img || '';
      } else {
        // Fallback quick edit
        const nm = prompt('Name:', it.name); if (!nm) return;
        it.name = nm; save('inventory', items); renderApp();
      }
      return;
    }

    if (btn.hasAttribute('data-del')) {
      const id = btn.getAttribute('data-del');
      const next = items.filter(x=>x.id!==id);
      save('inventory', next); notify('Deleted'); renderApp(); return;
    }

    // Inc/Dec stock & threshold
    const id =
      btn.getAttribute('data-inc') ||
      btn.getAttribute('data-dec') ||
      btn.getAttribute('data-inc-th') ||
      btn.getAttribute('data-dec-th');

    if (!id) return;
    const it = get(id); if (!it) return;

    if (btn.hasAttribute('data-inc')) { it.stock++; }
    if (btn.hasAttribute('data-dec')) { it.stock = Math.max(0, it.stock-1); }
    if (btn.hasAttribute('data-inc-th')) { it.threshold++; }
    if (btn.hasAttribute('data-dec-th')) { it.threshold = Math.max(0, it.threshold-1); }

    save('inventory', items); renderApp();
  });
}

// ---------- Products ----------
function viewProducts(){
  const items = load('products', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Products</h3>
          <div style="display:flex;gap:8px">
            <button class="btn ok" id="export-products"><i class="ri-download-2-line"></i> Export CSV</button>
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
                      ${
                        it.img
                          ? `<img class="thumb prod-thumb" data-card="${it.id}" alt="" src="${it.img}"/>`
                          : `<div class="thumb prod-thumb" data-card="${it.id}" style="display:grid;place-items:center;cursor:pointer">🛒</div>`
                      }
                      <img class="thumb-large" src="${it.img||'icons/icon-512.png'}" alt=""/>
                    </div>
                  </td>
                  <td>${it.name}</td>
                  <td>${it.barcode||''}</td>
                  <td>${USD(it.price)}</td>
                  <td>${it.type||'-'}</td>
                  <td>
                    ${
                      canCreate()
                        ? `
                      <button class="btn ghost" data-edit="${it.id}"><i class="ri-edit-line"></i></button>
                      <button class="btn danger" data-del="${it.id}"><i class="ri-delete-bin-6-line"></i></button>`
                        : ''
                    }
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function wireProducts(){
  const sec = document.querySelector('[data-section="products"]');
  if (!sec) return;

  // Export
  document.getElementById('export-products')?.addEventListener('click', ()=>{
    const items = load('products', []);
    downloadCSV('products.csv', items, ['id','name','barcode','price','type','ingredients','instructions','img']);
  });

  // Add
  document.getElementById('addProd')?.addEventListener('click', ()=>{
    if (typeof openModal === 'function' && document.getElementById('m-prod')) {
      openModal('m-prod'); return;
    }
    // Fallback
    const nm = prompt('Product name?'); if (!nm) return;
    const items = load('products', []);
    const id = 'p_'+Date.now();
    items.push({ id, name:nm, barcode:'', price:0, type:'', ingredients:'', instructions:'', img:'' });
    save('products', items); renderApp();
  });

  // Save (modal path if available)
  document.getElementById('save-prod')?.addEventListener('click', ()=>{
    const items = load('products', []);
    const id = document.getElementById('prod-id').value || ('p_'+Date.now());
    const obj = {
      id,
      name: document.getElementById('prod-name').value.trim(),
      barcode: document.getElementById('prod-barcode').value.trim(),
      price: parseFloat(document.getElementById('prod-price').value || '0'),
      type: document.getElementById('prod-type').value.trim(),
      ingredients: document.getElementById('prod-ingredients').value.trim(),
      instructions: document.getElementById('prod-instructions').value.trim(),
      img: document.getElementById('prod-img').value.trim()
    };
    if (!obj.name) return notify('Name required','warn');
    const i = items.findIndex(x=>x.id===id);
    if (i>=0) items[i]=obj; else items.push(obj);
    save('products', items);
    if (typeof closeModal === 'function') closeModal('m-prod');
    notify('Saved'); renderApp();
  });

  // Row actions
  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); 
    if (btn) {
      const id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); 
      if (!id) return;

      const items = load('products', []);
      if (btn.hasAttribute('data-edit')) {
        const it = items.find(x=>x.id===id); if (!it) return;
        if (typeof openModal === 'function' && document.getElementById('m-prod')) {
          openModal('m-prod');
          document.getElementById('prod-id').value=id;
          document.getElementById('prod-name').value=it.name;
          document.getElementById('prod-barcode').value=it.barcode||'';
          document.getElementById('prod-price').value=it.price;
          document.getElementById('prod-type').value=it.type||'';
          document.getElementById('prod-ingredients').value=it.ingredients||'';
          document.getElementById('prod-instructions').value=it.instructions||'';
          document.getElementById('prod-img').value=it.img||'';
        } else {
          const nm = prompt('Product name:', it.name); if (!nm) return;
          it.name = nm; save('products', items); renderApp();
        }
      } else {
        const next = items.filter(x=>x.id!==id);
        save('products', next); notify('Deleted'); renderApp();
      }
      return;
    }
  });
}

// ---------- COGS ----------
function viewCOGS(){
  const rows = load('cogs', []);
  const totals = rows.reduce((a,r)=>({
    grossIncome:a.grossIncome+(+r.grossIncome||0),
    produceCost:a.produceCost+(+r.produceCost||0),
    itemCost:a.itemCost+(+r.itemCost||0),
    freight:a.freight+(+r.freight||0),
    delivery:a.delivery+(+r.delivery||0),
    other:a.other+(+r.other||0)
  }),{grossIncome:0,produceCost:0,itemCost:0,freight:0,delivery:0,other:0});
  const grossProfit = (r)=> (+r.grossIncome||0) - ((+r.produceCost||0)+(+r.itemCost||0)+(+r.freight||0)+(+r.delivery||0)+(+r.other||0));
  const totalProfit = grossProfit(totals);

  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">COGS</h3>
          <div style="display:flex;gap:8px">
            <button class="btn ok" id="export-cogs"><i class="ri-download-2-line"></i> Export CSV</button>
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
                    ${
                      canCreate()
                        ? `
                      <button class="btn ghost" data-edit="${r.id}"><i class="ri-edit-line"></i></button>
                      <button class="btn danger" data-del="${r.id}"><i class="ri-delete-bin-6-line"></i></button>`
                        : ''
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
  `;
}

function wireCOGS(){
  const sec = document.querySelector('[data-section="cogs"]'); 
  if (!sec) return;

  // Export
  document.getElementById('export-cogs')?.addEventListener('click', ()=>{
    const rows = load('cogs', []);
    downloadCSV('cogs.csv', rows, [
      'id','date','grossIncome','produceCost','itemCost','freight','delivery','other'
    ]);
  });

  // Add
  document.getElementById('addCOGS')?.addEventListener('click', ()=>{
    if (typeof openModal === 'function' && document.getElementById('m-cogs')) {
      openModal('m-cogs'); return;
    }
    // Fallback quick add
    const date = prompt('Date (YYYY-MM-DD):', new Date().toISOString().slice(0,10)) || '';
    const gross = parseFloat(prompt('Gross Income:', '0') || '0');
    const rows = load('cogs', []);
    const id = 'c_'+Date.now();
    rows.push({ id, date, grossIncome:gross, produceCost:0, itemCost:0, freight:0, delivery:0, other:0 });
    save('cogs', rows); renderApp();
  });

  // Save via modal
  document.getElementById('save-cogs')?.addEventListener('click', ()=>{
    const rows = load('cogs', []);
    const id = document.getElementById('cogs-id').value || ('c_'+Date.now());
    const row = {
      id,
      date: document.getElementById('cogs-date').value || new Date().toISOString().slice(0,10),
      grossIncome: parseFloat(document.getElementById('cogs-grossIncome').value || '0'),
      produceCost: parseFloat(document.getElementById('cogs-produceCost').value || '0'),
      itemCost: parseFloat(document.getElementById('cogs-itemCost').value || '0'),
      freight: parseFloat(document.getElementById('cogs-freight').value || '0'),
      delivery: parseFloat(document.getElementById('cogs-delivery').value || '0'),
      other: parseFloat(document.getElementById('cogs-other').value || '0'),
    };
    const i = rows.findIndex(x=>x.id===id);
    if (i>=0) rows[i]=row; else rows.push(row);
    save('cogs', rows);
    if (typeof closeModal === 'function') closeModal('m-cogs');
    notify('Saved'); renderApp();
  });

  // Edit/Delete
  sec.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;

    if (btn.hasAttribute('data-edit')) {
      const rows = load('cogs', []); const r = rows.find(x=>x.id===id); if (!r) return;
      if (typeof openModal === 'function' && document.getElementById('m-cogs')) {
        openModal('m-cogs');
        document.getElementById('cogs-id').value=id;
        document.getElementById('cogs-date').value=r.date;
        document.getElementById('cogs-grossIncome').value=r.grossIncome;
        document.getElementById('cogs-produceCost').value=r.produceCost;
        document.getElementById('cogs-itemCost').value=r.itemCost;
        document.getElementById('cogs-freight').value=r.freight;
        document.getElementById('cogs-delivery').value=r.delivery;
        document.getElementById('cogs-other').value=r.other;
      } else {
        const gross = parseFloat(prompt('Gross Income:', r.grossIncome) || String(r.grossIncome||0));
        r.grossIncome = isNaN(gross) ? r.grossIncome : gross;
        save('cogs', rows); renderApp();
      }
    } else {
      let rows = load('cogs', []).filter(x=>x.id!==id);
      save('cogs', rows); notify('Deleted'); renderApp();
    }
  });
}

// ---------- Tasks (free DnD; works with empty lanes) ----------
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
          <!-- Empty lane still accepts drops; no "Drop here" text -->
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
  `;
}

function wireTasks(){
  const root = document.querySelector('[data-section="tasks"]'); 
  if (!root) return;

  // Add / Save (modal if available, fallback prompts)
  document.getElementById('addTask')?.addEventListener('click', ()=>{
    if (typeof openModal === 'function' && document.getElementById('m-task')) {
      openModal('m-task'); return;
    }
    const title = prompt('Task title?'); if (!title) return;
    const items = load('tasks', []);
    items.push({ id:'t_'+Date.now(), title, status:'todo' });
    save('tasks', items); renderApp();
  });

  document.getElementById('save-task')?.addEventListener('click', ()=>{
    const items = load('tasks', []);
    const id = document.getElementById('task-id').value || ('t_'+Date.now());
    const obj = { 
      id, 
      title: document.getElementById('task-title').value.trim(), 
      status: document.getElementById('task-status').value 
    };
    const i = items.findIndex(x=>x.id===id);
    if (i>=0) items[i]=obj; else items.push(obj);
    save('tasks',items);
    if (typeof closeModal === 'function') closeModal('m-task');
    notify('Saved'); renderApp();
  });

  root.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    const items = load('tasks', []);

    if (btn.hasAttribute('data-edit')) {
      const t = items.find(x=>x.id===id); if (!t) return;
      if (typeof openModal === 'function' && document.getElementById('m-task')) {
        openModal('m-task');
        document.getElementById('task-id').value = t.id;
        document.getElementById('task-title').value = t.title;
        document.getElementById('task-status').value = t.status;
      } else {
        const title = prompt('Title:', t.title); if (!title) return;
        t.title = title; save('tasks', items); renderApp();
      }
    } else {
      const next = items.filter(x=>x.id!==id);
      save('tasks', next); notify('Deleted'); renderApp();
    }
  });

  // DnD: allow drops even when lane empty
  setupDnD();
}

function setupDnD(){
  const lanes = ['todo','inprogress','done'];
  const allow = {
    'todo':       new Set(['inprogress','done']),
    'inprogress': new Set(['todo','done']),
    'done':       new Set(['todo','inprogress'])
  };

  // Card draggable
  document.querySelectorAll('[data-task]').forEach(card=>{
    card.ondragstart = (e)=> {
      e.dataTransfer.setData('text/plain', card.getAttribute('data-task'));
      // iOS Safari: set effect
      e.dataTransfer.dropEffect = 'move';
    };
  });

  // Lane receivers
  lanes.forEach(k=>{
    const laneGrid  = document.getElementById('lane-'+k);
    const parentCard = laneGrid?.closest('.lane-row');
    if (!laneGrid) return;

    const over = (e)=>{
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/plain');
      if (!id) { parentCard?.classList.remove('drop'); return; }
      const items = load('tasks', []);
      const t = items.find(x=>x.id===id);
      if (t && allow[t.status].has(k)) parentCard?.classList.add('drop');
      else parentCard?.classList.remove('drop');
    };
    const leave = ()=> parentCard?.classList.remove('drop');
    const drop = (e)=>{
      e.preventDefault();
      parentCard?.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const items = load('tasks', []);
      const t = items.find(x=>x.id===id); 
      if (!t) return;
      if (!allow[t.status].has(k)) { notify('Move not allowed','warn'); return; }
      t.status = k; 
      save('tasks', items); 
      renderApp();
    };

    laneGrid.ondragover  = over;
    laneGrid.ondragenter = (e)=> e.preventDefault();
    laneGrid.ondragleave = leave;
    laneGrid.ondrop      = drop;
  });
}

// Hook Part D into the render cycle (in case Part B didn’t already)
(function(){
  const _oldRenderApp = window.renderApp;
  if (!_oldRenderApp || _oldRenderApp.__wrappedByPartD) return;

  window.renderApp = function(){
    _oldRenderApp.call(this);

    if (window.currentRoute === 'inventory')  wireInventory?.();
    if (window.currentRoute === 'products')   wireProducts?.();
    if (window.currentRoute === 'cogs')       wireCOGS?.();
    if (window.currentRoute === 'tasks')      wireTasks?.();
  };
  window.renderApp.__wrappedByPartD = true;
})();

// =================== End Part D ===================

// Part E — Settings (instant theme + cloud), Users, Contact (EmailJS), Static pages, All Modals
// ===================== Part E =====================
// Settings (instant theme + cloud), Users management, Contact (EmailJS),
// Static pages (iframes), and ALL Modals + helpers.

// ---------- Modal helpers ----------
function openModal(id){
  const m = document.getElementById(id);
  const mb = document.getElementById('mb-'+(id.split('-')[1]||''));
  if (m) m.classList.add('active');
  if (mb) mb.classList.add('active');
}
function closeModal(id){
  const m = document.getElementById(id);
  const mb = document.getElementById('mb-'+(id.split('-')[1]||''));
  if (m) m.classList.remove('active');
  if (mb) mb.classList.remove('active');
}

// Mobile image preview (used by inventory/products thumbs)
function enableMobileImagePreview(){
  const isPhone = window.matchMedia('(max-width: 740px)').matches;
  if (!isPhone) return;
  document.querySelectorAll('.inv-preview, .prod-thumb').forEach(el=>{
    el.style.cursor = 'pointer';
    el.addEventListener('click', ()=>{
      const src = el.getAttribute('data-src') || el.getAttribute('src') || 'icons/icon-512.png';
      const img = document.getElementById('preview-img');
      if (img) img.src = src;
      openModal('m-img');
    });
  });
}

// ---------- Static pages + Contact builder ----------
window.pageContent = window.pageContent || {};
Object.assign(window.pageContent, {
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
  guide:`<h3>User Guide</h3>
    <div style="border:1px solid var(--card-border);border-radius:12px;overflow:hidden">
      <iframe src="guide.html" style="width:100%;height:calc(100vh - 220px);border:none"></iframe>
    </div>`,
  contact:`<h3>Contact</h3>
    <p>Send us a message and we’ll reply by email.</p>
    <div class="grid cols-2">
      <input id="ct-name" class="input" placeholder="Your name" />
      <input id="ct-email" class="input" type="email" placeholder="Your email" />
    </div>
    <textarea id="ct-msg" class="input" rows="5" placeholder="Message"></textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:10px">
      <button id="ct-send" class="btn"><i class="ri-send-plane-line"></i> Send</button>
    </div>
    <p style="color:var(--muted);font-size:12px;margin-top:6px">This uses EmailJS if configured in Settings → Email. If not configured, your email app will open as fallback.</p>`
});

function viewPage(key){
  return `<div class="card"><div class="card-body">${(window.pageContent && window.pageContent[key]) || '<p>Page</p>'}</div></div>`;
}

// Wire the Contact page (send via EmailJS or mailto fallback)
function wireContact(){
  const btn = document.getElementById('ct-send');
  if (!btn) return;
  btn.onclick = async ()=>{
    const name = (document.getElementById('ct-name')?.value || '').trim();
    const email = (document.getElementById('ct-email')?.value || '').trim();
    const msg = (document.getElementById('ct-msg')?.value || '').trim();
    if (!name || !email || !msg){ notify('Please fill all fields','warn'); return; }

    const cfg = load('emailjs_cfg', null);
    const hasEmailJS = !!(window.emailjs && window.emailjs.send);
    if (cfg && hasEmailJS){
      try{
        // initialize if not already
        if (!window.__emailjs_inited){
          window.emailjs.init(cfg.publicKey);
          window.__emailjs_inited = true;
        }
        await window.emailjs.send(cfg.serviceId, cfg.templateId, {
          from_name: name,
          reply_to: email,
          message: msg,
          to_email: cfg.toEmail || ''
        });
        notify('Message sent!', 'ok');
        document.getElementById('ct-name').value='';
        document.getElementById('ct-email').value='';
        document.getElementById('ct-msg').value='';
      }catch(e){
        notify('Failed to send via EmailJS. Opening your email app…','warn');
        window.location.href = `mailto:${encodeURIComponent(cfg.toEmail||'')}`
          + `?subject=${encodeURIComponent('Contact from Inventory App')}`
          + `&body=${encodeURIComponent(`From: ${name} <${email}>\n\n${msg}`)}`;
      }
    } else {
      // mailto fallback
      const to = (cfg && cfg.toEmail) ? cfg.toEmail : 'you@example.com';
      notify('Opening your email app…','ok');
      window.location.href = `mailto:${encodeURIComponent(to)}`
        + `?subject=${encodeURIComponent('Contact from Inventory App')}`
        + `&body=${encodeURIComponent(`From: ${name} <${email}>\n\n${msg}`)}`;
    }
  };
}

// ---------- Settings (Cloud + Theme + EmailJS + Users) ----------
function viewSettings(){
  const users = load('users', []);
  const theme = (typeof getTheme === 'function') ? getTheme() : {mode:'aqua', size:'medium'};
  const cloudOn = (typeof cloud?.isOn === 'function') ? cloud.isOn() : false;
  const emailCfg = load('emailjs_cfg', { serviceId:'', templateId:'', publicKey:'', toEmail:'' });

  return `
    <div class="grid">
      <!-- Cloud -->
      <div class="card">
        <div class="card-body">
          <h3 style="margin-top:0">Cloud Sync</h3>
          <p style="color:var(--muted)">Keep your data in Firebase Realtime Database. Works offline; sync when online.</p>
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

      <!-- Theme -->
      <div class="card">
        <div class="card-body">
          <h3 style="margin-top:0">Theme</h3>
          <div class="theme-inline">
            <div>
              <label style="font-size:12px;color:var(--muted)">Mode</label>
              <select id="theme-mode" class="input">
                ${(window.THEME_MODES||[{key:'light',name:'Light'},{key:'dark',name:'Dark'},{key:'aqua',name:'Aqua'}])
                  .map(m=>`<option value="${m.key}" ${theme.mode===m.key?'selected':''}>${m.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:12px;color:var(--muted)">Font Size</label>
              <select id="theme-size" class="input">
                ${(window.THEME_SIZES||[{key:'small',pct:90,label:'Small'},{key:'medium',pct:100,label:'Medium'},{key:'large',pct:112,label:'Large'}])
                  .map(s=>`<option value="${s.key}" ${theme.size===s.key?'selected':''}>${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- EmailJS -->
      <div class="card">
        <div class="card-body">
          <h3 style="margin-top:0">Email (Contact)</h3>
          <p style="color:var(--muted)">Configure EmailJS so the Contact page can send you messages.</p>
          <div class="grid cols-2">
            <input id="ej-service"  class="input" placeholder="Service ID"  value="${emailCfg.serviceId||''}"/>
            <input id="ej-template" class="input" placeholder="Template ID" value="${emailCfg.templateId||''}"/>
            <input id="ej-public"   class="input" placeholder="Public Key"  value="${emailCfg.publicKey||''}"/>
            <input id="ej-to"       class="input" placeholder="To Email (your inbox)" value="${emailCfg.toEmail||''}"/>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:10px">
            <button class="btn" id="ej-save"><i class="ri-save-3-line"></i> Save Email Settings</button>
          </div>
          <p style="color:var(--muted);font-size:12px;margin-top:8px">
            Tip: Include <code>&lt;script src="https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js"&gt;&lt;/script&gt;</code> in <code>index.html</code> to enable EmailJS.
          </p>
        </div>
      </div>

      <!-- Users -->
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

function wireSettings(){
  // Theme instant apply
  const mode = document.getElementById('theme-mode');
  const size = document.getElementById('theme-size');
  const applyThemeNow = ()=>{
    const t = { mode: mode.value, size: size.value };
    save('_theme2', t);
    if (typeof applyTheme === 'function') applyTheme();
    // Re-render to update palette everywhere
    if (typeof renderApp === 'function') renderApp();
  };
  mode?.addEventListener('change', applyThemeNow);
  size?.addEventListener('change', applyThemeNow);

  // Cloud controls
  const toggle = document.getElementById('cloud-toggle');
  const syncNow = document.getElementById('cloud-sync-now');

  toggle?.addEventListener('change', async (e)=>{
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

  syncNow?.addEventListener('click', async ()=>{
    try{
      if (!auth.currentUser){ notify('Sign in first.','warn'); return; }
      if (!cloud.isOn()){ notify('Turn Cloud Sync ON first in Settings.','warn'); return; }
      if (!navigator.onLine){ notify('You appear to be offline.','warn'); return; }
      await firebase.database().goOnline();
      await cloud.pushAll();
      notify('Synced');
    }catch(e){
      notify((e && e.message) || 'Sync failed','danger');
    }
  });

  // EmailJS save
  const ejSave = document.getElementById('ej-save');
  ejSave?.addEventListener('click', ()=>{
    const cfg = {
      serviceId: (document.getElementById('ej-service')?.value||'').trim(),
      templateId:(document.getElementById('ej-template')?.value||'').trim(),
      publicKey: (document.getElementById('ej-public')?.value||'').trim(),
      toEmail:   (document.getElementById('ej-to')?.value||'').trim(),
    };
    save('emailjs_cfg', cfg);
    notify('Email settings saved','ok');
  });

  // Users section wiring
  wireUsers();
}

// Users CRUD (Settings page)
function wireUsers(){
  if (!canManage()) return;
  const addBtn = document.getElementById('addUser');
  const table = document.querySelector('[data-section="users"]');
  addBtn?.addEventListener('click', ()=> openModal('m-user'));

  document.getElementById('save-user')?.addEventListener('click', ()=>{
    const users = load('users', []);
    const email = (document.getElementById('user-email')?.value || '').trim().toLowerCase();
    if (!email) return notify('Email required','warn');
    const obj = {
      name: (document.getElementById('user-name')?.value || email.split('@')[0]).trim(),
      email,
      username: (document.getElementById('user-username')?.value || email.split('@')[0]).trim(),
      role: (document.getElementById('user-role')?.value || 'user'),
      img: (document.getElementById('user-img')?.value || '').trim(),
      contact:'', password:''
    };
    const i = users.findIndex(x=>x.email.toLowerCase()===email);
    if (i>=0) users[i]=obj; else users.push(obj);
    save('users', users);
    closeModal('m-user'); notify('Saved'); renderApp();
  });

  table?.addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if (!btn) return;
    const email = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!email) return;

    if (btn.hasAttribute('data-edit')) {
      const users = load('users', []); const u = users.find(x=>x.email===email); if (!u) return;
      openModal('m-user');
      document.getElementById('user-name').value=u.name;
      document.getElementById('user-email').value=u.email;
      document.getElementById('user-username').value=u.username;
      document.getElementById('user-role').value=u.role;
      document.getElementById('user-img').value=u.img||'';
    } else {
      let users = load('users', []).filter(x=>x.email!==email);
      save('users', users); notify('Deleted'); renderApp();
    }
  });
}

// ---------- ALL Modals ----------
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

// Image preview modal (for phones)
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

// Ensure Settings wiring is called on render when route==settings
(function(){
  const _oldRenderApp = window.renderApp;
  if (!_oldRenderApp || _oldRenderApp.__wrappedByPartE) return;

  window.renderApp = function(){
    _oldRenderApp.call(this);

    if (window.currentRoute === 'settings') {
      wireSettings();
    }
    if (window.currentRoute === 'contact') {
      wireContact();
    }

    // Make sure mobile image preview is available where needed
    enableMobileImagePreview?.();
  };
  window.renderApp.__wrappedByPartE = true;
})();

// =================== End Part E ===================

// Part F — Search utilities + bootstrapping
// ===================== Part F =====================
// Search index helpers (guarded) + bootstrapping + small quality-of-life hooks.

// ---------- Search index utilities (define once) ----------
if (typeof window.buildSearchIndex !== 'function') {
  window.buildSearchIndex = function buildSearchIndex(){
    const posts = (typeof load==='function') ? load('posts', []) : [];
    const inv   = load?.('inventory', []) || [];
    const prods = load?.('products', []) || [];
    const cogs  = load?.('cogs', []) || [];
    const users = load?.('users', []) || [];

    const pages = [
      { id:'policy',  label:'Policy',      section:'Pages', route:'policy'  },
      { id:'license', label:'License',     section:'Pages', route:'license' },
      { id:'setup',   label:'Setup Guide', section:'Pages', route:'setup'   },
      { id:'contact', label:'Contact',     section:'Pages', route:'contact' },
      { id:'guide',   label:'User Guide',  section:'Pages', route:'guide'   },
    ];

    const ix = [];
    posts.forEach(p => ix.push({
      id:p.id, label:p.title, section:'Posts', route:'dashboard',
      text:`${p.title} ${p.body}`
    }));
    inv.forEach(i => ix.push({
      id:i.id, label:i.name, section:'Inventory', route:'inventory',
      text:`${i.name} ${i.code} ${i.type}`
    }));
    prods.forEach(p => ix.push({
      id:p.id, label:p.name, section:'Products', route:'products',
      text:`${p.name} ${p.barcode} ${p.type} ${p.ingredients}`
    }));
    cogs.forEach(r => ix.push({
      id:r.id, label:r.date, section:'COGS', route:'cogs',
      text:`${r.date} ${r.grossIncome} ${r.produceCost} ${r.itemCost} ${r.freight} ${r.delivery} ${r.other}`
    }));
    users.forEach(u => ix.push({
      id:u.email, label:u.name, section:'Users', route:'settings',
      text:`${u.name} ${u.email} ${u.role}`
    }));
    pages.forEach(p => ix.push(p));
    return ix;
  };
}

if (typeof window.searchAll !== 'function') {
  window.searchAll = function searchAll(index, q){
    const term = (q || '').toLowerCase();
    return index
      .map(item => {
        const labelHit = (item.label||'').toLowerCase().includes(term) ? 2 : 0;
        const textHit  = (item.text ||'').toLowerCase().includes(term) ? 1 : 0;
        return { item, score: labelHit + textHit };
      })
      .filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score)
      .map(x => x.item);
  };
}

if (typeof window.scrollToRow !== 'function') {
  window.scrollToRow = function scrollToRow(id){
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  };
}

// ---------- Online / offline hint (optional but handy on mobile) ----------
(function(){
  if (!('addEventListener' in window)) return;
  window.addEventListener('online',  ()=> typeof notify==='function' && notify('Back online','ok'));
  window.addEventListener('offline', ()=> typeof notify==='function' && notify('You are offline','warn'));
})();

// ---------- Service Worker (optional; if you add /service-worker.js later) ----------
(function(){
  if ('serviceWorker' in navigator) {
    // Don’t block rendering; register in idle time
    window.requestIdleCallback
      ? requestIdleCallback(()=> navigator.serviceWorker.register('/service-worker.js').catch(()=>{}))
      : setTimeout(()=> navigator.serviceWorker.register('/service-worker.js').catch(()=>{}), 500);
  }
})();

// ---------- First paint bootstrapping ----------
(function boot(){
  // If Part A already rendered via auth state, great.
  // But on very first load (no session yet), ensure we show Login immediately.
  try {
    if (typeof renderApp === 'function' && window.session) {
      renderApp();
    } else if (typeof renderLogin === 'function') {
      renderLogin();
    }
  } catch(e){
    // Show a soft error so you can see it on mobile
    if (typeof notify === 'function') notify(e.message || 'Startup error','danger');
    // still try to show login
    if (typeof renderLogin === 'function') renderLogin();
  }
})();

// ---------- Expose tiny debug API ----------
window._inventory = Object.assign(window._inventory || {}, {
  go: (typeof go === 'function' ? go : undefined),
  load: (typeof load === 'function' ? load : undefined),
  save: (typeof save === 'function' ? save : undefined),
  cloud: (typeof cloud !== 'undefined' ? cloud : undefined),
  theme: (typeof getTheme === 'function' ? getTheme() : undefined),
  renderApp: (typeof renderApp === 'function' ? renderApp : undefined)
});

// =================== End Part F ===================