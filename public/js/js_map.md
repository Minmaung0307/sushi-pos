Notes & where to put your EmailJS keys

In Part E → wireContact() replace:
	•	YOUR_PUBLIC_KEY
	•	YOUR_SERVICE_ID
	•	YOUR_TEMPLATE_ID

with the values from your EmailJS dashboard (Account → API Keys; Email Services → Service ID; Email Templates → Template ID). This uses client‑side EmailJS; if you prefer, you can swap to Cloud Functions later.

⸻
Here’s a quick map of the parts we’ve been working with for your app.js so you can quickly point to or request specific sections later:

⸻

Part A – Core Setup
	•	Firebase init (config, firebase.initializeApp)
	•	Local helpers (save, load, uid, etc.)
	•	Theme handling (get/set, apply)
	•	Cloud sync (push/pull to Firebase Realtime DB)
	•	Authentication (login/logout handling, session storage)
	•	Router (switch between routes, go function)
	•	Idle timer (auto-logout on inactivity)

⸻

Part B – App Shell
	•	Login UI (form render, events)
	•	Sidebar (menu, navigation, active link highlight)
	•	Topbar (search, theme toggle, user menu)
	•	renderApp() (main layout after login)
	•	Sidebar search (quick index search with click-to-jump)

⸻

Part C – Content & Dashboard
	•	Home (hot weekly videos + Shuffle button)
	•	Search page
	•	Dashboard
	•	Year-over-Year (YoY) and Month-over-Month (MoM) sales comparison
	•	Cards for totals (Users, Inventory, Products, COGS, Tasks) with click navigation
	•	Posts (list, add post modal, edit/delete)

⸻

Part D – Data Modules
	•	Inventory (list, add/edit modal, image preview, export CSV)
	•	Products (list, add/edit modal, image preview, export CSV)
	•	COGS (list, add/edit modal, export CSV, gross profit calc)
	•	Tasks (3-lane Kanban: To-Do / In Progress / Done; drag-and-drop freely even when empty)

⸻

Part E – Settings & Utilities
	•	Settings (theme/font settings, cloud toggle)
	•	Users management (list, add/edit, delete, role-based access)
	•	Contact page (EmailJS integration)
	•	Static pages (Policy, License, Setup, Guide)
	•	All Modals (image preview, confirm delete, add/edit forms, etc.)

⸻

Part F – Search + Boot
	•	Search index utilities (buildSearchIndex, searchAll, scrollToRow)
	•	Online/offline status notifier
	•	Service Worker registration (optional)
	•	Bootstrapping (renderApp or renderLogin on first load)
	•	Debug API (window._inventory for dev console access)

	
Quick “map” of parts (so you can reference later)
	•	Part A: Firebase init, helpers, seed, theme, cloud sync, auth, router/idle
	•	Part B: Login UI + Sidebar/Topbar + renderApp + sidebar search
	•	Part C: Home (hot weekly videos + Shuffle), Search page, Dashboard (YoY & MoM), Posts (with Add Post)
	•	Part D: Inventory / Products / COGS (+ CSV export), Tasks (free DnD even with empty lanes)
	•	Part E: Settings (instant theme + cloud), Users management, Contact (EmailJS), Static pages, All Modals
	•	Part F: Search index utilities + bootstrapping