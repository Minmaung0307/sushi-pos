/* =========================
   Sushi POS — compat build
   ========================= */

/* ===== Utilities ===== */
const q = s => document.querySelector(s);
const qa = s => Array.from(document.querySelectorAll(s));

function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); try { cloudMaybePush(); } catch(e) {} }
const load = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };

function showNotif(msg) {
  const n = q('#notification'); if (!n) return;
  n.textContent = msg; n.style.display = 'block'; n.style.opacity = 1;
  setTimeout(() => { n.style.opacity = 0; setTimeout(() => n.style.display = 'none', 260); }, 1600);
}

/* Image compression */
async function compressImage(file, maxW=1000, maxH=1000, quality=0.8){
  if(!file) return '';
  const img = await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(file); });
  let {width, height} = img;
  const ratio = Math.min(maxW/width, maxH/height, 1);
  width = Math.round(width*ratio); height = Math.round(height*ratio);
  const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,width,height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  URL.revokeObjectURL(img.src);
  return dataUrl;
}
const formatPhone=v=>{const d=(v||'').toString().replace(/\D/g,'').slice(0,10); if(d.length<4) return d; if(d.length<7) return `(${d.slice(0,3)}) ${d.slice(3)}`; return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;};

/* ===== Theme ===== */
function applyTheme(){const t=load('theme',{color:'light',font:'medium'}); document.body.classList.toggle('dark',t.color==='dark'); document.body.style.fontSize=t.font==='large'?'18px':t.font==='small'?'15px':'16px';}

/* ===== Defaults / State ===== */
const DEFAULT_ADMIN={username:'admin',email:'admin@sushi.com',password:'admin123',role:'admin',name:'Admin',contact:'(123) 456-7890',img:''};
const DEMO={posts:[],inventory:[],sushi:[],vendors:[],cogs:[],tasks:[{id:'todo',name:'To Do',cards:[]},{id:'doing',name:'In Progress',cards:[]},{id:'done',name:'Done',cards:[]},]};
let SKEYS = Object.keys(DEMO); let S = {};
const UI_DEFAULT={quickPostOpen:false,sidebarOpen:false}; let UI=load('ui',UI_DEFAULT);
let session=load('session',null); let page=load('page','dashboard');

/* ===== PWA install button ===== */
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  const btn = document.getElementById('installBtn'); if (btn) btn.style.display='inline-block';
});
window.addEventListener('appinstalled', () => { deferredPrompt=null; showNotif('App installed!'); const btn=document.getElementById('installBtn'); if(btn) btn.style.display='none'; });

/* ======================
   Firebase (compat)
   ====================== 
   IMPORTANT: fill with YOUR project values (Project settings > Web app) */
