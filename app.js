// --- Firebase (Auth only) ----------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBY52zMMQqsvssukui3TfQnMigWoOzeKGk",
  authDomain: "sushi-pos.firebaseapp.com",
  projectId: "sushi-pos"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// --- DOM helpers --------------------------------------------------------------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const notify = (msg, type='ok') => {
  const n = $('#notification'); if (!n) return;
  n.textContent = msg; n.className = `notification show ${type}`;
  setTimeout(()=> n.className='notification', 2200);
};
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }

// --- Globals & Prefill --------------------------------------------------------
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];
let session = load('session', null);
let currentRoute = load('_route', 'dashboard');
let searchQuery = load('_searchQ', '');

// Prefill localStorage (one-time)
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
    { id:'post1', title:'Welcome to Sushi POS', body:'Create products, track stock, sell faster.', img:'', createdAt: now }
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
    const users = load('users', []);
    let prof = users.find(u => (u.email||'').toLowerCase() === email);
    if (!prof) {
      const role = SUPER_ADMINS.includes(email) ? 'admin' : 'user';
      prof = { name: role==='admin'?'Admin':'User', username: email.split('@')[0], email, contact:'', role, password:'', img:'' };
      users.push(prof); save('users', users);
    } else if (SUPER_ADMINS.includes(email) && prof.role!=='admin') {
      prof.role = 'admin'; save('users', users);
    }
    session = { ...prof }; save('session', session);
    resetIdleTimer();
    renderApp();
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
            <div class="logo">🍣</div>
            <div class="login-badge">Manager / Admin</div>
          </div>
          <h2 style="text-align:center;margin:6px 0 2px">Sushi POS</h2>
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
async function doLogout(){ await auth.signOut(); notify('Signed out'); }

// --- Sidebar + Search ---------------------------------------------------------
function renderSidebar(active='dashboard'){
  const links = [
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
  ];
  return `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="logo">🍣</div>
        <div class="title">Sushi POS</div>
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
  // nav clicks (close after click)
  $$('.sidebar .item').forEach(a => {
    a.onclick = ()=> { const r = a.getAttribute('data-route'); if (r) { go(r); closeSidebar(); } };
  });

  // Global search -> shows mini suggestions AND opens Search page in main pane
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
          // Put the exact search into the search page for context
          openResultsPage(label);
          results.classList.remove('active');
          input.value = '';
          closeSidebar();
          // Optional: scroll later by id if available
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

function buildSearchIndex(){
  const inventory = load('inventory', []);
  const products = load('products', []);
  const users = load('users', []);
  const posts = load('posts', []);
  const tasks = load('tasks', []);
  const cogs = load('cogs', []);
  const idx = [];
  inventory.forEach(x => idx.push({section:'Inventory', route:'inventory', id:x.id, label:`${x.name} (${x.code})`, haystack:`${x.name} ${x.code} ${x.type}`.toLowerCase()}));
  products.forEach(x => idx.push({section:'Products', route:'products', id:x.id, label:`${x.name} ($${x.price.toFixed(2)})`, haystack:`${x.name} ${x.barcode} ${x.ingredients} ${x.type}`.toLowerCase()}));
  users.forEach(x => idx.push({section:'Users', route:'settings', id:x.email, label:`${x.name} – ${x.role}`, haystack:`${x.name} ${x.username} ${x.email} ${x.role}`.toLowerCase()}));
  posts.forEach(x => idx.push({section:'Posts', route:'dashboard', id:x.id, label:x.title, haystack:`${x.title} ${x.body}`.toLowerCase()}));
  tasks.forEach(x => idx.push({section:'Tasks', route:'tasks', id:x.id, label:`${x.title} (${x.status})`, haystack:`${x.title} ${x.status}`.toLowerCase()}));
  cogs.forEach(x => idx.push({section:'COGS', route:'cogs', id:x.id, label:`COGS ${x.date}`, haystack:`${x.date}`.toLowerCase()}));
  return idx;
}
function searchAll(index, q){ return index.filter(i => i.haystack.includes(q.toLowerCase())); }
function scrollToRow(id){ const el = document.getElementById(id); if (el) el.scrollIntoView({behavior:'smooth', block:'center'}); }

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

// Search page (main pane)
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

// Dashboard (unchanged tiles + posts modal)
function viewDashboard(){
  const posts = load('posts', []);
  const inv = load('inventory', []);
  const prods = load('products', []);
  const users = load('users', []);

  return `
    <div class="grid cols-4 auto">
      <div class="card tile" data-go="inventory"><div>Total Items</div><h2>${inv.length}</h2></div>
      <div class="card tile" data-go="products"><div>Products</div><h2>${prods.length}</h2></div>
      <div class="card tile" data-go="settings"><div>Users</div><h2>${users.length}</h2></div>
      <div class="card tile" data-go="tasks"><div>Tasks</div><h2>${load('tasks',[]).length}</h2></div>
    </div>

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

    ${postModal()}
  `;
}

// Inventory with header bg
function viewInventory(){
  const items = load('inventory', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Inventory</h3>
          ${canCreate() ? `<button class="btn" id="addInv"><i class="ri-add-line"></i> Add Item</button>` : ''}
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
                      ${it.img?`<img class="thumb" src="${it.img}" alt=""/>`:`<div class="thumb" style="display:grid;place-items:center">🍙</div>`}
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
  `;
}

