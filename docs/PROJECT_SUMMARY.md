# NagriVanta: complete project summary (context for a new AI chat)

> Paste this whole file into a new ChatGPT / Claude chat, then ask your question.
> It describes what the project is, how it is built, where everything lives and what state it is in.
> Secrets are **not** included; they live only in `server/.env` (git-ignored) and in Vercel environment variables.

## 1. What it is

**NagriVanta** ("nagrik" = citizen) is an AI-powered civic issue reporting and resolution platform for Indian cities. The pilot covers **Ghaziabad and Noida (Uttar Pradesh)**.

- **Citizens** report potholes, garbage, water leaks, dark streetlights and blocked drains. They can report by text, voice, photo or video, chat, or the Open311 API.
- **The AI** classifies each report, writes a summary, sets the priority and spots duplicates.
- **Smart routing** assigns the case to the least-loaded officer in the right department.
- **Officers** resolve the case with before/after photo evidence, and the platform verifies that evidence.
- **Everything is public and auditable:** a hash-chained audit trail, ward scorecards, open data and SLA escalation.

The project was built from 5 blueprint documents (4 PDFs + 1 DOCX) and a comparison image of 18 required features. The owner is Naman Verma, a 3rd-year CSE student at KIET (GitHub: NAMAN-VERMA-02).

| | |
|---|---|
| Live website | https://nagrivanta-web.vercel.app |
| Live API | https://nagrivanta-api.vercel.app (health: `/health`) |
| GitHub | https://github.com/NAMAN-VERMA-02/NagriVanta (public, branch `main`) |
| User guide | `docs/NagriVanta-User-Guide.pdf` |

## 2. Tech stack

The project is MERN + Tailwind. No Python was needed for any feature.

| Layer | Tech |
|---|---|
| API | Node.js, **Express 5**, **Mongoose 9** (MongoDB Atlas, database `nagrivanta`), **Zod 4** validation, JWT bearer auth, bcrypt, Multer (memory storage), sharp (resize + perceptual hash), exifr (photo GPS/time), express-rate-limit |
| AI | **Google Gemini** via `@google/genai`. Model `gemini-flash-lite-latest`, fallback `gemini-flash-latest`. An offline Naive Bayes classifier (`server/src/ai/model.json`) plus keyword rules is always available as a fallback. |
| Web | **React 19**, **Vite 8**, **Tailwind CSS v4** (`@utility`, `@custom-variant dark`), react-router 8. Maps: react-leaflet 5 + Leaflet 1.9, leaflet.markercluster and leaflet.heat. Charts: Recharts. Icons: lucide-react 1.x (it has no brand icons). Fonts: Plus Jakarta Sans + Noto Sans Devanagari. |
| Mobile | **Expo SDK 58** / React Native, expo-router (`mobile/src/app`), Ionicons, AsyncStorage offline outbox |
| Hosting | **Vercel**, two projects: `nagrivanta-api` (serverless Express) and `nagrivanta-web` (static SPA). Vercel account "envy-rights". |
| External free APIs | OpenStreetMap / Esri / OpenTopoMap / CARTO tiles, Nominatim (search + reverse geocoding), India Post pincode API, Open-Meteo weather |

## 3. Repository layout

```
NagriVanta/
├─ server/                 Express API
│  ├─ src/app.js           app setup, /health, /uploads/:key, /api/v1, /open311/v2
│  ├─ src/config/          env.js, db.js, constants.js (CITIES, categories, SLA hours, wards)
│  ├─ src/models/          User, Complaint, ComplaintHistory (hash chain), Department, Feedback,
│  │                       Notification, Upload (media stored in MongoDB), Vote, Cache
│  ├─ src/controllers/     auth, complaints, admin, profile (incl. geo + public track), open311
│  ├─ src/services/        ai (Gemini), classifier (offline NB), rules (priority factors), duplicates,
│  │                       routing, workflow (status machine), verification (before/after evidence),
│  │                       analytics, risk (Open-Meteo alerts), geo, assistant (chatbot), profile
│  │                       (levels/points), background (waitUntil), webhook
│  ├─ src/jobs/sla.js      SLA escalation (cron endpoint /api/v1/jobs/sla, protected by CRON_SECRET)
│  ├─ scripts/             seed, demo (in-memory Mongo), train classifier
│  └─ tests/               node:test suite (27 tests)
├─ client/                 React web app
│  ├─ src/components/      Header, Footer, CommandPalette, Maps, leafletPlugins, Assistant (chat),
│  │                       Charts, Insights, ThemeToggle, ui
│  ├─ src/pages/           Home, Report, MyReports, Community, ComplaintDetail, Queue, Analytics,
│  │                       Scorecard, Notifications, Profile, Guide, About, Faq, Track, Auth
│  ├─ src/context/         AuthContext, ThemeContext (light/dark), PrefsContext (lang en/hi, Lite mode, online)
│  ├─ src/i18n.js          English + Hindi strings
│  └─ public/sw.js         PWA service worker (offline app shell)
├─ mobile/                 Expo app (report with camera + GPS, nearby, chat, profile, queue, offline outbox)
├─ data/                   nyc311_sample.csv (real NYC 311 data), civic_labelled_india.json (synthetic India set)
└─ docs/                   User guide PDF, this summary
```