const firebaseConfig = {
  apiKey: "AIzaSyBY52zMMQqsvssukui3TfQnMigWoOzeKGk",
  authDomain: "sushi-pos.firebaseapp.com",
  projectId: "sushi-pos",
  storageBucket: "sushi-pos.firebasestorage.app",
  messagingSenderId: "909622476838",
  appId: "1:909622476838:web:1a1fb221a6a79fcaf4a6e7",
  measurementId: "G-M8Q8EJ4T7Q"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// Anyone in this list is always an admin when they sign in
// const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com']; // add more emails if you want

/* ===== Cloud (no realtime stream; pull/push only) ===== */
const workspaceRef = () => db.collection('workspaces').doc(auth.currentUser.uid);
const profileRef   = () => db.collection('profiles').doc(auth.currentUser.uid);
// optional username mapping (username -> email)
const unameRef     = (u) => db.collection('usernames').doc((u||'').toLowerCase());

async function cloudSaveAll() {
  if (!auth.currentUser) return;
  const payload = {}; SKEYS.forEach(k => payload[k] = load(k, DEMO[k]));
  await workspaceRef().set(payload, { merge: true });
}
async function cloudLoadAll() {
  if (!auth.currentUser) return;
  const ws = await workspaceRef().get();
  if (ws.exists) {
    const data = ws.data() || {};
    SKEYS.forEach(k => save(k, data[k] ?? DEMO[k]));
  } else {
    await workspaceRef().set(DEMO);
    SKEYS.forEach(k => save(k, DEMO[k]));
  }
}
async function cloudLoadProfile() {
  if (!auth.currentUser) return null;
  const p = await profileRef().get();
  if (p.exists) return p.data();
  // first account becomes admin
  const firstAdmin = { role:'admin', name:'Admin', username:'admin', email:auth.currentUser.email || '', contact:'', img:'' };
  await profileRef().set(firstAdmin, { merge:true });
  return firstAdmin;
}
async function cloudSaveProfile(partial){
  if (!auth.currentUser) return;
  await profileRef().set(partial, { merge:true });
}
async function cloudMaybePush(){ if (auth.currentUser) { try{ await cloudSaveAll(); }catch(e){} } }

/* ===== Helpers ===== */
function syncState(){ SKEYS.forEach(k=>S[k]=load(k,DEMO[k])); }

/* ===== UI ===== */
function renderApp(){
  syncState(); applyTheme();
  const who = session ? (session.username||session.email||'') : '';
  const role = session ? (session.role||'user') : 'user';

  q('#root').innerHTML=`
    <div class="app">
      ${renderSidebar()}
      <div id="scrim" class="scrim ${UI.sidebarOpen && window.innerWidth<=900 ? 'show':''}"></div>
      <main class="main">
        <div class="topbar">
          <div style="display:flex;align-items:center;gap:8px">
            <button id="burgerFab" class="burger-inline" title="Menu"><i class="ri-menu-line"></i></button>
            <div class="who">Logged in as: <b>${who}</b> (${role})</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;position:relative">
            <button id="installBtn" class="small" style="display:none"><i class="ri-download-2-line"></i> Install</button>
            <select id="themeColor" class="small"><option value="light">Light</option><option value="dark">Dark</option></select>
            <select id="themeFont" class="small"><option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option></select>
            <button id="userBtn" class="small" title="Account"><i class="ri-user-3-line"></i></button>
            <button class="small" id="logoutBtn"><i class="ri-logout-box-r-line"></i> Logout</button>

            <div id="userMenu" style="display:none;position:absolute;right:0;top:42px;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);min-width:220px;overflow:hidden;z-index:111;">
              <div style="padding:10px 12px;border-bottom:1px solid var(--border);font-weight:700">${session?.name || session?.username || 'User'}</div>
              <div style="padding:10px 12px;border-bottom:1px solid var(--border);font-size:.9em;color:var(--muted)">
                <div><strong>User:</strong> ${session?.username || '—'}</div>
                <div><strong>Email:</strong> ${session?.email || '—'}</div>
                <div><strong>Contact:</strong> ${session?.contact || '—'}</div>
              </div>
              <button class="menu-btn" style="width:100%;color:var(--text)"><i class="ri-settings-3-line"></i>&nbsp;<span onclick="go('settings')">Settings</span></button>
            </div>
          </div>
        </div>

        ${renderPage()}
        <div id="modal" class="modal"><div class="inner" id="modalInner"></div></div>
      </main>
    </div>
  `;

  // Theme
  const theme=load('theme',{color:'light',font:'medium'}); q('#themeColor').value=theme.color; q('#themeFont').value=theme.font;
  q('#themeColor').onchange=q('#themeFont').onchange=()=>{save('theme',{color:q('#themeColor').value,font:q('#themeFont').value}); applyTheme();};

  // Sidebar
  const sb=q('.sidebar'); const scr=q('#scrim'); const bf=q('#burgerFab');
  const toggleSide=()=>{UI.sidebarOpen=!UI.sidebarOpen; save('ui',UI); sb.classList.toggle('open',UI.sidebarOpen); if(scr) scr.classList.toggle('show',UI.sidebarOpen && window.innerWidth<=900);};
  if(bf) bf.onclick=toggleSide;
  sb.classList.toggle('open',UI.sidebarOpen);
  if(scr){scr.onclick=()=>closeSidebarIfMobile();}
  q('main').addEventListener('click',()=>{ if(window.innerWidth<=900 && UI.sidebarOpen) closeSidebarIfMobile(); });
  if (window.innerWidth <= 900) { UI.sidebarOpen = false; save('ui', UI); sb.classList.remove('open'); if (scr) scr.classList.remove('show'); }
  window.onresize = () => { if (window.innerWidth <= 900) closeSidebarIfMobile(); };

  // PWA install
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    if (deferredPrompt) installBtn.style.display = 'inline-block';
    installBtn.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.style.display='none'; };
  }

  // User dropdown
  const userBtn = document.getElementById('userBtn');
  const userMenu = document.getElementById('userMenu');
  if (userBtn && userMenu) {
    userBtn.onclick = (e) => { e.stopPropagation(); userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none'; };
    document.addEventListener('click', () => { userMenu.style.display = 'none'; }, { once:true });
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = logout;

  qa('.menu-btn').forEach(b=>b.classList.toggle('active',b.dataset?.page===page));
  afterRender();
}
function closeSidebarIfMobile(){UI.sidebarOpen=false; save('ui',UI); const sb=q('.sidebar'); const scr=q('#scrim'); sb.classList.remove('open'); if(scr) scr.classList.remove('show');}

/* ===== Login (username OR email) ===== */
function renderLogin(){
  applyTheme();
  q('#root').innerHTML=`
    <div class="login-bg">
      <form class="login-form" id="loginForm" autocomplete="off">
        <h1><i class="ri-leaf-fill"></i> Sushi POS</h1>
        <input type="text" id="id" placeholder="Username or Email" required autofocus>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit">Login</button>
        <div class="error" id="loginError"></div>
      </form>
    </div>`;
  q('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = q('#id').value.trim().toLowerCase();
    const pw = q('#password').value;

    let email = id.includes('@') ? id : null;
    if (!email) {
      try {
        const mapDoc = await unameRef(id).get();
        if (mapDoc.exists) email = (mapDoc.data().email || '').toLowerCase();
      } catch {}
    }

    try {
      if (!email) throw new Error('Use email or a mapped username.');
      await auth.signInWithEmailAndPassword(email, pw);

      // render immediately; sync in background
      session = { username:id, email, role:'user', name:'User' };
      save('session', session); renderApp();

      // background profile + workspace load
      const prof = await cloudLoadProfile();
      session = { ...session, ...prof }; save('session', session); renderApp();
      await cloudLoadAll();
      renderApp();
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        try {
          const createEmail = email || `${crypto.randomUUID().slice(0,8)}@placeholder.local`;
          await auth.createUserWithEmailAndPassword(createEmail, pw);
          // first account per project gets admin in profile
          await profileRef().set({ role: 'admin', name:'Admin', username: id.includes('@')? id.split('@')[0]: id, email:createEmail, contact:'', img:'' }, { merge:true });
          await workspaceRef().set(DEMO, { merge:true });
          if (id && createEmail) await unameRef(id).set({ email: createEmail });

          session = { username: id || createEmail.split('@')[0], email:createEmail, role:'admin', name:'Admin' };
          save('session', session);
          showNotif('Account created'); renderApp();
          await cloudLoadAll(); renderApp();
        } catch (e2) {
          q('#loginError').textContent = e2.message || 'Sign up failed';
        }
      } else {
        q('#loginError').textContent = err.message || 'Invalid credentials';
      }
    }
  };
}

/* ===== Sidebar ===== */
function renderSidebar(){
  return `
    <aside class="sidebar">
      <div class="brand"><i class="ri-leaf-fill"></i> Sushi POS</div>
      <div class="search-wrap"><input id="globalSearch" class="search" placeholder="Search (e.g., tuna, vendor, task)"></div>
      <nav class="menu">
        ${['dashboard','inventory','sushi','vendors','tasks','cogs','settings'].map(p=>`
          <button class="menu-btn" data-page="${p}" onclick="go('${p}')"><i class="ri-${iconFor(p)}"></i> ${cap(p)}</button>`).join('')}
      </nav>
      <button class="logout" onclick="logout()">Logout</button>
    </aside>`;
}
const iconFor=p=>({dashboard:'dashboard-2-line',inventory:'archive-2-line',sushi:'restaurant-2-line',vendors:'store-3-line',tasks:'task-line',cogs:'coins-line',settings:'settings-3-line'})[p];
const cap=s=>s[0].toUpperCase()+s.slice(1);
function go(p){page=p; save('page',p); if(window.innerWidth<=900) closeSidebarIfMobile(); renderApp();}

