// ===================== Part 1 — Firebase + Helpers + Theme + Cloud + Auth =====================

// --- Firebase (Auth + Realtime Database)
var firebaseConfig = {
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
var auth = firebase.auth();
var db   = firebase.database();

// --- DOM helpers
function $(sel, root){ return (root||document).querySelector(sel); }
function $$(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function notify(msg, type){
  var n = $('#notification'); if (!n) return;
  n.textContent = msg; n.className = 'notification show ' + (type||'ok');
  setTimeout(function(){ n.className='notification'; }, 2200);
}
function save(key, val){
  localStorage.setItem(key, JSON.stringify(val));
  try { if (cloud && cloud.isOn()) cloud.saveKV(key, val).catch(function(){}); } catch(e){}
}
function load(key, fallback){
  try { var v = JSON.parse(localStorage.getItem(key)); return (v===undefined||v===null)?fallback:v; }
  catch { return fallback; }
}

// --- Globals & Prefill
var SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com'];
var session = load('session', null);
var currentRoute = load('_route', 'home');
var searchQuery  = load('_searchQ', '');

// seed data (one time local)
(function seedOnFirstRun(){
  if (load('_seeded', false)) return;
  var now = Date.now();
  var users = [
    { name:'Admin',   username:'admin',   email:'admin@sushi.com',         contact:'', role:'admin',   password:'', img:'' },
    { name:'Manager', username:'manager', email:'minmaung0307@gmail.com',  contact:'', role:'manager', password:'', img:'' },
    { name:'Cashier', username:'cashier1',email:'cashier@sushi.com',       contact:'', role:'user',    password:'', img:'' },
  ];
  var inventory = [
    { id:'inv1', img:'', name:'Nori Sheets', code:'NOR-100', type:'Dry', price:3.00, stock:80, threshold:30 },
    { id:'inv2', img:'', name:'Sushi Rice',  code:'RIC-200', type:'Dry', price:1.50, stock:24, threshold:20 },
    { id:'inv3', img:'', name:'Fresh Salmon',code:'SAL-300', type:'Raw', price:7.80, stock:10, threshold:12 },
  ];
  var products = [
    { id:'p1', img:'', name:'Salmon Nigiri',   barcode:'11100001', price:5.99, type:'Nigiri', ingredients:'Rice, Salmon', instructions:'Brush with nikiri.' },
    { id:'p2', img:'', name:'California Roll', barcode:'11100002', price:7.49, type:'Roll',   ingredients:'Rice, Nori, Crab, Avocado', instructions:'8 pcs.' },
  ];
  var posts = [{ id:'post1', title:'Welcome to Inventory', body:'Track stock, manage products, and work faster.', img:'', createdAt: now }];
  var tasks = [
    { id:'t1', title:'Prep Salmon',        status:'todo' },
    { id:'t2', title:'Cook Rice',          status:'inprogress' },
    { id:'t3', title:'Sanitize Station',   status:'done' },
  ];
  var cogs = [
    { id:'c1', date:'2024-08-01', grossIncome: 1200, produceCost:280, itemCost:180, freight:45, delivery:30, other:20 },
    { id:'c2', date:'2024-08-02', grossIncome:  900, produceCost:220, itemCost:140, freight:30, delivery:25, other:10 }
  ];
  save('users', users); save('inventory', inventory); save('products', products);
  save('posts', posts); save('tasks', tasks); save('cogs', cogs);
  save('_seeded', true);
})();

// --- Theme
var THEME_MODES = [
  { key:'light', name:'Light' },
  { key:'dark',  name:'Dark'  },
  { key:'aqua',  name:'Aqua'  }
];
var THEME_SIZES = [
  { key:'small',  pct: 90, label:'Small' },
  { key:'medium', pct:100, label:'Medium' },
  { key:'large',  pct:112, label:'Large' }
];
function getTheme(){ return load('_theme2', { mode:'aqua', size:'medium' }); }
function applyTheme(){
  var t = getTheme();
  var sizeObj = THEME_SIZES.filter(function(s){ return s.key===t.size; })[0];
  var size = sizeObj ? sizeObj.pct : 100;
  document.documentElement.setAttribute('data-theme', t.mode==='light' ? 'light' : (t.mode==='dark' ? 'dark' : ''));
  document.documentElement.style.setProperty('--font-scale', size + '%');
}
applyTheme();

// --- Cloud Sync (RTDB)
var CLOUD_KEYS = ['inventory','products','posts','tasks','cogs','users','_theme2'];
var cloud = (function(){
  var liveRefs = [];
  function uid(){ return auth.currentUser && auth.currentUser.uid; }
  function on(){ return !!load('_cloudOn', false); }
  function setOn(v){ save('_cloudOn', !!v); }
  function pathFor(key){ return db.ref('tenants/' + uid() + '/kv/' + key); }
  function saveKV(key, val){
    if (!on() || !uid()) return Promise.resolve();
    return pathFor(key).set({ key:key, val:val, updatedAt: firebase.database.ServerValue.TIMESTAMP });
  }
  function pullAllOnce(){
    if (!uid()) return Promise.resolve();
    return db.ref('tenants/' + uid() + '/kv').get().then(function(snap){
      if (!snap.exists()) return;
      var all = snap.val() || {};
      Object.keys(all).forEach(function(k){
        var row = all[k];
        if (row && row.key && ('val' in row)){
          localStorage.setItem(row.key, JSON.stringify(row.val));
        }
      });
    });
  }
  function subscribeAll(){
    if (!uid()) return;
    unsubscribeAll();
    CLOUD_KEYS.forEach(function(key){
      var ref = pathFor(key);
      var handler = ref.on('value', function(snap){
        var data = snap.val();
        if (!data) return;
        var curr = load(key, null);
        if (JSON.stringify(curr) !== JSON.stringify(data.val)){
          localStorage.setItem(key, JSON.stringify(data.val));
          if (key==='_theme2') applyTheme();
          renderApp();
        }
      });
      liveRefs.push({ ref:ref, handler:handler });
    });
  }
  function unsubscribeAll(){
    liveRefs.forEach(function(x){ try{ x.ref.off(); }catch(e){} });
    liveRefs = [];
  }
  function pushAll(){
    if (!uid()) return Promise.resolve();
    return CLOUD_KEYS.reduce(function(p, k){
      return p.then(function(){
        var v = load(k, null);
        if (v !== null && v !== undefined) return saveKV(k, v);
      });
    }, Promise.resolve());
  }
  function enable(){
    if (!uid()) return Promise.reject(new Error('Sign in first.'));
    setOn(true);
    return pullAllOnce().then(pushAll).then(subscribeAll);
  }
  function disable(){ setOn(false); unsubscribeAll(); }
  return { isOn:on, enable:enable, disable:disable, saveKV:saveKV, pullAllOnce:pullAllOnce, subscribeAll:subscribeAll, pushAll:pushAll };
})();

// --- Router & Idle
function go(route){ currentRoute = route; save('_route', route); renderApp(); }

var idleTimer = null;
var IDLE_LIMIT = 10 * 60 * 1000;
function resetIdleTimer(){
  if (!session) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(function(){
    auth.signOut().finally(function(){ notify('Signed out due to inactivity','warn'); });
  }, IDLE_LIMIT);
}
['click','mousemove','keydown','touchstart','scroll'].forEach(function(evt){
  window.addEventListener(evt, resetIdleTimer, { passive: true });
});

// --- Auth state
auth.onAuthStateChanged(function(user){
  applyTheme();
  if (user) {
    var email = (user.email || '').toLowerCase();
    var users = load('users', []);
    var prof = users.filter(function(u){ return (u.email||'').toLowerCase()===email; })[0];
    if (!prof){
      var role = SUPER_ADMINS.indexOf(email)>=0 ? 'admin':'user';
      prof = { name: role==='admin'?'Admin':'User', username: email.split('@')[0], email:email, contact:'', role:role, password:'', img:'' };
      users.push(prof); save('users', users);
    } else if (SUPER_ADMINS.indexOf(email)>=0 && prof.role!=='admin'){
      prof.role='admin'; save('users', users);
    }
    session = JSON.parse(JSON.stringify(prof)); save('session', session);

    if (cloud.isOn()){
      cloud.pullAllOnce().then(function(){ cloud.subscribeAll(); }).catch(function(){});
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

// ===================== Part 2 — Login/Logout + Sidebar/Topbar + Render scaffold =====================

// Login
function renderLogin() {
  var root = $('#root');
  root.innerHTML = ''+
    '<div class="login">'+
      '<div class="card login-card">'+
        '<div class="card-body">'+
          '<div class="login-logo">'+
            '<div class="logo">📦</div>'+
            '<div class="login-badge">Manager / Admin</div>'+
          '</div>'+
          '<h2 style="text-align:center;margin:6px 0 12px">Inventory</h2>'+
          '<div class="grid">'+
            '<input id="li-email" class="input" type="email" placeholder="Email" />'+
            '<input id="li-pass" class="input" type="password" placeholder="Password" />'+
            '<button id="btnLogin" class="btn">Sign In</button>'+
            '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px">'+
              '<button id="btnForgot" class="btn ghost" type="button">Forgot Password</button>'+
              '<a href="https://you-6bddf.web.app/contact.html" class="btn secondary" target="_blank" rel="noopener">Contact</a>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';

  $('#btnLogin').onclick = function(){
    var email = $('#li-email').value.trim();
    var pass  = $('#li-pass').value;
    if (!email || !pass) { notify('Enter email & password','warn'); return; }
    auth.signInWithEmailAndPassword(email, pass)
      .then(function(){ notify('Welcome!'); })
      .catch(function(e){ notify((e && e.message)||'Login failed','danger'); });
  };

  $('#btnForgot').onclick = function(){
    var email = $('#li-email').value.trim();
    if (!email) { notify('Enter your email above first','warn'); return; }
    auth.sendPasswordResetEmail(email)
      .then(function(){ notify('Password reset email sent'); })
      .catch(function(e){ notify((e && e.message)||'Could not send reset email','danger'); });
  };
}

function doLogout(){ cloud.disable(); return auth.signOut().then(function(){ notify('Signed out'); }); }

// Sidebar / Topbar
function renderSidebar(active){
  var links = [
    { route:'home',      icon:'ri-home-5-line',              label:'Home' },
    { route:'dashboard', icon:'ri-dashboard-line',           label:'Dashboard' },
    { route:'inventory', icon:'ri-archive-2-line',           label:'Inventory' },
    { route:'products',  icon:'ri-store-2-line',             label:'Products' },
    { route:'cogs',      icon:'ri-money-dollar-circle-line', label:'COGS' },
    { route:'tasks',     icon:'ri-list-check-2',             label:'Tasks' },
    { route:'settings',  icon:'ri-settings-3-line',          label:'Settings' }
  ];
  var pages = [
    { route:'policy',  icon:'ri-shield-check-line',    label:'Policy' },
    { route:'license', icon:'ri-copyright-line',       label:'License' },
    { route:'setup',   icon:'ri-guide-line',           label:'Setup Guide' },
    { route:'contact', icon:'ri-customer-service-2-line', label:'Contact' },
    { route:'guide',   icon:'ri-video-line',           label:'User Guide' },
  ];
  return ''+
    '<aside class="sidebar" id="sidebar">'+
      '<div class="brand">'+
        '<div class="logo">📦</div>'+
        '<div class="title">Inventory</div>'+
      '</div>'+

      '<div class="search-wrap">'+
        '<input id="globalSearch" placeholder="Search everything…" autocomplete="off" />'+
        '<div id="searchResults" class="search-results"></div>'+
      '</div>'+

      '<h6>Menu</h6>'+
      '<nav class="nav">'+
        links.map(function(l){
          return '<div class="item '+(active===l.route?'active':'')+'" data-route="'+l.route+'">'+
            '<i class="'+l.icon+'"></i> <span>'+l.label+'</span>'+
          '</div>';
        }).join('')+
      '</nav>'+

      '<h6>Links</h6>'+
      '<div class="links">'+
        pages.map(function(p){
          return '<div class="item" data-route="'+p.route+'">'+
            '<i class="'+p.icon+'"></i> <span>'+p.label+'</span>'+
          '</div>';
        }).join('')+
      '</div>'+

      '<h6>Social</h6>'+
      '<div class="socials-row">'+
        '<a href="https://youtube.com" target="_blank" rel="noopener" title="YouTube"><i class="ri-youtube-fill"></i></a>'+
        '<a href="https://facebook.com" target="_blank" rel="noopener" title="Facebook"><i class="ri-facebook-fill"></i></a>'+
        '<a href="https://instagram.com" target="_blank" rel="noopener" title="Instagram"><i class="ri-instagram-line"></i></a>'+
        '<a href="https://tiktok.com" target="_blank" rel="noopener" title="TikTok"><i class="ri-tiktok-fill"></i></a>'+
        '<a href="https://twitter.com" target="_blank" rel="noopener" title="X/Twitter"><i class="ri-twitter-x-line"></i></a>'+
      '</div>'+
    '</aside>';
}
function renderTopbar(){
  return ''+
    '<div class="topbar">'+
      '<div class="left">'+
        '<div class="burger" id="burger"><i class="ri-menu-line"></i></div>'+
        '<div><strong>'+ (currentRoute.charAt(0).toUpperCase()+currentRoute.slice(1)) +'</strong></div>'+
      '</div>'+
      '<div class="right">'+
        '<button class="btn ghost" id="btnHome"><i class="ri-home-5-line"></i> Home</button>'+
        '<button class="btn secondary" id="btnLogout"><i class="ri-logout-box-r-line"></i> Logout</button>'+
      '</div>'+
    '</div>'+
    '<div class="backdrop" id="backdrop"></div>';
}

// Global delegated listeners
document.addEventListener('click', function(e){
  var item = e.target.closest && e.target.closest('.sidebar .item[data-route]');
  if (!item) return;
  var r = item.getAttribute('data-route');
  if (r) go(r);
}, { passive: true });

document.addEventListener('click', function(e){
  var btn = e.target.closest && e.target.closest('[data-close]');
  if (!btn) return;
  var id = btn.getAttribute('data-close');
  if (id) { closeModal(id); }
}, { passive: true });

// Render App
function renderApp(){
  if (!session) { renderLogin(); return; }
  var root = $('#root');
  root.innerHTML = ''+
    '<div class="app">'+
      renderSidebar(currentRoute)+
      '<div>'+
        renderTopbar()+
        '<div class="main" id="main">'+
          (currentRoute==='home'      ? viewHome() :
           currentRoute==='dashboard' ? viewDashboard() :
           currentRoute==='inventory' ? viewInventory() :
           currentRoute==='products'  ? viewProducts()  :
           currentRoute==='cogs'      ? viewCOGS()      :
           currentRoute==='tasks'     ? viewTasks()     :
           currentRoute==='settings'  ? viewSettings()  :
           currentRoute==='search'    ? viewSearch()    :
           viewPage(currentRoute))+
        '</div>'+
      '</div>'+
    '</div>';

  hookSidebarInteractions();

  var b = $('#burger'), bd = $('#backdrop'), bh = $('#btnHome'), bl = $('#btnLogout');
  if (b)  b.addEventListener('click', openSidebar, { passive:true });
  if (bd) bd.addEventListener('click', closeSidebar, { passive:true });
  if (bh) bh.addEventListener('click', function(){ go('home'); });
  if (bl) bl.addEventListener('click', doLogout);

  // Section wiring:
  if (currentRoute==='dashboard')  wireDashboard();
  if (currentRoute==='inventory')  wireInventory();
  if (currentRoute==='products')   wireProducts();
  if (currentRoute==='cogs')       wireCOGS();
  if (currentRoute==='tasks'){     wireTasks(); setupDnD(); }
  if (currentRoute==='settings')   wireSettings();

  enableMobileImagePreview(); // defined below
}

function openSidebar(){ var s=$('#sidebar'), bk=$('#backdrop'); if(s) s.classList.add('open'); if(bk) bk.classList.add('active'); }
function closeSidebar(){ var s=$('#sidebar'), bk=$('#backdrop'); if(s) s.classList.remove('open'); if(bk) bk.classList.remove('active'); }

// ===================== Part 3 — Home + Search + Dashboard =====================

// Weekly Hot Music Video (rotates weekly; muted for autoplay)
function weeklyVideoEmbed(){
  var list = [
    'https://www.youtube.com/embed/3JZ4pnNtyxQ?autoplay=1&mute=1&playsinline=1',
    'https://www.youtube.com/embed/kXYiU_JCYtU?autoplay=1&mute=1&playsinline=1',
    'https://www.youtube.com/embed/ktvTqknDobU?autoplay=1&mute=1&playsinline=1',
    'https://www.youtube.com/embed/09R8_2nJtjg?autoplay=1&mute=1&playsinline=1',
    'https://www.youtube.com/embed/fJ9rUzIMcZQ?autoplay=1&mute=1&playsinline=1'
  ];
  var now = new Date();
  var onejan = new Date(now.getFullYear(),0,1);
  var week = Math.ceil((((now - onejan) / 86400000) + onejan.getDay()+1)/7);
  var idx = week % list.length;
  return '<div class="card"><div class="card-body">'+
    '<h4 style="margin:0 0 10px 0">Hot Weekly Music</h4>'+
    '<div style="position:relative; padding-top:56.25%">'+
      '<iframe src="'+list[idx]+'" '+
        'allow="autoplay; encrypted-media" '+
        'allowfullscreen '+
        'style="position:absolute;top:0;left:0;width:100%;height:100%;border:1px solid var(--card-border);border-radius:12px">'+
      '</iframe>'+
    '</div>'+
    '<div style="color:var(--muted);font-size:12px;margin-top:6px">Rotates weekly. Audio will play after you unmute.</div>'+
  '</div></div>';
}

function viewHome(){
  return ''+
    '<div class="card"><div class="card-body">'+
      '<h3 style="margin-top:0">Welcome 👋</h3>'+
      '<p style="color:var(--muted)">Pick a section to get started.</p>'+
      '<div class="grid cols-4 auto" style="margin-bottom:12px">'+
        '<div class="card tile" data-go="inventory"><div class="card-body" style="display:flex;gap:10px;align-items:center"><i class="ri-archive-2-line"></i><div><div>Inventory</div></div></div></div>'+
        '<div class="card tile" data-go="products"><div class="card-body" style="display:flex;gap:10px;align-items:center"><i class="ri-store-2-line"></i><div><div>Products</div></div></div></div>'+
        '<div class="card tile" data-go="cogs"><div class="card-body" style="display:flex;gap:10px;align-items:center"><i class="ri-money-dollar-circle-line"></i><div><div>COGS</div></div></div></div>'+
        '<div class="card tile" data-go="tasks"><div class="card-body" style="display:flex;gap:10px;align-items:center"><i class="ri-list-check-2"></i><div><div>Tasks</div></div></div></div>'+
      '</div>'+
      weeklyVideoEmbed()+   // hot weekly video card
    '</div></div>';
}

function hookSidebarInteractions(){
  var input = $('#globalSearch');
  var results = $('#searchResults');
  var indexData = buildSearchIndex();
  var searchTimer;
  if (!input) return;

  input.removeAttribute('disabled');
  input.style.pointerEvents = 'auto';

  function openResultsPage(q){
    searchQuery = q; save('_searchQ', q);
    if (currentRoute !== 'search') go('search'); else renderApp();
  }

  input.addEventListener('keydown', function(e){
    if (e.key === 'Enter') {
      var q = input.value.trim();
      if (q) { openResultsPage(q); results.classList.remove('active'); input.blur(); closeSidebar(); }
    }
  });

  input.addEventListener('input', function(){
    clearTimeout(searchTimer);
    var q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('active'); results.innerHTML=''; return; }
    searchTimer = setTimeout(function(){
      var out = searchAll(indexData, q).slice(0,12);
      if (!out.length) { results.classList.remove('active'); results.innerHTML=''; return; }
      results.innerHTML = out.map(function(r){
        return '<div class="result" data-route="'+r.route+'" data-id="'+(r.id||'')+'">'+
          '<strong>'+r.label+'</strong> <span style="color:var(--muted)">— '+r.section+'</span></div>';
      }).join('');
      results.classList.add('active');
      $$('.search-results .result').forEach(function(row){
        row.onclick = function(){
          var r = row.getAttribute('data-route');
          var id = row.getAttribute('data-id') || '';
          var label = row.textContent.trim();
          openResultsPage(label);
          results.classList.remove('active');
          input.value='';
          closeSidebar();
          if (id) setTimeout(function(){ scrollToRow(id); }, 80);
        };
      });
    }, 120);
  });

  document.addEventListener('click', function(e){
    if (!results.contains(e.target) && e.target !== input){
      results.classList.remove('active');
    }
  });
}

function viewSearch(){
  var q = searchQuery || '';
  var index = buildSearchIndex();
  var out = q ? searchAll(index, q) : [];
  return ''+
    '<div class="card"><div class="card-body">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
        '<h3 style="margin:0">Search</h3>'+
        '<div style="color:var(--muted)">Query: <strong>'+(q || '(empty)')+'</strong></div>'+
      '</div>'+
      (out.length ?
        '<div class="grid">'+
          out.map(function(r){
            return '<div class="card"><div class="card-body" style="display:flex;justify-content:space-between;align-items:center">'+
              '<div><div style="font-weight:700">'+r.label+'</div><div style="color:var(--muted);font-size:12px">'+r.section+'</div></div>'+
              '<button class="btn" data-go="'+r.route+'" data-id="'+(r.id||'')+'">Open</button>'+
            '</div></div>';
          }).join('')+
        '</div>' : '<p style="color:var(--muted)">No results.</p>')+
    '</div></div>';
}

// --- COGS helpers for monthly/YoY comparison -------------------------------
function parseYMD(s){
  // expects "YYYY-MM-DD"; returns {y,m,d}
  if (!s || typeof s!=='string' || s.length<7) return null;
  var parts = s.split('-');
  var y = parseInt(parts[0],10), m = parseInt(parts[1],10), d = parseInt(parts[2]||'1',10);
  if (isNaN(y)||isNaN(m)||isNaN(d)) return null;
  return { y:y, m:m, d:d };
}
function monthKey(y,m){ return y + '-' + (m<10 ? '0'+m : ''+m); }
function sumGrossForMonth(rows, y, m){
  var key = monthKey(y,m);
  return rows.reduce(function(total, r){
    var dt = parseYMD(r.date); if (!dt) return total;
    return (monthKey(dt.y, dt.m)===key) ? (total + Number(r.grossIncome||0)) : total;
  }, 0);
}
function prevMonth(y,m){ // returns {y,m} for previous month
  if (m>1) return { y:y, m:m-1 };
  return { y:y-1, m:12 };
}
function sameMonthLastYear(y,m){ return { y:y-1, m:m }; }

function buildRevenueCompare(rows){
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth()+1; // 1..12
  var pm = prevMonth(y,m), lastYear = sameMonthLastYear(y,m);

  var thisMonth = sumGrossForMonth(rows, y, m);
  var prevMon   = sumGrossForMonth(rows, pm.y, pm.m);
  var yoy       = sumGrossForMonth(rows, lastYear.y, lastYear.m);

  // normalize to 100% for the largest among the three (avoid /0)
  var maxV = Math.max(thisMonth, prevMon, yoy, 1);

  return {
    labels: {
      thisMonth:  new Date(y, m-1, 1).toLocaleString(undefined, { month:'short', year:'numeric' }),
      prevMonth:  new Date(pm.y, pm.m-1, 1).toLocaleString(undefined, { month:'short', year:'numeric' }),
      yoy:        new Date(lastYear.y, lastYear.m-1, 1).toLocaleString(undefined, { month:'short', year:'numeric' })
    },
    values: { thisMonth: thisMonth, prevMonth: prevMon, yoy: yoy },
    widths: {
      thisMonth:  Math.round((thisMonth/maxV)*100),
      prevMonth:  Math.round((prevMon  /maxV)*100),
      yoy:        Math.round((yoy      /maxV)*100)
    }
  };
}

function viewDashboard(){
  var posts = load('posts', []);
  var inv = load('inventory', []);
  var prods = load('products', []);
  var users = load('users', []);
  var tasks = load('tasks', []);
  var cogsRows = load('cogs', []);

  var lowCt  = inv.filter(function(i){ return i.stock <= i.threshold && i.stock > Math.max(1, Math.floor(i.threshold*0.6)); }).length;
  var critCt = inv.filter(function(i){ return i.stock <= Math.max(1, Math.floor(i.threshold*0.6)); }).length;

  // build revenue compare
  var cmp = buildRevenueCompare(cogsRows);
  function usd(x){ return '$' + Number(x||0).toFixed(0); }

  return ''+
    '<div class="grid cols-4 auto">'+
      '<div class="card tile" data-go="inventory"><div class="card-body"><div>Total Items</div><h2>'+inv.length+'</h2></div></div>'+
      '<div class="card tile" data-go="products"><div class="card-body"><div>Products</div><h2>'+prods.length+'</h2></div></div>'+
      '<div class="card tile" data-go="settings"><div class="card-body"><div>Users</div><h2>'+users.length+'</h2></div></div>'+
      '<div class="card tile" data-go="tasks"><div class="card-body"><div>Tasks</div><h2>'+tasks.length+'</h2></div></div>'+
    '</div>'+

    '<div class="grid cols-4 auto" style="margin-top:12px">'+
      '<div class="card" style="border-left:4px solid var(--warn)"><div class="card-body"><strong>Low stock</strong><div style="color:var(--muted)">'+lowCt+'</div></div></div>'+
      '<div class="card" style="border-left:4px solid var(--danger)"><div class="card-body"><strong>Critical</strong><div style="color:var(--muted)">'+critCt+'</div></div></div>'+
      '<div class="card tile" data-go="cogs"><div class="card-body"><strong>COGS</strong><div style="color:var(--muted)">View details</div></div></div>'+
      // NEW: Revenue Compare tile
      '<div class="card"><div class="card-body">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
          '<strong>Revenue Compare</strong>'+
          '<span style="color:var(--muted);font-size:12px">Gross income</span>'+
        '</div>'+
        '<div class="compare-wrap">'+
          '<div class="compare-row">'+
            '<div class="compare-label">This month<br><strong>'+cmp.labels.thisMonth+'</strong></div>'+
            '<div class="compare-bar"><div class="compare-fill" style="width:'+cmp.widths.thisMonth+'%"></div></div>'+
            '<div class="compare-value">'+usd(cmp.values.thisMonth)+'</div>'+
          '</div>'+
          '<div class="compare-row">'+
            '<div class="compare-label">Prev month<br><strong>'+cmp.labels.prevMonth+'</strong></div>'+
            '<div class="compare-bar"><div class="compare-fill" style="width:'+cmp.widths.prevMonth+'%"></div></div>'+
            '<div class="compare-value">'+usd(cmp.values.prevMonth)+'</div>'+
          '</div>'+
          '<div class="compare-row">'+
            '<div class="compare-label">YoY same mo.<br><strong>'+cmp.labels.yoy+'</strong></div>'+
            '<div class="compare-bar"><div class="compare-fill" style="width:'+cmp.widths.yoy+'%"></div></div>'+
            '<div class="compare-value">'+usd(cmp.values.yoy)+'</div>'+
          '</div>'+
        '</div>'+
      '</div></div>'+
    '</div>'+

    '<div class="card" style="margin-top:16px"><div class="card-body">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
        '<h3 style="margin:0">Posts</h3>'+
        (canCreate()? '<button class="btn" id="addPost"><i class="ri-add-line"></i> Add Post</button>' : '')+
      '</div>'+
      '<div class="grid" data-section="posts" style="grid-template-columns: 1fr;">'+
        posts.map(function(p){
          return '<div class="card" id="'+p.id+'"><div class="card-body">'+
            '<div style="display:flex;justify-content:space-between;align-items:center">'+
              '<div><strong>'+p.title+'</strong><div style="color:var(--muted);font-size:12px">'+new Date(p.createdAt).toLocaleString()+'</div></div>'+
              '<div>'+
                (canCreate()? '<button class="btn ghost" data-edit="'+p.id+'"><i class="ri-edit-line"></i></button>':'')+
                (canCreate()? '<button class="btn danger" data-del="'+p.id+'"><i class="ri-delete-bin-6-line"></i></button>':'')+
              '</div>'+
            '</div>'+
            (p.img? '<img src="'+p.img+'" style="width:100%;border-radius:12px;margin-top:10px;border:1px solid var(--card-border)"/>' : '')+
            '<p style="margin-top:8px">'+p.body+'</p>'+
          '</div></div>';
        }).join('')+
      '</div>'+
    '</div></div>'+

    postModal();
}

function wireDashboard(){
  var addPostBtn = $('#addPost');
  if (addPostBtn){ addPostBtn.onclick = function(){ openModal('m-post'); }; }

  var usersTile = document.querySelector('.tile[data-go="settings"]');
  if (usersTile){ usersTile.style.cursor = 'pointer'; usersTile.onclick = function(){ go('settings'); }; }

  wirePosts();
}

function wirePosts(){
  var saveBtn = $('#save-post');
  if (saveBtn){
    saveBtn.addEventListener('click', function(){
      var posts = load('posts', []);
      var id = $('#post-id').value || ('post_'+Date.now());
      var obj = {
        id:id,
        title: $('#post-title').value.trim(),
        body: $('#post-body').value.trim(),
        img:  $('#post-img').value.trim(),
        createdAt: Date.now()
      };
      if (!obj.title) return notify('Title required','warn');
      var i = posts.findIndex(function(x){ return x.id===id; });
      if (i>=0) posts[i]=obj; else posts.unshift(obj);
      save('posts', posts); closeModal('m-post'); notify('Saved'); renderApp();
    });
  }

  var sec = $('[data-section="posts"]');
  if (!sec) return;
  sec.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('button'); if (!btn) return;
    var id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    if (btn.hasAttribute('data-edit')){
      var posts = load('posts', []);
      var p = posts.find(function(x){ return x.id===id; }); if (!p) return;
      openModal('m-post');
      $('#post-id').value = p.id;
      $('#post-title').value = p.title;
      $('#post-body').value = p.body;
      $('#post-img').value = p.img||'';
    } else {
      var postsNew = load('posts', []).filter(function(x){ return x.id!==id; });
      save('posts', postsNew); notify('Deleted'); renderApp();
    }
  });
}

// ===================== Part 4 — Inventory / Products / COGS / Tasks / Settings =====================

var USD = function(x){ return '$'+Number(x||0).toFixed(2); };

function viewInventory(){
  var items = load('inventory', []);
  return ''+
  '<div class="card"><div class="card-body">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
      '<h3 style="margin:0">Inventory</h3>'+
      (canCreate()? '<button class="btn" id="addInv"><i class="ri-add-line"></i> Add Item</button>':'')+
    '</div>'+
    '<div class="table-wrap" data-section="inventory">'+
      '<table class="table">'+
        '<thead><tr>'+
          '<th>Image</th><th>Name</th><th>Code</th><th>Type</th><th>Price</th><th>Stock</th><th>Threshold</th><th>Actions</th>'+
        '</tr></thead>'+
        '<tbody>'+
          items.map(function(it){
            var warnClass = it.stock <= it.threshold ? (it.stock <= Math.max(1, Math.floor(it.threshold*0.6)) ? 'tr-danger' : 'tr-warn') : '';
            return '<tr id="'+it.id+'" class="'+warnClass+'">'+
              '<td><div class="thumb-wrap">'+
                (it.img? '<img class="thumb inv-preview" data-src="'+it.img+'" alt=""/>' :
                          '<div class="thumb inv-preview" data-src="icons/icon-512.png" style="display:grid;place-items:center">📦</div>')+
                '<img class="thumb-large" src="'+(it.img||'icons/icon-512.png')+'" alt=""/>'+
              '</div></td>'+
              '<td>'+it.name+'</td>'+
              '<td>'+it.code+'</td>'+
              '<td>'+(it.type||'-')+'</td>'+
              '<td>'+USD(it.price)+'</td>'+
              '<td><button class="btn ghost" data-dec="'+it.id+'">–</button><span style="padding:0 10px">'+it.stock+'</span><button class="btn ghost" data-inc="'+it.id+'">+</button></td>'+
              '<td><button class="btn ghost" data-dec-th="'+it.id+'">–</button><span style="padding:0 10px">'+it.threshold+'</span><button class="btn ghost" data-inc-th="'+it.id+'">+</button></td>'+
              '<td>'+(canCreate()? '<button class="btn ghost" data-edit="'+it.id+'"><i class="ri-edit-line"></i></button> <button class="btn danger" data-del="'+it.id+'"><i class="ri-delete-bin-6-line"></i></button>' : '')+'</td>'+
            '</tr>';
          }).join('')+
        '</tbody>'+
      '</table>'+
    '</div>'+
  '</div></div>'+
  invModal()+ imgPreviewModal();
}

function viewProducts(){
  var items = load('products', []);
  return ''+
  '<div class="card"><div class="card-body">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
      '<h3 style="margin:0">Products</h3>'+
      (canCreate()? '<button class="btn" id="addProd"><i class="ri-add-line"></i> Add Product</button>':'')+
    '</div>'+
    '<div class="table-wrap" data-section="products">'+
      '<table class="table">'+
        '<thead><tr>'+
          '<th>Image</th><th>Name</th><th>Barcode</th><th>Price</th><th>Type</th><th>Actions</th>'+
        '</tr></thead>'+
        '<tbody>'+
          items.map(function(it){
            return '<tr id="'+it.id+'">'+
              '<td><div class="thumb-wrap">'+
                (it.img? '<img class="thumb prod-thumb prod-preview" data-card="'+it.id+'" data-src="'+it.img+'" alt=""/>' :
                          '<div class="thumb prod-thumb prod-preview" data-card="'+it.id+'" data-src="icons/icon-512.png" style="display:grid;place-items:center;cursor:pointer">🍣</div>')+
                '<img class="thumb-large" src="'+(it.img||'icons/icon-512.png')+'" alt=""/>'+
              '</div></td>'+
              '<td>'+it.name+'</td>'+
              '<td>'+it.barcode+'</td>'+
              '<td>'+USD(it.price)+'</td>'+
              '<td>'+(it.type||'-')+'</td>'+
              '<td>'+(canCreate()? '<button class="btn ghost" data-edit="'+it.id+'"><i class="ri-edit-line"></i></button> <button class="btn danger" data-del="'+it.id+'"><i class="ri-delete-bin-6-line"></i></button>' : '')+'</td>'+
            '</tr>';
          }).join('')+
        '</tbody>'+
      '</table>'+
    '</div>'+
  '</div></div>'+
  prodModal()+ prodCardModal()+ imgPreviewModal();
}

function viewCOGS(){
  var rows = load('cogs', []);
  function sum(key){ return rows.reduce(function(a,r){ return a + Number(r[key]||0); }, 0); }
  function grossProfit(r){ return r.grossIncome - (r.produceCost+r.itemCost+r.freight+r.delivery+r.other); }
  var totals = {
    grossIncome: sum('grossIncome'),
    produceCost: sum('produceCost'),
    itemCost:    sum('itemCost'),
    freight:     sum('freight'),
    delivery:    sum('delivery'),
    other:       sum('other')
  };
  var totalProfit = grossProfit(totals);

  return ''+
  '<div class="card"><div class="card-body">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
      '<h3 style="margin:0">COGS</h3>'+
      (canCreate()? '<button class="btn" id="addCOGS"><i class="ri-add-line"></i> Add Row</button>':'')+
    '</div>'+
    '<div class="table-wrap" data-section="cogs">'+
      '<table class="table">'+
        '<thead><tr>'+
          '<th>Date</th><th>Gross Income</th><th>Produce Cost</th><th>Item Cost</th><th>Freight</th><th>Delivery</th><th>Other</th><th>Gross Profit</th><th>Actions</th>'+
        '</tr></thead>'+
        '<tbody>'+
          rows.map(function(r){
            return '<tr id="'+r.id+'">'+
              '<td>'+r.date+'</td>'+
              '<td>'+USD(r.grossIncome)+'</td>'+
              '<td>'+USD(r.produceCost)+'</td>'+
              '<td>'+USD(r.itemCost)+'</td>'+
              '<td>'+USD(r.freight)+'</td>'+
              '<td>'+USD(r.delivery)+'</td>'+
              '<td>'+USD(r.other)+'</td>'+
              '<td>'+USD(grossProfit(r))+'</td>'+
              '<td>'+(canCreate()? '<button class="btn ghost" data-edit="'+r.id+'"><i class="ri-edit-line"></i></button> <button class="btn danger" data-del="'+r.id+'"><i class="ri-delete-bin-6-line"></i></button>':'')+'</td>'+
            '</tr>';
          }).join('')+
          '<tr class="tr-total">'+
            '<th>Total</th>'+
            '<th>'+USD(totals.grossIncome)+'</th>'+
            '<th>'+USD(totals.produceCost)+'</th>'+
            '<th>'+USD(totals.itemCost)+'</th>'+
            '<th>'+USD(totals.freight)+'</th>'+
            '<th>'+USD(totals.delivery)+'</th>'+
            '<th>'+USD(totals.other)+'</th>'+
            '<th>'+USD(totalProfit)+'</th>'+
            '<th></th>'+
          '</tr>'+
        '</tbody>'+
      '</table>'+
    '</div>'+
  '</div></div>'+
  cogsModal();
}

function viewTasks(){
  var items = load('tasks', []);
  function lane(key, label, color){
    return ''+
    '<div class="card lane-row" data-lane="'+key+'">'+
      '<div class="card-body">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
          '<h3 style="margin:0;color:'+color+'">'+label+'</h3>'+
          (key==='todo' && canCreate()? '<button class="btn" id="addTask"><i class="ri-add-line"></i> Add Task</button>':'')+
        '</div>'+
        '<div class="grid lane-grid" id="lane-'+key+'">'+
          '<div class="lane-dropzone" data-dropzone="'+key+'">Drop here</div>'+
          items.filter(function(t){ return t.status===key; }).map(function(t){
            return '<div class="card task-card" id="'+t.id+'" draggable="true" data-task="'+t.id+'">'+
              '<div class="card-body" style="display:flex;justify-content:space-between;align-items:center">'+
                '<div>'+t.title+'</div>'+
                '<div>'+(canCreate()? '<button class="btn ghost" data-edit="'+t.id+'"><i class="ri-edit-line"></i></button> <button class="btn danger" data-del="'+t.id+'"><i class="ri-delete-bin-6-line"></i></button>':'')+'</div>'+
              '</div>'+
            '</div>';
          }).join('')+
        '</div>'+
      '</div>'+
    '</div>';
  }
  return ''+
    '<div data-section="tasks">'+
      lane('todo','To do','#f59e0b')+
      lane('inprogress','In progress','#3b82f6')+
      lane('done','Done','#10b981')+
    '</div>'+
    taskModal();
}

function viewSettings(){
  var users = load('users', []);
  var theme = getTheme();
  var cloudOn = cloud.isOn();

  return ''+
  '<div class="grid">'+
    '<div class="card"><div class="card-body">'+
      '<h3 style="margin-top:0">Cloud Sync</h3>'+
      '<p style="color:var(--muted)">Store your data in Firebase RTDB. Local-first; works offline.</p>'+
      '<div class="theme-inline">'+
        '<div>'+
          '<label style="font-size:12px;color:var(--muted)">Status</label>'+
          '<select id="cloud-toggle" class="input">'+
            '<option value="off" '+(!cloudOn?'selected':'')+'>Off</option>'+
            '<option value="on" '+(cloudOn?'selected':'')+'>On</option>'+
          '</select>'+
        '</div>'+
        '<div>'+
          '<label style="font-size:12px;color:var(--muted)">Actions</label><br/>'+
          '<button class="btn" id="cloud-sync-now"><i class="ri-cloud-line"></i> Sync Now</button>'+
        '</div>'+
      '</div>'+
    '</div></div>'+

    '<div class="card"><div class="card-body">'+
      '<h3 style="margin-top:0">Theme</h3>'+
      '<div class="theme-inline">'+
        '<div>'+
          '<label style="font-size:12px;color:var(--muted)">Mode</label>'+
          '<select id="theme-mode" class="input">'+
            THEME_MODES.map(function(m){ return '<option value="'+m.key+'" '+(theme.mode===m.key?'selected':'')+'>'+m.name+'</option>'; }).join('')+
          '</select>'+
        '</div>'+
        '<div>'+
          '<label style="font-size:12px;color:var(--muted)">Font Size</label>'+
          '<select id="theme-size" class="input">'+
            THEME_SIZES.map(function(s){ return '<option value="'+s.key+'" '+(theme.size===s.key?'selected':'')+'>'+s.label+'</option>'; }).join('')+
          '</select>'+
        '</div>'+
      '</div>'+
    '</div></div>'+

    '<div class="card"><div class="card-body">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
        '<h3 style="margin:0">Users</h3>'+
        (canManage()? '<button class="btn" id="addUser"><i class="ri-add-line"></i> Add User</button>':'')+
      '</div>'+
      '<table class="table" data-section="users">'+
        '<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>'+
        '<tbody>'+
          users.map(function(u){
            return '<tr id="'+u.email+'">'+
              '<td>'+u.name+'</td>'+
              '<td>'+u.email+'</td>'+
              '<td>'+u.role+'</td>'+
              '<td>'+(canManage()? '<button class="btn ghost" data-edit="'+u.email+'"><i class="ri-edit-line"></i></button> <button class="btn danger" data-del="'+u.email+'"><i class="ri-delete-bin-6-line"></i></button>':'')+'</td>'+
            '</tr>';
          }).join('')+
        '</tbody>'+
      '</table>'+
    '</div></div>'+
  '</div>'+
  userModal();
}

// Static pages (iframes)
var pageContent = {
  policy: '<h3>Policy</h3><div style="border:1px solid var(--card-border);border-radius:12px;overflow:hidden"><iframe src="policy.html" style="width:100%;height:calc(100vh - 220px);border:none"></iframe></div>',
  license:'<h3>License</h3><div style="border:1px solid var(--card-border);border-radius:12px;overflow:hidden"><iframe src="license.html" style="width:100%;height:calc(100vh - 220px);border:none"></iframe></div>',
  setup:  '<h3>Setup Guide</h3><div style="border:1px solid var(--card-border); border-radius:12px; overflow:hidden;"><iframe src="setup-guide.html" style="width:100%; height: calc(100vh - 220px); border:none;"></iframe></div>',
  contact:'<h3>Contact</h3><p>This opens the standalone page.</p><a class="btn" href="contact.html" target="_blank" rel="noopener"><i class="ri-send-plane-line"></i> Open Contact</a>',
  guide:  '<h3>User Guide</h3><div style="border:1px solid var(--card-border);border-radius:12px;overflow:hidden"><iframe src="guide.html" style="width:100%;height:calc(100vh - 220px);border:none"></iframe></div>'
};
function viewPage(key){ return '<div class="card"><div class="card-body">'+(pageContent[key]||'<p>Page</p>')+'</div></div>'; }

// Permissions
function canManage(){ return session && (session.role==='admin' || session.role==='manager'); }
function canCreate(){ return session && (session.role==='admin' || session.role==='manager'); }

// ===================== Part 5 — Modals + Wiring + DnD + Image Preview =====================

// Modals
function postModal(){
  if (!canCreate()) return '';
  return ''+
  '<div class="modal-backdrop" id="mb-post"></div>'+
  '<div class="modal" id="m-post">'+
    '<div class="dialog">'+
      '<div class="head"><strong>Post</strong><button class="btn ghost" data-close="m-post">Close</button></div>'+
      '<div class="body grid">'+
        '<input id="post-id" type="hidden" />'+
        '<input id="post-title" class="input" placeholder="Title" />'+
        '<textarea id="post-body" class="input" placeholder="Body"></textarea>'+
        '<input id="post-img" class="input" placeholder="Image URL (optional)" />'+
      '</div>'+
      '<div class="foot"><button class="btn" id="save-post">Save</button></div>'+
    '</div>'+
  '</div>';
}
function invModal(){
  if (!canCreate()) return '';
  return ''+
  '<div class="modal-backdrop" id="mb-inv"></div>'+
  '<div class="modal" id="m-inv">'+
    '<div class="dialog">'+
      '<div class="head"><strong>Inventory Item</strong><button class="btn ghost" data-close="m-inv">Close</button></div>'+
      '<div class="body grid">'+
        '<input id="inv-id" type="hidden" />'+
        '<input id="inv-name" class="input" placeholder="Name" />'+
        '<input id="inv-code" class="input" placeholder="Code" />'+
        '<select id="inv-type" class="input"><option>Raw</option><option>Cooked</option><option>Dry</option><option>Other</option></select>'+
        '<input id="inv-price" class="input" type="number" step="0.01" placeholder="Price" />'+
        '<input id="inv-stock" class="input" type="number" placeholder="Stock" />'+
        '<input id="inv-threshold" class="input" type="number" placeholder="Threshold" />'+
        '<input id="inv-img" class="input" placeholder="Image URL (optional)" />'+
      '</div>'+
      '<div class="foot"><button class="btn" id="save-inv">Save</button></div>'+
    '</div>'+
  '</div>';
}
function prodModal(){
  if (!canCreate()) return '';
  return ''+
  '<div class="modal-backdrop" id="mb-prod"></div>'+
  '<div class="modal" id="m-prod">'+
    '<div class="dialog">'+
      '<div class="head"><strong>Product</strong><button class="btn ghost" data-close="m-prod">Close</button></div>'+
      '<div class="body grid">'+
        '<input id="prod-id" type="hidden" />'+
        '<input id="prod-name" class="input" placeholder="Name" />'+
        '<input id="prod-barcode" class="input" placeholder="Barcode" />'+
        '<input id="prod-price" class="input" type="number" step="0.01" placeholder="Price" />'+
        '<input id="prod-type" class="input" placeholder="Type" />'+
        '<textarea id="prod-ingredients" class="input" placeholder="Ingredients"></textarea>'+
        '<textarea id="prod-instructions" class="input" placeholder="Instructions"></textarea>'+
        '<input id="prod-img" class="input" placeholder="Image URL (optional)" />'+
      '</div>'+
      '<div class="foot"><button class="btn" id="save-prod">Save</button></div>'+
    '</div>'+
  '</div>';
}
function prodCardModal(){
  return ''+
  '<div class="modal-backdrop" id="mb-card"></div>'+
  '<div class="modal" id="m-card">'+
    '<div class="dialog">'+
      '<div class="head"><strong id="pc-name">Product</strong><button class="btn ghost" data-close="m-card">Close</button></div>'+
      '<div class="body grid cols-2">'+
        '<div><img id="pc-img" style="width:100%;border-radius:12px;border:1px solid var(--card-border)" /></div>'+
        '<div class="grid">'+
          '<div><strong>Barcode:</strong> <span id="pc-barcode"></span></div>'+
          '<div><strong>Price:</strong> <span id="pc-price"></span></div>'+
          '<div><strong>Type:</strong> <span id="pc-type"></span></div>'+
          '<div><strong>Ingredients:</strong><div id="pc-ingredients"></div></div>'+
          '<div><strong>Instructions:</strong><div id="pc-instructions"></div></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
  '</div>';
}
function cogsModal(){
  if (!canCreate()) return '';
  return ''+
  '<div class="modal-backdrop" id="mb-cogs"></div>'+
  '<div class="modal" id="m-cogs">'+
    '<div class="dialog">'+
      '<div class="head"><strong>COGS Row</strong><button class="btn ghost" data-close="m-cogs">Close</button></div>'+
      '<div class="body grid cols-2">'+
        '<input id="cogs-id" type="hidden" />'+
        '<input id="cogs-date" class="input" type="date" />'+
        '<input id="cogs-grossIncome" class="input" type="number" step="0.01" placeholder="Gross Income" />'+
        '<input id="cogs-produceCost" class="input" type="number" step="0.01" placeholder="Produce Cost" />'+
        '<input id="cogs-itemCost" class="input" type="number" step="0.01" placeholder="Item Cost" />'+
        '<input id="cogs-freight" class="input" type="number" step="0.01" placeholder="Freight" />'+
        '<input id="cogs-delivery" class="input" type="number" step="0.01" placeholder="Delivery" />'+
        '<input id="cogs-other" class="input" type="number" step="0.01" placeholder="Other" />'+
      '</div>'+
      '<div class="foot"><button class="btn" id="save-cogs">Save</button></div>'+
    '</div>'+
  '</div>';
}
function taskModal(){
  if (!canCreate()) return '';
  return ''+
  '<div class="modal-backdrop" id="mb-task"></div>'+
  '<div class="modal" id="m-task">'+
    '<div class="dialog">'+
      '<div class="head"><strong>Task</strong><button class="btn ghost" data-close="m-task">Close</button></div>'+
      '<div class="body grid">'+
        '<input id="task-id" type="hidden" />'+
        '<input id="task-title" class="input" placeholder="Title" />'+
        '<select id="task-status"><option value="todo">To do</option><option value="inprogress">In progress</option><option value="done">Done</option></select>'+
      '</div>'+
      '<div class="foot"><button class="btn" id="save-task">Save</button></div>'+
    '</div>'+
  '</div>';
}
function imgPreviewModal(){
  return ''+
  '<div class="modal-backdrop" id="mb-img"></div>'+
  '<div class="modal img-modal" id="m-img">'+
    '<div class="dialog">'+
      '<div class="head"><strong>Preview</strong><button class="btn ghost" data-close="m-img">Close</button></div>'+
      '<div class="body"><div class="imgbox"><img id="preview-img" src="" alt="Preview"/></div></div>'+
    '</div>'+
  '</div>';
}
function openImg(src){ var img=$('#preview-img'); if (!img) return; img.src = src || 'icons/icon-512.png'; openModal('m-img'); }
function openModal(id){ var m=$('#'+id), b=$('#mb-'+id.split('-')[1]); if (m) m.classList.add('active'); if (b) b.classList.add('active'); }
function closeModal(id){ var m=$('#'+id), b=$('#mb-'+id.split('-')[1]); if (m) m.classList.remove('active'); if (b) b.classList.remove('active'); }

// Wiring — Inventory
function wireInventory(){
  var add = $('#addInv'); if (add) add.onclick = function(){ openModal('m-inv'); };

  var sec = $('[data-section="inventory"]'); if (!sec) return;

  var saveBtn = $('#save-inv');
  if (saveBtn){
    saveBtn.addEventListener('click', function(){
      var items = load('inventory', []);
      var id = $('#inv-id').value || ('inv_'+Date.now());
      var obj = {
        id:id,
        name: $('#inv-name').value.trim(),
        code: $('#inv-code').value.trim(),
        type: $('#inv-type').value.trim(),
        price: parseFloat($('#inv-price').value||'0'),
        stock: parseInt($('#inv-stock').value||'0',10),
        threshold: parseInt($('#inv-threshold').value||'0',10),
        img: $('#inv-img').value.trim()
      };
      if (!obj.name) return notify('Name required','warn');
      var i = items.findIndex(function(x){ return x.id===id; });
      if (i>=0) items[i]=obj; else items.push(obj);
      save('inventory', items); closeModal('m-inv'); notify('Saved'); renderApp();
    });
  }

  sec.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('button'); if (!btn) return;

    if (btn.hasAttribute('data-edit')){
      var id = btn.getAttribute('data-edit');
      var items = load('inventory', []);
      var it = items.find(function(x){ return x.id===id; }); if (!it) return;
      openModal('m-inv');
      $('#inv-id').value=id; $('#inv-name').value=it.name; $('#inv-code').value=it.code;
      $('#inv-type').value=it.type||'Other'; $('#inv-price').value=it.price; $('#inv-stock').value=it.stock;
      $('#inv-threshold').value=it.threshold; $('#inv-img').value=it.img||'';
      return;
    }
    if (btn.hasAttribute('data-del')){
      var id = btn.getAttribute('data-del');
      var items2 = load('inventory', []).filter(function(x){ return x.id!==id; });
      save('inventory', items2); notify('Deleted'); renderApp(); return;
    }
    if (btn.hasAttribute('data-inc')){
      var id = btn.getAttribute('data-inc');
      var items3 = load('inventory', []); var it3 = items3.find(function(x){ return x.id===id; }); if (!it3) return;
      it3.stock++; save('inventory', items3); renderApp(); return;
    }
    if (btn.hasAttribute('data-dec')){
      var id = btn.getAttribute('data-dec');
      var items4 = load('inventory', []); var it4 = items4.find(function(x){ return x.id===id; }); if (!it4) return;
      it4.stock=Math.max(0,it4.stock-1); save('inventory', items4); renderApp(); return;
    }
    if (btn.hasAttribute('data-inc-th')){
      var id = btn.getAttribute('data-inc-th');
      var items5 = load('inventory', []); var it5 = items5.find(function(x){ return x.id===id; }); if (!it5) return;
      it5.threshold++; save('inventory', items5); renderApp(); return;
    }
    if (btn.hasAttribute('data-dec-th')){
      var id = btn.getAttribute('data-dec-th');
      var items6 = load('inventory', []); var it6 = items6.find(function(x){ return x.id===id; }); if (!it6) return;
      it6.threshold=Math.max(0,it6.threshold-1); save('inventory', items6); renderApp(); return;
    }
  });
}

// Wiring — Products
function wireProducts(){
  var add = $('#addProd'); if (add) add.onclick = function(){ openModal('m-prod'); };

  var sec = $('[data-section="products"]'); if (!sec) return;

  var saveBtn = $('#save-prod');
  if (saveBtn){
    saveBtn.addEventListener('click', function(){
      var items = load('products', []);
      var id = $('#prod-id').value || ('p_'+Date.now());
      var obj = {
        id:id,
        name: $('#prod-name').value.trim(),
        barcode: $('#prod-barcode').value.trim(),
        price: parseFloat($('#prod-price').value||'0'),
        type: $('#prod-type').value.trim(),
        ingredients: $('#prod-ingredients').value.trim(),
        instructions: $('#prod-instructions').value.trim(),
        img: $('#prod-img').value.trim()
      };
      if (!obj.name) return notify('Name required','warn');
      var i = items.findIndex(function(x){ return x.id===id; });
      if (i>=0) items[i]=obj; else items.push(obj);
      save('products', items); closeModal('m-prod'); notify('Saved'); renderApp();
    });
  }

  sec.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('button'); if (!btn) return;
    var id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    if (btn.hasAttribute('data-edit')){
      var items = load('products', []); var it = items.find(function(x){ return x.id===id; }); if (!it) return;
      openModal('m-prod');
      $('#prod-id').value=id; $('#prod-name').value=it.name; $('#prod-barcode').value=it.barcode;
      $('#prod-price').value=it.price; $('#prod-type').value=it.type;
      $('#prod-ingredients').value=it.ingredients; $('#prod-instructions').value=it.instructions; $('#prod-img').value=it.img||'';
    } else {
      var items2 = load('products', []).filter(function(x){ return x.id!==id; });
      save('products', items2); notify('Deleted'); renderApp();
    }
  });

  wireProductCardClicks();
}
function wireProductCardClicks(){
  $$('.prod-thumb').forEach(function(el){
    el.style.cursor = 'pointer';
    el.onclick = function(){
      var id = el.getAttribute('data-card');
      var items = load('products', []);
      var it = items.find(function(x){ return x.id===id; }); if (!it) return;
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

// Phone image preview
function enableMobileImagePreview(){
  var isPhone = window.matchMedia('(max-width: 740px)').matches;
  if (!isPhone) return;
  $$('.inv-preview, .prod-preview').forEach(function(el){
    el.style.cursor = 'pointer';
    el.addEventListener('click', function(){
      var src = el.getAttribute('data-src') || 'icons/icon-512.png';
      openImg(src);
    });
  });
}

// Wiring — COGS
function wireCOGS(){
  var add = $('#addCOGS'); if (add) add.onclick = function(){ openModal('m-cogs'); };

  var sec = $('[data-section="cogs"]'); if (!sec) return;

  var saveBtn = $('#save-cogs');
  if (saveBtn){
    saveBtn.addEventListener('click', function(){
      var rows = load('cogs', []);
      var id = $('#cogs-id').value || ('c_'+Date.now());
      var row = {
        id:id,
        date: $('#cogs-date').value || new Date().toISOString().slice(0,10),
        grossIncome: parseFloat($('#cogs-grossIncome').value||'0'),
        produceCost: parseFloat($('#cogs-produceCost').value||'0'),
        itemCost: parseFloat($('#cogs-itemCost').value||'0'),
        freight: parseFloat($('#cogs-freight').value||'0'),
        delivery: parseFloat($('#cogs-delivery').value||'0'),
        other: parseFloat($('#cogs-other').value||'0')
      };
      var i = rows.findIndex(function(x){ return x.id===id; });
      if (i>=0) rows[i]=row; else rows.push(row);
      save('cogs', rows); closeModal('m-cogs'); notify('Saved'); renderApp();
    });
  }

  sec.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('button'); if (!btn) return;
    var id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    if (btn.hasAttribute('data-edit')){
      var rows = load('cogs', []); var r = rows.find(function(x){ return x.id===id; }); if (!r) return;
      openModal('m-cogs');
      $('#cogs-id').value=id; $('#cogs-date').value=r.date;
      $('#cogs-grossIncome').value=r.grossIncome; $('#cogs-produceCost').value=r.produceCost;
      $('#cogs-itemCost').value=r.itemCost; $('#cogs-freight').value=r.freight;
      $('#cogs-delivery').value=r.delivery; $('#cogs-other').value=r.other;
    } else {
      var rows2 = load('cogs', []).filter(function(x){ return x.id!==id; });
      save('cogs', rows2); notify('Deleted'); renderApp();
    }
  });
}

// DnD — Tasks (works with empty lanes)
function setupDnD(){
  var lanes = ['todo','inprogress','done'];
  var allow = {
    'todo':       new Set(['inprogress','done']),
    'inprogress': new Set(['todo','done']),
    'done':       new Set(['todo','inprogress'])
  };

  // cards draggable
  $$('[data-task]').forEach(function(card){
    card.ondragstart = function(e){
      e.dataTransfer.setData('text/plain', card.getAttribute('data-task'));
    };
  });

  // lanes accept
  lanes.forEach(function(k){
    var laneGrid = $('#lane-'+k);
    var dropzone = document.querySelector('.lane-dropzone[data-dropzone="'+k+'"]');
    var parentCard = laneGrid && laneGrid.closest('.lane-row');

    function over(e){
      e.preventDefault();
      var id = e.dataTransfer && e.dataTransfer.getData('text/plain');
      if (!id) { if(parentCard) parentCard.classList.remove('drop'); return; }
      var items = load('tasks', []);
      var t = items.find(function(x){ return x.id===id; }); if (!t){ if(parentCard) parentCard.classList.remove('drop'); return; }
      if (allow[t.status].has(k)) { if(parentCard) parentCard.classList.add('drop'); }
      else { if(parentCard) parentCard.classList.remove('drop'); }
    }
    function leave(){ if(parentCard) parentCard.classList.remove('drop'); }
    function drop(e){
      e.preventDefault();
      if(parentCard) parentCard.classList.remove('drop');
      var id = e.dataTransfer.getData('text/plain');
      var items = load('tasks', []);
      var t = items.find(function(x){ return x.id===id; }); if (!t) return;
      if (!allow[t.status].has(k)) { notify('Move not allowed','warn'); return; }
      t.status = k; save('tasks', items); renderApp();
    }

    if (laneGrid){
      laneGrid.ondragover = over;
      laneGrid.ondragenter = function(e){ e.preventDefault(); };
      laneGrid.ondragleave = leave;
      laneGrid.ondrop = drop;
    }
    if (dropzone){
      dropzone.ondragover = over;
      dropzone.ondragenter = function(e){ e.preventDefault(); };
      dropzone.ondragleave = leave;
      dropzone.ondrop = drop;
    }
  });
}

function wireTasks(){
  var root = $('[data-section="tasks"]'); if (!root) return;
  var add = $('#addTask'); if (add) add.onclick = function(){ openModal('m-task'); };

  var saveBtn = $('#save-task');
  if (saveBtn){
    saveBtn.addEventListener('click', function(){
      var items = load('tasks', []);
      var id = $('#task-id').value || ('t_'+Date.now());
      var obj = { id:id, title: $('#task-title').value.trim(), status: $('#task-status').value };
      var i = items.findIndex(function(x){ return x.id===id; });
      if (i>=0) items[i]=obj; else items.push(obj);
      save('tasks', items); closeModal('m-task'); notify('Saved'); renderApp();
    });
  }

  root.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('button'); if (!btn) return;
    var id = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!id) return;
    if (btn.hasAttribute('data-edit')){
      var items = load('tasks', []); var t = items.find(function(x){ return x.id===id; }); if (!t) return;
      openModal('m-task'); $('#task-id').value=t.id; $('#task-title').value=t.title; $('#task-status').value=t.status;
    } else {
      var items2 = load('tasks', []).filter(function(x){ return x.id!==id; });
      save('tasks', items2); notify('Deleted'); renderApp();
    }
  });
}

