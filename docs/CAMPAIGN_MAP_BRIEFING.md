# Campaign star-map — implementation briefing

Replace the flat mission list with a navigable **star chart**: missions are star
systems you jump between, each unlocked only by clearing the previous one, plus a
few **optional bonus systems** off the main lane. A sibling game ("pirates",
derived from this codebase) already shipped this exact pattern — this briefing
mirrors it onto honorverse.

Develop on branch `claude/pirates-from-honorverse-qi2oot`.

## Current state (already in the repo)

- `src/data/missions/index.ts` exports `SCENARIOS: Record<string, Scenario>` (11 missions).
- `src/main.ts` has `showMissionSelect()` rendering a flat `.mission-row` list, an
  intro (`showCampaignIntro`), a remote leaderboard ("Síň slávy"), and a bootstrap tail:
  ```ts
  if (requested && SCENARIOS[requested]) bridge.start(requested)
  else if (!introSeen()) showCampaignIntro(showMissionSelect)
  else showMissionSelect()
  ```
- Missions use a trigger system; a win sets `state.outcome === 'win'`, handled in `showOutcome`.
- Persistence today: only `wob-campaign-intro-seen` and the nickname/email for the
  leaderboard. **There is no local "cleared missions" store — this is the one new
  piece to add.**

## Build it as ~3 small PRs

### 1. Data + persistence + URL guard (no visual change yet)

- New `src/data/campaign.ts`:
  ```ts
  export interface CampaignNode { id: string; x: number; y: number; requires?: string; optional?: boolean }
  export const CAMPAIGN_NODES: CampaignNode[] = [
    { id: 'mission01', x: 90, y: 500 },
    { id: 'mission02', x: 210, y: 430, requires: 'mission01' },
    // … the main lane winds across a 1000×600 chart; each `requires` = previous mission id …
    { id: 'mission11', x: 920, y: 80, requires: 'mission10' },
    // optional bonus systems — nothing points back at them, so they never block progress:
    { id: 'side01', x: 330, y: 430, requires: 'mission02', optional: true },
    { id: 'side02', x: 640, y: 380, requires: 'mission05', optional: true },
  ]
  export const STARFIELD: { x: number; y: number; r: number }[] = [ /* decorative nebulae / planets */ ]

  export function isMissionUnlocked(id: string, cleared: readonly string[]): boolean {
    const n = CAMPAIGN_NODES.find(n => n.id === id)
    return !!n && (!n.requires || cleared.includes(n.requires))
  }
  ```
- In `main.ts`, add a local cleared store using the `wob-` key convention:
  ```ts
  const CLEARED_KEY = 'wob-cleared'
  function loadCleared(): string[] { try { return JSON.parse(localStorage.getItem(CLEARED_KEY) ?? '[]') } catch { return [] } }
  function markCleared(id: string): void {
    const s = new Set(loadCleared()); s.add(id)
    try { localStorage.setItem(CLEARED_KEY, JSON.stringify([...s])) } catch { /* noop */ }
  }
  ```
- Call `markCleared(currentMissionId)` in `showOutcome` on a win (alongside the leaderboard submit).
- Gate the bootstrap so a bookmarked / hand-edited `?mission=` can't skip the lane:
  ```ts
  const cleared = loadCleared()
  if (requested && SCENARIOS[requested] && isMissionUnlocked(requested, cleared)) bridge.start(requested)
  else if (!introSeen()) showCampaignIntro(showStarMap)
  else showStarMap()
  ```

### 2. The star chart — replace `showMissionSelect()` with `showStarMap()` (the headline change)

Build an SVG (`viewBox="0 0 1000 600"`) with three layers:

- **Hyperlane routes** — a `<line>` from each node to its `requires` node, classed
  `done` / `open` / `locked` by cleared/available state (solid cleared, dashed
  available, dim locked). Bonus routes get an extra dashed/amber style.
- **System nodes** — a `<g>` per node: a circle + a badge (`✔` cleared, the
  main-mission number, or `★` for a bonus) + the mission title. Add
  `data-mission="<id>"` **only** when unlocked, so taps on locked systems do
  nothing. Number **only** non-optional nodes (`n.optional ? '★' : ++mainNo`).
- **"You are here" marker** — a ship glyph over the first uncleared-but-available
  node (`CAMPAIGN_NODES.find(n => !cleared.has(n.id) && avail(n))`), so the player
  always sees where to jump next.

Wire clicks: `el.querySelectorAll('g[data-mission]')` → `bridge.start(id)`. Add CSS
with a **space skin**: dark radial starfield gradient background, scattered star
dots, 1–2 soft nebula ellipses; hyperlanes = thin glowing cyan dashed lines;
system nodes = small glowing circles (green cleared, cyan available, dim grey
locked, amber ★ bonus). Keep the desktop layout otherwise intact — the map *is*
the menu.

### 3. Bonus missions

Author two optional `Scenario` files (`src/data/missions/side01.ts`, `side02.ts`)
with the existing trigger vocabulary (`winMission` / `loseMission`,
`objectiveComplete` / `objectiveFail`, `shipDestroyed` / `shipSurrendered`,
`setFlag` / `flag` / `flagNot`, `time`, `distanceBelow`, …). Each self-contained
and numerically stable when ticked ~250 s. Register them in `missions/index.ts`,
add `optional: true` nodes to `campaign.ts` (each with a `requires` pointing at a
main mission), and give them a scene image if honorverse has a per-mission scene
map. Theme: **side ops** — a distress call, a pirate cache, a recon jump — flagged
★ on the chart.

## Watch-outs (learned building this in pirates)

- **Test count assertion**: the campaign test likely asserts an exact mission
  count. Change it to `toBeGreaterThanOrEqual(11)` and rely on the "every scenario
  runs 250 s stably" test to cover the new ones.
- Add a tiny **integrity test**: every `CAMPAIGN_NODES` id ∈ `SCENARIOS`, and every
  `requires` ∈ node ids.
- **Replay stays allowed**: a cleared system must stay `data-mission`-tappable
  (smaller / no reward), and the replay / `?mission=` path must treat an
  already-cleared mission as unlocked.
- **Reef/aground-style objectives** (if any bonus mission has "avoid X"): fail such
  an objective from the *specific* condition (e.g. `aground`), never from a generic
  `shipDestroyed`, and only mark it complete on a win when the fail-flag is unset
  (`flagNot`). A generic death should not report an unrelated objective as
  failed/kept.
- Keep `tsc --noEmit` clean and the full test suite green; verify the map renders
  with a headless screenshot.

## Optional follow-on (only if you want the full pirates depth)

pirates layered more on top of the same map: a persisted **profile** (money +
per-hull upgrades), a **shipyard** (own/buy/select your flagship hull), **persistent
damage** carried between missions with **pay-to-repair** at port, and a **mobile
touch UX** (infographic HUD). None of that is required for the star-map + bonus
missions — a `cleared` array is all the map needs — but the same `profile` shape
ports over cleanly if you later want the economy loop.
