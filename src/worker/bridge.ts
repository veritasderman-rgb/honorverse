/** Most UI ↔ sim worker (postMessage obal). */
import type { Order, Scenario, SimState, WorkerInMsg, WorkerOutMsg } from '../sim/types'

export class SimBridge {
  private worker: Worker
  /** volá se s každým snapshotem (~20×/s) */
  onSnapshot: ((state: SimState, compression: number) => void) | null = null
  /** volá se po inicializaci scénáře */
  onReady: ((scenario: Scenario) => void) | null = null

  constructor() {
    this.worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
      const msg = e.data
      if (msg.kind === 'snapshot') this.onSnapshot?.(msg.state, msg.compression)
      else if (msg.kind === 'ready') this.onReady?.(msg.scenario)
    }
  }

  start(scenarioId: string): void {
    this.post({ kind: 'init', scenarioId })
  }

  sendOrder(order: Order): void {
    this.post({ kind: 'order', order })
  }

  setCompression(factor: number): void {
    this.post({ kind: 'setCompression', factor })
  }

  requestSnapshot(): void {
    this.post({ kind: 'snapshotRequest' })
  }

  private post(msg: WorkerInMsg): void {
    this.worker.postMessage(msg)
  }
}
