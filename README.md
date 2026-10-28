# NagriVanta: AI-Powered Civic Issue Reporting & Resolution Platform

**🌐 Live demo: https://nagrivanta-web.vercel.app** · API: https://nagrivanta-api.vercel.app ([health](https://nagrivanta-api.vercel.app/health)) · Open data: [CSV](https://nagrivanta-api.vercel.app/api/v1/public/open-data.csv) · [Open311](https://nagrivanta-api.vercel.app/open311/v2/services.json)

> The live demo runs on synthetic data for Ghaziabad and Noida. Demo account passwords for the live site are kept private; run it locally (below) to use the documented demo accounts.

Citizens report potholes, garbage, water leaks, dark streetlights and blocked drains. Admins confirm the triage and assign a department with an SLA. Officers resolve the case with evidence. Citizens rate the fix or reopen it. Every step goes into an audit trail.

**AI recommends. Rules validate. People decide.** The AI only suggests a category, summary and priority, and it runs *after* the complaint is saved:

1. **Instant (in the request, ~ms):** a Naive Bayes model trained on the bundled datasets classifies the report and smart routing assigns it. The citizen gets their reference ID right away.
2. **Background (Gemini, ~5–20 s):** Google Gemini reads the text **and the photo** and refines the suggestion. On Vercel this runs after the response via `waitUntil`; the case page refreshes itself. If Gemini disagrees with an auto-routed category, admins are alerted instead of the case silently moving.
3. **Fallbacks:** if the main model is overloaded (503) or slow, a fallback model is tried; if Gemini is unavailable, the offline result stays. A complaint is never lost because of the AI.

**Stack: MERN only.** Every feature is MongoDB + Express + React + Node, with Tailwind CSS. Python was not needed for any feature: image understanding goes through the Gemini API, image hashing uses `sharp`, and the text classifier is trained and run in JavaScript.

| Part | Stack | Platforms |
|---|---|---|
| `server/` | Node.js, Express 5, MongoDB + Mongoose, Zod, JWT, Multer, sharp, exifr, Gemini SDK | API for every client + Open311 API |
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
| Admin | admin@nagrivanta.local |
| Officers (Ghaziabad) | pwd / san / jal / ele / drn `.officer@nagrivanta.local` (e.g. pwd.officer@nagrivanta.local) |
| Officers (Noida) | `noida.` + the same, e.g. noida.pwd.officer@nagrivanta.local |
| Citizens | citizen1@nagrivanta.local, citizen2@nagrivanta.local, citizen3@nagrivanta.local |

These are demo-only credentials. Do not use them on a public deployment.

## 2. Normal setup with your own database

```bash
cd server
cp .env.example .env      # Windows: copy .env.example .env
# edit .env (see the API keys table below)
npm install
npm run seed              # WARNING: wipes and re-creates the NagriVanta collections
npm run dev
```

## 3. API keys and settings (you add these yourself)

Never commit `.env` files; they are git-ignored.