/* ===== Pages ===== */
function renderPage(){
  switch(page){
    case 'dashboard': return renderDashboard();
    case 'inventory': return renderInventory();
    case 'sushi': return renderSushi();
    case 'vendors': return renderVendors();
    case 'tasks': return renderTasks();
    case 'cogs': return renderCogs();
    case 'settings': return renderSettings();
    default: return '<h2>Not found</h2>';
  }
}

/* ---------- Dashboard ---------- */
function renderDashboard(){
  const low=S.inventory.filter(i=> i.qty <= (i.critical||0) || i.qty <= (i.low||0));
  const totals=S.cogs.reduce((a,c)=>{const gp=(+c.gross_income||0)-(+c.produce||0)-(+c.item_cost||0)-(+c.freight||0)-(+c.delivery||0)-(+c.other||0); a.gi+=+c.gross_income||0; a.gp+=gp; return a;},{gi:0,gp:0});
  return `
    <div class="dash-head">
      <h1>Dashboard</h1>
      <button id="qpToggle" class="icon-btn plus ${UI.quickPostOpen?'open':''}" title="${UI.quickPostOpen?'Close quick post form':'New quick post'}"><i class="ri-add-line"></i></button>
    </div>

    ${UI.quickPostOpen?`
      <form class="form" id="postForm" enctype="multipart/form-data">
        <input class="field-12" id="postTitle" placeholder="Post title">
        <textarea class="field-12" id="postBody" placeholder="Write something..."></textarea>
        <input class="field-12" id="postImg" type="file" accept="image/*">
        <button class="btn field-12" type="submit">Publish</button>
      </form>`:''}

    <div class="grid auto">
      <div class="card" onclick="go('inventory')">
        <div class="card-actions"><button class="icon-btn edit" onclick="event.stopPropagation();go('inventory')"><i class="ri-arrow-right-up-line"></i></button></div>
        <div class="stat"><div class="num">${S.inventory.length}</div><div class="card-sub">Inventory Items</div></div>
        ${low.length?`<div class="badge ${low.length>0?'warn':''}" style="margin-top:8px">${low.length} low/critical</div>`:''}
      </div>
      <div class="card" onclick="go('sushi')">
        <div class="card-actions"><button class="icon-btn edit" onclick="event.stopPropagation();go('sushi')"><i class="ri-arrow-right-up-line"></i></button></div>
        <div class="stat"><div class="num">${S.sushi.length}</div><div class="card-sub">Sushi Items</div></div>
      </div>
      <div class="card" onclick="go('vendors')">
        <div class="card-actions"><button class="icon-btn edit" onclick="event.stopPropagation();go('vendors')"><i class="ri-arrow-right-up-line"></i></button></div>
        <div class="stat"><div class="num">${S.vendors.length}</div><div class="card-sub">Vendors</div></div>
      </div>
      <div class="card" onclick="go('tasks')">
        <div class="card-actions"><button class="icon-btn edit" onclick="event.stopPropagation();go('tasks')"><i class="ri-arrow-right-up-line"></i></button></div>
        <div class="stat"><div class="num">${S.tasks.reduce((a,t)=>a+t.cards.length,0)}</div><div class="card-sub">Tasks</div></div>
      </div>
      <div class="card" onclick="go('cogs')">
        <div class="card-actions"><button class="icon-btn edit" onclick="event.stopPropagation();go('cogs')"><i class="ri-arrow-right-up-line"></i></button></div>
        <div class="stat"><div class="num">$${totals.gi.toFixed(2)}</div><div class="card-sub">Total Gross Income</div></div>
        <div class="card-sub" style="margin-top:6px">Gross Profit: <b>$${totals.gp.toFixed(2)}</b></div>
      </div>
      <div class="card" onclick="go('settings')">
        <div class="card-actions"><button class="icon-btn edit" onclick="event.stopPropagation();go('settings')"><i class="ri-arrow-right-up-line"></i></button></div>
        <div class="stat"><div class="num">⚙️</div><div class="card-sub">Settings</div></div>
      </div>
    </div>

    <div class="posts" style="margin-top:10px">
      ${S.posts.map((p,i)=>`
        <div class="card">
          <div class="card-actions">
            <button class="icon-btn edit" onclick="editPost(${i})"><i class="ri-edit-2-line"></i></button>
            <button class="icon-btn delete" onclick="delPost(${i})"><i class="ri-delete-bin-6-line"></i></button>
          </div>
          ${p.img?`<img src="${p.img}" class="post-img" alt="post image">`:''}
          <div class="card-title">${p.title}</div>
          <div class="card-sub">${p.body||''}</div>
        </div>
      `).join('')}
    </div>
  `;
}
function wireDashboard(){
  const t=q('#qpToggle'); if(t){ t.onclick=()=>{UI.quickPostOpen=!UI.quickPostOpen; save('ui',UI); renderApp();}; }
  const f=q('#postForm'); if(!f) return;
  f.onsubmit=async(e)=>{e.preventDefault();
    const title=q('#postTitle').value.trim(), body=q('#postBody').value.trim(), file=q('#postImg').files[0];
    if(!title) return;
    let img=''; if(file) img=await compressImage(file, 1400, 1400, 0.8);
    const posts=load('posts',[]);
    posts.push({title,body,img,date:Date.now()}); save('posts',posts);
    UI.quickPostOpen=false; save('ui',UI);
    showNotif('Post published'); renderApp();
  };
}