## 4. Roles and main flows

- **Guest:**
  - Can use Home, How it works, About, FAQ, Track a report (by reference ID like `CIV-261028-AB12CD34`), the public scorecard and open data.
- **Citizen:**
  - **Report an issue:** category, text or voice, up to 3 photos + 1 video, map pin / GPS / photo EXIF / pincode lookup, and a landmark.
  - **My reports:** a timeline with SLA countdown.
  - **Nearby issues:** "me too" votes.
  - **Feedback and reopen** on resolved cases.
  - **Profile:** level, civic points, badges, activity, personal map.
  - **Notifications.**
- **Officer:**
  - Works from **My queue**.
  - Moves cases through statuses (`submitted → under_review → assigned → in_progress → resolved → closed`, plus `needs_info`, `blocked`, `reopened`, `rejected`).
  - Uploads after-photos (evidence verification), adds notes.
  - Sees analytics.
- **Admin:**
  - Works the triage queue (review AI output, assign, overdue filter).
  - Has analytics: ward stats, recurrence heatmap, officer workload, risk alerts.
  - Manages staff accounts and department SLA hours.

**Demo accounts:**
- Emails: `citizen1@nagrivanta.local`, `pwd.officer@nagrivanta.local`, `admin@nagrivanta.local` (and more).
- Live site password: the private `SEED_PASSWORD` in `.env`.
- Local demo password (`npm run demo`): `Demo@12345`.

## 5. The 18 features (all implemented)

1. Multi-channel intake: web, mobile app, voice (Web Speech), chat assistant, Open311 GeoReport v2.
2. Photo/video upload with EXIF time and GPS extraction and client-side compression.
3. AI image + text classification (Gemini multimodal). The offline classifier answers instantly; Gemini refines the result in the background.
4. AI summary and explainable priority score (rule factors: safety risk, blocked access, sensitive place, persisting, health hazard, votes, duplicates).
5. Smart routing to the least-loaded officer of the right department and city.
6. Duplicate detection: text similarity + distance + photo perceptual hash (dHash).
7. Live tracking timeline plus browser notifications (polling, works on serverless).
8. SLA deadlines per department, with automatic escalation (cron).
9. Before/after evidence verification (EXIF time/location checks + AI comparison).
10. Tamper-evident hash-chained audit trail (integrity check endpoint).
11. Ward analytics dashboard (Recharts).
12. Recurrence heatmap / hotspots (3+ same-category reports within ~110 m in 90 days).
13. Predictive risk alerts (Open-Meteo rain forecast + complaint history).
14. Public ward scorecard + open data export (CSV/JSON, CC BY 4.0, locations rounded ~100 m for privacy).
15. Hindi/English UI.
16. Offline-first: PWA service worker, IndexedDB outbox (web), AsyncStorage outbox (mobile), plus a Lite mode that hides map tiles.
17. Role-based access (citizen/officer/admin), community votes and citizen ratings.
18. Multi-city configuration (Ghaziabad, Noida).

## 6. Extras added later

- **Advanced profile page:** level and civic points, badges, stats, activity history, personal map, settings, password change.
- **Guest pages:** How it works, About, FAQ, Track. **Pincode lookup** on the report form.
- **Professional animations:** page transitions, reveal on scroll, count-up numbers, prefers-reduced-motion respected.
- **Maps, map-app style:**
  - Basemaps: Default, Streets, Satellite (+ labels), Terrain, Light, Dark. The choice is remembered.
  - Place search, my location, fullscreen (native API), zoom.
  - Data maps fit to the data, with **Clusters / Pins / Heat** views, **category filter chips** with counts, a hotspot toggle, popups (with "Open case" on the profile map), and a fit-all button.
  - **Ctrl/⌘ + scroll** zooms; a plain scroll keeps scrolling the page and shows a hint.
  - The report map has a **draggable pin** with a coordinates chip and a Copy button.
