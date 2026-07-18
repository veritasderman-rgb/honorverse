/**
 * Bootstrap UI vrstvy: bridge → plot → panely → controller,
 * briefing overlay na start (pauza), win/lose overlay dle outcome.
 */
import { SimBridge } from './worker/bridge'
import { TacticalPlot } from './ui/plot'
import { Panels, esc, fmtTime } from './ui/panels'
import { UIController } from './ui/input'
import type { Scenario, SimState } from './sim/types'

const canvas = document.getElementById('plot') as HTMLCanvasElement
const sidebar = document.getElementById('sidebar') as HTMLElement
const topbar = document.getElementById('topbar') as HTMLElement

const bridge = new SimBridge()
const plot = new TacticalPlot(canvas)
const panels = new Panels(sidebar, topbar, a => controller.handleAction(a))
const controller = new UIController(bridge, plot, panels)

let outcomeShown = false

function overlay(html: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'overlay'
  el.innerHTML = `<div class="box">${html}</div>`
  document.body.appendChild(el)
  return el
}

function showBriefing(sc: Scenario): void {
  const el = overlay(
    `<h2>${esc(sc.title)}</h2>`
    + `<div class="brief">${esc(sc.briefing)}</div>`
    + `<button id="btn-start">START</button>`,
  )
  el.querySelector('#btn-start')?.addEventListener('click', () => {
    el.remove()
    controller.setCompression(1)
  })
}

function showOutcome(state: SimState): void {
  const win = state.outcome === 'win'
  const objs = state.objectives.map(o => {
    const mark = o.state === 'done' ? '■' : o.state === 'failed' ? '✗' : '□'
    return `<div class="obj ${o.state}">${mark} ${esc(o.text)}</div>`
  }).join('')
  const el = overlay(
    `<h2 class="${win ? 'win' : 'lose'}">${win ? 'VÍTĚZSTVÍ' : 'PORÁŽKA'}</h2>`
    + `<div class="brief">Mise ukončena v čase ${fmtTime(state.t)}.</div>`
    + objs
    + `<div style="margin-top:14px"><button id="btn-again">ZNOVU</button></div>`,
  )
  el.querySelector('#btn-again')?.addEventListener('click', () => location.reload())
}

bridge.onReady = scenario => {
  showBriefing(scenario)
  plot.start()
}

bridge.onSnapshot = (state, compression) => {
  controller.handleSnapshot(state, compression)
  if (!outcomeShown && state.outcome !== 'running') {
    outcomeShown = true
    controller.setCompression(0)
    showOutcome(state)
  }
}

bridge.start('mission01')
