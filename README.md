# CivicLens: AI-Powered Civic Issue Reporting & Resolution Platform

Citizens report potholes, garbage, water leaks, dark streetlights and blocked drains. Admins confirm the triage and assign a department with an SLA. Officers resolve the case with evidence. Citizens rate the fix or reopen it. Every step goes into an audit trail.

**AI recommends. Rules validate. People decide.** The AI (Google Gemini) only suggests a category, summary and priority, and it runs *after* the complaint is saved. If the AI is missing, slow or broken, the complaint is still saved and a rule-based engine fills the suggestion instead.

| Part | Stack | Platforms |
|---|---|---|
| `server/` | Node.js, Express 5, MongoDB + Mongoose, Zod, JWT, Multer, Gemini SDK | API for every client |
| `client/` | React 19, Vite, Tailwind CSS v4, React Router, Leaflet/OpenStreetMap, Recharts | Web (desktop + phone browsers) and installable PWA |
| `mobile/` | Expo SDK 58, React Native, Expo Router | Android, iOS (and web) |
| `data/` | Real NYC 311 sample + labelled synthetic Indian set | Seeding and AI evaluation |

Both the web and mobile apps have a **header and footer with a single light/dark toggle button**. The choice is saved per device and defaults to the system theme.

---

## 1. Quick start (no database install needed)

