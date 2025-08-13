// Part A – Firebase Init, Helpers, Theme, Cloud Sync, Auth, Router/Idle
/* ================================
   PART A – CORE INIT + GLOBALS
   ================================ */

// ===== FIREBASE INIT =====
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
const db = firebase.database();

// ===== GLOBAL VARS =====
let currentRoute = 'home';
let idleTimer = null;
let cloud = { isOn: true }; // prevent undefined errors

// ===== THEME / SETTINGS =====
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
function loadTheme() {
  const t = localStorage.getItem('theme') || 'light';
  setTheme(t);
}

// ===== NOTIFY HELPER =====
function notify(msg, type = 'ok', ms = 3000) {
  const n = document.getElementById('notification');
  if (!n) return;
  n.textContent = msg;
  n.className = `notification show ${type}`;
  setTimeout(() => { n.className = 'notification'; }, ms);
}

// ===== ROUTER =====
function navigate(route) {
  currentRoute = route;
  window.location.hash = route;
  renderApp();
}

// ===== AUTH STATE =====
auth.onAuthStateChanged(user => {
  console.log("[auth] onAuthStateChanged fired. user?", !!user);
  if (user) {
    renderApp();
  } else {
    renderLogin();
  }
});

// ===== IDLE DETECTION =====
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (auth.currentUser) {
      console.log("Idle too long, signing out...");
      auth.signOut();
    }
  }, 1000 * 60 * 30); // 30 min
}
['mousemove', 'keydown', 'click'].forEach(evt =>
  window.addEventListener(evt, resetIdleTimer)
);
resetIdleTimer();

// ===== CLOUD SYNC =====
function syncNow() {
  if (!cloud.isOn) {
    notify('Client is offline', 'warn');
    return;
  }
  notify('Syncing...', 'ok');
  // here you would push local changes to Firebase or vice versa
  setTimeout(() => {
    notify('Sync complete', 'ok');
  }, 1000);
}

// ===== INITIAL THEME LOAD =====
loadTheme();

// Part B – Login UI + Sidebar/Topbar + renderApp + Global Listeners + Sidebar Search
/* ================================
   PART B – LOGIN + NAVIGATION
   ================================ */

// ===== LOGIN UI =====
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
      const msg = e?.message || 'Login failed';
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

  document.getElementById('link-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof openModal === 'function' && document.getElementById('m-forgot')) openModal('m-forgot');
    else notify('Password reset is available in Settings > Account.', 'ok');
  });
  document.getElementById('link-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof openModal === 'function' && document.getElementById('m-register')) openModal('m-register');
    else notify('Registration is disabled in this demo. Ask an admin to invite you.', 'ok');
  });
}

// ===== SIDEBAR =====
function renderSidebar() {
  return `
    <div class="sidebar">
      <div class="sidebar-logo">📦</div>
      <nav>
        <a href="#home" data-route="home"><i class="ri-home-line"></i> Home</a>
        <a href="#dashboard" data-route="dashboard"><i class="ri-dashboard-line"></i> Dashboard</a>
        <a href="#inventory" data-route="inventory"><i class="ri-archive-2-line"></i> Inventory</a>
        <a href="#products" data-route="products"><i class="ri-cake-line"></i> Products</a>
        <a href="#tasks" data-route="tasks"><i class="ri-task-line"></i> Tasks</a>
        <a href="#cogs" data-route="cogs"><i class="ri-pie-chart-line"></i> COGS</a>
        <a href="#users" data-route="users"><i class="ri-team-line"></i> Users</a>
        <a href="#settings" data-route="settings"><i class="ri-settings-3-line"></i> Settings</a>
        <a href="#contact" data-route="contact"><i class="ri-mail-line"></i> Contact</a>
      </nav>
    </div>
  `;
}

// ===== TOPBAR =====
function renderTopbar() {
  return `
    <div class="topbar">
      <div class="sidebar-toggle"><i class="ri-menu-line"></i></div>
      <input id="sidebar-search" class="search" placeholder="Search..." />
      <div class="user-menu"><i class="ri-user-line"></i></div>
    </div>
  `;
}

