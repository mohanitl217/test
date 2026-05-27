# TypeMaster — Multi-language Typing Website

Learn typing and take tests in **English**, **Hindi (KrutiDev/DevLys)** and **Hindi (Mangal Unicode)** with three layouts: **Remington GAIL**, **INSCRIPT**, and **Remington CBI**.

Includes user signup/login, an **admin dashboard** to manage users and add exercises per section, and distinct visual themes per language and per mode (Learn vs Test).

## Stack

- **Backend:** Pure Node.js (no npm dependencies). HTTP server, file-based JSON storage, scrypt password hashing, HMAC-signed token auth.
- **Frontend:** Plain HTML / CSS / JS, fully responsive, Google Fonts (Inter, JetBrains Mono, Noto Sans Devanagari).

## Run

The site can run in **two modes** — pick whichever fits.

### Mode 1 — Full-stack (recommended)

Starts the Node backend with multi-user auth, server-side data persistence, and an admin API.

```bash
node server.js
```

Open <http://localhost:3000>. No `npm install` required — the server uses only Node built-ins.

### Mode 2 — Static (any web host)

Serve the `public/` folder from any static host (GitHub Pages, Netlify, Vercel, an Nginx box, or even by opening `public/index.html` over `file://`).

When the backend can't be reached, the site automatically falls back to a **localStorage-backed store**:

- The default admin (`admin@typing.local` / `admin123`) is seeded into your browser on first visit.
- Signups, logins, exercises and admin actions all work, but data is **only saved in your current browser** and is not shared with other users.
- A small banner appears at the bottom of the page noting "static mode".

Switch back to Mode 1 anytime by running `node server.js` and refreshing.

## Default admin

```
email:    admin@typing.local
password: admin123
```

Visit `/login.html`, switch to the **Admin** tab, and sign in. You will land on the admin dashboard at `/admin.html`.

## Pages

| URL | Description | Theme |
|---|---|---|
| `/` | Home page | Gradient hero |
| `/login.html` `/signup.html` | Auth | Soft gradient card |
| `/admin.html` | Admin dashboard | Dark sidebar + light main |
| `/pages/english/learn.html` | English · Learn | Cool blue, friendly |
| `/pages/english/test.html` | English · Test | Cool blue, exam-style stats |
| `/pages/english/number.html` | Number drill | Dark numpad |
| `/pages/hindi-krutidev/learn.html` | KrutiDev · Learn | Warm amber, legacy font |
| `/pages/hindi-krutidev/test.html` | KrutiDev · Test | Warm amber, exam-style |
| `/pages/hindi-mangal/gail-learn.html` | Mangal · GAIL · Learn | Green |
| `/pages/hindi-mangal/gail-test.html` | Mangal · GAIL · Test | Green |
| `/pages/hindi-mangal/inscript-learn.html` | Mangal · INSCRIPT · Learn | Purple |
| `/pages/hindi-mangal/inscript-test.html` | Mangal · INSCRIPT · Test | Purple |
| `/pages/hindi-mangal/cbi-learn.html` | Mangal · CBI · Learn | Orange |
| `/pages/hindi-mangal/cbi-test.html` | Mangal · CBI · Test | Orange |

## REST API

| Method | Path | Auth | Body | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/signup` | – | `{name,email,password}` | Create user |
| POST | `/api/auth/login` | – | `{email,password}` | Get token + user |
| GET  | `/api/exercises?section=&mode=` | – | – | Public exercise list |
| GET  | `/api/admin/users` | admin | – | List users |
| DELETE | `/api/admin/users/:id` | admin | – | Delete user |
| PATCH | `/api/admin/users/:id/role` | admin | `{role:"user"\|"admin"}` | Change role |
| GET  | `/api/admin/exercises` | admin | – | All exercises |
| POST | `/api/admin/exercises` | admin | `{section,mode,title,content}` | Add |
| PUT  | `/api/admin/exercises/:id` | admin | partial | Update |
| DELETE | `/api/admin/exercises/:id` | admin | – | Delete |

Section values: `english`, `hindi-krutidev`, `hindi-mangal-gail`, `hindi-mangal-inscript`, `hindi-mangal-cbi`.
Mode values: `learn`, `test`, `number`.

## Data

- `data/users.json` — users (auto-seeded with admin user on first run)
- `data/exercises.json` — exercises (auto-seeded with sample lessons)

Delete these files to reset the system — they regenerate on next startup.

## Notes on Hindi rendering

- **KrutiDev/DevLys** is a *legacy non-Unicode* font. Stored content is the KrutiDev byte sequence; the page requests the `Kruti Dev 010` font (must be installed on the user's machine for ideal display) and falls back to Devanagari Unicode.
- **Mangal Unicode** content is stored as proper Devanagari Unicode and renders with `Noto Sans Devanagari` / system Mangal.
- The site does **not** transliterate keyboard layouts — users type with their OS-configured KrutiDev / GAIL / INSCRIPT / CBI keyboard.

## Project layout

```
typing-website/
├── server.js           # Single-file HTTP server (no dependencies)
├── package.json
├── data/               # Auto-created on first run (users.json, exercises.json)
└── public/
    ├── index.html
    ├── login.html / signup.html / admin.html
    ├── css/   (base, home, auth, admin, learn, test, english, hindi-krutidev, hindi-mangal)
    ├── js/    (home, auth, admin, learn, test)
    └── pages/
        ├── english/{learn,test,number}.html
        ├── hindi-krutidev/{learn,test}.html
        └── hindi-mangal/{gail,inscript,cbi}-{learn,test}.html
```
