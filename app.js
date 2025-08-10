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
  const n = $('#notification');
  if (!n) return;
  n.textContent = msg;
  n.className = `notification show ${type}`;
  setTimeout(()=> n.className='notification', 2200);
};

function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }

// --- Globals & Prefill --------------------------------------------------------
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];

// Prefill on first run (localStorage only)
(function seedOnFirstRun(){
  if (load('_seeded', false)) return;
  const now = Date.now();

  const users = [
    { name:'Admin', username:'admin', email:'admin@sushi.com', contact:'', role:'admin', password:'', img:'' },
    { name:'Manager', username:'manager', email:'minmaung0307@gmail.com', contact:'', role:'manager', password:'', img:'' },
    { name:'Cashier One', username:'cashier1', email:'cashier@sushi.com', contact:'', role:'user', password:'', img:'' },
  ];
  const inventory = [
    { id:'inv1', img:'', name:'Nori Sheets', code:'NOR-100', price:3.00, stock:80, threshold:30 },
    { id:'inv2', img:'', name:'Sushi Rice', code:'RIC-200', price:1.50, stock:24, threshold:20 },
    { id:'inv3', img:'', name:'Fresh Salmon', code:'SAL-300', price:7.80, stock:10, threshold:12 },
  ];
  const products = [
    { id:'p1', img:'', name:'Salmon Nigiri', barcode:'11100001', price:5.99, type:'Nigiri', ingredients:'Rice, Salmon', instructions:'Brush with nikiri.', card:true },
    { id:'p2', img:'', name:'California Roll', barcode:'11100002', price:7.49, type:'Roll', ingredients:'Rice, Nori, Crab, Avocado', instructions:'8 pcs.', card:true },
  ];
  const posts = [
    { id:'post1', title:'Welcome to Sushi POS', body:'This is your dashboard. Create products, track stock, and sell faster.', img:'', createdAt: now }
  ];
  const tasks = [
    { id:'t1', title:'Prep Salmon', status:'todo' },
    { id:'t2', title:'Cook Rice', status:'inprogress' },
    { id:'t3', title:'Sanitize Station', status:'done' },
  ];
  const cogs = [
    { id:'c1', date:'2025-08-01', grossIncome: 1200.00, produceCost: 280.00, itemCost: 180.00, freight: 45.00, delivery: 30.00, other: 20.00 },
    { id:'c2', date:'2025-08-02', grossIncome: 900.00,  produceCost: 220.00, itemCost: 140.00, freight: 30.00, delivery: 25.00, other: 10.00 }
  ];

  save('users', users);
  save('inventory', inventory);
  save('products', products);
  save('posts', posts);
  save('tasks', tasks);
  save('cogs', cogs);
  save('_seeded', true);
})();

// --- Session / Theme ----------------------------------------------------------
let session = load('session', null);
let currentRoute = load('_route', 'dashboard');

const THEMES = [
  { key:'light',  name:'Light',  class:'light', baseSize:100 },
  { key:'dark',   name:'Dark',   class:'dark',  baseSize:100 },
  { key:'aqua',   name:'Aqua',   class:'',      baseSize:100 }, // default
  { key:'big',    name:'Big Text', class:'',    baseSize:112 },
];

function applyTheme(){
  const t = load('_theme', { key:'aqua', class:'', baseSize:100 });
  document.documentElement.setAttribute('data-theme', t.key==='light' ? 'light' : (t.key==='dark' ? 'dark' : ''));
  document.documentElement.style.setProperty('--font-scale', t.baseSize + '%');
}

applyTheme();

// --- Router helpers -----------------------------------------------------------
function go(route){
  currentRoute = route;
  save('_route', route);
  renderApp();
}

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
    session = { ...prof };
    save('session', session);
    renderApp();
  } else {
    session = null; save('session', null);
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
    } catch (e) {
      notify(e.message || 'Login failed','danger');
    }
  };
}

async function doLogout(){
  await auth.signOut();
  notify('Signed out');
}