/* ---------- Inventory ---------- */
function renderInventory(){
  return `
    <h1 style="padding:12px">Inventory</h1>
    <form class="form" id="invForm" enctype="multipart/form-data">
      <input class="field-3" id="invCode" placeholder="Code (e.g., TUNA-01)">
      <input class="field-3" id="invName" placeholder="Name (e.g., Tuna)">
      <input class="field-2" id="invQty" type="number" placeholder="Qty">
      <input class="field-2" id="invLow" type="number" placeholder="Low threshold">
      <input class="field-2" id="invCritical" type="number" placeholder="Critical threshold">
      <input class="field-12" id="invImg" type="file" accept="image/*">
      <button class="btn field-12" type="submit">Add Item</button>
    </form>

    <table class="table">
      <thead><tr><th>Image</th><th>Code</th><th>Name</th><th>Qty</th><th>Low</th><th>Critical</th><th>Actions</th></tr></thead>
      <tbody>
        ${S.inventory.map((it,i)=>{
          const badge = it.qty<=+it.critical ? `<span class="badge danger">critical</span>` :
                        it.qty<=+it.low ? `<span class="badge warn">low</span>` : '';
          return `
          <tr>
            <td>${it.img?`<span class="thumb-wrap"><img class="img-thumb" src="${it.img}"><img class="img-big" src="${it.img}"></span>`:'—'}</td>
            <td>${it.code||'—'}</td>
            <td>${it.name}</td>
            <td>
              <div class="qty">
                <button class="btn small" onclick="decQty(${i});return false;">−</button>
                <strong>${it.qty}</strong> ${badge}
                <button class="btn small" onclick="incQty(${i});return false;">+</button>
              </div>
            </td>
            <td>${it.low||0}</td>
            <td>${it.critical||0}</td>
            <td>
              <button class="icon-btn edit" onclick="editInv(${i})"><i class="ri-edit-2-line"></i></button>
              <button class="icon-btn delete" onclick="delInv(${i})"><i class="ri-delete-bin-6-line"></i></button>
            </td>
          </tr>`;}).join('')}
      </tbody>
    </table>
  `;
}
function wireInventory(){
  const f=q('#invForm'); if(!f) return;
  f.onsubmit=async(e)=>{e.preventDefault();
    const code=q('#invCode').value.trim();
    const name=q('#invName').value.trim();
    const qty=+q('#invQty').value||0;
    const low=+q('#invLow').value||0;
    const critical=+q('#invCritical').value||0;
    const file=q('#invImg').files[0];

    if(!name) return;
    let img=''; if(file) img=await compressImage(file, 1200, 1200, 0.8);
    const inv=load('inventory',[]); inv.push({code,name,qty,low,critical,img});
    save('inventory',inv); showNotif('Inventory item added'); renderApp();
  };
}
function incQty(i){const inv=load('inventory',[]); inv[i].qty=(+inv[i].qty||0)+1; save('inventory',inv); renderApp();}
function decQty(i){const inv=load('inventory',[]); inv[i].qty=Math.max(0,(+inv[i].qty||0)-1); save('inventory',inv); renderApp();}
function editInv(i){
  const it=S.inventory[i];
  openModal(`
    <h2>Edit Inventory</h2>
    <form class="form" id="editInvForm" enctype="multipart/form-data">
      <input class="field-3" id="eCode" value="${it.code||''}" placeholder="Code">
      <input class="field-3" id="eName" value="${it.name}" placeholder="Name">
      <input class="field-2" id="eQty" type="number" value="${it.qty}" placeholder="Qty">
      <input class="field-2" id="eLow" type="number" value="${it.low||0}" placeholder="Low">
      <input class="field-2" id="eCritical" type="number" value="${it.critical||0}" placeholder="Critical">
      <input class="field-12" id="eImg" type="file" accept="image/*">
      ${it.img?`<img src="${it.img}" class="img-thumb" style="margin-left:8px">`:''}
      <div class="field-12" style="display:flex;gap:8px"><button class="btn" type="submit">Save</button><button class="btn small" type="button" onclick="closeModal()">Cancel</button></div>
    </form>`);
  q('#editInvForm').onsubmit=async(e)=>{e.preventDefault();
    const inv=load('inventory',[]);
    const rec=inv[i]; rec.code=q('#eCode').value.trim(); rec.name=q('#eName').value.trim(); rec.qty=+q('#eQty').value||0;
    rec.low=+q('#eLow').value||0; rec.critical=+q('#eCritical').value||0;
    const file=q('#eImg').files[0]; if(file){ rec.img=await compressImage(file, 1200, 1200, 0.8); }
    save('inventory',inv); showNotif('Inventory updated'); closeModal(); renderApp();
  };
}
function delInv(i){const inv=load('inventory',[]); inv.splice(i,1); save('inventory',inv); showNotif('Inventory deleted'); renderApp();}