| Variable | File | Required? | Where to get it |
|---|---|---|---|
| `MONGODB_URI` | `server/.env` | Yes (not for `npm run demo`) | **Local:** install MongoDB Community Server (https://www.mongodb.com/try/download/community), then use `mongodb://127.0.0.1:27017/nagrivanta`. **Cloud (free):** create an M0 cluster on MongoDB Atlas (https://www.mongodb.com/cloud/atlas/register) → *Database* → *Connect* → *Drivers* → copy the `mongodb+srv://…` string, put in your DB user's password, and add your IP under *Network Access*. |
| `JWT_SECRET` | `server/.env` | Yes | Any long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GEMINI_API_KEY` | `server/.env` | Optional | Google AI Studio: https://aistudio.google.com/app/apikey → **Create API key**. Some new projects get *"free tier not available"*: enable billing at https://aistudio.google.com/billing. Without a working key the offline trained model is used. |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | `server/.env` | Optional | Default `gemini-flash-lite-latest` (fastest in our tests), fallback `gemini-flash-latest` when the first is overloaded. Model list: https://ai.google.dev/gemini-api/docs/models |
| `AI_TIMEOUT_MS` | `server/.env` | Optional | Per Gemini call, default 25000 (calls run in the background; the chat assistant caps itself at 12 s). |
| `SEED_PASSWORD` | `server/.env` | For shared DBs | Password for the demo accounts that `npm run seed` creates. Any strong string. |
| `CRON_SECRET` | `server/.env` + Vercel | For Vercel Cron | Any long random string; protects `/api/v1/jobs/sla`. |
| `OPEN311_API_KEYS` | `server/.env` | Optional | Comma-separated random strings you give to partner systems that file cases through Open311. |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | `server/.env` | Optional | Your endpoint for signed case events (`X-NagriVanta-Signature`, HMAC-SHA256). |
| `AUTO_ASSIGN`, `RISK_WEATHER`, `APP_TZ_OFFSET` | `server/.env` | Optional | Smart routing on/off (default on), weather-based risk alerts on/off (Open-Meteo, no key), time zone for date filters (default `+05:30`). |
| `CORS_ORIGINS` | `server/.env` | Optional | Comma-separated browser origins allowed to call the API (defaults to the Vite and Expo web dev ports). Add your deployed web URL here. |
| `VITE_API_URL` | `client/.env` | Production only | Leave empty in development (Vite proxies `/api`). In production set it to your API URL. |
| `EXPO_PUBLIC_API_URL` | `mobile/.env` | Yes | The API URL **as seen from your phone**: `http://<your-computer-LAN-IP>:5000`. Find the IP with `ipconfig` (Windows, "IPv4 Address") or `ipconfig getifaddr en0` (macOS). Android emulator: `http://10.0.2.2:5000`. |

Maps (OpenStreetMap) and weather (Open-Meteo) need **no key**.

## 4. Mobile app (Android / iOS)

```bash
cd mobile
cp .env.example .env      # then set EXPO_PUBLIC_API_URL to your LAN IP
npm install
npx expo start
```

Install **Expo Go** on your phone (Play Store / App Store), connect to the same Wi-Fi as your computer, and scan the QR code. The server listens on `0.0.0.0` so the phone can reach it.

The mobile app covers the citizen flow (sign up, report with camera + GPS, nearby issues with "me too", AI assistant chat, track, rate, reopen, offline outbox, Hindi/English) and the officer flow (queue, status updates, after-photo evidence). Voice input on mobile uses the keyboard microphone. Admin triage and analytics stay on the web app.

Build installable apps with EAS (free account at https://expo.dev):

```bash
npx eas-cli@latest build --platform android --profile preview
```

A production build that talks to a plain `http://` API on Android needs HTTPS or a cleartext exception; deploy the API behind HTTPS.

## 5. Tests and AI evaluation

```bash
cd server
npm test        # 25 tests: workflow, permissions, uploads, AI fallback + background Gemini refinement, routing, duplicates, audit chain, votes, Open311, assistant, SLA
npm run train   # retrain the offline classifier (writes src/ai/model.json)
npm run eval    # held-out accuracy: keyword rules vs trained model (vs Gemini when the key works)
```

Held-out results (test rows never seen in training; NYC split by distinct descriptor text):

| Dataset | n | Keyword rules | Trained model + rules |
|---|---|---|---|
| Synthetic Indian reports (incl. Hindi/Hinglish) | 6 | 100% | 100% |
| Real NYC 311 descriptors | 300 | 4.0% | 56.7% |

The Indian hold-out is tiny and synthetic, and NYC descriptors are short US phrases. Quote these numbers only with their sample size.

### Live verification (deployed site, 28 Oct 2026)

An automated end-to-end check against the live API exercised every feature: role logins and permission checks, a voice-channel report with a photo, instant offline triage, smart routing, **background Gemini image + text classification** (`gemini-flash-lite-latest`, photo used), duplicate detection, a "me too" vote, SLA due date, officer resolution with fresh evidence, **Gemini before/after photo comparison**, citizen notifications, intact hash-chained history, rating, analytics + hotspots, weather risk alerts, open data + CORS, multi-city scorecard, Hindi and English assistant, Open311 create/read, service worker + manifest, and the protected cron endpoint. All checks passed after the fixes in this release (Devanagari keywords for the offline assistant, and instant offline replies for clear chat messages).

## 6. The 18 features (from the comparison study) and where they live

| # | Feature | How it is implemented |
|---|---|---|
| 1 | Multi-channel intake (web, app, voice, chat) | Web form, Expo app, Web Speech voice input (en-IN/hi-IN), AI assistant chat (`/assistant/chat`), Open311 API. `source` records the channel. |
| 2 | Photo/video upload with auto metadata | Up to 3 photos + 1 short video. The server reads EXIF capture time and GPS (`exifr`), re-encodes images (`sharp`) and stores them in MongoDB under random keys. A photo's GPS can supply the location. |
| 3 | AI category classification (image + text) | Offline Naive Bayes answers instantly; Gemini then reads the text **and first photo** in the background (`refineWithAi` in `services/complaints.js`). |
| 4 | AI summary & priority prediction | One-line summary + suggested priority, plus a transparent rule score with every factor listed. |
| 5 | Smart department routing (auto-assignment) | `services/routing.js`: city + category → department, then the least-loaded officer, when the category is reliable; otherwise a suggestion for the triage queue. |
| 6 | Duplicate detection (text + image + location) | Text similarity, distance, category and 64-bit perceptual photo hashes (`services/duplicates.js`). Never merged automatically. |
| 7 | Real-time status tracking & notifications | Hash-chained timeline, in-app notifications polled every 20 s, browser notifications, signed webhooks. |
| 8 | SLA monitoring & escalation | Per-department, per-priority due dates; the job escalates overdue cases exactly once (atomic claim). |
| 9 | Before/after evidence verification | A new after-photo is required for every resolution. Checks: differs from the report photo, not reused anywhere, taken after the report, taken on site, optional Gemini visual comparison. Evidence SHA-256 goes into the tamper-evident history. |
| 10 | Ward analytics & recurrence heatmap | Ward/city charts and hotspots (3+ same-category reports within ~110 m in 90 days) drawn as rings on the map. |
| 11 | Predictive risk alerts (weather + history) | `services/risk.js`: Open-Meteo 3-day rain forecast × 180-day complaint history per ward. Rule-based and explained. |
| 12 | Public transparency dashboard (open data) | Scorecard with small-group suppression; `/public/open-data.csv` and `.json` (anonymised, CC BY 4.0). |
| 13 | Hindi / local language | Full Hindi UI toggle (web + mobile), Hindi voice input, Hindi assistant replies, Hinglish-aware classifier. |
| 14 | Offline / low-bandwidth mode | Service-worker app shell; IndexedDB (web) / AsyncStorage (mobile) outbox that syncs when back online; Lite mode (no map tiles, smaller photos), on automatically for Save-Data/2G. |
| 15 | Integration with other govt services | Open311 GeoReport v2 (`/open311/v2/...`) with the partner `account_id` as a shared case ID; signed outbound webhooks. |
| 16 | Role-based access | Citizen / officer / admin, checked server-side on every route; officers scoped to their department. |
| 17 | Community feedback & ratings | "Me too" upvotes (one per citizen, raise priority), 1–5 ratings, reopen within 30 days. |
| 18 | Scalable multi-city deployment | Cities/wards config, per-city departments and officers, city filters everywhere, stateless serverless API with indexed MongoDB. |

Also fixed from the code audit: unguessable image links, AI triage awaited (works on serverless), photo compression for Vercel's 4.5 MB limit, time-zone-correct due dates and date filters, no orphan uploads on failed updates, fresh evidence required after a reopen, officer emails hidden from citizens, 4-byte reference IDs, atomic escalation.

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
| POST / DELETE | `/complaints/:id/upvote` ("me too") | Citizen (not on own report) |
| GET | `/complaints/:id/integrity` (verify hash-chained history) | Owner citizen, assigned officer, admin |
| POST | `/assistant/chat` (`{ messages, lang }`) | Public; signed-in users can look up their own cases |
| GET | `/admin/analytics?from=&to=&city=` | Officer, admin |
| GET | `/admin/workload` | Admin |
| GET / POST | `/admin/users` | Admin (create officers/admins) |
| PATCH | `/admin/departments/:id` (SLA hours) | Admin |
| GET | `/cities`, `/departments?city=`, `/public/scorecard?city=`, `/public/risk-alerts?city=` | Public |
| GET | `/public/open-data.csv`, `/public/open-data.json` | Public (anonymised) |
| GET | `/jobs/sla` | Vercel Cron (`Authorization: Bearer CRON_SECRET`) |
| GET / POST | `/open311/v2/services.json`, `/open311/v2/requests.json`, `/open311/v2/requests/:id.json` (outside `/api/v1`) | Public read; create needs an `api_key` from `OPEN311_API_KEYS` |
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

Live demo: web **https://nagrivanta-web.vercel.app** · API **https://nagrivanta-api.vercel.app** (`/health`).

The API and the web app are two Vercel projects:

- **API (`server/`)**: `server/api/index.js` is the serverless entry and `server/vercel.json` sends every path to it. A daily Vercel Cron calls `/api/v1/jobs/sla` to escalate overdue cases (the Hobby plan allows daily crons). Uploaded photos are stored in MongoDB, because serverless disks are not shared or persistent.
  Env vars in Vercel: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CRON_SECRET`, `CORS_ORIGINS` (include the web URL), `NODE_ENV=production`.
- **Web (`client/`)**: static Vite build with an SPA rewrite in `client/vercel.json`. Env var: `VITE_API_URL` = the API URL.
- **MongoDB Atlas** must allow Vercel's changing IPs: Atlas → *Network Access* → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`), with a strong DB password.
- Seed the online database once from your computer: put the Atlas URI and a `SEED_PASSWORD` in `server/.env`, then `npm run seed`.

Deploy from each folder with `npx vercel deploy --prod`. Images are limited to 4 MB each because Vercel caps request bodies at about 4.5 MB.

## 10. Known limits

- Gemini needs a key with billing enabled for its Google project. Its response time varies a lot (5–20 s observed), which is why it runs in the background; without a key the offline model handles everything except the AI photo comparison.
- Voice input on the website depends on browser support (Chrome, Edge, Safari). On mobile, use the keyboard microphone.
- Real-time updates use polling, not websockets, because serverless hosting does not keep connections open.
- In-memory rate limits are per server instance; add a Vercel Firewall rate-limit rule for `/api/v1/auth/*`.
- Media is stored in MongoDB (fine for a pilot); move it to object storage at scale.
- Risk alerts are transparent rules, not a trained forecasting model; validate them against real local data before relying on them.
- This is an independent pilot, not an official government system. Do not claim government integration, faster resolution or AI accuracy without measured evidence.
