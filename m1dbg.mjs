import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' })
const { sim } = await server.ssrLoadModule('/src/sim/engine.ts')
const { mission01 } = await server.ssrLoadModule('/src/data/missions/mission01.ts')
const { dist } = await server.ssrLoadModule('/src/sim/vec.ts')

function run(throttle, delay) {
  const state = sim.create(mission01)
  let ordered = false
  let minGap = Infinity
  while (state.outcome === 'running' && state.t < 6 * 3600) {
    if (!ordered && state.t >= delay) {
      sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle })
      sim.applyOrder(state, { kind: 'intercept', shipId: 1, targetId: 2 })
      ordered = true
    }
    const g = dist(state.ships[0].pos, state.ships[1].pos)
    minGap = Math.min(minGap, g)
    if (ordered && state.ships[0].tubeCooldown <= 0 && g < 6_000_000) {
      sim.applyOrder(state, { kind: 'launchSalvo', shipId: 1, targetId: 2, count: 3, mode: 0 })
    }
    sim.tick(state, 0.5)
    state.events.length = 0
  }
  return { outcome: state.outcome, t: Math.round(state.t), cygnusX: Math.round(state.ships[1].pos.x / 1e6), minGap: Math.round(minGap / 1e6) }
}

console.log('tah 80 %, start t=60: ', run(0.8, 60))
console.log('tah 100 %, start t=60: ', run(1.0, 60))
console.log('tah 100 %, start t=420:', run(1.0, 420))
console.log('tah 120 %, start t=600:', run(1.2, 600))