- **Header:**
  - **Command palette (Ctrl/⌘ + K or "/")** to jump to pages, toggle theme/language/Lite, and track a reference ID.
  - Sliding nav indicator, scroll progress bar, auto-hide on scroll down.
  - "Report issue" CTA, a single light/dark toggle, Hindi toggle, Lite mode, notification bell.
  - Mobile slide-in drawer with preferences.
- **Footer:** CTA band, role-aware link columns, open data/API links, live API status indicator, PWA "Install app" button, source code link, back to top.

## 7. API overview (base `/api/v1`)

- **Auth:** `POST /auth/register|login|logout`, `GET /auth/me`
- **Public:** `GET /public/scorecard`, `/public/risk-alerts`, `/public/open-data.(csv|json)`, `/public/track/:ref`, `/departments`, `/cities`
- **Geo (cached):** `GET /geo/pincode/:pin`, `/geo/reverse?lat&lng`, `/geo/search?q`
- **Profile:** `GET|PATCH /profile`, `POST /profile/password`
- **Assistant:** `POST /assistant/chat`
- **Complaints:**
  - `POST /complaints` (citizen, multipart), `GET /complaints/mine|nearby`, `GET /complaints`, `GET /complaints/:id`, `GET /complaints/:id/integrity`
  - `PATCH /complaints/:id` (admin review), `PATCH /complaints/:id/status` (staff, evidence upload), `PATCH /complaints/:id/assign`
  - `POST /complaints/:id/notes|feedback|reopen|upvote`
- **Admin:** `GET /admin/analytics|workload|users`, `POST /admin/users`, `PATCH /admin/departments/:id`
- **Notifications:** `GET /notifications`, `POST /notifications/read-all`, `PATCH /notifications/:id/read`
- **Jobs:** `GET /jobs/sla` (Bearer `CRON_SECRET`)
- **Open311:** `/open311/v2/services.json`, `requests.json` (GET/POST), `requests/:id.json`
- **Other:** `GET /health`, `GET /uploads/:key` (media)

## 8. Configuration (`server/.env`, see `server/.env.example`)

- `PORT`, `NODE_ENV`
- `MONGODB_URI` (Atlas)
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CORS_ORIGINS`
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `AI_TIMEOUT_MS`
- `SLA_CHECK_MINUTES`
- `SEED_PASSWORD`
- `CRON_SECRET`
- `AUTO_ASSIGN`
- `APP_TZ_OFFSET`
- `RISK_WEATHER`
- `WEBHOOK_URL`, `WEBHOOK_SECRET`

The web app uses `VITE_API_URL` (the API origin). Get keys here:
- Gemini: https://aistudio.google.com/apikey
- MongoDB: https://cloud.mongodb.com

## 9. Run, test, deploy

```bash
# local demo, no external DB (in-memory Mongo + seed data), password Demo@12345
cd server && npm install && npm run demo      # API on :5000
cd client && npm install && npm run dev       # web on :5173 (proxies /api, /uploads, /health)
cd mobile && npm install && npx expo start    # mobile app

cd server && npm test                         # 27 tests
cd server && npm run seed                     # seed the real database (uses SEED_PASSWORD)
```

**Deploy:**
- Vercel deploys with `npx vercel deploy --prod --yes` from git-free copies of `server/` and `client/`. Commits authored by a non-member of the Vercel team are blocked, so deploy from those copies.
- Commits go under Naman's name only, with no AI co-author lines.

## 10. Verification status (28 Oct 2026)

- **Tests:** 27/27 automated tests pass.
- **API:** 25/25 live API feature checks pass.
- **Crash crawl:** 48 pages across all roles and all case statuses, no errors.
- **Map and UI checks:** 20/20 pass on the live site. They cover:
  - fit-to-data, Ctrl+scroll zoom, pins, popups, filters, heat and fullscreen;
  - the drag pin;
  - the command palette, mobile drawer and footer status;
  - no horizontal scroll on phones.
- **Offline classifier:** 56.7% accuracy on held-out real NYC descriptions, against 4% for keyword rules alone. It also understands Hindi and Hinglish.

## 11. Known limits and open items

- Rotate the MongoDB password and the Gemini key that were shared in chat, then update the Vercel environment variables.
- A few automated "Live check" test cases remain in the live demo data. The old Vercel projects `civiclens-api/web` can be deleted.
- The mobile app was built and bundled but not tested on a physical phone, and it is not published to the app stores.
- Gemini free-tier models are sometimes slow or return 503. The app handles this with an instant offline result, background refinement, a fallback model, a retry, and a cron retry for missed cases.
- Add a Vercel Firewall rate-limit rule for the sign-in routes (an app-level limiter already exists).
- This is an independent pilot, not an official government system.
