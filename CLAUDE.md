# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run preview  # Preview production build
npm run preview:deploy  # Build and deploy the current feature branch to Surge
npm run check    # Dependency health report (audit + outdated, prod vs dev)
npm run serve    # Rebuild dist/ and make sure the local server is up (see below)
npx vitest run   # Run the test suite once (`npm test` starts watch mode)
```

### Delivery workflow

Never commit or push feature work directly to `master`: every push to that
branch deploys the public application through GitHub Pages.

For each change:

1. Work on an isolated `feature/*`, `fix/*` or `chore/*` branch, preferably in
   a dedicated Git worktree.
2. Run the type check, tests and production build.
3. Deploy the branch with `npm run preview:deploy`. The script refuses to run
   on `master` or `main` and publishes a stable URL derived from the branch
   name, such as `https://tracflux-feature-example.surge.sh`.
4. Send that URL to the user and wait for explicit validation.
5. Only after validation, merge the pull request into `master`.

The deployment command expects `SURGE_LOGIN` and `SURGE_TOKEN` in the runtime
environment. Never write those values to the repository, command line, logs or
conversation. Set `TRACFLUX_PREVIEW_DOMAIN` only when a custom preview domain
is needed.

### Voir une modification dans TraCflux local

The user tests in the installed PWA at `http://localhost:4173`, not in the dev
server. That origin is served by `vite preview` from `dist/`, so a source change
is invisible until `dist/` is rebuilt — the PWA would keep showing the cached
build indefinitely.

**After any change to `src/`, `index.html`, `public/` or `vite.config.ts`, run
`npm run serve` before reporting the work as testable**, then tell the user to
press Ctrl+R in the TraCflux window and click « Recharger » on the banner.

`npm run serve` rebuilds and starts `vite preview` only if port 4173 is free —
an already running server picks up the new build on its own (sirv re-reads from
disk on every request), and `preview.strictPort` would make a second one fail.

The server is launched **outside the current process tree**, through WMI
(`Win32_Process.Create`), so its parent is `WmiPrvSE.exe` and it belongs to no
terminal job object. `detached: true` alone was not enough on Windows: the
process was orphaned from its launcher but stayed inside the job, and Windows
kills a whole job at once when it closes — on 2026-09-11 the server vanished
mid-session that way, with nothing having stopped it.

**`npm run serve` now proves its own claim**: before printing anything
reassuring it fetches `/index.html` from the server and compares it byte for
byte with `dist/index.html`. If they differ — server down, or a stale process
squatting the port — it exits 1 and says so. A green run is therefore
trustworthy; do not pipe its output through `tail -1`, which hides the verdict.

The « Recharger » banner appears when the service worker re-checks for a new
version — on page load, or once an hour ([ReloadPrompt.tsx](src/components/ReloadPrompt.tsx)).
Leaving the window open is therefore not enough: Ctrl+R is what triggers it.
The diagnostic report's build date is the only reliable check for a stale bundle.

Never suggest testing in `npm run dev` (port 3000) as an equivalent: no service
worker there, and it is a distinct origin with its own localStorage.

### Dependency hygiene

Run `npm run check` at the start of any session resuming work after a gap, and
report the result before doing anything else. The project goes weeks between
sessions and new advisories accumulate silently — six appeared in three weeks
during the July/August 2026 break, none caused by a code change here.

The report separates vulnerabilities that reach the browser from those confined
to the build/test toolchain; only the former are urgent. `npm audit fix` plus
`npm update` handles everything inside the existing semver ranges. `xlsx` has a
standing high-severity advisory with no upstream fix — it is a known, tracked
item, not a new finding.

## Architecture

Traffic signal timing tool (« diagramme de feux ») built with React 18,
TypeScript (strict) and Vite, shipped as an installable PWA. All application
code is `.ts` / `.tsx`; part of the tests are still `.js` / `.jsx`
(`allowJs`, `checkJs: false`). Identifiers and comments mix English and
French: the business vocabulary (plan de feu, groupe, temps interverts,
escamotage, adaptatif…) stays in French.

### Entry points

`src/main.tsx` wraps everything in `ConfirmProvider` and
`MicroVariablesProvider`, then renders:
- `App.tsx` — the intersection editor (default);
- `GreenWavePage.tsx` — the green wave (« onde verte ») editor, when the URL
  carries `?greenwave`. It reads intersections saved by the editor.

`ReloadPrompt` (service worker update banner) is mounted on both.

### Data model

The persisted contract lives in `src/types/projet.ts`; any field added to a
saved project must be declared there. Main types:

- **`Groupe`** — one signal group, one row of the diagram:
  `{ id, name, type, minGreen, offset, durations: { green, orange, red }, … }`
  plus optional comment and traffic fields. `type` is `'VL'`, `'TC'`,
  `'P'`/`'Piéton'`, `'CY'`/`'Cycliste'`, `'FL'`, `'PP'`…
- **`Matrice`** — intergreen matrix (« temps interverts »):
  `matrice[from][to]` = minimum time in seconds between the end of `from`'s
  green and the start of `to`'s green. A cell is a number or `''` (no
  constraint).
- **`PlanDeFeu`** (PF) — one timing plan, shown as a tab: its micro-regulation
  action table (`data: ActionMicro[]`), its diagram (`LigneDiagramme[]`),
  optionally its own matrix and cycle, remarks, simulation scenario, phasing
  bubble settings. Up to `MAX_PF` plans per project.
- **`ActionMicro`** — one row of the action table (« Seconde lucarne »,
  « Escamotage », « Flèche d'anticipation », « Adaptatif vertical »…), with
  `gf` (group), `deb` / `fin` (seconds in the cycle) and action-specific fields.
- **`Projet`** — the whole saved file: groups, matrix, `pfTabs`, intersection
  image and arrows, traffic datasets (HPM, HPS, HC…), properties, layout
  options (`OptionsMiseEnPage`).

`src/types/greenWave.ts` holds the green wave model.

### State management

`src/hooks/useTrafficLight.ts` is the single source of truth for the project
(about 3,000 lines): groups, cycle, matrix, plans and active plan, action
table, traffic datasets, image, properties, undo/redo history (50 steps),
computed `conflicts`, save/load (`getFullState` / `loadFullState`) and
autosave. `utils/pfHelpers.ts` holds the plan helpers it relies on
(`createEmptyPF`, `ensurePFIntegrity`, `buildDiagramFromGroups`…).

`App.tsx` (also about 3,000 lines) calls `useTrafficLight` and composes the UI
state from smaller hooks in `src/hooks/`: `useFileOperations` (open/save
through the File System Access API), `useImportOperations` (Diagfeux, Excel,
HTM), `useUILayout`, `useDialogState`, `useSimulationUI`, `usePhasageBulleUI`,
`useProjectModification` (the « * » dirty flag), and the `useFloating*` hooks
(each detachable panel). `usePopupWindow` renders a panel into a separate
browser window and remembers its position per screen.

Both files are known to be too large; when touching them, prefer extracting
a cohesive piece into a hook or a `utils/` module over growing them.

### Persistence

- **Files** — projects are saved as JSON through the File System Access API
  (`useFileOperations`, `writeFileHandle`, `useDirectoryHandles`); `dossierLock`
  stamps exported projects as read-only (a convention, not a protection).
- **Browser cache** — every project is autosaved to `localStorage` under
  `traffic_project_<name>` (+ `_backup`), ordered by `traffic_project_order`;
  this feeds « Restaurer un projet récent ». UI preferences (floating panel
  visibility, tooltips, toasts, window positions…) are also in `localStorage`;
  they belong to the workstation, not to the project.
- `projectValidator` checks and repairs loaded files; old formats are
  normalised on load (see `ProjetEnregistre` in `useTrafficLight.ts`).

### Component layout

```
App.tsx
├── MenuBar, LoginModal
├── WelcomeScreen                       (no project open)
├── ProjectHeader                       (name, group count, undo/redo, plan, account)
├── WorkspaceSidebar                    (components/app/)
│   ├── GroupTable        — group timing parameters
│   ├── IntergreenMatrix  — intergreen matrix
│   ├── TrafficTable      — traffic volumes and capacity
│   ├── ConflictList, DiagnosticPanel
│   ├── SimulationPanel
│   └── PropertiesPanel
├── WorkspaceMain                       (components/app/)
│   ├── TimelineDiagram   — the timing diagram (components/timeline/)
│   ├── ActionTable       — micro-regulation actions of the active plan
│   ├── IntersectionImage — intersection photo with group arrows
│   └── PhasageBulle      — phasing bubble diagram
└── Dialogs: ProjectOpenDialog, DiagramEditDialogs, ImportDialogs,
    GreenWaveDialogs, DossierPrintDialog, PrintPreviewModal, SupportDialogs…
```

`components/timeline/` splits the diagram into header, sidebar, rows, grid,
drag handling (`useTimelineDrag`), geometry (`timelineGeometry`) and the
`incrustations/` overlays (arrows and bars drawn for each action type).

### Timeline rendering

`TimelineDiagram.tsx` draws the plan horizontally over one cycle: width =
`cycleLength * pixelsPerSecond`, phase bars positioned with `left`, ruler ticks
every 5 s, a playhead at the current time. Actions of the active plan add
overlays; in simulation mode the simulated diagram replaces the original one.

### Conflict detection

The `conflicts` memo in `useTrafficLight.ts` checks every non-empty
`matrice[from][to]`: if the actual gap between the end of `from`'s green and
the start of `to`'s green (modulo the cycle) is below the required intergreen,
it records a conflict. It accounts for « Seconde lucarne » (extra green
windows), « Escamotage » between the two groups (managed overlap) and
« Flèche d'anticipation » (timings replaced by the arrow's).
`utils/conflictUtils.ts` provides the shared types and helpers;
`utils/matrixDelayConflict.ts` and `utils/diagnostics.ts` add further checks.

### Simulation

`src/simulation/` computes the diagram as it would run once selected actions
apply (`calculateSimulatedDiagram`). Each action type is one operation in
`simulation/operations/` (adaptatif vertical, escamotage de phase / de groupe,
fermeture / ouverture anticipée, point de repos), applied in order on a shared
`EtatSimulation` with a journal of time contractions (`journal.ts`).
`conflitsSimules` re-runs conflict detection on the simulated diagram.

### Other modules

- `GreenWavePage.tsx` + `components/greenwave/`, `utils/greenWave*.ts` —
  green wave editor, bandwidth computation, print.
- `utils/excelImporter.ts`, `diagfeuxImporter.ts`, `parseHTMFile.ts` — imports.
- `utils/exportHelpers.ts`, `ongletImpression.ts` — PNG/PDF export and printing
  in a separate tab.
- `utils/capacityCalc.ts`, `trafficHelpers.ts` — capacity and traffic.

### Tests

Vitest + Testing Library in jsdom; tests sit next to the code they cover
(`*.test.js|jsx|ts|tsx`), shared setup in `src/tests/setup.js`. Coverage
floors are set in `vite.config.ts` (`test.coverage.thresholds`): raise them
when coverage grows, never lower them. CI (`.github/workflows/test.yml`) runs
`npm run types`, `npm run test:coverage` and `npm run build` on pushes and
pull requests targeting `master`.