// Wiring — Users
function wireUsers(){
  if (!canManage()) return;
  var add = $('#addUser'); if (add) add.onclick = function(){ openModal('m-user'); };

  var saveBtn = $('#save-user');
  if (saveBtn){
    saveBtn.addEventListener('click', function(){
      var users = load('users', []);
      var email = ($('#user-email').value||'').trim().toLowerCase();
      if (!email) return notify('Email required','warn');
      var obj = {
        name: $('#user-name').value.trim() || email.split('@')[0],
        email: email,
        username: $('#user-username').value.trim() || email.split('@')[0],
        role: $('#user-role').value,
        img: $('#user-img').value.trim(),
        contact:'', password:''
      };
      var i = users.findIndex(function(x){ return (x.email||'').toLowerCase()===email; });
      if (i>=0) users[i]=obj; else users.push(obj);
      save('users', users); closeModal('m-user'); notify('Saved'); renderApp();
    });
  }

  var sec = $('[data-section="users"]'); if (!sec) return;
  sec.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('button'); if (!btn) return;
    var email = btn.getAttribute('data-edit') || btn.getAttribute('data-del'); if (!email) return;
    if (btn.hasAttribute('data-edit')){
      var users = load('users', []); var u = users.find(function(x){ return x.email===email; }); if (!u) return;
      openModal('m-user');
      $('#user-name').value=u.name; $('#user-email').value=u.email;
      $('#user-username').value=u.username; $('#user-role').value=u.role;
      $('#user-img').value=u.img||'';
    } else {
      var users2 = load('users', []).filter(function(x){ return x.email!==email; });
      save('users', users2); notify('Deleted'); renderApp();
    }
  });
}

