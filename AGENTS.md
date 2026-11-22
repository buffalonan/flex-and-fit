# AGENTS.md

Context for AI agents and reviewers working on this repo. Read this first instead of re-deriving it from the code. Keep it up to date when you change how things work.

## What this is

Flex & Fit: one person's log of gym workouts and flexibility sessions (Ferran, who writes in Spanish; the UI is in Spanish). A web app served by his Mac and the same app wrapped for Android (Samsung S23) with Capacitor. Modelled on `buffalonan/german-learning`: no framework, no build step, every merge to `main` releases the APK and the Mac's image.

**Roadmap** (proposal doc: https://claude.ai/artifact/91xtGjZy26UdwRYwkTv3kG):
1. Skeleton and releases: quick session log, history, sync with the Mac, JSON backups (this phase).
2. Flexibility: the 6-month plan (6 phases, tests, daily checklist) with the animated SVG figures (v2 prototype in `prototypes/animaciones/`; Lottie and 3D are kept for later).
3. Gym: sets, reps and weights, rest timer, repeat last session, history per exercise, records.
4. Progress charts. Possibly importing heart rate and kcal from his Coros watch.

**Workout UX (Ferran's requirement):** home is a list of workouts as cards; tapping one shows its exercises (animation, dose, cues) and a start button. Each workout shows a body mannequin, front and back, modelled on the Coros app: grey silhouettes on a dark panel, worked muscles in red, stronger with more sets, each with a dotted leader label ("9 series"), and stats below (series, tiempo, FC media, kcal, carga). Exercises carry their primary and secondary muscles; a workout's map is the sum of its exercises'.

## Layout

| Path | What it is |
| --- | --- |
| `web/` | The app: `index.html` (markup), `styles.css` (tokens on `:root`, light and dark), `app.js` (screens and UI), `store.js` (IndexedDB), `sync.js` (sync with the Mac), `icon.svg`, `manifest.webmanifest`. ES modules, no build step. |
| `server/` | `server.js` (Node `http`, no npm packages: serves `web/` and the API), `db.js` (SQLite via `node:sqlite`), `backup.js` (weekly copies), `server.test.js` (`node --test`). Needs Node 24. |
| `Dockerfile`, `docker-compose.yml`, `.env.example` | The Mac's container: image `ghcr.io/buffalonan/flex-and-fit`, port 3334, data in the volume `flexfit-data`, backups bind-mounted at `/backups/local` and `/backups/drive`. |
| `scripts/mac/` | `install.sh` (sets up `~/flex-and-fit` on the Mac, writes `.env`, starts the container, installs the hourly launchd job) and `update.sh` (that job: `docker compose pull && up -d`). |
| `scripts/build-app-web.js` | Copies `web/` into `www/` for the app (adding `capacitor.js`) or, with `--web`, elsewhere for Docker and Pages. Writes `APP_VERSION` into `<meta name="app-version">`. |
| `scripts/build-icons.js` | Draws the Android launcher icons and splash screens from `web/icon.svg` with Playwright's Chromium. |
| `android/` | Capacitor's Android project, app id `io.github.buffalonan.flexandfit`. Hand-edited only in `app/build.gradle` (version and signing from env vars, key alias `flexandfit`) and `AndroidManifest.xml` (`usesCleartextTraffic`, see below). |
| `tests/` | Playwright tests against the real server, desktop and Pixel 7 sizes, with a fresh database per run. |
| `android-tests/` | Emulator smoke test of the real app, only in CI (`android.yml`). |
| `prototypes/animaciones/` | Archived animation prototypes (SVG, Lottie, 3D). Not served, not linted. |

## How it works

- **Records:** every piece of data is a record `{ tabla, id, data, actualizado, borrado }`. Tables: `ejercicios`, `sesiones`, `series`, `tests`, `rutinas`, `ajustes` (the server refuses others; add new ones in `server/db.js` `TABLAS`). Ids are UUIDs, or stable ids such as `plan-<fecha>` and `fase-<n>` for imported plan data. Deleting sets `borrado` so the delete syncs.
- **Local first:** `store.js` keeps records in IndexedDB (`flexfit` database, stores `registros` and `meta`). A local write sets `pendiente: 1`. `store.onChange` re-renders and schedules a sync 1.5 s later.
- **Sync** (`sync.js`, `POST /api/sync`): the device sends its pending records and `desde` (the last server `seq` it saw); the server applies them (newest `actualizado` wins, a tie keeps the server's) and returns everything with `seq > desde`, in pages of 5000 (`mas: true` means ask again). The device clears `pendiente` only on records not edited again meanwhile, applies what came back with the same rule, and stores the new `seq`. Syncs run on start, after changes, every 5 minutes, when the browser comes online and when the app resumes. `SYNC_TOKEN`, if set on the server, must be sent as `Authorization: Bearer`.
- **Where the server is:** the web served by the Mac uses its own origin; the Android app has no default and the address is typed once in Ajustes (kept only in the phone's `localStorage`); the Pages demo has none, hides the server card and keeps data in the browser. **Never commit the owner's host names, Tailscale IPs, ports of other services or personal paths:** the repo and the Pages demo are public.
- **Android and plain HTTP:** the app's WebView origin is `https://localhost`, so `CapacitorHttp` is enabled in `capacitor.config.json` to send `fetch` natively, and the manifest allows cleartext. Tailscale encrypts the traffic.
- **Backups:** the server checks every hour and writes `flexfit-YYYY-MM-DD.db` (`VACUUM INTO`) into each `BACKUP_DIRS` folder whose newest copy is 7+ days old, keeping 12. On the Mac these are `~/Documents/fitness-backups/weekly` and Google Drive's `Backups/Fitness`. JSON export/import in Ajustes covers every record; import also takes the JSON copied from the 6-month flexibility plan artifact (`plan: "flexibilidad-6m-v1"`).
- **UI:** three tabs (Hoy, Historial, Ajustes) at the bottom; the sync pill at the top shows Sincronizado, "N sin subir", "Sin conexión con el Mac" or "Solo en este dispositivo". `renderSync` drops overlapping renders so a stale read never wins. Settings live in `localStorage` under `flexfit.ajustes` (`servidor`, `token`, `tema`, `tab`), always in try/catch. Android Back goes to Hoy, and closes the app from Hoy.

## Rules

- **Write markup only through the `html` tagged template** in `app.js`; it escapes every value. ESLint's `no-unsanitized` fails CI otherwise. Notes and imported JSON are user input.
- Elements are shown and hidden with `el.hidden` (the `[hidden]` rule in `styles.css` makes that work).
- Colours are CSS variables on `:root`, redefined for dark mode. Tap targets are at least 44px. The page must fit a phone without sideways scrolling (a test checks every tab).
- Exercise instructions must be safe and correct: tension, never pain; no bouncing.
- New or changed behaviour needs a test (`tests/` for the app, `server/server.test.js` for the server). Never skip or delete a test to get CI green.
- The server has no npm dependencies on purpose; keep it that way unless there's a strong reason.

## Commands

```sh
npm ci
npm run serve                     # http://localhost:3334, data in ./data
npm test                          # server tests + Playwright
npx eslint . --max-warnings 0
npm run app:sync                  # web → Android project
```

In Claude's cloud sessions use Node 24 (`export PATH=/opt/node24/bin:$PATH`) and `PW_CHROMIUM=/opt/pw-browsers/chromium` for Playwright's browser.

## CI and workflow

- Work on a branch and open a PR into `main`. Don't push to `main` directly.
- `tests.yml`: ESLint, server tests, Playwright. `security.yml`: npm audit, signatures, gitleaks (weekly too). `codeql.yml` and dependency review (public repo). `claude-review.yml`: Claude reviews each PR once (`@claude review` for another look).
- `android.yml`: Android Lint, emulator smoke test, APK on every PR (artifact) and on `main` the release `app-v1.<run>` with `flex-and-fit.apk`, signed with `ANDROID_KEYSTORE_BASE64`/`ANDROID_KEYSTORE_PASSWORD` or a one-off key if missing.
- `docker.yml`: builds the image for arm64 (the Mac is Apple Silicon, Docker via colima) and amd64; on `main` pushes `:latest` and `:1.<run>` to ghcr.io. The package must be public for the Mac to pull it without logging in.
- `pages.yml`: the demo on GitHub Pages.