/* ---------- Sushi ---------- */
function renderSushi(){
  return `
    <h1 style="padding:12px">Sushi Items</h1>
    <form class="form" id="sushiForm" enctype="multipart/form-data">
      <input class="field-4" id="suName" placeholder="Name (e.g., Tuna Roll)">
      <input class="field-2" id="suPrice" type="number" step="0.01" placeholder="Price">
      <select class="field-2" id="suType"><option value="">Type</option><option>Raw</option><option>Cooked</option><option>Vegan</option><option>Special</option></select>
      <input class="field-12" id="suImg" type="file" accept="image/*">
      <textarea class="field-6" id="suIngr" placeholder="Ingredients (comma separated)"></textarea>
      <textarea class="field-6" id="suInst" placeholder="Instructions"></textarea>
      <button class="btn field-12" type="submit">Add Sushi</button>
    </form>

    <div class="grid auto">
      ${S.sushi.map((s,i)=>`
        <div class="card" onclick="viewSushi(${i})">
          <div class="card-actions">
            <button class="icon-btn edit" onclick="event.stopPropagation();editSushi(${i})"><i class="ri-edit-2-line"></i></button>
            <button class="icon-btn delete" onclick="event.stopPropagation();delSushi(${i})"><i class="ri-delete-bin-6-line"></i></button>
          </div>
          ${s.img?`<img src="${s.img}" class="post-img" style="height:220px" alt="${s.name}">`:`<div class="card-img" style="height:220px;background:#f8fafc;border:1px dashed var(--border);border-radius:12px"></div>`}
          <div class="card-title">${s.name}</div>
          <div class="card-sub">${s.type||'—'} • $${(+s.price||0).toFixed(2)}</div>
        </div>`).join('')}
    </div>`;
}
function wireSushi(){
  const f=q('#sushiForm'); if(!f) return;
  f.onsubmit=async(e)=>{e.preventDefault();
    const name=q('#suName').value.trim(); if(!name) return;
    const price=+q('#suPrice').value||0, type=q('#suType').value||'',
          ingredients=q('#suIngr').value.trim(), instructions=q('#suInst').value.trim(),
          file=q('#suImg').files[0];

    let img=''; if(file) img=await compressImage(file, 1400, 1400, 0.8);

    const sushi=load('sushi',[]); sushi.push({name,price,type,ingredients,instructions,img});
    save('sushi',sushi); showNotif('Sushi item added'); renderApp();
  };
}
function viewSushi(i){
  const s=S.sushi[i];
  openModal(`
    ${s.img?`<img src="${s.img}" style="width:100%;height:220px;object-fit:contain;border-radius:12px;background:#fff;border:1px solid var(--border);margin-bottom:8px">`:''}
    <h2 style="margin:.4rem 0">${s.name}</h2>
    <div class="card-sub" style="margin-bottom:10px">${s.type||'—'} • $${(+s.price||0).toFixed(2)}</div>
    ${s.ingredients?`<div><strong>Ingredients:</strong><br>${s.ingredients}</div>`:''}
    ${s.instructions?`<div style="margin-top:8px"><strong>Instructions:</strong><br>${s.instructions}</div>`:''}
    <div style="margin-top:12px;display:flex;gap:8px"><button class="btn small brand" onclick="closeModal()">Close</button></div>`);
}
function editSushi(i){
  const s=S.sushi[i];
  openModal(`
    <h2>Edit Sushi</h2>
    <form class="form" id="editSu" enctype="multipart/form-data">
      <input class="field-4" id="eSuName" value="${s.name}">
      <input class="field-2" id="eSuPrice" type="number" step="0.01" value="${s.price||0}">
      <select class="field-2" id="eSuType"><option ${s.type===''?'selected':''} value="">Type</option>${['Raw','Cooked','Vegan','Special'].map(t=>`<option ${s.type===t?'selected':''}>${t}</option>`).join('')}</select>
      <input class="field-12" id="eSuImg" type="file" accept="image/*">
      ${s.img?`<img src="${s.img}" class="img-thumb" style="margin-left:8px">`:''}
      <textarea class="field-6" id="eSuIngr">${s.ingredients||''}</textarea>
      <textarea class="field-6" id="eSuInst">${s.instructions||''}</textarea>
      <div class="field-12" style="display:flex;gap:8px"><button class="btn" type="submit">Save</button><button type="button" class="btn small" onclick="closeModal()">Cancel</button></div>
    </form>`);
  q('#eSuType').value=s.type||'';
  q('#editSu').onsubmit=async(e)=>{e.preventDefault();
    try{
      const sushi=load('sushi',[]); const rec=sushi[i];
      rec.name=q('#eSuName').value.trim(); rec.price=+q('#eSuPrice').value||0; rec.type=q('#eSuType').value||'';
      rec.ingredients=q('#eSuIngr').value.trim(); rec.instructions=q('#eSuInst').value.trim();
      const f=q('#eSuImg').files[0]; if(f){ rec.img=await compressImage(f, 1400, 1400, 0.8); }
      save('sushi',sushi); showNotif('Sushi updated');
    } finally { closeModal(); renderApp(); }
  };
}
function delSushi(i){const sushi=load('sushi',[]); sushi.splice(i,1); save('sushi',sushi); showNotif('Sushi deleted'); renderApp();}

/* ---------- Vendors ---------- */
function renderVendors(){
  return `
    <h1 style="padding:12px">Vendors</h1>
    <form class="form" id="venForm">
      <input class="field-3" id="vName" placeholder="Vendor name">
      <input class="field-3" id="vPhone" placeholder="Phone">
      <input class="field-3" id="vEmail" placeholder="Email">
      <input class="field-3" id="vAddr" placeholder="Address">
      <button class="btn field-12" type="submit">Add Vendor</button>
    </form>

    <table class="table">
      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Actions</th></tr></thead>
      <tbody>
        ${S.vendors.map((v,i)=>`
          <tr>
            <td>${v.name}</td><td>${v.phone}</td><td>${v.email||'—'}</td><td>${v.address||'—'}</td>
            <td><button class="icon-btn edit" onclick="editVendor(${i})"><i class="ri-edit-2-line"></i></button>
                <button class="icon-btn delete" onclick="delVendor(${i})"><i class="ri-delete-bin-6-line"></i></button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}
function wireVendors(){
  const f=q('#venForm'); if(!f) return;
  const phone=q('#vPhone'); phone.oninput=()=>{phone.value=formatPhone(phone.value);};
  f.onsubmit=(e)=>{e.preventDefault();
    const name=q('#vName').value.trim(); if(!name) return;
    const vendors=load('vendors',[]);
    vendors.push({name,phone:formatPhone(q('#vPhone').value),email:q('#vEmail').value.trim(),address:q('#vAddr').value.trim()});
    save('vendors',vendors); showNotif('Vendor added'); renderApp();
  };
}
function editVendor(i){
  const v=S.vendors[i];
  openModal(`
    <h2>Edit Vendor</h2>
    <form class="form" id="editVen">
      <input class="field-3" id="eVName" value="${v.name}">
      <input class="field-3" id="eVPhone" value="${v.phone}">
      <input class="field-3" id="eVEmail" value="${v.email||''}">
      <input class="field-3" id="eVAddr" value="${v.address||''}">
      <div class="field-12" style="display:flex;gap:8px"><button class="btn" type="submit">Save</button><button type="button" class="btn small" onclick="closeModal()">Cancel</button></div>
    </form>`);
  q('#eVPhone').oninput=()=>{q('#eVPhone').value=formatPhone(q('#eVPhone').value);};
  q('#editVen').onsubmit=(e)=>{e.preventDefault();
    const vendors=load('vendors',[]); const rec=vendors[i];
    rec.name=q('#eVName').value.trim(); rec.phone=formatPhone(q('#eVPhone').value); rec.email=q('#eVEmail').value.trim(); rec.address=q('#eVAddr').value.trim();
    save('vendors',vendors); showNotif('Vendor updated'); closeModal(); renderApp();
  };
}
function delVendor(i){const vendors=load('vendors',[]); vendors.splice(i,1); save('vendors',vendors); showNotif('Vendor deleted'); renderApp();}

