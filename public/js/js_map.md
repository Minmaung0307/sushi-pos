Notes & where to put your EmailJS keys

In Part E → wireContact() replace:
	•	YOUR_PUBLIC_KEY
	•	YOUR_SERVICE_ID
	•	YOUR_TEMPLATE_ID

with the values from your EmailJS dashboard (Account → API Keys; Email Services → Service ID; Email Templates → Template ID). This uses client‑side EmailJS; if you prefer, you can swap to Cloud Functions later.

⸻

Quick “map” of parts (so you can reference later)
	•	Part A: Firebase init, helpers, seed, theme, cloud sync, auth, router/idle
	•	Part B: Login UI + Sidebar/Topbar + renderApp + sidebar search
	•	Part C: Home (hot weekly videos + Shuffle), Search page, Dashboard (YoY & MoM), Posts (with Add Post)
	•	Part D: Inventory / Products / COGS (+ CSV export), Tasks (free DnD even with empty lanes)
	•	Part E: Settings (instant theme + cloud), Users management, Contact (EmailJS), Static pages, All Modals
	•	Part F: Search index utilities + bootstrapping