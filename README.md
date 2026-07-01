<div align="center">

<img src="src/assets/logo.png" alt="Goa Community College" width="110" />

# 🎓 GCC Class Scheduling System

### Conflict‑free timetables for **Goa Community College** — built for admins, instructors, and students.

_Plan classes, detect conflicts, manage sections & faculty, and give every student a clear, always‑up‑to‑date schedule._

<br/>

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-gcc--scheduling--app.vercel.app-7B1C1C?style=for-the-badge)](https://gcc-scheduling-app.vercel.app)

<br/>

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?logo=vercel&logoColor=white)
![TiDB](https://img.shields.io/badge/TiDB-Serverless-DC382D?logo=mysql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT_+_bcrypt-000000?logo=jsonwebtokens&logoColor=white)
![Status](https://img.shields.io/badge/status-live-brightgreen)

</div>

---

## ✨ Overview

The **GCC Class Scheduling System** is a full‑stack web app that turns the messy, error‑prone job of building a college timetable into something fast and reliable. It automatically flags **room, instructor, and section conflicts**, scopes everything to the active **academic year & semester**, and gives each role exactly the view they need — all wrapped in a clean, **dark‑mode‑ready** interface.

> **One question drives the whole app:** *who is this user, and what are they allowed to see or change?* Every protected endpoint enforces that on the server.

---

## 🌟 Highlights

- 🗓️ **Smart calendar** — drag to create classes, click a card to edit or delete, resize rows/columns, and export to **PDF / print**.
- ⚠️ **Live conflict detection** — room, instructor, **and** section overlaps are caught server‑side and shown right on the dashboard (with which schedule came first).
- 🎯 **Academic‑term aware** — a global active **year + semester**; switch semesters and the calendar starts blank until it has its own schedules.
- 🔁 **One‑click year rollover** — snapshot every student's year & section, promote everyone up a level, and advance to the next academic year.
- 🧾 **Self‑registration** — instructors sign up and students register; admins **approve or reject** from a dedicated queue.
- 📜 **Full activity log** — every create / edit / delete / approval is recorded, surfaced in the notification bell and a slide‑in **history panel**.
- 📊 **Insights** — instructor teaching‑load analytics at a glance.
- 🌙 **Dark mode** everywhere, responsive down to mobile.
- 🔐 **Hardened by design** — role‑based authorization, fail‑closed JWT, rate‑limited logins, and security headers.

---

## 👥 Built for three roles

| Role | What they can do |
| :--- | :--- |
| 🛠️ **Admin** | Full control — manage schedules, subjects, sections, classrooms, instructors & students; approve registrations; run analytics; roll over academic years; view the activity log. |
| 👩‍🏫 **Instructor** | View their own teaching schedule (calendar + list), manage their classes on their page, and see upcoming events. |
| 🎒 **Student** | See their section's weekly timetable, update their year/section when promoted, and browse events. |

---

## 🧰 Tech Stack

**Frontend** · React 19 (Create React App) · React Router 7 · Tailwind CSS 3 · lucide‑react · react‑hot‑toast
**Backend** · Vercel Serverless Functions (Node) · JWT (8h) + bcrypt
**Database** · TiDB Serverless (MySQL‑compatible) via `mysql2`
**Email** · Resend or SMTP (admin password reset)
**Hosting** · Vercel

---

## 🏗️ Architecture

```
React SPA  ──HTTPS/JWT──▶  Vercel Serverless (/api/*.js)  ──SSL──▶  TiDB Serverless (MySQL)
   │                              │
   │  role‑aware UI               │  requireAuth / requireAdmin on every protected route
   │  dark mode, calendar         │  object‑level access (own schedule / own section)
   └──────────────────────────────┘  central error handling · activity logging
```

Each file in `/api` is a single serverless endpoint. Auth, DB access, rate‑limiting, and audit logging are shared helpers (`_auth.js`, `_db.js`, `_rateLimit.js`).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+**
- A **TiDB Serverless** database (or any MySQL‑compatible DB)

### 1. Clone & install
```bash
git clone https://github.com/azyy00/2026-scheduling-app.git
cd 2026-scheduling-app
npm install
```

### 2. Configure environment
Copy the template and fill in your values:
```bash
cp .env.example .env.local
```
```env
TIDB_HOST=...
TIDB_PORT=4000
TIDB_USER=...
TIDB_PASSWORD=...
TIDB_DATABASE=...
# REQUIRED — the app fails closed without it:
JWT_SECRET=          # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
> Optional email (password reset): `ADMIN_EMAIL`, plus **Resend** (`RESEND_API_KEY`, `MAIL_FROM`) *or* **SMTP** (`SMTP_HOST`, `SMTP_PORT`, …). See `.env.example`.

### 3. Initialize the database
```bash
node database/migrate.js      # applies database/schema.sql
```

### 4. Run it
```bash
# Frontend only (API calls hit your deployed backend)
npm start

# Full stack incl. serverless API (recommended)
vercel dev
```
Open **http://localhost:3000** 🎉

### 5. Build for production
```bash
npm run build
```

---

## 🔐 Security

Security is enforced on the **server**, not just hidden in the UI:

- ✅ **Role‑based authorization** — `requireAuth` / `requireAdmin` on every management endpoint (non‑admins get `403`).
- ✅ **Object‑level access** — instructors/students can only read their own schedule/section.
- ✅ **Fail‑closed JWT** — no hardcoded fallback secret; the app refuses to issue tokens if `JWT_SECRET` is missing.
- ✅ **Brute‑force protection** — DB‑backed login limiter blocks after **3 failed attempts** (works across serverless instances).
- ✅ **Parameterized SQL**, friendly error handling (no leaked internals), and **security headers** (HSTS, `X‑Frame‑Options`, `X‑Content‑Type‑Options`, Referrer/Permissions‑Policy).
- ✅ **Audit trail** of every sensitive action.

---

## 🗂️ Project Structure

```
├── api/                      # Vercel serverless endpoints (one file = one endpoint)
│   ├── _auth.js  _db.js      # shared auth, DB pool, error & activity helpers
│   ├── _rateLimit.js _mailer.js
│   ├── auth.js  schedules.js  instructors.js  students.js  …
│   └── misc.js  term.js  events.js
├── database/                 # schema.sql + migration script
├── src/
│   ├── pages/                # admin · instructor · student · auth · shared
│   ├── components/common/    # ScheduleCalendar, Navbar, HistoryDrawer, AnalyticsPanel …
│   ├── context/  hooks/  utils/
│   └── assets/
└── vercel.json               # security headers + SPA rewrites
```

---

## 🧭 Roadmap

- [ ] Student ID + password/PIN first‑login (replace ID‑only login)
- [ ] Shared‑store rate limiting (Vercel KV / Redis) for all endpoints
- [ ] HttpOnly / Secure session cookies
- [ ] Bulk‑import hardening (row caps, formula‑injection guards)

---

## 👨‍💻 Author

**Anthony Azuela** — design & development.
Goa Community College · Goa, Camarines Sur 🇵🇭

<div align="center">

_Built with ❤️ for GCC._

</div>