/* ---------- Tasks ---------- */
let dragCtx=null;
function renderTasks(){
  return `
    <h1 style="padding:12px">Tasks</h1>
    <div class="kanban">
      ${S.tasks.map(list=>`
        <div class="list">
          <div class="list-head">${list.name}</div>
          <div class="drop" data-list="${list.id}">
            ${list.cards.map((c,idx)=>`
              <div class="kcard" draggable="true" data-list="${list.id}" data-idx="${idx}">
                <span>${c}</span>
                <span>
                  <button class="icon-btn edit" onclick="editTask('${list.id}',${idx})"><i class="ri-edit-2-line"></i></button>
                  <button class="icon-btn delete" onclick="delTask('${list.id}',${idx})"><i class="ri-delete-bin-6-line"></i></button>
                </span>
              </div>`).join('')}
          </div>
          <div class="kadd"><input id="${list.id}New" placeholder="Add task…"><button class="btn small brand" onclick="addTask('${list.id}')"><i class="ri-add-line"></i></button></div>
        </div>`).join('')}
    </div>`;
}
function wireTasks(){
  qa('.kcard').forEach(el=>{el.ondragstart=e=>{dragCtx={fromList:el.dataset.list,fromIdx:+el.dataset.idx}; e.dataTransfer.effectAllowed='move';};});
  qa('.drop').forEach(zone=>{
    zone.ondragover=e=>{e.preventDefault(); zone.classList.add('over');};
    zone.ondragleave=()=>zone.classList.remove('over');
    zone.ondrop=e=>{e.preventDefault(); zone.classList.remove('over'); if(!dragCtx) return;
      const tasks=load('tasks',DEMO.tasks), from=tasks.find(l=>l.id===dragCtx.fromList), to=tasks.find(l=>l.id===zone.dataset.list);
      const [moved]=from.cards.splice(dragCtx.fromIdx,1); to.cards.push(moved); save('tasks',tasks); showNotif('Task moved'); renderApp();
    };
  });
}
function addTask(listId){const tasks=load('tasks',DEMO.tasks); const val=q(`#${listId}New`).value.trim(); if(!val) return; tasks.find(l=>l.id===listId).cards.push(val); save('tasks',tasks); renderApp();}
function editTask(listId,idx){
  openModal(`
    <h2>Edit Task</h2>
    <form class="form" id="et">
      <input class="field-12" id="etxt" value="${S.tasks.find(l=>l.id===listId).cards[idx]}">
      <div class="field-12" style="display:flex;gap:8px"><button class="btn" type="submit">Save</button><button type="button" class="btn small" onclick="closeModal()">Cancel</button></div>
    </form>`);
  q('#et').onsubmit=e=>{e.preventDefault(); const tasks=load('tasks',DEMO.tasks); tasks.find(l=>l.id===listId).cards[idx]=q('#etxt').value.trim(); save('tasks',tasks); showNotif('Task updated'); closeModal(); renderApp(); };
}
function delTask(listId,idx){const tasks=load('tasks',DEMO.tasks); tasks.find(l=>l.id===listId).cards.splice(idx,1); save('tasks',tasks); showNotif('Task deleted'); renderApp();}