// ===== APP RENDER =====
function renderApp() {
  const root = document.getElementById('root');
  const sidebarHTML = renderSidebar();
  const topbarHTML = renderTopbar();

  let contentHTML = '';
  switch (currentRoute) {
    case 'dashboard': contentHTML = renderDashboard(); break;
    case 'inventory': contentHTML = renderInventory(); break;
    case 'products': contentHTML = renderProducts(); break;
    case 'tasks': contentHTML = renderTasks(); break;
    case 'cogs': contentHTML = renderCogs(); break;
    case 'users': contentHTML = renderUsers(); break;
    case 'settings': contentHTML = renderSettings(); break;
    case 'contact': contentHTML = renderContact(); break;
    default: contentHTML = renderHome();
  }

  root.innerHTML = `
    <div class="layout">
      ${sidebarHTML}
      <div class="main">
        ${topbarHTML}
        <div class="content">${contentHTML}</div>
      </div>
    </div>
  `;

  wireSidebarSearch();
}

// ===== SIDEBAR SEARCH =====
function wireSidebarSearch() {
  const searchInput = document.getElementById('sidebar-search');
  if (!searchInput) return;
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    document.querySelectorAll('.sidebar nav a').forEach(a => {
      const text = a.textContent.toLowerCase();
      a.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

// Part C – Home (Hot Weekly Videos + Shuffle), Dashboard (YoY & MoM), Posts
/* ================================
   PART C – HOME + DASHBOARD + POSTS
   ================================ */

// ===== HOME PAGE =====
function renderHome() {
  return `
    <div class="home">
      <h1>Welcome</h1>
      <p>Your hub for quick actions & updates.</p>
      <div class="video-player">
        <video id="hotVideo" width="100%" controls autoplay muted></video>
        <button id="btnShuffle" class="btn">Shuffle Videos</button>
      </div>
    </div>
  `;
}

const weeklyVideos = [
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
  "https://media.w3.org/2010/05/sintel/trailer_hd.mp4"
];

function playRandomVideo() {
  const vid = document.getElementById('hotVideo');
  if (!vid) return;
  const pick = weeklyVideos[Math.floor(Math.random() * weeklyVideos.length)];
  vid.src = pick;
}

function wireHome() {
  document.getElementById('btnShuffle')?.addEventListener('click', playRandomVideo);
  playRandomVideo();
}

// ===== DASHBOARD =====
function renderDashboard() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const currentSales = sumSalesByMonth(year, month);
  const prevMonthSales = sumSalesByMonth(year, month - 1);
  const prevYearSales = sumSalesByMonth(year - 1, month);

  const momChange = prevMonthSales ? ((currentSales - prevMonthSales) / prevMonthSales) * 100 : 0;
  const yoyChange = prevYearSales ? ((currentSales - prevYearSales) / prevYearSales) * 100 : 0;

  return `
    <div class="dashboard">
      <h1>Dashboard</h1>
      <div class="stats-grid">
        <div class="stat-card" data-route="inventory"><h3>Total Items</h3><p>${inventory.length}</p></div>
        <div class="stat-card" data-route="products"><h3>Products</h3><p>${products.length}</p></div>
        <div class="stat-card" data-route="tasks"><h3>Tasks</h3><p>${tasks.length}</p></div>
        <div class="stat-card" data-route="cogs"><h3>COGS</h3><p>${cogs.length}</p></div>
      </div>
      <div class="sales-comparison">
        <h2>Sales Comparison</h2>
        <p>Month-over-Month: ${momChange.toFixed(1)}%</p>
        <p>Year-over-Year: ${yoyChange.toFixed(1)}%</p>
      </div>
    </div>
  `;
}

function wireDashboard() {
  document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => {
      const route = card.getAttribute('data-route');
      if (route) navigate(route);
    });
  });
}

