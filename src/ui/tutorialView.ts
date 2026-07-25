/**
 * Vykreslení tutoriálu: SPOTLIGHT (ztmavení scény s průzorem na cílový
 * prvek) + bublina s textem kroku, počítadlem a tlačítky POKRAČOVAT /
 * PŘESKOČIT. Implementuje HudView — controller ho krmí snapshoty přes
 * composite; podmínky kroků se vyhodnocují nad snapshotem (data/tutorials).
 *
 * Dokončení či přeskočení se pamatuje per mise (localStorage wob-tut-<id>),
 * takže tutoriál neotravuje při opakování mise.
 */
import type { SimEvent, SimState } from '../sim/types'
import type { HudView, UiState } from './panels'
import { esc } from './panels'
import { TUTORIALS, type TutorialStep } from '../data/tutorials'
import { getLang, t } from './i18n'

const storeKey = (missionId: string): string => `wob-tut-${missionId}`

export class TutorialView implements HudView {
  private layer: HTMLElement
  private hole: HTMLElement
  private bubble: HTMLElement
  private steps: TutorialStep[] | null = null
  private missionId = ''
  private idx = 0
  private lastPlaceAt = 0

  constructor(root: HTMLElement) {
    this.layer = document.createElement('div')
    this.layer.id = 'tutorial-layer'
    this.layer.style.display = 'none'
    this.hole = document.createElement('div')
    this.hole.className = 'tut-hole'
    this.bubble = document.createElement('div')
    this.bubble.className = 'tut-bubble'
    this.layer.append(this.hole, this.bubble)
    root.appendChild(this.layer)
    // tlačítka bubliny (delegace — bublina se přerenderovává)
    this.bubble.addEventListener('pointerup', e => {
      const b = (e.target as Element | null)?.closest('[data-tut]')
      if (!b) return
      if (b.getAttribute('data-tut') === 'skip') this.stop(true)
      else this.advance()
    })
  }

  /** spustí tutoriál mise (existuje-li a nebyl-li už dokončen/přeskočen) */
  start(missionId: string): void {
    const steps = TUTORIALS[missionId]
    if (!steps || steps.length === 0) return
    try { if (localStorage.getItem(storeKey(missionId)) === 'done') return } catch { /* noop */ }
    this.steps = steps
    this.missionId = missionId
    this.idx = 0
    this.layer.style.display = 'block'
    this.renderStep()
  }

  /** ukončí tutoriál; markDone = zapamatovat (dokončení i přeskočení) */
  stop(markDone: boolean): void {
    if (markDone && this.missionId) {
      try { localStorage.setItem(storeKey(this.missionId), 'done') } catch { /* noop */ }
    }
    this.steps = null
    this.layer.style.display = 'none'
  }

  private advance(): void {
    if (!this.steps) return
    this.idx++
    if (this.idx >= this.steps.length) { this.stop(true); return }
    this.renderStep()
  }

  addEvents(_events: SimEvent[]): void { /* kroky čtou snapshot, ne eventy */ }

  update(state: SimState, ui: UiState, _force?: boolean): void {
    if (!this.steps) return
    // konec mise → tutoriál zmizí (bez zápisu — příště se nabídne znovu)
    if (state.outcome !== 'running') { this.stop(false); return }
    const step = this.steps[this.idx]
    if (step.done && step.done(state, ui)) { this.advance(); return }
    // spotlight sleduje prvek (přerendery HUD mění pozice) — šetrně ~6 Hz
    const now = performance.now()
    if (now - this.lastPlaceAt > 160) {
      this.lastPlaceAt = now
      this.place(step)
    }
  }

  /** bublina kroku: počítadlo, text dle jazyka, POKRAČOVAT (ruční) / PŘESKOČIT */
  private renderStep(): void {
    if (!this.steps) return
    const step = this.steps[this.idx]
    const lang = getLang()
    this.bubble.innerHTML =
      `<div class="tut-head"><span>${t('tut.title')} · ${this.idx + 1}/${this.steps.length}</span></div>`
      + `<div class="tut-text">${esc(step.text[lang])}</div>`
      + `<div class="tut-btns">`
      + (step.done ? '' : `<button data-tut="next">${t('tut.next')}</button>`)
      + `<button data-tut="skip" class="tut-skip">${t('tut.skip')}</button>`
      + `</div>`
    this.lastPlaceAt = 0
    this.place(step)
  }

  /** umístí spotlight na kotvu a bublinu k ní (nebo doprostřed bez kotvy) */
  private place(step: TutorialStep): void {
    const el = step.anchor ? document.querySelector(step.anchor) : null
    const r = el?.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const bw = Math.min(360, vw - 24)
    this.bubble.style.width = `${bw}px`
    if (!r || r.width === 0 || r.height === 0) {
      // bez kotvy: jemné ztmavení celé scény, bublina dole uprostřed
      this.hole.style.display = 'none'
      this.layer.classList.add('tut-dim')
      this.bubble.style.left = `${Math.round((vw - bw) / 2)}px`
      this.bubble.style.top = ''
      this.bubble.style.bottom = '120px'
      return
    }
    this.layer.classList.remove('tut-dim')
    const pad = 6
    this.hole.style.display = 'block'
    this.hole.style.left = `${Math.round(r.left - pad)}px`
    this.hole.style.top = `${Math.round(r.top - pad)}px`
    this.hole.style.width = `${Math.round(r.width + pad * 2)}px`
    this.hole.style.height = `${Math.round(r.height + pad * 2)}px`
    // bublina nad/pod kotvou podle poloviny obrazovky, vodorovně přimknutá
    const left = Math.max(12, Math.min(vw - bw - 12, Math.round(r.left + r.width / 2 - bw / 2)))
    this.bubble.style.left = `${left}px`
    if (r.top > vh / 2) {
      this.bubble.style.top = ''
      this.bubble.style.bottom = `${Math.round(vh - r.top + pad + 8)}px`
    } else {
      this.bubble.style.bottom = ''
      this.bubble.style.top = `${Math.round(r.bottom + pad + 8)}px`
    }
  }
}