/* ---------- COGS ---------- */
function renderCogs(){
  const totals=S.cogs.reduce((a,c)=>{const gi=+c.gross_income||0,pr=+c.produce||0,ic=+c.item_cost||0,fr=+c.freight||0,de=+c.delivery||0,ot=+c.other||0; const gp=gi-pr-ic-fr-de-ot; a.gi+=gi;a.pr+=pr;a.ic+=ic;a.fr+=fr;a.de+=de;a.ot+=ot;a.gp+=gp; return a;},{gi:0,pr:0,ic:0,fr:0,de:0,ot:0,gp:0});
  return `
    <h1 style="padding:12px">COGS</h1>
    <form class="form" id="cogsForm">
      <input class="field-3" id="cgWeek" placeholder="Week (e.g., 2025-W32)">
      <input class="field-3" id="cgGI" type="number" step="0.01" placeholder="Gross Income">
      <input class="field-2" id="cgPR" type="number" step="0.01" placeholder="Produce">
      <input class="field-2" id="cgIC" type="number" step="0.01" placeholder="Item Cost">
      <input class="field-2" id="cgFR" type="number" step="0.01" placeholder="Freight">
      <input class="field-2" id="cgDE" type="number" step="0.01" placeholder="Delivery">
      <input class="field-2" id="cgOT" type="number" step="0.01" placeholder="Other">
      <button class="btn field-12" type="submit">Add COGS</button>
    </form>

    <table class="table">
      <thead><tr><th>Week</th><th>GI</th><th>Produce</th><th>Item</th><th>Freight</th><th>Delivery</th><th>Other</th><th>Gross Profit</th><th>Actions</th></tr></thead>
      <tbody>
        ${S.cogs.map((c,i)=>{const gp=(+c.gross_income||0)-(+c.produce||0)-(+c.item_cost||0)-(+c.freight||0)-(+c.delivery||0)-(+c.other||0);
          return `<tr>
            <td>${c.week||'—'}</td><td>$${(+c.gross_income||0).toFixed(2)}</td><td>$${(+c.produce||0).toFixed(2)}</td><td>$${(+c.item_cost||0).toFixed(2)}</td>
            <td>$${(+c.freight||0).toFixed(2)}</td><td>$${(+c.delivery||0).toFixed(2)}</td><td>$${(+c.other||0).toFixed(2)}</td>
            <td style="color:${gp>=0?'var(--ok)':'var(--danger)'};font-weight:800">$${gp.toFixed(2)}</td>
            <td><button class="icon-btn edit" onclick="editCogs(${i})"><i class="ri-edit-2-line"></i></button>
                <button class="icon-btn delete" onclick="delCogs(${i})"><i class="ri-delete-bin-6-line"></i></button></td>
          </tr>`;}).join('')}
      </tbody>
      <tfoot><tr><th>Total</th><th>$${totals.gi.toFixed(2)}</th><th>$${totals.pr.toFixed(2)}</th><th>$${totals.ic.toFixed(2)}</th><th>$${totals.fr.toFixed(2)}</th><th>$${totals.de.toFixed(2)}</th><th>$${totals.ot.toFixed(2)}</th><th>$${totals.gp.toFixed(2)}</th><th></th></tr></tfoot>
    </table>`;
}
function wireCogs(){
  const f=q('#cogsForm'); if(!f) return;
  f.onsubmit=e=>{e.preventDefault();
    const cogs=load('cogs',[]); cogs.push({week:q('#cgWeek').value.trim(),gross_income:+q('#cgGI').value||0,produce:+q('#cgPR').value||0,item_cost:+q('#cgIC').value||0,freight:+q('#cgFR').value||0,delivery:+q('#cgDE').value||0,other:+q('#cgOT').value||0});
    save('cogs',cogs); showNotif('COGS added'); renderApp();
  };
}
function editCogs(i){
  const c=S.cogs[i];
  openModal(`
    <h2>Edit COGS</h2>
    <form class="form" id="ec">
      <input class="field-3" id="eW" value="${c.week||''}">
      <input class="field-3" id="eGI" type="number" step="0.01" value="${c.gross_income||0}">
      <input class="field-2" id="ePR" type="number" step="0.01" value="${c.produce||0}">
      <input class="field-2" id="eIC" type="number" step="0.01" value="${c.item_cost||0}">
      <input class="field-2" id="eFR" type="number" step="0.01" value="${c.freight||0}">
      <input class="field-2" id="eDE" type="number" step="0.01" value="${c.delivery||0}">
      <input class="field-2" id="eOT" type="number" step="0.01" value="${c.other||0}">
      <div class="field-12" style="display:flex;gap:8px"><button class="btn" type="submit">Save</button><button type="button" class="btn small" onclick="closeModal()">Cancel</button></div>
    </form>`);
  q('#ec').onsubmit=e=>{e.preventDefault();
    const cogs=load('cogs',[]); const rec=cogs[i];
    rec.week=q('#eW').value.trim(); rec.gross_income=+q('#eGI').value||0; rec.produce=+q('#ePR').value||0; rec.item_cost=+q('#eIC').value||0; rec.freight=+q('#eFR').value||0; rec.delivery=+q('#eDE').value||0; rec.other=+q('#eOT').value||0;
    save('cogs',cogs); showNotif('COGS updated'); closeModal(); renderApp();
  };
}
function delCogs(i){const cogs=load('cogs',[]); cogs.splice(i,1); save('cogs',cogs); showNotif('COGS deleted'); renderApp();}

/* ---------- Settings (Profile & Roles) ---------- */
function renderSettings(){
  const canEditRole = (session?.role || 'user') === 'admin';
  return `
    <h1 style="padding:12px">Settings</h1>
    <form class="form" id="userForm" enctype="multipart/form-data">
      <input class="field-3" id="uName" placeholder="Full name" value="${session?.name||''}">
      <input class="field-3" id="uUser" placeholder="Username" value="${session?.username||''}">
      <input class="field-3" id="uEmail" placeholder="Email" value="${session?.email||''}">
      <input class="field-3" id="uPhone" placeholder="Contact" value="${session?.contact||''}">
      <select class="field-3" id="uRole" ${canEditRole?'':'disabled'}>
        ${['user','staff','manager','admin'].map(r=>`<option ${((session?.role||'user')===r)?'selected':''}>${r}</option>`).join('')}
      </select>
      <input class="field-6" id="uImg" type="file" accept="image/*">
      <button class="btn field-12" type="submit">Save Profile ${canEditRole?'(role editable)':''}</button>
    </form>

    <div class="users">
      <div class="card ucard">
        <img src="${session?.img||''}" class="uimg" alt="">
        <div style="flex:1">
          <div class="card-title">${session?.name||'—'} <span class="badge" style="margin-left:6px;background:rgba(14,165,165,.12);color:var(--brand)">${session?.role||'user'}</span></div>
          <div class="card-sub">
            <div><strong>Username:</strong> ${session?.username || '—'}</div>
            <div><strong>Email:</strong> ${session?.email || '—'}</div>
            <div><strong>Contact:</strong> ${session?.contact || '—'}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="padding:0 12px 12px;color:var(--muted);font-size:.9rem">
      <b>About roles:</b> First account becomes <b>admin</b>. Other people should sign up on their own device; they’ll start as <b>user</b>.  
      An <b>admin</b> can change their own role here (and, with a small Cloud Function, could manage other accounts’ roles centrally).
    </div>
  `;
}
function wireSettings(){
  const f=q('#userForm'); if(!f) return;
  const phone=q('#uPhone'); phone.oninput=()=>{phone.value=formatPhone(phone.value);};
  f.onsubmit=async(e)=>{e.preventDefault();
    try{
      let img=session?.img||'';
      const file=q('#uImg').files[0]; if(file) img=await compressImage(file, 1000, 1000, 0.8);
      const data={
        name:q('#uName').value.trim(),
        username:q('#uUser').value.trim().toLowerCase(),
        email:q('#uEmail').value.trim(),
        contact:formatPhone(q('#uPhone').value),
        img
      };
      // role editable only for admins
      if ((session?.role||'user') === 'admin') data.role = q('#uRole').value;

      await cloudSaveProfile(data);

      // username -> email map
      if (data.username && data.email) { try { await unameRef(data.username).set({ email: data.email.toLowerCase() }); } catch {} }

      session = { ...session, ...data };
      save('session', session);
      showNotif('Profile saved');
      renderApp();
    } catch(e){ showNotif('Failed to save profile'); }
  };
}