Needs **Node.js 20+** (https://nodejs.org).

```bash
cd server
npm install
npm run demo
```

`npm run demo` starts an in-memory MongoDB, seeds demo data and runs the API at http://localhost:5000. Data is lost when you stop it.

Then, in a second terminal:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173.

Demo accounts (password `Demo@12345` for all):

| Role | Email |
|---|---|
| Admin | admin@civiclens.local |
| Officers | pwd / san / jal / ele / drn `.officer@civiclens.local` (e.g. pwd.officer@civiclens.local) |
| Citizens | citizen1@civiclens.local, citizen2@civiclens.local, citizen3@civiclens.local |

These are demo-only credentials. Do not use them on a public deployment.

## 2. Normal setup with your own database

```bash
cd server
cp .env.example .env      # Windows: copy .env.example .env
# edit .env (see the API keys table below)
npm install
npm run seed              # WARNING: wipes and re-creates the CivicLens collections
npm run dev
```

## 3. API keys and settings (you add these yourself)

Never commit `.env` files; they are git-ignored.

| Variable | File | Required? | Where to get it |
|---|---|---|---|
| `MONGODB_URI` | `server/.env` | Yes (not for `npm run demo`) | **Local:** install MongoDB Community Server (https://www.mongodb.com/try/download/community), then use `mongodb://127.0.0.1:27017/civiclens`. **Cloud (free):** create an M0 cluster on MongoDB Atlas (https://www.mongodb.com/cloud/atlas/register) → *Database* → *Connect* → *Drivers* → copy the `mongodb+srv://…` string, put in your DB user's password, and add your IP under *Network Access*. |
| `JWT_SECRET` | `server/.env` | Yes | Any long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GEMINI_API_KEY` | `server/.env` | Optional | Google AI Studio: https://aistudio.google.com/app/apikey → sign in → **Create API key**. Free tier is enough for a demo. Without it the rule-based engine is used. |
| `GEMINI_MODEL` | `server/.env` | Optional | Defaults to `gemini-2.5-flash`. Model list: https://ai.google.dev/gemini-api/docs/models |
| `CORS_ORIGINS` | `server/.env` | Optional | Comma-separated browser origins allowed to call the API (defaults to the Vite and Expo web dev ports). Add your deployed web URL here. |
| `VITE_API_URL` | `client/.env` | Production only | Leave empty in development (Vite proxies `/api`). In production set it to your API URL. |
| `EXPO_PUBLIC_API_URL` | `mobile/.env` | Yes | The API URL **as seen from your phone**: `http://<your-computer-LAN-IP>:5000`. Find the IP with `ipconfig` (Windows, "IPv4 Address") or `ipconfig getifaddr en0` (macOS). Android emulator: `http://10.0.2.2:5000`. |

Maps use OpenStreetMap tiles and need **no key**.

## 4. Mobile app (Android / iOS)

```bash
cd mobile
cp .env.example .env      # then set EXPO_PUBLIC_API_URL to your LAN IP
npm install
npx expo start
```

Install **Expo Go** on your phone (Play Store / App Store), connect to the same Wi-Fi as your computer, and scan the QR code. The server listens on `0.0.0.0` so the phone can reach it.

The mobile app covers the citizen flow (sign up, report with camera + GPS, track, rate, reopen) and the officer flow (queue, status updates, after-photo evidence). Admin triage and analytics stay on the web app.

Build installable apps with EAS (free account at https://expo.dev):

```bash
npx eas-cli@latest build --platform android --profile preview
```

A production build that talks to a plain `http://` API on Android needs HTTPS or a cleartext exception; deploy the API behind HTTPS.

## 5. Tests and AI evaluation

```bash
cd server
npm test        # 14 tests: workflow rules, permissions, uploads, AI failure, duplicates, SLA, analytics
npm run eval    # category accuracy + per-class precision/recall on the bundled datasets
```

Baseline measured with the **rule engine only** (no Gemini key):

| Dataset | n | Accuracy |
|---|---|---|
| Synthetic Indian reports (distinct templates) | 24 | 79.2% |
| Real NYC 311 descriptors | 200 | 57.0% |

Run `npm run eval` again after adding `GEMINI_API_KEY` to compare. Quote any number with its sample size; the Indian set is small and synthetic.

## 6. Features

- **Accounts and roles:** citizen, officer, admin. Every permission is checked on the server, never only in the UI.
- **Reporting:** title, description (English/Hindi/Hinglish), category or "let AI suggest", ward, map pin or GPS, up to 3 photos (type checked by magic bytes, 5 MB max). Unique reference ID like `CIV-261028-29D135`.
- **Explainable triage:** AI suggestion with reasons and confidence, stored apart from confirmed fields. Transparent rule-based priority score with each factor's points.
- **Duplicate hints:** nearby (300 m, 30 days) reports scored on distance, wording and category, shown live while typing. Never merged automatically.
- **Workflow:** allowed status transitions per role (Submitted → Under review → Assigned → In progress → Resolved → Closed, plus Needs info, Blocked, Rejected, Reopened). Resolving requires a note and an after-photo.
- **SLA:** due date from the department's per-priority hours; a background job escalates overdue cases once and notifies the officer and admins.
- **Audit trail:** append-only history with actor, time, old → new status, notes. Internal notes are hidden from citizens.
- **Feedback and reopen:** citizens rate a resolved case (closes it) or reopen within 30 days.
- **Notifications:** in-app, for status changes, assignments, escalations and reopenings.
- **Analytics (staff):** cases by status, category, ward, 30-day trend, overdue count, median resolution time, reopen rate, ratings, hotspot map, AI health.
- **Public scorecard:** ward-level resolved %, overdue %, median fix time; wards with fewer than 5 reports are suppressed and map points are rounded to ~100 m.

## 7. API (base `/api/v1`)

| Method | Endpoint | Who |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Public (rate-limited) |
| GET / POST | `/auth/me`, `/auth/logout` | Signed in |
| POST | `/complaints` (multipart, `images`) | Citizen |
| GET | `/complaints/mine` | Signed in |
| GET | `/complaints?status=&category=&priority=&ward=&overdue=&q=&page=` | Admin: all · Officer: own dept · Citizen: public-safe subset |
| GET | `/complaints/nearby?lat=&lng=&text=` | Signed in |
| GET | `/complaints/:id` | Owner citizen, assigned officer, admin |
| PATCH | `/complaints/:id` (confirm category/priority) | Admin |
| PATCH | `/complaints/:id/status` (multipart, `evidence`) | Officer, admin |
| PATCH | `/complaints/:id/assign` | Admin |
| POST | `/complaints/:id/notes` | Officer, admin |
| POST | `/complaints/:id/feedback`, `/complaints/:id/reopen` | Owner citizen |
| GET | `/admin/analytics?from=&to=` | Officer, admin |
| GET / POST | `/admin/users` | Admin (create officers/admins) |
| PATCH | `/admin/departments/:id` (SLA hours) | Admin |
| GET | `/departments`, `/public/scorecard` | Public |
| GET / PATCH / POST | `/notifications`, `/notifications/:id/read`, `/notifications/read-all` | Signed in |
| GET | `/health` | Public |

Responses use `{ success, data, meta?, requestId }`; errors use `{ success: false, error: { code, message, details? }, requestId }`.

## 8. Project layout

```
server/src/  config/ models/ routes/ controllers/ services/ middleware/ validators/ jobs/ app.js server.js
server/scripts/  seed.js demo.js eval.js       server/tests/  unit + API tests
client/src/  components/ pages/ context/ services/ utils/
mobile/src/  app/ (Expo Router screens) components/ lib/
data/        nyc311_sample.csv, civic_labelled_india.json, README.md (sources + licences)
```

## 9. Deployment (Vercel)

Live demo: web **https://civiclens-web-murex.vercel.app** · API **https://civiclens-api-coral.vercel.app** (`/health`).

The API and the web app are two Vercel projects:

- **API (`server/`)**: `server/api/index.js` is the serverless entry and `server/vercel.json` sends every path to it. A daily Vercel Cron calls `/api/v1/jobs/sla` to escalate overdue cases (the Hobby plan allows daily crons). Uploaded photos are stored in MongoDB, because serverless disks are not shared or persistent.
  Env vars in Vercel: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CRON_SECRET`, `CORS_ORIGINS` (include the web URL), `NODE_ENV=production`.
- **Web (`client/`)**: static Vite build with an SPA rewrite in `client/vercel.json`. Env var: `VITE_API_URL` = the API URL.
- **MongoDB Atlas** must allow Vercel's changing IPs: Atlas → *Network Access* → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`), with a strong DB password.
- Seed the online database once from your computer: put the Atlas URI and a `SEED_PASSWORD` in `server/.env`, then `npm run seed`.

Deploy from each folder with `npx vercel deploy --prod`. Images are limited to 4 MB each because Vercel caps request bodies at about 4.5 MB.

## 10. Known limits (not built)

Hindi UI translation (Hindi *input* works), voice/IVR, offline drafts, weather-based prediction, image-reuse detection, email/SMS notifications, admin screens on mobile, an admin UI for creating staff (the API endpoint exists). This is an independent pilot, not an official government system; do not claim government integration, faster resolution or AI accuracy without measured evidence.