// --- Sidebar (with Global Search + Links + Socials) ---------------------------
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
        <input id="globalSearch" placeholder="Search everything…" />
        <div id="searchResults" class="search-results"></div>
      </div>

      <h6>Menu</h6>
      <nav class="nav">
        ${links.map(l => `
          <a class="item ${active===l.route?'active':''}" data-route="${l.route}">
            <i class="${l.icon}"></i> <span>${l.label}</span>
          </a>`).join('')}
      </nav>

      <h6>Links</h6>
      <div class="links">
        ${pages.map(p => `
          <a class="item" data-route="${p.route}">
            <i class="${p.icon}"></i> <span>${p.label}</span>
          </a>`).join('')}
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
  // nav clicks
  $$('.sidebar .item').forEach(a => {
    a.onclick = (e)=> {
      const r = a.getAttribute('data-route');
      if (r) { closeSidebar(); go(r); }
    };
  });

  // Global search
  const input = $('#globalSearch');
  const results = $('#searchResults');
  const indexData = buildSearchIndex();
  let searchTimer;

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
          const route = row.getAttribute('data-route');
          const id = row.getAttribute('data-id') || null;
          results.classList.remove('active');
          input.value = '';
          go(route);
          if (id) setTimeout(()=> scrollToRow(id), 50);
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

  const index = [];
  inventory.forEach(x => index.push({section:'Inventory', route:'inventory', id:x.id, label:`${x.name} (${x.code})`, haystack:`${x.name} ${x.code}`.toLowerCase()}));
  products.forEach(x => index.push({section:'Products', route:'products', id:x.id, label:`${x.name} ($${x.price.toFixed(2)})`, haystack:`${x.name} ${x.barcode} ${x.ingredients} ${x.type}`.toLowerCase()}));
  users.forEach(x => index.push({section:'Users', route:'settings', id:x.email, label:`${x.name} – ${x.role}`, haystack:`${x.name} ${x.username} ${x.email} ${x.role}`.toLowerCase()}));
  posts.forEach(x => index.push({section:'Posts', route:'dashboard', id:x.id, label:x.title, haystack:`${x.title} ${x.body}`.toLowerCase()}));
  tasks.forEach(x => index.push({section:'Tasks', route:'tasks', id:x.id, label:`${x.title} (${x.status})`, haystack:`${x.title} ${x.status}`.toLowerCase()}));
  cogs.forEach(x => index.push({section:'COGS', route:'cogs', id:x.id, label:`COGS ${x.date}`, haystack:`${x.date} ${x.grossIncome} ${x.grossProfit}`.toLowerCase()}));
  return index;
}
function searchAll(index, q){ return index.filter(i => i.haystack.includes(q)); }
function scrollToRow(id){
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
}

// --- Header / Burger ----------------------------------------------------------
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

// --- View renderers -----------------------------------------------------------
// Currency
const USD = x => `$${Number(x||0).toFixed(2)}`;

