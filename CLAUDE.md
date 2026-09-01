# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run preview  # Preview production build
npm run check    # Dependency health report (audit + outdated, prod vs dev)
npm run serve    # Rebuild dist/ and make sure the local server is up (see below)
npx vitest run   # Run the test suite once (`npm test` starts watch mode)
```

### Voir une modification dans TraCflux local

The user tests in the installed PWA at `http://localhost:4173`, not in the dev
server. That origin is served by `vite preview` from `dist/`, so a source change
is invisible until `dist/` is rebuilt — the PWA would keep showing the cached
build indefinitely.

**After any change to `src/`, `index.html`, `public/` or `vite.config.js`, run
`npm run serve` before reporting the work as testable**, then tell the user to
press Ctrl+R in the TraCflux window and click « Recharger » on the banner.

`npm run serve` rebuilds and starts `vite preview` only if port 4173 is free —
an already running server picks up the new build on its own (sirv re-reads from
disk on every request), and `preview.strictPort` would make a second one fail.
The server is detached: it survives the session that started it, so in practice
it only starts on the first run after a reboot.

The « Recharger » banner appears when the service worker re-checks for a new
version — on page load, or once an hour ([ReloadPrompt.jsx](src/components/ReloadPrompt.jsx)).
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

Traffic light intersection diagram tool built with React + Vite.

### State Management

All application state is centralized in `src/hooks/useTrafficLight.js`:
- Groups (traffic light phases), cycle length, intersection name
- Conflict matrix (intergreen times between groups)
- Computed conflicts (validates timing constraints)
- Action table data
- Auto-saves to localStorage, with named project save/load

### Key Data Structures

**Group** - A traffic light phase:
```js
{
  id, name, type: 'VL'|'TC'|'Cycliste'|'Piéton',
  minGreen, offset,
  durations: { green, orange, red }
}
```

**Conflict Matrix** - 2D array where `matrix[from][to]` = minimum intergreen time (seconds) required between end of group `from` green and start of group `to` green.

### Component Layout

```
App.jsx
├── Header (intersection name, group count, cycle length, zoom slider)
├── Sidebar (tabbed: Projects | Configuration | Traffic)
│   ├── GroupTable - edit group timing parameters
│   ├── IntergreenMatrix - edit conflict matrix
│   ├── TrafficTable - traffic engineering data
│   └── ProjectManager - save/load projects
└── Diagram Area
    ├── TimelineDiagram - horizontal timeline showing phases
    └── ActionTable - action sequence table
```

### Timeline Rendering

`TimelineDiagram.jsx` renders phases horizontally:
- Time window = cycle length
- Width = `cycleLength * pixelsPerSecond`
- Phase bars positioned with `left` CSS property
- Ruler ticks at 5-second intervals
- Playhead shows current global time

### Conflict Detection

In `useTrafficLight.js`, the `conflicts` memo calculates violations:
- For each non-zero matrix entry `matrix[from][to]`
- Computes actual gap between end of `from` green and start of `to` green
- If actual gap < required intergreen time, adds to conflicts list
