# Review guide

What reviewers (human or Claude) should check on pull requests in this repo.

## Blocking

- **Lost or corrupted data.** Anything that could drop a record, skip it in sync, let an older edit overwrite a newer one, or break the weekly backups. The sync rules are in AGENTS.md.
- **Unsafe HTML.** Markup must be built with the `html` tagged template. Flag any `innerHTML`, `outerHTML` or `insertAdjacentHTML` fed by a plain string, and any `eval` or `new Function`.
- **Server exposure.** Static files served from outside `web/`, the sync API accepting unchecked input, or a token check that can be bypassed.
- **Unsafe exercise instructions:** anything that pushes into pain, bouncing, or a risky position without a safer option.
- **New or changed behaviour without a test.**
- **Secrets or personal data** committed to the repo (including `.env`).
- **Phone layout broken:** content wider than the screen, or controls too small to tap.

## Worth a suggestion

- Copy that's unclear or not in natural Spanish.
- Slow paths on the phone (large re-renders, too many IndexedDB transactions).

## Not worth commenting on

- Formatting or style the linter doesn't flag.
- Restating what the diff does.