// Products with header bg
function viewProducts(){
  const items = load('products', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Products</h3>
          ${canCreate() ? `<button class="btn" id="addProd"><i class="ri-add-line"></i> Add Product</button>` : ''}
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
                      ${it.img?`<img class="thumb prod-thumb" data-card="${it.id}" src="${it.img}" alt=""/>`:`<div class="thumb prod-thumb" data-card="${it.id}" style="display:grid;place-items:center;cursor:pointer">🍤</div>`}
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
  `;
}

// COGS with header bg + total bg
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
          ${canCreate() ? `<button class="btn" id="addCOGS"><i class="ri-add-line"></i> Add Row</button>` : ''}
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

// Tasks as full-width lanes + DnD highlight both ways
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

// Settings (Theme full width above Users full width)
function viewSettings(){
  const users = load('users', []);
  const theme = getTheme();
  return `
    <div class="grid">
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

// Static pages + Contact form
const pageContent = {
  policy: `<h3>Policy</h3><p>Our basic privacy and data usage policy for Sushi POS.</p>`,
  license:`<h3>License</h3><p>Permissive license for your restaurant use.</p>`,
  setup:  `<h3>Setup Guide</h3><ol><li>Create Firebase Auth users.</li><li>Sign in as admin/manager.</li><li>Use Settings to set roles & theme.</li></ol>`,
  contact:`<h3>Contact</h3>
    <p>Got a question? Send us a message.</p>
    <div class="grid cols-2">
      <input id="ct-name" class="input" placeholder="Your name" />
      <input id="ct-email" class="input" type="email" placeholder="Your email" />
    </div>
    <textarea id="ct-msg" class="input" rows="5" placeholder="Message"></textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:10px">
      <button id="ct-send" class="btn"><i class="ri-send-plane-line"></i> Send</button>
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
          ${ currentRoute==='dashboard' ? viewDashboard()
            : currentRoute==='inventory' ? viewInventory()
            : currentRoute==='products'  ? viewProducts()
            : currentRoute==='cogs'      ? viewCOGS()
            : currentRoute==='tasks'     ? viewTasks()
            : currentRoute==='settings'  ? viewSettings()
            : currentRoute==='search'    ? viewSearch()
            : viewPage(currentRoute) }
        </div>
      </div>
    </div>
  `;

  hookSidebarInteractions();

  // Burger / backdrop / home / logout
  $('#burger')?.addEventListener('click', openSidebar, { passive:true });
  $('#backdrop')?.addEventListener('click', closeSidebar, { passive:true });
  $('#btnHome')?.addEventListener('click', ()=> go('dashboard'));
  $('#btnLogout')?.addEventListener('click', doLogout);

  // Dashboard tiles click-through
  $$('.tile').forEach(t=>{ t.onclick = ()=> { const r=t.getAttribute('data-go'); if (r) go(r); }; });

  // Search "Open" buttons in main pane
  $$('#main [data-go]').forEach(btn=>{
    btn.onclick = ()=>{
      const r = btn.getAttribute('data-go'); const id = btn.getAttribute('data-id');
      go(r);
      if (id) setTimeout(()=> scrollToRow(id), 80);
    };
  });

  // Wire sections
  wirePosts();
  wireInventory();
  wireProducts();
  wireCOGS();
  wireTasks();
  wireUsers();
  wireTheme();
  wireProductCardClicks();
  setupDnD();

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

// COGS
function wireCOGS(){
  if ($('#addCOGS')) $('#addCOGS').onclick = ()=> openModal('m-cogs');
  const sec = $('[data-section="cogs"]'); if (!sec) return;

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

// Tasks DnD (bi-directional) + highlight
function setupDnD(){
  const lanes = ['todo','inprogress','done'];
  lanes.forEach(k=>{
    const lane = $('#lane-'+k); if (!lane) return;

    // Highlight parent card on drag over
    const parentCard = lane.closest('.lane-row');

    lane.ondragover = (e)=>{ e.preventDefault(); parentCard?.classList.add('drop'); };
    lane.ondragenter = (e)=>{ e.preventDefault(); parentCard?.classList.add('drop'); };
    lane.ondragleave = ()=> { parentCard?.classList.remove('drop'); };
    lane.ondrop = (e)=>{
      e.preventDefault();
      parentCard?.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const items = load('tasks', []);
      const t = items.find(x=>x.id===id); if (!t) return;
      t.status = k; save('tasks', items); renderApp();
    };
  });

  $$('[data-task]').forEach(card=>{
    card.ondragstart = (e)=> { e.dataTransfer.setData('text/plain', card.getAttribute('data-task')); };
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

// Theme dropdowns (instant apply)
function wireTheme(){
  const mode = $('#theme-mode'); const size = $('#theme-size');
  if (!mode || !size) return;
  const apply = ()=>{
    const t = { mode: mode.value, size: size.value };
    save('_theme2', t); applyTheme(); renderApp();
  };
  mode.onchange = apply;
  size.onchange = apply;
}

// Initial render
if (session) renderApp();

// Expose for debugging
window._sushipos = { go, load, save };