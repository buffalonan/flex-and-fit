# Review guide

What reviewers (human or Claude) should check on pull requests in this repo. Read AGENTS.md first: it says how sync, the sub-path, the releases and the figures work. Each rule below comes from something that already went wrong here or in `buffalonan/german-learning`.

## Blocking

### Privacy (the repo and the Pages demo are public)

- **The owner's host names, Tailscale or LAN IPs, ports of other services on the Mac, personal paths** (`/Users/<name>/…`, `~/Documents/<real folder>`), e-mail addresses or real health data, anywhere: code, tests, fixtures, docs, comments, screenshots, workflow files, commit messages. Placeholders like `<mac>`, `100.x.y.z` or `example.local` are fine. Server addresses must come from the user (Perfil), Bonjour or the server's `DIRECCIONES` env at run time, never from a default in the code.
- **Secrets** committed to the repo (`.env`, keystores, tokens), or a workflow that prints one.
- **Health data leaving the user's devices.** Workouts, heart rate and calories may go only to the user's own Mac through `/api/sync`. No analytics, no third-party requests, no CDN at run time (the APK must work offline: libraries are vendored in `web/vendor/`). Health Connect permissions must stay read-only and limited to what the app shows.

### Data

- **Lost or corrupted records.** Anything that could drop a record, skip it in sync, let an older edit overwrite a newer one (newest `actualizado` wins, a tie keeps the server's), clear `pendiente` on a record edited again meanwhile, or delete a row instead of setting `borrado`. A new table must be added to `TABLAS` in `server/db.js` or the server refuses it.
- **Changed ids.** Plan sessions are `sesiones/plan-<fecha>` and tests `tests/fase-<n>`, so the plan's JSON import and the app write the same record. Changing an id format, a table name or a field that old records already have, without reading the old shape too, loses Ferran's history.
- **Backups broken:** the weekly `VACUUM INTO` copies, the number kept, or JSON export/import no longer covering every table.

### Security

- **Unsafe HTML.** Markup must be built with the `html` tagged template. Flag any `innerHTML`, `outerHTML` or `insertAdjacentHTML` fed by a plain string, and any `eval` or `new Function`. Notes, imported JSON and data from Health Connect are user input.
- **Server exposure.** Static files served from outside `web/` (path traversal), the sync API accepting unchecked tables, ids or sizes, or a `SYNC_TOKEN` check that can be bypassed.
- **A new npm dependency in `server/`.** The server has none on purpose.
- **Workflow risks:** `pull_request_target`, untrusted PR text interpolated into `run:` (`${{ github.event.* }}` inside a shell script), wider `permissions:` than the job needs, actions pinned to a branch instead of a tag, or the Claude review rules read from the PR branch instead of the base branch.

### Things that break the release (every merge to `main` ships)

- **Absolute URLs in `web/`** (`"/api/…"`, `"/app.js"`, `location.origin` as the server). The Mac serves the app under `/fitness/` behind a proxy that strips the prefix, so every URL must be relative and the server is `new URL(".", location.href)`.
- **Android:** changes to the app id, the signing setup or the key alias, a manifest change that drops `usesCleartextTraffic`, or code that only works in a desktop browser (the WebView origin is `https://localhost` and `fetch` goes through `CapacitorHttp`). New Capacitor plugins must be registered in `MainActivity.java`.
- **Docker:** an image that no longer builds for arm64 (the Mac is Apple Silicon), a changed port, volume or `BACKUP_DIRS`, or a change that would make the Mac's hourly `update.sh` fail.
- **Mac scripts** (`scripts/mac/`) that assume tools on the default `PATH` (docker lives in `~/.local/bin`), or that overwrite the user's `.env` values.

### Exercises

- **Unsafe or wrong instructions:** anything that pushes into pain, bouncing, holding the breath under load, or a risky position without a safer option. Tension, never pain. Doses must be ones a coach would give (sets, reps, seconds, rest).
- **Wrong muscles** on an exercise (`p`/`s`): the mannequin and the volume are built from them.
- **A strength exercise without a figure:** it needs an entry in both `G` (`figura.js`) and `FIG_FUERZA` (`datos.js`).
- **Copied third-party assets:** COROS images, icons or 3D models, or a figure or template presented as a brand's own. Professional templates must link their source (`fuente`).

### Tests

- **New or changed behaviour without a test** (`tests/` for the app, `server/server.test.js` for the server, `android-tests/` for native code where it can run on the emulator).
- **A test skipped, deleted or weakened** to get CI green.
- **Tests that depend on real time or the real network:** they must fake the clock (`page.clock`, with `fastForward`, not `runFor`) and wait for elements instead of fixed sleeps. WebGL stays off unless the test asks for it.

### Phone

- **Layout broken:** content wider than the screen (a test checks every tab), tap targets under 44px, or text cut off at the Pixel 7 size.
- **Android Back** no longer closing panels and sheets, or leaving a session without asking.
- **Number fields:** the kg field must accept negative values (assisted pull-ups), so no `min` and no `inputmode="decimal"`.

## Worth a suggestion

- Copy that's unclear or not in natural Spanish (Spain), or a term that doesn't match the rest of the app (series, repeticiones, descanso, entreno).
- AGENTS.md not updated when the PR changes how something works.
- Slow paths on the phone: large re-renders, too many IndexedDB transactions, a WebGL canvas or animation frame left running when its screen is closed.
- Colours outside the CSS variables on `:root`, elements shown or hidden with `style.display` instead of `el.hidden`, `localStorage` without try/catch.

## Not worth commenting on

- Formatting or style the linter doesn't flag.
- Restating what the diff does.
- Vendored code (`web/vendor/`), archived prototypes (`prototypes/`), generated files (`package-lock.json`, Android launcher icons) or binary files.
