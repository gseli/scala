# CLAUDE.md

Drum practice app (React + Vite + TS) that reads a Roland TD-07 over Web MIDI and scores timing per hit.
**Read `docs/VISION.md` first.** It decides priorities, design language and non-goals.

## Commands

- `npm run dev`: open http://localhost:5173 in **Chrome** (Web MIDI is Chrome-only)
- `npm test`: Vitest, run once
- `npm run build`: `tsc --noEmit` + Vite build

Before saying a change is done, run `npm test && npm run build` and report the result honestly.

## How we work

- The user is learning professional AI-assisted development. **Explain the why** behind choices as you go, briefly.
- Plan first for anything non-trivial; wait for approval before implementing.
- Work on a branch, never on `main`. Changes land through a PR.
- Commit or push only when asked. **No `Co-Authored-By: Claude` trailers** in commits.
- Ask before adding any dependency (non-goal: heavy deps).

## Code constraints

- Timing is the product. Schedule audio on the `AudioContext` clock (`src/audio/`), never with `setTimeout`.
  MIDI and keyboard events use `performance.now()`; convert with `contextToPerfOffset`.
- TD-07 note numbers live in `src/midi/padMap.ts`. Feet (36 kick, 44 hh pedal) are excluded from hand exercises.
- Pattern DSL: `src/rudiments/dsl.ts` (PPQ 48). It only models R/L hands today; kit pieces need an extension.
- Persistence is localStorage via `src/store/persist.ts`. No backend, no accounts.
- Every new piece of logic gets a `*.test.ts` next to it.

## Conventions

- UI text is Spanish today and is moving to i18n (es default, en). Code and comments are in English.
- UI follows the «estudio de noche» language in VISION.md:
  - Never use colour alone; pair it with a shape or a word.
  - Respect `prefers-reduced-motion`.
  - No hit flashes; the ambient background never reacts to the beat.
  - No points, streaks or unlocks.
- Pad navigation: Tom 1 / Tom 2 move, snare selects, crash goes back. Keyboard must also work.

## Learned from corrections

<!-- Add one line each time the user corrects something. Keep this file under ~60 lines. -->
