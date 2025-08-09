# 🍣 Sushi POS — User Guide

## Overview
Sushi POS is a lightweight, responsive, PWA-enabled point-of-sale and management system for sushi restaurants.  
It supports inventory, menu items (sushi), vendors, tasks, cost of goods sold (COGS), user management, and dashboard posts.

## Features
- **Dashboard**: Quick posts with optional images.
- **Inventory**: Track items with quantity, low/critical thresholds, image upload, and stock adjustments (+/-).
- **Sushi Items**: Manage menu items with price, type, ingredients, instructions, and image upload.
- **Vendors**: Store supplier details (name, account, contact, email, address).
- **Tasks**: Kanban board with drag-and-drop (`To Do`, `In Progress`, `Done`).
- **COGS**: Calculates income, costs, and gross profit automatically.
- **Settings**: Manage theme, font, language, and users (with roles).
- **Authentication**: Login via username or email (Firebase Auth).
- **Cloud Sync**: User-specific data stored in Firebase Firestore.
- **Offline Support**: Installable PWA for desktop & mobile.
- **Responsive UI**: Mobile/tablet-friendly with collapsible sidebar.

---

## Getting Started

### 1. Installation
1. Clone or download the repository.
2. Place the following in the root:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `manifest.webmanifest`
   - `sw.js`
   - `icons/icon-192.png` & `icons/icon-512.png`

3. Serve the files using:
   - A local web server (`Live Server` in VSCode, `python -m http.server`, etc.)
   - Or deploy to GitHub Pages.

---

### 2. Firebase Setup
1. Create a [Firebase](https://firebase.google.com/) project.
2. Enable **Authentication → Email/Password**.
3. Enable **Firestore Database** (production mode).
4. In **Project settings → Web app**, copy the `firebaseConfig` object.
5. Paste `firebaseConfig` into `app.js` (near the top).
6. Deploy your site with all Firebase SDK scripts included in `index.html`.

---

### 3. User Accounts
- **Default Admin**:
  - Email: `admin@sushi.com`
  - Password: `admin123`
- Create additional users from **Settings → Users**.
- Username login is supported if mapped to an email in Firestore.

---

### 4. Adding Content
#### Posts
- Click **`+`** in Dashboard to add quick posts.
- Attach an image (optional).

#### Inventory
- Go to **Inventory**.
- Fill in name, quantity, low & critical thresholds, and upload an image.
- Adjust quantities with **+** and **-** buttons.

#### Sushi Items
- Add name, price, type, ingredients, instructions, and image.
- Click an item to view full details.

#### Vendors
- Add supplier info (name, account, contact, email, address).

#### Tasks
- Drag cards between columns.

#### COGS
- Add income and cost items; profit is calculated automatically.

#### Settings
- Change theme, font, and language.
- Add/edit/delete users (role-based permissions apply).

---

### 5. Mobile/Tablet Use
- Sidebar collapses into a burger menu.
- Tap burger to open menu; selecting an item closes it again.

---

### 6. Offline & Installation
- App works offline via service worker.
- On supported browsers, you’ll see an **Install App** option in the address bar or via browser menu.

---

### 7. License
This project is licensed under the [MIT License](LICENSE.md).

---

## Troubleshooting
- **Login fails**: Check Firebase credentials and username/email mapping.
- **No install prompt**: Verify `manifest.webmanifest` and `sw.js` are present and valid.
- **Images not showing**: Ensure file uploads are correctly processed; clear cache and reload.

---

## Author
You are free to use, modify, and share this app under the MIT License.