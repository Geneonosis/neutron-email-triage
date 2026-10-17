# neutron-email-triage

Jev-first email classification for Proton Mail via Proton Mail Bridge. This
independent React + TypeScript + Electron application also provides a CLI. The
React renderer is bundled with Vite; Electron and CLI TypeScript are compiled
into `dist/`.

Neutron Email Triage is an independent, unofficial project and is not
affiliated with or endorsed by Proton AG or TypeSafe AI.

## CLI contract (source of truth)

All GUI actions are backed by these CLI commands:

- `npm run run -- [flags]` — triage run (dry-run by default)
- `npm run scan -- [flags]` — alias of run
- `npm run history` — recent decision log entries
- `npm run health` — environment/config health checks
- `npm run config` — runtime config (secrets masked)
- `npm run move -- --uid <uid> --destination <trash|archive>` — move one inbox message

Common flags for `run`/`scan`:

- `--limit <n|all>`
- `--offset <n>`
- `--include-body`
- `--unreadonly`
- `--reclassify`
- `--execute --trash-threshold <0.9..1.0>`
- `--json`

## GUI (Electron MVP)

Build the TypeScript sources and run:

```powershell
npm install
npm run build
npm run electron
```

To build a Windows x64 installer, run:

```powershell
npm run dist:win
```

The NSIS installer is written to `release/` as
`Neutron Email Triage-<version>-Setup.exe`. It installs per-user by default and offers
a custom installation-directory option. The packaged app stores decision
history in the user's application data directory rather than inside the
read-only application bundle. Proton Mail Bridge and TypeSafe API credentials
must be configured separately on each computer.

The CLI and Electron entry points run from the generated `dist/` directory.
Use `npm test` to build and run the test suite.

Storybook stories and browser interaction tests are available with:

```powershell
npx playwright install chromium
npm run test:storybook
```

The Storybook test command runs the interaction tests in Chromium without
starting the Storybook UI. Use `npm run storybook` to browse components.
`npm run test:all` runs the build, Jest tests, Node tests, and Storybook tests.
Each component lives in its own folder under `renderer/components`; Jest tests
are colocated in that folder's `__tests__` directory.

To build a Windows x64 installer, run:

```powershell
npm run dist:win
```

The NSIS installer is written to `release/` as
`Neutron Email Triage-<version>-Setup.exe`. It installs per-user by default and offers
a custom installation-directory option. The packaged app stores decision
history in the user's application data directory rather than inside the
read-only application bundle. Proton Mail Bridge and TypeSafe API credentials
must be configured separately on each computer.

GUI surfaces:

- Health panel -> `health --json`
- Config panel -> `config --json`
- Run panel -> `run ... --json`
- History table -> `history --limit N --json`

Health, config, and history share handlers with the CLI. Runs use an isolated
worker process. Electron launches its executable with `ELECTRON_RUN_AS_NODE=1`
so it runs the worker as Node, rather than opening another Electron app.
`--json` returns one JSON response; diagnostics go to stderr. Failures return a
nonzero exit code and an error response or a run summary with failure counts.
The desktop worker has a five-minute limit and is stopped if it exceeds that
limit. A stopped run may have partially processed mail; review history before
retrying.

The Health, Config, and Run panels each offer a human-readable **Rich UI** view
alongside the corresponding JSON output. In Run, both tabs show the same result
without rerunning the scan. Each recommendation includes the message date,
subject, sender, confidence, Jev decision, and action status. Action status is
shown as **Pending Decision** until a move is recorded. Trash and archive
actions are confirmed individually and do not require rerunning the scan; JSON
output can be copied to the clipboard.

## Safety

- Dry-run is default
- `--execute` requires `--trash-threshold >= 0.9`
- Per-message trash/archive actions require individual confirmation
- Decision log is local (`decisions.jsonl`)

## Setup

Requires Node 20+, Proton Mail Bridge running/sign-in, TypeSafe API key.

```powershell
npm install
npm run health
npm run run
```

## Scripts

- `npm run run`
- `npm run scan`
- `npm run health`
- `npm run config`
- `npm run history`
- `npm run electron`
- `npm test`
- `npm run test:storybook` (requires Playwright Chromium; install with `npx playwright install chromium`)
- `npm run test:all`

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