// Settings wiring
function wireSettings(){
  var mode = $('#theme-mode'), size = $('#theme-size');
  if (mode && size){
    function apply(){
      var t = { mode: mode.value, size: size.value };
      save('_theme2', t); applyTheme(); renderApp();
    }
    mode.onchange = apply;
    size.onchange = apply;
  }

  var toggle = $('#cloud-toggle');
  if (toggle){
    toggle.addEventListener('change', function(e){
      var val = e.target.value;
      if (val==='on'){
        if (!auth.currentUser){ notify('Sign in first.','warn'); toggle.value='off'; return; }
        firebase.database().goOnline();
        cloud.enable().then(function(){ notify('Cloud Sync ON'); }).catch(function(err){
          notify((err && err.message)||'Could not enable sync','danger'); toggle.value='off';
        });
      } else {
        cloud.disable();
        firebase.database().goOffline();
        notify('Cloud Sync OFF');
      }
    });
  }

  var syncNow = $('#cloud-sync-now');
  if (syncNow){
    syncNow.addEventListener('click', function(){
      if (!auth.currentUser){ notify('Sign in first.','warn'); return; }
      if (!cloud.isOn()){ notify('Turn Cloud Sync ON first in Settings.','warn'); return; }
      if (!navigator.onLine){ notify('You appear to be offline.','warn'); return; }
      firebase.database().goOnline();
      cloud.pushAll().then(function(){ notify('Synced'); }).catch(function(e){
        notify((e && e.message) || 'Sync failed','danger');
      });
    });
  }
}

