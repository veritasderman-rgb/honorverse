/**
 * Sim worker — simulace běží mimo UI vlákno. Tiká fixním SIM_DT,
 * komprese času = víc kroků na interval. Snapshoty posílá ~20×/s
 * (structured clone celého SimState; UI si kontakty filtruje samo).
 */
import { sim } from '../sim/engine'
import { SIM_DT } from '../sim/constants'
import { SCENARIOS } from '../data/missions'
import type { Scenario, SimState, WorkerInMsg, WorkerOutMsg } from '../sim/types'

/** interval smyčky (ms) */
const TICK_MS = 50
/** strop kroků na jeden interval (ochrana proti zamrznutí workeru) */
const MAX_STEPS = 20_000

/** Záložní scénář pro vývoj UI, než vznikne src/data/missions.ts. */
const DEMO_SCENARIO: Scenario = {
  id: 'demo',
  title: 'Cvičný střet',
  briefing:
    'CVIČNÁ MISE (demo)\n\n'
    + 'ANS Dauntless (CL) na hlídce zachytila neznámý impelerový kontakt. '
    + 'Rozvědka hlásí v sektoru pirátský torpédoborec.\n\n'
    + 'Úkol: zachytit kontakt a zničit ho.',
  seed: 1337,
  ships: [
    {
      classId: 'cl-sokol', side: 'player', name: 'ANS Dauntless',
      pos: { x: 0, y: 0 }, vel: { x: 20, y: 0 }, heading: 0, doctrine: 'player',
    },
    {
      classId: 'dd-vichr', side: 'enemy', name: 'Pirát',
      pos: { x: 40_000_000, y: 5_000_000 }, vel: { x: -80, y: 0 },
      heading: Math.PI, doctrine: 'attack',
    },
  ],
  objectives: [{ id: 'kill', text: 'Znič nepřátelskou loď', state: 'open' }],
  triggers: [],
}

let state: SimState | null = null
let compression = 0
/** akumulátor zlomků kroků (při 1× vychází 0.1 kroku na interval) */
let stepAcc = 0

const post = (msg: WorkerOutMsg): void => {
  ;(self as unknown as { postMessage(m: unknown): void }).postMessage(msg)
}

/** Scénář z src/data/missions, fallback na demo pro vývoj UI. */
function loadScenario(id: string): Scenario {
  return SCENARIOS?.[id] ?? DEMO_SCENARIO
}

function sendSnapshot(): void {
  if (!state) return
  post({ kind: 'snapshot', state, compression })
  state.events = []
}

self.onmessage = (e: MessageEvent<WorkerInMsg>) => {
  const msg = e.data
  switch (msg.kind) {
    case 'init': {
      const scenario = loadScenario(msg.scenarioId)
      state = sim.create(scenario)
      compression = 0
      stepAcc = 0
      post({ kind: 'ready', scenario })
      sendSnapshot()
      break
    }
    case 'order':
      if (state) sim.applyOrder(state, msg.order)
      break
    case 'setCompression':
      compression = Math.max(0, Math.min(10_000, msg.factor))
      stepAcc = 0
      break
    case 'snapshotRequest':
      sendSnapshot()
      break
  }
}

setInterval(() => {
  if (!state) return
  if (compression > 0 && state.outcome === 'running') {
    stepAcc += (compression * (TICK_MS / 1000)) / SIM_DT
    let steps = Math.floor(stepAcc)
    stepAcc -= steps
    if (steps > MAX_STEPS) { steps = MAX_STEPS; stepAcc = 0 }
    let scanned = 0
    for (let i = 0; i < steps; i++) {
      sim.tick(state, SIM_DT)
      if (state.outcome !== 'running') break
      // událost se slowdown ukončí dávku — UI hned zpomalí na 1×
      let hasSlowdown = false
      for (; scanned < state.events.length; scanned++) {
        if (state.events[scanned].slowdown) hasSlowdown = true
      }
      if (hasSlowdown) break
    }
  }
  sendSnapshot()
}, TICK_MS)