function sumSalesByMonth(year, month) {
  const filtered = cogs.filter(row => {
    const d = new Date(row.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  return filtered.reduce((sum, row) => sum + (row.grossIncome || 0), 0);
}

// ===== POSTS =====
function renderPosts() {
  return `
    <div class="posts">
      <h1>Posts</h1>
      <button id="btnNewPost" class="btn">New Post</button>
      <div id="postList">${posts.map(p => `<div class="post-card"><h3>${p.title}</h3><p>${p.body}</p></div>`).join('')}</div>
    </div>
  `;
}

function wirePosts() {
  document.getElementById('btnNewPost')?.addEventListener('click', () => {
    const title = prompt("Post Title:");
    const body = prompt("Post Body:");
    if (title && body) {
      posts.push({ title, body });
      notify('Post added');
      navigate('posts');
    }
  });
}

// Part D – Inventory / Products / COGS (+ CSV Export), Tasks (Free DnD)
/* ================================
   PART D – INVENTORY / PRODUCTS / COGS / TASKS
   ================================ */

function renderInventory() {
  return `
    <div class="inventory">
      <h1>Inventory</h1>
      <button class="btn" id="btnExportInv">Export CSV</button>
      <table>
        <thead><tr><th>Name</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>
          ${inventory.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>${i.price}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function wireInventory() {
  document.getElementById('btnExportInv')?.addEventListener('click', () => exportCSV('inventory.csv', inventory));
}

function renderProducts() {
  return `
    <div class="products">
      <h1>Products</h1>
      <button class="btn" id="btnExportProd">Export CSV</button>
      <div class="grid">
        ${products.map(p => `<div class="card"><h3>${p.name}</h3><p>${p.desc}</p></div>`).join('')}
      </div>
    </div>
  `;
}

function wireProducts() {
  document.getElementById('btnExportProd')?.addEventListener('click', () => exportCSV('products.csv', products));
}

function renderCogs() {
  return `
    <div class="cogs">
      <h1>COGS</h1>
      <button class="btn" id="btnExportCogs">Export CSV</button>
      <table>
        <thead><tr><th>Date</th><th>Gross Income</th></tr></thead>
        <tbody>
          ${cogs.map(c => `<tr><td>${c.date}</td><td>${c.grossIncome}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function wireCogs() {
  document.getElementById('btnExportCogs')?.addEventListener('click', () => exportCSV('cogs.csv', cogs));
}

function exportCSV(filename, rows) {
  const csvContent = "data:text/csv;charset=utf-8," +
    [Object.keys(rows[0]).join(","), ...rows.map(r => Object.values(r).join(","))].join("\n");
  const link = document.createElement("a");
  link.href = encodeURI(csvContent);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===== TASKS =====
function renderTasks() {
  return `
    <div class="tasks">
      <h1>Tasks</h1>
      <div class="task-lane" data-status="todo">
        <h3>To Do</h3>
        ${tasks.filter(t => t.status === 'todo').map(t => `<div class="task-card" draggable="true">${t.title}</div>`).join('')}
      </div>
      <div class="task-lane" data-status="inprogress">
        <h3>In Progress</h3>
        ${tasks.filter(t => t.status === 'inprogress').map(t => `<div class="task-card" draggable="true">${t.title}</div>`).join('')}
      </div>
      <div class="task-lane" data-status="done">
        <h3>Done</h3>
        ${tasks.filter(t => t.status === 'done').map(t => `<div class="task-card" draggable="true">${t.title}</div>`).join('')}
      </div>
    </div>
  `;
}

function wireTasks() {
  const cards = document.querySelectorAll('.task-card');
  const lanes = document.querySelectorAll('.task-lane');

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.textContent);
      e.dataTransfer.effectAllowed = 'move';
    });
  });

  lanes.forEach(lane => {
    lane.addEventListener('dragover', e => e.preventDefault());
    lane.addEventListener('drop', e => {
      e.preventDefault();
      const title = e.dataTransfer.getData('text/plain');
      const task = tasks.find(t => t.title === title);
      if (task) {
        task.status = lane.dataset.status;
        navigate('tasks');
      }
    });
  });
}

// Part E – Settings, Users Management, Contact (EmailJS), Static Pages, All Modals
/* ================================
   PART E – SETTINGS / USERS / CONTACT / MODALS
   ================================ */

// ===== SETTINGS =====
function renderSettings() {
  return `
    <div class="settings">
      <h1>Settings</h1>
      <label>Theme:
        <select id="themeSelect">
          <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
          <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
        </select>
      </label>
    </div>
  `;
}

function wireSettings() {
  document.getElementById('themeSelect')?.addEventListener('change', e => {
    theme = e.target.value;
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    notify(`Theme set to ${theme}`);
  });
}

// ===== USERS =====
function renderUsers() {
  return `
    <div class="users">
      <h1>Users</h1>
      <button id="btnNewUser" class="btn">New User</button>
      <div class="grid">
        ${users.map(u => `
          <div class="card">
            <h3>${u.name}</h3>
            <p>${u.email}</p>
            <button class="btn edit-user" data-id="${u.id}">Edit</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function wireUsers() {
  document.getElementById('btnNewUser')?.addEventListener('click', () => {
    openModal('m-new-user');
  });
  document.querySelectorAll('.edit-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openModal('m-edit-user', id);
    });
  });
}

// ===== CONTACT =====
function renderContact() {
  return `
    <div class="contact">
      <h1>Contact Us</h1>
      <form id="contactForm">
        <input type="text" name="from_name" placeholder="Your Name" required>
        <input type="email" name="from_email" placeholder="Your Email" required>
        <textarea name="message" placeholder="Message" required></textarea>
        <button type="submit" class="btn">Send</button>
      </form>
    </div>
  `;
}

function wireContact() {
  document.getElementById('contactForm')?.addEventListener('submit', e => {
    e.preventDefault();
    emailjs.sendForm('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', e.target, 'YOUR_PUBLIC_KEY')
      .then(() => {
        notify('Message sent successfully!');
        e.target.reset();
      })
      .catch(err => {
        console.error('EmailJS error', err);
        notify('Failed to send message.', 'danger');
      });
  });
}

// ===== STATIC PAGES =====
function renderStatic(page) {
  const pages = {
    'user-guide': `<h1>User Guide</h1><p>Instructions on how to use the app...</p>`,
    'social': `<h1>Social</h1><p>Links to our social platforms...</p>`
  };
  return pages[page] || '<h1>Page not found</h1>';
}

// ===== MODALS =====
function openModal(id, data) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  if (id === 'm-edit-user' && data) {
    const user = users.find(u => u.id === data);
    if (user) {
      modal.querySelector('input[name="name"]').value = user.name;
      modal.querySelector('input[name="email"]').value = user.email;
    }
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// Part F – Search Index Utilities + Bootstrapping
/* ================================
   PART F – SEARCH UTILITIES / APP BOOTSTRAP
   ================================ */

function buildSearchIndex() {
  return [
    ...inventory.map(i => ({ title: i.name, route: 'inventory' })),
    ...products.map(p => ({ title: p.name, route: 'products' })),
    ...tasks.map(t => ({ title: t.title, route: 'tasks' })),
    ...cogs.map(c => ({ title: c.date, route: 'cogs' }))
  ];
}

function searchApp(query) {
  const idx = buildSearchIndex();
  return idx.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
}

function navigate(route) {
  let html = '';
  if (route === 'home') html = renderHome();
  else if (route === 'dashboard') html = renderDashboard();
  else if (route === 'posts') html = renderPosts();
  else if (route === 'inventory') html = renderInventory();
  else if (route === 'products') html = renderProducts();
  else if (route === 'cogs') html = renderCogs();
  else if (route === 'tasks') html = renderTasks();
  else if (route === 'settings') html = renderSettings();
  else if (route === 'users') html = renderUsers();
  else if (route === 'contact') html = renderContact();
  else if (route === 'user-guide' || route === 'social') html = renderStatic(route);

  const root = document.getElementById('root');
  if (root) root.innerHTML = html;

  // Wire-up respective page
  if (route === 'home') wireHome();
  if (route === 'dashboard') wireDashboard();
  if (route === 'posts') wirePosts();
  if (route === 'inventory') wireInventory();
  if (route === 'products') wireProducts();
  if (route === 'cogs') wireCogs();
  if (route === 'tasks') wireTasks();
  if (route === 'settings') wireSettings();
  if (route === 'users') wireUsers();
  if (route === 'contact') wireContact();
}

auth.onAuthStateChanged(user => {
  if (user) {
    navigate('dashboard');
  } else {
    renderLogin();
  }
});
