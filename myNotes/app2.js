// Part A – Firebase Init, Helpers, Theme, Cloud Sync, Auth, Router/Idle
/* ================================
   PART A – CORE INIT + GLOBALS
   ================================ */

/********************
 *  FIREBASE INIT   *
 ********************/
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

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.database();

/********************
 *  GLOBAL VARS     *
 ********************/
let currentUser = null;
let currentRoute = '';
let idleTimer = null;
let isCloudEnabled = false;

/********************
 *  THEME HANDLING  *
 ********************/
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'light');
}

function loadTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  applyTheme(theme);
}

function saveTheme(theme) {
  localStorage.setItem('theme', theme);
  applyTheme(theme);
}

/********************
 *  UTILITIES       *
 ********************/
function notify(msg, type='ok') {
  const note = document.getElementById('notification');
  if (!note) return;
  note.textContent = msg;
  note.className = `notification show ${type}`;
  setTimeout(() => { note.className = 'notification'; }, 4000);
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toISOString().split('T')[0];
}

function formatMoney(num) {
  return `$${Number(num || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function randomId() {
  return Math.random().toString(36).substr(2, 9);
}

/********************
 *  CLOUD SYNC      *
 ********************/
const cloud = {
  isOn: () => isCloudEnabled,
  enable: () => { isCloudEnabled = true; },
  disable: () => { isCloudEnabled = false; }
};

/********************
 *  AUTH HANDLING   *
 ********************/
auth.onAuthStateChanged(user => {
  console.log('[auth] onAuthStateChanged fired. user?', !!user);
  if (user) {
    currentUser = user;
    renderApp();
  } else {
    currentUser = null;
    renderLogin();
  }
});

/********************
 *  ROUTER          *
 ********************/
function navigate(route) {
  currentRoute = route;
  switch(route) {
    case 'dashboard': wireDashboard?.(); break;
    case 'inventory': wireInventory?.(); break;
    case 'products':  wireProducts?.(); break;
    case 'cogs':      wireCOGS?.(); break;
    case 'tasks':     wireTasks?.(); setupDnD?.(); break;
    case 'settings':  wireSettings?.(); break;
  }
}

/********************
 *  IDLE DETECTION  *
 ********************/
function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (auth.currentUser) {
      auth.signOut();
      notify('Signed out due to inactivity.', 'warn');
    }
  }, 30 * 60 * 1000); // 30 minutes
}

['mousemove','keydown','touchstart'].forEach(evt => {
  window.addEventListener(evt, resetIdleTimer);
});


/********************
 *  LOGIN RENDER    *
 ********************/
function renderLogin() {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="login">
      <div class="card login-card">
        <div class="card-body">
          <div class="login-logo" style="display:grid;place-items:center;gap:10px;margin-bottom:10px">
            <div class="logo" style="
                width:100px;height:100px;border-radius:22px;
                display:grid;place-items:center;
                background: radial-gradient(ellipse at 30% 30%, var(--brand), var(--brand-2));
                color: #fff; font-size:38px; font-weight:800; box-shadow: var(--shadow);
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

    if (!navigator.onLine) {
      notify('You appear to be offline. Connect to the internet and try again.', 'warn');
      return;
    }

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      notify('Welcome!');
    } catch (e) {
      const msg = e && e.message ? e.message : 'Login failed';
      if (/network/i.test(msg)) {
        notify('Network error: please check your connection and try again.', 'danger');
      } else if (/password/i.test(msg)) {
        notify('Incorrect email or password.', 'danger');
      } else if (/api key/i.test(msg)) {
        notify('Invalid API key – check your Firebase configuration.', 'danger');
      } else {
        notify(msg, 'danger');
      }
    }
  };

  document.getElementById('btnLogin')?.addEventListener('click', doSignIn);
  document.getElementById('li-pass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSignIn();
  });

  document.getElementById('link-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof openModal === 'function' && document.getElementById('m-forgot')) openModal('m-forgot');
    else notify('Password reset is available in Settings > Account.', 'ok');
  });
  document.getElementById('link-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof openModal === 'function' && document.getElementById('m-register')) openModal('m-register');
    else notify('Registration is disabled in this demo.', 'ok');
  });
}

/********************
 *  SIDEBAR + TOPBAR *
 ********************/
function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="logo">📦</div>
      <nav>
        <a href="#dashboard" class="nav-link" data-route="dashboard"><i class="ri-dashboard-line"></i> Dashboard</a>
        <a href="#inventory" class="nav-link" data-route="inventory"><i class="ri-archive-line"></i> Inventory</a>
        <a href="#products" class="nav-link" data-route="products"><i class="ri-sushi-line"></i> Products</a>
        <a href="#cogs" class="nav-link" data-route="cogs"><i class="ri-money-dollar-circle-line"></i> COGS</a>
        <a href="#tasks" class="nav-link" data-route="tasks"><i class="ri-task-line"></i> Tasks</a>
        <a href="#settings" class="nav-link" data-route="settings"><i class="ri-settings-3-line"></i> Settings</a>
        <a href="#users" class="nav-link" data-route="users"><i class="ri-team-line"></i> Users</a>
        <a href="#contact" class="nav-link" data-route="contact"><i class="ri-mail-line"></i> Contact</a>
      </nav>
    </aside>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <button id="btnSidebarToggle" class="icon-btn"><i class="ri-menu-line"></i></button>
      <input id="sidebar-search" class="input" type="text" placeholder="Search..." style="flex:1;margin-left:8px" />
      <div style="flex:1"></div>
      <button id="btnLogout" class="btn small"><i class="ri-logout-box-line"></i> Logout</button>
    </header>
  `;
}

/********************
 *  APP RENDER      *
 ********************/
function renderApp() {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="app">
      ${renderSidebar()}
      <main class="main">
        ${renderTopbar()}
        <section id="main-content" class="main-content"></section>
      </main>
    </div>
  `;

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    auth.signOut();
    notify('Signed out', 'ok');
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const route = link.getAttribute('data-route');
      navigate(route);
    });
  });

  document.getElementById('btnSidebarToggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });

  document.getElementById('sidebar-search')?.addEventListener('input', e => {
    const val = e.target.value.toLowerCase();
    document.querySelectorAll('.nav-link').forEach(link => {
      const match = link.textContent.toLowerCase().includes(val);
      link.style.display = match ? '' : 'none';
    });
  });

  navigate('dashboard');
}