// ===================== Part 6 — Search Index + Utils + Boot =====================

function buildSearchIndex(){
  var posts = load('posts', []);
  var inv   = load('inventory', []);
  var prods = load('products', []);
  var cogs  = load('cogs', []);
  var users = load('users', []);
  var pages = [
    { id:'policy',  label:'Policy',  section:'Pages', route:'policy' },
    { id:'license', label:'License', section:'Pages', route:'license' },
    { id:'setup',   label:'Setup Guide', section:'Pages', route:'setup' },
    { id:'contact', label:'Contact', section:'Pages', route:'contact' },
    { id:'guide',   label:'User Guide', section:'Pages', route:'guide' }
  ];
  var ix = [];
  posts.forEach(function(p){ ix.push({ id:p.id, label:p.title, section:'Posts', route:'dashboard', text:(p.title+' '+p.body) }); });
  inv.forEach(function(i ){ ix.push({ id:i.id, label:i.name,  section:'Inventory', route:'inventory', text:(i.name+' '+i.code+' '+i.type) }); });
  prods.forEach(function(p){ ix.push({ id:p.id, label:p.name, section:'Products',  route:'products',  text:(p.name+' '+p.barcode+' '+p.type+' '+p.ingredients) }); });
  cogs.forEach(function(r){ ix.push({ id:r.id, label:r.date,  section:'COGS',      route:'cogs',      text:(r.date+' '+r.grossIncome+' '+r.produceCost+' '+r.itemCost+' '+r.freight+' '+r.delivery+' '+r.other) }); });
  users.forEach(function(u){ ix.push({ id:u.email, label:u.name, section:'Users',   route:'settings',  text:(u.name+' '+u.email+' '+u.role) }); });
  pages.forEach(function(p){ ix.push(p); });
  return ix;
}
function searchAll(index, q){
  var term = q.toLowerCase();
  return index.map(function(item){
    var labelHit = ((item.label||'').toLowerCase().indexOf(term)>=0) ? 2 : 0;
    var textHit  = ((item.text ||'').toLowerCase().indexOf(term)>=0) ? 1 : 0;
    return { item:item, score: labelHit + textHit };
  }).filter(function(x){ return x.score>0; }).sort(function(a,b){ return b.score-a.score; }).map(function(x){ return x.item; });
}
function scrollToRow(id){
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
}

// Boot
if (session) renderApp(); else renderLogin();

// For console debugging
window._inventory = { go:go, load:load, save:save, cloud:cloud };