/* ---------- Posts edit/del ---------- */
function editPost(i){
  const p=S.posts[i];
  openModal(`
    <h2>Edit Post</h2>
    <form class="form" id="ep" enctype="multipart/form-data">
      <input class="field-12" id="t" value="${p.title}">
      <textarea class="field-12" id="b">${p.body||''}</textarea>
      <input class="field-12" id="pi" type="file" accept="image/*">
      ${p.img?`<img src="${p.img}" class="img-thumb" style="margin-left:8px">`:''}
      <div class="field-12" style="display:flex;gap:8px"><button class="btn" type="submit">Save</button><button type="button" class="btn small" onclick="closeModal()">Cancel</button></div>
    </form>`);
  q('#ep').onsubmit=async(e)=>{e.preventDefault();
    const posts=load('posts',[]); const rec=posts[i];
    rec.title=q('#t').value.trim(); rec.body=q('#b').value.trim();
    const f=q('#pi').files[0]; if(f){ rec.img=await compressImage(f, 1400, 1400, 0.8); }
    save('posts',posts); showNotif('Post updated'); closeModal(); renderApp();
  };
}
function delPost(i){const posts=load('posts',[]); posts.splice(i,1); save('posts',posts); showNotif('Post deleted'); renderApp();}

/* ---------- Modal & misc ---------- */
function openModal(html){const m=q('#modal'); q('#modalInner').innerHTML=html; m.style.display='flex'; m.onclick=e=>{ if(e.target===m) closeModal(); };}
function closeModal(){const m=q('#modal'); m.style.display='none'; q('#modalInner').innerHTML='';}

async function logout(){
  try { await auth.signOut(); } catch {}
  save('session',null); session=null; renderLogin(); showNotif('Logged out');
}

function doSearch(term){
  if(!term){showNotif('Type something to search'); return;}
  const t=term.toLowerCase(); const hits=[];
  S.inventory.forEach((x,i)=>{ if((x.name||'').toLowerCase().includes(t)||(x.code||'').toLowerCase().includes(t)) hits.push({type:'inventory',i,label:`Inventory • ${x.code?x.code+' • ':''}${x.name}`});});
  S.sushi.forEach((x,i)=>{ if((x.name||'').toLowerCase().includes(t)||(x.type||'').toLowerCase().includes(t)) hits.push({type:'sushi',i,label:`Sushi • ${x.name}`});});
  S.vendors.forEach((x,i)=>{ if(Object.values(x).join(' ').toLowerCase().includes(t)) hits.push({type:'vendors',i,label:`Vendor • ${x.name}`});});
  S.tasks.forEach(list=> list.cards.forEach((c,ci)=>{ if((c||'').toLowerCase().includes(t)) hits.push({type:'tasks',i:ci,extra:list.id,label:`Task • ${c}`});}));
  if(!hits.length){showNotif('No results'); return;}
  openModal(`<h2>Search results</h2><div class="grid auto">${hits.map(h=>`<div class="card" onclick="jump('${h.type}')">${h.label}</div>`).join('')}</div><div style="margin-top:10px"><button class="btn small" onclick="closeModal()">Close</button></div>`);
}
function jump(type){closeModal(); page=type; save('page',page); if(window.innerWidth<=900) closeSidebarIfMobile(); renderApp();}

/* ===== Boot ===== */
function render() {
  if (session) renderApp(); else renderLogin();
}
function afterRender(){
  const gs=q('#globalSearch'); if(gs){ gs.onkeyup=e=>{ if(e.key==='Enter') doSearch(gs.value.trim()); }; }
  if(page==='dashboard') wireDashboard();
  if(page==='inventory') wireInventory();
  if(page==='sushi') wireSushi();
  if(page==='vendors') wireVendors();
  if(page==='tasks') wireTasks();
  if(page==='cogs') wireCogs();
  if(page==='settings') wireSettings();
}

// Auth boot (fast UI, background sync)
// Make sure this exists above:
const SUPER_ADMINS = ['admin@sushi.com', 'minmaung0307@gmail.com']; // add yours
let cloudUnsub = null; // reuse your existing var if you already have it

auth.onAuthStateChanged(async (user) => {
  applyTheme();

  // Clean up any previous Firestore listener
  if (cloudUnsub) { try { cloudUnsub(); } catch {} cloudUnsub = null; }

  if (!user) {
    // No auth → show login (or last local session if you want that behavior)
    session = load('session', null);
    if (session) { renderApp(); } else { renderLogin(); }
    return;
  }

  // Logged in
  const email = (user.email || '').toLowerCase();

  // Try to pull cloud state, but don’t block the UI if it fails
  try { await cloudLoadAll(); } catch (e) { console.warn('cloudLoadAll failed:', e); }

  // Build/repair local profile
  const users = load('users', [DEFAULT_ADMIN]);
  let prof = users.find(u => (u.email || '').toLowerCase() === email);

  const forcedRole = SUPER_ADMINS.includes(email) ? 'admin' : (prof?.role || 'user');

  if (!prof) {
    // First time this email signs in on this device → create a local profile record
    prof = {
      name: forcedRole === 'admin' ? 'Admin' : 'User',
      username: email ? (email.split('@')[0] || 'user') : (user.uid.slice(0,8)),
      email,
      contact: '',
      role: forcedRole,
      password: '',
      img: ''
    };
    users.push(prof);
    save('users', users);
  } else if (prof.role !== forcedRole) {
    // Upgrade/downgrade role based on SUPER_ADMINS
    prof.role = forcedRole;
    save('users', users);
  }

  // Set session and paint UI immediately
  session = { ...prof };
  save('session', session);
  renderApp();

  // Start cloud live sync (ignore if Firestore rules/env not ready)
  try {
    cloudSubscribe(); // this should set cloudUnsub internally
  } catch (e) {
    console.warn('cloudSubscribe failed:', e);
  }
});

// start
applyTheme(); render();