// Dashboard
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
        <div class="grid">
          ${posts.map(p => `
            <div class="card" id="${p.id}">
              <div class="card-body">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div><strong>${p.title}</strong><div style="color:var(--muted);font-size:12px">${new Date(p.createdAt).toLocaleString()}</div></div>
                  <div>
                    <button class="btn ghost" data-edit-post="${p.id}"><i class="ri-edit-line"></i></button>
                    <button class="btn danger" data-del-post="${p.id}"><i class="ri-delete-bin-6-line"></i></button>
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

// Inventory
function viewInventory(){
  const items = load('inventory', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Inventory</h3>
          ${canCreate() ? `<button class="btn" id="addInv"><i class="ri-add-line"></i> Add Item</button>` : ''}
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>Image</th><th>Name</th><th>Code</th><th>Price</th><th>Stock</th><th>Threshold</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${items.map(it => {
                const warnClass = it.stock <= it.threshold ? (it.stock <= Math.max(1, Math.floor(it.threshold*0.6)) ? 'tr-danger' : 'tr-warn') : '';
                return `<tr id="${it.id}" class="${warnClass}">
                  <td>${it.img?`<img class="thumb" src="${it.img}"/>`:`<div class="thumb" style="display:grid;place-items:center">🍙</div>`}</td>
                  <td>${it.name}</td>
                  <td>${it.code}</td>
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
                    <button class="btn ghost" data-edit="${it.id}"><i class="ri-edit-line"></i></button>
                    <button class="btn danger" data-del="${it.id}"><i class="ri-delete-bin-6-line"></i></button>
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

// Products
function viewProducts(){
  const items = load('products', []);
  return `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Products</h3>
          ${canCreate() ? `<button class="btn" id="addProd"><i class="ri-add-line"></i> Add Product</button>` : ''}
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>Image</th><th>Name</th><th>Barcode</th><th>Price</th><th>Type</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${items.map(it => `
                <tr id="${it.id}">
                  <td>${it.img?`<img class="thumb" src="${it.img}"/>`:`<div class="thumb" style="display:grid;place-items:center">🍤</div>`}</td>
                  <td><a href="#" data-card="${it.id}">${it.name}</a></td>
                  <td>${it.barcode}</td>
                  <td>${USD(it.price)}</td>
                  <td>${it.type||'-'}</td>
                  <td>
                    <button class="btn ghost" data-edit="${it.id}"><i class="ri-edit-line"></i></button>
                    <button class="btn danger" data-del="${it.id}"><i class="ri-delete-bin-6-line"></i></button>
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
          ${canCreate() ? `<button class="btn" id="addCOGS"><i class="ri-add-line"></i> Add Row</button>` : ''}
        </div>
        <div class="table-wrap">
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
                    <button class="btn ghost" data-edit="${r.id}"><i class="ri-edit-line"></i></button>
                    <button class="btn danger" data-del="${r.id}"><i class="ri-delete-bin-6-line"></i></button>
                  </td>
                </tr>`).join('')}
              <tr>
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

// Tasks (simple lanes)
function viewTasks(){
  const items = load('tasks', []);
  const lane = (key, label)=>`
    <div class="card">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h3 style="margin:0">${label}</h3>
          ${key==='todo' && canCreate()? `<button class="btn" id="addTask"><i class="ri-add-line"></i> Add Task</button>`:''}
        </div>
        <div class="grid">
          ${items.filter(t=>t.status===key).map(t=>`
            <div class="card" id="${t.id}">
              <div class="card-body" style="display:flex;justify-content:space-between;align-items:center">
                <div>${t.title}</div>
                <div>
                  <select data-move="${t.id}">
                    <option value="todo" ${t.status==='todo'?'selected':''}>To do</option>
                    <option value="inprogress" ${t.status==='inprogress'?'selected':''}>In progress</option>
                    <option value="done" ${t.status==='done'?'selected':''}>Done</option>
                  </select>
                  <button class="btn ghost" data-edit="${t.id}"><i class="ri-edit-line"></i></button>
                  <button class="btn danger" data-del="${t.id}"><i class="ri-delete-bin-6-line"></i></button>
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;
  return `
    <div class="grid cols-3">
      ${lane('todo','To do')}
      ${lane('inprogress','In progress')}
      ${lane('done','Done')}
    </div>
    ${taskModal()}
  `;
}

// Settings (Users + Theme)
function viewSettings(){
  const users = load('users', []);
  const theme = load('_theme', THEMES[2]);

  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="margin:0">Users</h3>
            ${canManage()? `<button class="btn" id="addUser"><i class="ri-add-line"></i> Add User</button>`:''}
          </div>
          <table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              ${users.map(u=>`
                <tr id="${u.email}">
                  <td>${u.name}</td>
                  <td>${u.email}</td>
                  <td>${u.role}</td>
                  <td>
                    <button class="btn ghost" data-edit="${u.email}"><i class="ri-edit-line"></i></button>
                    <button class="btn danger" data-del="${u.email}"><i class="ri-delete-bin-6-line"></i></button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h3 style="margin-top:0">Theme</h3>
          <div class="theme-presets">
            ${THEMES.map(t=>`
              <div class="theme-card">
                <div class="preview"></div>
                <div class="meta">
                  <div class="name">${t.name}</div>
                  <div class="size">${t.baseSize}%</div>
                </div>
                <div style="padding:0 12px 12px">
                  <button class="btn secondary" data-theme="${t.key}">Use ${t.name}</button>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    ${userModal()}
  `;
}

// Static pages
const pageContent = {
  policy: `<h3>Policy</h3><p>Our basic privacy and data usage policy for Sushi POS.</p>`,
  license:`<h3>License</h3><p>This app is provided under a permissive license for your restaurant use.</p>`,
  setup:  `<h3>Setup Guide</h3><ol><li>Create Firebase Auth users.</li><li>Sign in as admin/manager.</li><li>Use Settings to tune roles and Theme.</li></ol>`,
  contact:`<h3>Contact</h3><p>Questions? Email us at support@sushipos.example</p>`
};
function viewPage(key){
  return `<div class="card"><div class="card-body">${pageContent[key]||'<p>Page</p>'}</div></div>`;
}

// --- Permission helpers -------------------------------------------------------
function canManage(){ return session && (session.role==='admin' || session.role==='manager'); }
function canCreate(){ return session && (session.role==='admin' || session.role==='manager'); }

// --- Modals (posts/inventory/products/tasks/users/cogs) ----------------------
// For brevity, modals are simple; all forms are modal-based (no alerts).

function postModal(){
  if (!canCreate()) return '';
  return `
  <div class="modal-backdrop" id="mb-post"></div>
  <div class="modal" id="m-post">
    <div class="dialog">
      <div class="head"><strong>Post</strong><button class="btn ghost" data-close="m-post">Close</button></div>
      <div class="body grid">
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
            : viewPage(currentRoute) }
        </div>
      </div>
    </div>
  `;

  hookSidebarInteractions();

  // Burger / back home / logout
  $('#burger')?.addEventListener('click', openSidebar);
  $('#backdrop')?.addEventListener('click', closeSidebar);
  $('#btnHome')?.addEventListener('click', ()=> go('dashboard'));
  $('#btnLogout')?.addEventListener('click', doLogout);

  // Dashboard actions
  $$('.tile').forEach(t=>{
    t.onclick = ()=> { const r=t.getAttribute('data-go'); if (r) go(r); };
  });

  // Posts
  if ($('#addPost')) {
    $('#addPost').onclick = ()=> openModal('m-post');
  }
  $$('#save-post').forEach(btn=>{
    btn.onclick = ()=>{
      const posts = load('posts', []);
      const obj = {
        id:'post_'+Date.now(),
        title: $('#post-title').value.trim(),
        body: $('#post-body').value.trim(),
        img: $('#post-img').value.trim(),
        createdAt: Date.now()
      };
      if (!obj.title) return notify('Title required','warn');
      posts.unshift(obj); save('posts', posts);
      notify('Post saved'); closeModal('m-post'); renderApp();
    };
  });
  $$('[data-edit-post]').forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute('data-edit-post');
      const posts = load('posts', []);
      const p = posts.find(x=>x.id===id); if (!p) return;
      openModal('m-post');
      $('#post-title').value = p.title;
      $('#post-body').value = p.body;
      $('#post-img').value = p.img||'';
      $('#save-post').onclick = ()=>{
        p.title = $('#post-title').value.trim();
        p.body = $('#post-body').value.trim();
        p.img = $('#post-img').value.trim();
        save('posts', posts); notify('Updated'); closeModal('m-post'); renderApp();
      };
    };
  });
  $$('[data-del-post]').forEach(b=>{
    b.onclick = ()=>{
      const id=b.getAttribute('data-del-post');
      let posts = load('posts', []).filter(x=>x.id!==id);
      save('posts', posts); notify('Deleted'); renderApp();
    };
  });

  // Inventory
  if ($('#addInv')) $('#addInv').onclick = ()=> openModal('m-inv');
  $$('#save-inv').forEach(btn=>{
    btn.onclick = ()=>{
      const items = load('inventory', []);
      const id = $('#inv-id').value || ('inv_'+Date.now());
      const obj = {
        id,
        name: $('#inv-name').value.trim(),
        code: $('#inv-code').value.trim(),
        price: parseFloat($('#inv-price').value||'0'),
        stock: parseInt($('#inv-stock').value||'0'),
        threshold: parseInt($('#inv-threshold').value||'0'),
        img: $('#inv-img').value.trim(),
      };
      if (!obj.name) return notify('Name required','warn');
      const i = items.findIndex(x=>x.id===id);
      if (i>=0) items[i]=obj; else items.push(obj);
      save('inventory', items); notify('Saved'); closeModal('m-inv'); renderApp();
    };
  });
  $$('[data-edit]').forEach(b=>{
    const id=b.getAttribute('data-edit');
    if (b.closest('table')?.closest('.card')?.textContent.includes('Inventory')) {
      b.onclick = ()=>{
        const items = load('inventory', []);
        const it = items.find(x=>x.id===id); if (!it) return;
        openModal('m-inv');
        $('#inv-id').value=id; $('#inv-name').value=it.name; $('#inv-code').value=it.code;
        $('#inv-price').value=it.price; $('#inv-stock').value=it.stock;
        $('#inv-threshold').value=it.threshold; $('#inv-img').value=it.img||'';
      };
    }
  });
  $$('[data-del]').forEach(b=>{
    const id=b.getAttribute('data-del');
    if (b.closest('table')?.closest('.card')?.textContent.includes('Inventory')) {
      b.onclick = ()=>{
        let items = load('inventory', []).filter(x=>x.id!==id);
        save('inventory', items); notify('Deleted'); renderApp();
      };
    }
  });
  $$('[data-inc]').forEach(b=>{
    b.onclick = ()=>{
      const id=b.getAttribute('data-inc');
      const items = load('inventory', []);
      const it = items.find(x=>x.id===id); if (!it) return;
      it.stock++; save('inventory', items); renderApp();
    };
  });
  $$('[data-dec]').forEach(b=>{
    b.onclick = ()=>{
      const id=b.getAttribute('data-dec');
      const items = load('inventory', []);
      const it = items.find(x=>x.id===id); if (!it) return;
      it.stock=Math.max(0,it.stock-1); save('inventory', items); renderApp();
    };
  });
  $$('[data-inc-th]').forEach(b=>{
    b.onclick = ()=>{
      const id=b.getAttribute('data-inc-th');
      const items = load('inventory', []);
      const it = items.find(x=>x.id===id); if (!it) return;
      it.threshold++; save('inventory', items); renderApp();
    };
  });
  $$('[data-dec-th]').forEach(b=>{
    b.onclick = ()=>{
      const id=b.getAttribute('data-dec-th');
      const items = load('inventory', []);
      const it = items.find(x=>x.id===id); if (!it) return;
      it.threshold=Math.max(0,it.threshold-1); save('inventory', items); renderApp();
    };
  });

  // Products
  if ($('#addProd')) $('#addProd').onclick = ()=> openModal('m-prod');
  $$('#save-prod').forEach(btn=>{
    btn.onclick = ()=>{
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
      save('products', items); notify('Saved'); closeModal('m-prod'); renderApp();
    };
  });
  // Edit/Delete within products table
  $$('table .btn.ghost[data-edit]').forEach(b=>{
    if (b.closest('table')?.closest('.card')?.textContent.includes('Products')) {
      b.onclick = ()=>{
        const id=b.getAttribute('data-edit');
        const items = load('products', []);
        const it = items.find(x=>x.id===id); if (!it) return;
        openModal('m-prod');
        $('#prod-id').value=id; $('#prod-name').value=it.name; $('#prod-barcode').value=it.barcode;
        $('#prod-price').value=it.price; $('#prod-type').value=it.type;
        $('#prod-ingredients').value=it.ingredients; $('#prod-instructions').value=it.instructions;
        $('#prod-img').value=it.img||'';
      };
    }
  });
  $$('table .btn.danger[data-del]').forEach(b=>{
    if (b.closest('table')?.closest('.card')?.textContent.includes('Products')) {
      b.onclick = ()=>{
        const id=b.getAttribute('data-del');
        let items = load('products', []).filter(x=>x.id!==id);
        save('products', items); notify('Deleted'); renderApp();
      };
    }
  });
  // Product card
  $$('[data-card]').forEach(a=>{
    a.onclick = (e)=>{
      e.preventDefault();
      const id = a.getAttribute('data-card');
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

  // COGS
  if ($('#addCOGS')) $('#addCOGS').onclick = ()=> openModal('m-cogs');
  if ($('#save-cogs')) {
    $('#save-cogs').onclick = ()=>{
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
      save('cogs', rows); notify('Saved'); closeModal('m-cogs'); renderApp();
    };
  }
  // COGS table edit/del
  $$('table .btn.ghost[data-edit]').forEach(b=>{
    if (b.closest('table')?.closest('.card')?.textContent.includes('COGS')) {
      b.onclick = ()=>{
        const id=b.getAttribute('data-edit');
        const rows = load('cogs', []);
        const r = rows.find(x=>x.id===id); if (!r) return;
        openModal('m-cogs');
        $('#cogs-id').value=id; $('#cogs-date').value=r.date;
        $('#cogs-grossIncome').value=r.grossIncome; $('#cogs-produceCost').value=r.produceCost;
        $('#cogs-itemCost').value=r.itemCost; $('#cogs-freight').value=r.freight;
        $('#cogs-delivery').value=r.delivery; $('#cogs-other').value=r.other;
      };
    }
  });
  $$('table .btn.danger[data-del]').forEach(b=>{
    if (b.closest('table')?.closest('.card')?.textContent.includes('COGS')) {
      b.onclick = ()=>{
        const id=b.getAttribute('data-del');
        let rows = load('cogs', []).filter(x=>x.id!==id);
        save('cogs', rows); notify('Deleted'); renderApp();
      };
    }
  });

  // Tasks
  if ($('#addTask')) $('#addTask').onclick = ()=> openModal('m-task');
  if ($('#save-task')) {
    $('#save-task').onclick = ()=>{
      const items = load('tasks', []);
      const id = $('#task-id').value || ('t_'+Date.now());
      const obj = { id, title: $('#task-title').value.trim(), status: $('#task-status').value };
      const i = items.findIndex(x=>x.id===id);
      if (i>=0) items[i]=obj; else items.push(obj);
      save('tasks',items); notify('Saved'); closeModal('m-task'); renderApp();
    };
  }
  $$('select[data-move]').forEach(s=>{
    s.onchange = ()=>{
      const id = s.getAttribute('data-move');
      const items = load('tasks', []);
      const t = items.find(x=>x.id===id); if (!t) return;
      t.status = s.value; save('tasks', items); renderApp();
    };
  });
  $$('[data-edit]').forEach(b=>{
    if (b.closest('.card')?.querySelector('h3')?.textContent.includes('To do') ||
        b.closest('.card')?.querySelector('h3')?.textContent.includes('In progress') ||
        b.closest('.card')?.querySelector('h3')?.textContent.includes('Done')) {
      b.onclick = ()=>{
        const id=b.getAttribute('data-edit');
        const items = load('tasks', []);
        const t = items.find(x=>x.id===id); if (!t) return;
        openModal('m-task');
        $('#task-id').value=id; $('#task-title').value=t.title; $('#task-status').value=t.status;
      };
    }
  });
  $$('[data-del]').forEach(b=>{
    if (b.closest('.card')?.querySelector('h3')?.textContent.match(/To do|In progress|Done/)) {
      b.onclick = ()=>{
        const id=b.getAttribute('data-del');
        let items = load('tasks', []).filter(x=>x.id!==id);
        save('tasks', items); notify('Deleted'); renderApp();
      };
    }
  });

  // Users
  if ($('#addUser')) $('#addUser').onclick = ()=> openModal('m-user');
  if ($('#save-user')) {
    $('#save-user').onclick = ()=>{
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
      save('users', users); notify('Saved'); closeModal('m-user'); renderApp();
    };
  }
  // Users edit/del
  $$('table .btn.ghost[data-edit]').forEach(b=>{
    if (b.closest('table')?.closest('.card')?.textContent.includes('Users')) {
      b.onclick = ()=>{
        const email=b.getAttribute('data-edit');
        const users = load('users', []);
        const u = users.find(x=>x.email===email); if (!u) return;
        openModal('m-user');
        $('#user-name').value=u.name; $('#user-email').value=u.email;
        $('#user-username').value=u.username; $('#user-role').value=u.role;
        $('#user-img').value=u.img||'';
      };
    }
  });
  $$('table .btn.danger[data-del]').forEach(b=>{
    if (b.closest('table')?.closest('.card')?.textContent.includes('Users')) {
      b.onclick = ()=>{
        const email=b.getAttribute('data-del');
        let users = load('users', []).filter(x=>x.email!==email);
        save('users', users); notify('Deleted'); renderApp();
      };
    }
  });

  // Theme switching
  $$('[data-theme]').forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.getAttribute('data-theme');
      const found = THEMES.find(t=>t.key===key);
      if (!found) return;
      save('_theme', found); applyTheme(); notify(`Theme: ${found.name}`); renderApp();
    };
  });

  // Close modal buttons
  $$('[data-close]').forEach(b=> b.onclick = ()=> closeModal(b.getAttribute('data-close')));
}

function openModal(id){ $('#'+id)?.classList.add('active'); $('#mb-'+id.split('-')[1])?.classList.add('active'); }
function closeModal(id){ $('#'+id)?.classList.remove('active'); $('#mb-'+id.split('-')[1])?.classList.remove('active'); }

// Initial render
if (session) renderApp();

// Expose for debugging
window._sushipos = { go, load, save };