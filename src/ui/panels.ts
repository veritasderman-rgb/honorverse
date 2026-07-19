/**
 * Panely v #sidebar a horní lišta v #topbar — prosté DOM (innerHTML),
 * přerender ze snapshotu (sidebar throttlovaný na ~7 Hz).
 * Akce tlačítek se chytají na pointerdown delegací (přežije přerender).
 * Nově: komunikační panel (avatary z img/<speaker>.png), detail cíle,
 * stav AUTO palby + progres bar šachet, overlay toasty u plotu.
 */
import { SHIP_CLASSES } from '../data/defs'
import { TUBE_COOLDOWN } from '../sim/constants'
import { poweredEnvelope } from '../sim/weapons'
import type { Contact, DriveMode, ShipState, SimEvent, SimState, Subsystems } from '../sim/types'
import type { AudioManager } from './audio'

/** stav UI vrstvy předávaný z controlleru (src/ui/input.ts) */
export interface UiState {
  ownShipId: number | null
  targetId: number | null
  courseMode: boolean
  salvoMode: DriveMode
  compression: number
  slowdownText: string | null
}

export type PanelAction =
  | { kind: 'compression'; factor: number }
  | { kind: 'select'; id: number }
  | { kind: 'order'; act: string }

const COMP_BTNS: { f: number; label: string }[] = [
  { f: 0, label: '⏸' },
  { f: 1, label: '1×' },
  { f: 10, label: '10×' },
  { f: 100, label: '100×' },
  { f: 1000, label: '1000×' },
  { f: 10000, label: '10000×' },
]

const SUBSYS: { key: keyof Subsystems; label: string }[] = [
  { key: 'impellerFwd', label: 'impelery příď' },
  { key: 'impellerAft', label: 'impelery záď' },
  { key: 'sidewallPort', label: 'bočník LB' },
  { key: 'sidewallStbd', label: 'bočník PB' },
  { key: 'tubesPort', label: 'šachty LB' },
  { key: 'tubesStbd', label: 'šachty PB' },
  { key: 'energyPort', label: 'energet. LB' },
  { key: 'energyStbd', label: 'energet. PB' },
  { key: 'pdlc', label: 'PDLC' },
  { key: 'cm', label: 'protirakety' },
  { key: 'sensors', label: 'senzory' },
  { key: 'ecm', label: 'ECM' },
]

/** české názvy rolí + iniciály fallbacku (soubory avatarů dle docs/ART_PROMPTS.md) */
/** ilustrace tříd lodí (public/img/<hodnota>.png) — klíč je classId nebo hullCode */
const SHIP_IMAGES: Record<string, string> = {
  'dd-vichr': 'ship-dd', 'cl-sokol': 'ship-cl', 'ca-bastion': 'ship-ca',
  'merch-freighter': 'ship-merch', 'merch-runner': 'ship-merch',
  'merch-qship': 'ship-qship', 'disp-courier': 'ship-courier',
  DD: 'ship-dd', CL: 'ship-cl', CA: 'ship-ca', MERCH: 'ship-merch', DB: 'ship-courier',
}

const SPEAKERS: Record<string, { name: string; initials: string }> = {
  'captain': { name: 'Kapitán', initials: 'KPT' },
  'xo': { name: 'První důstojník', initials: 'XO' },
  'engineer': { name: 'Inženýr', initials: 'INŽ' },
  'tactical': { name: 'Taktický důstojník', initials: 'TAK' },
  'comms': { name: 'Spojař', initials: 'SPO' },
  'enemy-captain': { name: 'Nepřátelský kapitán', initials: 'NPŘ' },
  'pirate': { name: 'Pirát', initials: 'PIR' },
  'station': { name: 'Stanice', initials: 'STN' },
  'governor': { name: 'Guvernér', initials: 'GUV' },
}

// ---------- formátovací pomocníci (sdílené i pro main.ts) ----------

export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))

export const fmtTime = (t: number): string => {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${h}:${p(m)}:${p(s)}`
}

export const fmtKm = (km: number): string => {
  const a = Math.abs(km)
  if (a >= 1e6) return (km / 1e6).toFixed(2) + ' M km'
  if (a >= 1e4) return Math.round(km / 1e3) + ' tis. km'
  return Math.round(km) + ' km'
}

const pctClass = (v: number): string => (v >= 0.995 ? 'ok' : v >= 0.5 ? 'amber' : 'bad')

/** odhad aktuální polohy kontaktu (extrapolace o stáří dat) */
export const contactEstPos = (c: Contact): { x: number; y: number } =>
  ({ x: c.pos.x + c.vel.x * c.age, y: c.pos.y + c.vel.y * c.age })

/** avatar mluvčího: obrázek img/<speaker>.png, při chybě načtení iniciály */
const avatarHtml = (speaker: string): string => {
  const sp = SPEAKERS[speaker] ?? { name: speaker, initials: '??' }
  return `<span class="comm-ava">`
    + `<img src="img/${esc(speaker)}.png" alt="" onerror="this.parentElement.classList.add('noimg')">`
    + `<i>${esc(sp.initials)}</i></span>`
}

// ---------- panely ----------

export class Panels {
  private log: { t: number; text: string; warn: boolean }[] = []
  private commLog: { t: number; speaker: string; text: string }[] = []
  private lastSidebarAt = 0
  private toasts: HTMLElement | null = null
  /** přerenderovávaná část topbaru (audio ovládání se renderuje jen jednou) */
  private tbMain: HTMLElement

  constructor(
    private sidebar: HTMLElement,
    private topbar: HTMLElement,
    private onAction: (a: PanelAction) => void,
    audio?: AudioManager,
  ) {
    // dynamická část topbaru (čas, komprese) — přepisuje se každý snapshot;
    // audio ovládání je samostatný sourozenec, ať slidery nepřijdou o drag
    this.tbMain = document.createElement('span')
    this.tbMain.className = 'tb-main'
    topbar.appendChild(this.tbMain)
    if (audio) topbar.appendChild(this.buildAudioBar(audio))
    // delegace na pointerdown: elementy se při přerenderu mění, kontejner ne
    const handler = (e: Event): void => {
      const t = e.target as Element | null
      const el = t?.closest?.('[data-comp],[data-sel],[data-act]')
      if (!el) return
      const comp = el.getAttribute('data-comp')
      if (comp != null) { this.onAction({ kind: 'compression', factor: Number(comp) }); return }
      const sel = el.getAttribute('data-sel')
      if (sel != null) { this.onAction({ kind: 'select', id: Number(sel) }); return }
      const act = el.getAttribute('data-act')
      if (act != null) this.onAction({ kind: 'order', act })
    }
    sidebar.addEventListener('pointerdown', handler)
    topbar.addEventListener('pointerdown', handler)

    // kontejner na toasty u plotu (poslední hail + vlastní zásahy)
    const plotContainer = document.getElementById('plot-container')
    if (plotContainer) {
      this.toasts = document.createElement('div')
      this.toasts.id = 'toasts'
      plotContainer.appendChild(this.toasts)
    }
  }

  /** toast overlay u plotu — zmizí po pár sekundách */
  private showToast(html: string, cls: string, ms: number): void {
    if (!this.toasts) return
    const el = document.createElement('div')
    el.className = `toast ${cls}`
    el.innerHTML = html
    this.toasts.appendChild(el)
    // max 4 toasty najednou
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove()
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600) }, ms)
  }

  /** připojí nové události ze snapshotu do logu (worker je po odeslání maže) */
  addEvents(events: SimEvent[]): void {
    for (const ev of events) {
      const speakerName = ev.speaker ? SPEAKERS[ev.speaker]?.name ?? ev.speaker : null
      const logText = speakerName && ev.kind !== 'message' ? `${speakerName}: ${ev.text}` : ev.text
      this.log.unshift({ t: ev.t, text: logText, warn: !!ev.slowdown || ev.kind === 'shipDestroyed' })

      // komunikace → comm log + výrazný toast
      if (ev.kind === 'comm' && ev.speaker) {
        this.commLog.unshift({ t: ev.t, speaker: ev.speaker, text: ev.text })
        if (this.commLog.length > 8) this.commLog.length = 8
        this.showToast(
          `${avatarHtml(ev.speaker)}<span class="toast-body"><b>${esc(SPEAKERS[ev.speaker]?.name ?? ev.speaker)}</b>`
          + `<span>${esc(ev.text)}</span></span>`,
          'toast-comm', 9000)
      }
      // vlastní zásah → červený toast „ZÁSAH — …"
      if (ev.kind === 'subsystemHit' && ev.side === 'player') {
        const detail = ev.text.replace(/^.*?zásah — /, '')
        this.showToast(`<b>ZÁSAH</b> — ${esc(detail)}`, 'toast-hit', 5000)
      }
    }
    if (this.log.length > 40) this.log.length = 40
  }

  update(state: SimState, ui: UiState, force = false): void {
    this.renderTopbar(state, ui)
    const now = performance.now()
    if (!force && now - this.lastSidebarAt < 150) return
    this.lastSidebarAt = now
    this.renderSidebar(state, ui)
  }

  /** audio ovládání topbaru — renderuje se JEDNOU (slidery přežijí drag) */
  private buildAudioBar(audio: AudioManager): HTMLElement {
    const bar = document.createElement('span')
    bar.className = 'tb-audio'
    bar.innerHTML =
      `<button class="tb-mute" title="ztlumit / zapnout zvuk">${audio.muted ? '🔇' : '🔊'}</button>`
      + `<label title="hlasitost hudby">♪ <input class="tb-vol-music" type="range" min="0" max="100"`
      + ` value="${Math.round(audio.musicVolume * 100)}"></label>`
      + `<label title="hlasitost efektů">FX <input class="tb-vol-sfx" type="range" min="0" max="100"`
      + ` value="${Math.round(audio.sfxVolume * 100)}"></label>`
    const mute = bar.querySelector<HTMLButtonElement>('.tb-mute')!
    mute.addEventListener('click', () => {
      audio.setMuted(!audio.muted)
      mute.textContent = audio.muted ? '🔇' : '🔊'
    })
    bar.querySelector<HTMLInputElement>('.tb-vol-music')!.addEventListener('input', e => {
      audio.setMusicVolume(Number((e.target as HTMLInputElement).value) / 100)
    })
    bar.querySelector<HTMLInputElement>('.tb-vol-sfx')!.addEventListener('input', e => {
      audio.setSfxVolume(Number((e.target as HTMLInputElement).value) / 100)
    })
    return bar
  }

  private renderTopbar(state: SimState, ui: UiState): void {
    const btns = COMP_BTNS
      .map(b => `<button data-comp="${b.f}" class="${b.f === ui.compression ? 'active' : ''}">${b.label}</button>`)
      .join('')
    this.tbMain.innerHTML =
      `<span class="tb-time">ČAS ${fmtTime(state.t)}</span>`
      + `<span class="tb-comp">${btns}</span>`
      + `<button data-act="help" title="nápověda (H)">?</button>`
      + (ui.slowdownText ? `<span class="tb-slow">⚠ ZPOMALENO: ${esc(ui.slowdownText)}</span>` : '')
  }

  private renderSidebar(state: SimState, ui: UiState): void {
    const own = state.ships.find(s => s.id === ui.ownShipId) ?? null
    this.sidebar.innerHTML =
      this.panelOwnShip(own, state)
      + this.panelContacts(state, own, ui)
      + this.panelTargetDetail(state, own, ui)
      + this.panelOrders(own, ui)
      + this.panelObjectives(state)
      + this.panelComms()
      + this.panelLog()
  }

  private panelOwnShip(own: ShipState | null, state: SimState): string {
    if (!own) return `<div class="panel"><h3>Vlastní loď</h3><div class="dim">žádná loď</div></div>`
    const def = SHIP_CLASSES[own.classId]
    const speed = Math.hypot(own.vel.x, own.vel.y)
    const impAvg = (own.subsystems.impellerFwd + own.subsystems.impellerAft) / 2
    const accG = own.wedgeOn ? own.throttle * (def?.maxAccelG ?? 0) * impAvg : 0
    const hullPct = def ? Math.max(0, own.hull / def.hullPoints) : 1
    const rows = SUBSYS.map(s => {
      const v = own.subsystems[s.key]
      const cls = pctClass(v)
      return `<div class="subsys ${cls}"><span class="nm">${s.label}</span>`
        + `<span class="bar"><i style="width:${Math.round(v * 100)}%"></i></span>`
        + `<span class="pc ${cls}">${Math.round(v * 100)}%</span></div>`
    }).join('')
    const status = own.destroyed
      ? `<div class="bad">LOĎ ZNIČENA</div>`
      : `<div class="row"><span>klín: <b class="${own.wedgeOn ? 'ok' : 'amber'}">${own.wedgeOn ? 'ZAP' : 'VYP'}</b></span>`
        + `<span>senzory: <b class="${own.activeSensors ? 'amber' : 'ok'}">${own.activeSensors ? 'AKTIVNÍ' : 'PASIVNÍ'}</b></span></div>`
        + `<div class="row"><span>poloha: <b class="${own.rolledTo != null ? 'amber' : 'ok'}">${own.rolledTo != null ? 'ODVALENÁ' : 'normální'}</b></span>`
        + `<span>tah: ${Math.round(own.throttle * 100)} %</span></div>`

    // cooldown šachet jako progres bar (plný = připraveno)
    const ready = 1 - Math.min(1, own.tubeCooldown / TUBE_COOLDOWN)
    const cdRow = `<div class="subsys ${ready >= 1 ? 'ok' : 'amber'}"><span class="nm">šachty nabití</span>`
      + `<span class="bar"><i style="width:${Math.round(ready * 100)}%"></i></span>`
      + `<span class="pc">${own.tubeCooldown > 0 ? Math.ceil(own.tubeCooldown) + ' s' : 'OK'}</span></div>`

    // stav AUTO palby
    const fc = own.fireControl
    let fireRow = ''
    if (fc.mode === 'auto' && fc.targetId != null) {
      const tgt = state.ships.find(s => s.id === fc.targetId)
      const tgtName = tgt ? tgt.name : `#${fc.targetId}`
      const next = fc.engaged
        ? (own.tubeCooldown > 0 ? `další salva za ${Math.ceil(own.tubeCooldown)} s` : 'pálí')
        : 'čeká na obálku'
      fireRow = `<div class="row auto-fire"><span class="amber">AUTO → ${esc(tgtName)}</span>`
        + `<span>${next} · zbývá ${own.missiles}</span></div>`
    }
    // druhá vlna vrstvené salvy
    let waveRow = ''
    if (own.pendingWave) {
      waveRow = `<div class="row auto-fire"><span class="amber">2. vlna (HI)</span>`
        + `<span>start za ${Math.max(0, Math.ceil(own.pendingWave.launchAt - state.t))} s</span></div>`
    }

    return `<div class="panel"><h3>Vlastní loď</h3>`
      + `<div class="row"><b>${esc(own.name)}</b><span class="dim">${esc(def?.name ?? own.classId)} (${def?.hullCode ?? '?'})</span></div>`
      + `<div class="row"><span>rychlost: ${Math.round(speed).toLocaleString('cs-CZ')} km/s</span><span>akcel.: ${Math.round(accG)} g</span></div>`
      + `<div class="row"><span>trup: <b class="${pctClass(hullPct)}">${Math.round(hullPct * 100)} %</b></span>`
      + `<span>rakety ${own.missiles} · CM ${own.cms}</span></div>`
      + status
      + cdRow
      + fireRow
      + waveRow
      + `<div style="margin-top:5px">${rows}</div>`
      + `</div>`
  }

  private panelContacts(state: SimState, own: ShipState | null, ui: UiState): string {
    const list = [...state.contacts.player]
    const oPos = own ? own.pos : { x: 0, y: 0 }
    const withRange = list.map(c => {
      const est = contactEstPos(c)
      return { c, range: Math.hypot(est.x - oPos.x, est.y - oPos.y) }
    }).sort((a, b) => a.range - b.range)
    const rows = withRange.map(({ c, range }) => {
      const cls = c.idQuality === 0 ? '???' : (SHIP_CLASSES[c.classGuess]?.hullCode ?? c.classGuess)
      const q = ['jen klín', 'třída?', 'ident.'][c.idQuality]
      const speed = Math.hypot(c.vel.x, c.vel.y)
      const sel = c.shipId === ui.targetId ? ' sel' : ''
      return `<div class="contact-row${sel}" data-sel="${c.shipId}">`
        + `<div class="row"><span class="${c.idQuality === 0 ? 'amber' : 'bad'}">◆ ${esc(cls)} #${c.shipId}</span><span>${fmtKm(range)}</span></div>`
        + `<div class="row dim"><span>${Math.round(speed).toLocaleString('cs-CZ')} km/s · ${q}</span><span>stáří ${Math.round(c.age)} s</span></div>`
        + `</div>`
    }).join('')
    return `<div class="panel"><h3>Kontakty</h3>${rows || '<div class="dim">žádné kontakty</div>'}</div>`
  }

  /** DETAIL CÍLE: geometrie, klasifikace, odhad výzbroje a obálek */
  private panelTargetDetail(state: SimState, own: ShipState | null, ui: UiState): string {
    if (ui.targetId == null) return ''
    const c = state.contacts.player.find(x => x.shipId === ui.targetId)
    if (!c || !own) return ''

    const est = contactEstPos(c)
    const dx = est.x - own.pos.x
    const dy = est.y - own.pos.y
    const d = Math.hypot(dx, dy)
    // radiální rychlost: + = vzdaluje se, − = přibližuje
    const ux = d > 0 ? dx / d : 1
    const uy = d > 0 ? dy / d : 0
    const vr = (c.vel.x - own.vel.x) * ux + (c.vel.y - own.vel.y) * uy
    const closingTxt = vr < -0.5
      ? `<span class="bad">přibližuje se ${Math.round(-vr).toLocaleString('cs-CZ')} km/s</span>`
      : vr > 0.5
        ? `vzdaluje se ${Math.round(vr).toLocaleString('cs-CZ')} km/s`
        : 'drží vzdálenost'
    const qLabel = ['jen impelerový klín', 'přibližná klasifikace', 'plná identifikace'][c.idQuality]

    let body =
      `<div class="row"><span>vzdálenost:</span><b>${fmtKm(d)}</b></div>`
      + `<div class="row"><span>radiálně:</span><span>${closingTxt}</span></div>`
      + `<div class="row"><span>stáří dat:</span><span>${Math.round(c.age)} s (light-lag)</span></div>`
      + `<div class="row"><span>klasifikace:</span><span>${qLabel}</span></div>`

    const tDef = SHIP_CLASSES[c.classGuess]
    if (c.idQuality >= 1 && tDef) {
      // ilustrace třídy (public/img/ship-*.png; chybějící obrázek se skryje)
      const img = SHIP_IMAGES[c.classGuess] ?? SHIP_IMAGES[tDef.hullCode]
      if (img) {
        body += `<img class="target-img" src="img/${img}.png" alt="" onerror="this.remove()">`
      }
      // odhad třídy / tonáže / akcelerace
      body += `<div class="row"><span>třída:</span><b>${esc(tDef.name)} (${tDef.hullCode})</b></div>`
        + `<div class="row"><span>tonáž:</span><span>~${Math.round(tDef.tonnage / 1000).toLocaleString('cs-CZ')} kt</span></div>`
        + `<div class="row"><span>max. akcel.:</span><span>~${tDef.maxAccelG} g</span></div>`
    } else if (c.idQuality >= 1) {
      body += `<div class="row dim"><span>třída neznámá — přibliž se / aktivní senzory</span></div>`
    }

    if (c.idQuality >= 2 && tDef) {
      // výzbroj + porovnání raketových obálek (dle aktuální geometrie)
      body += `<div class="row"><span>výzbroj:</span>`
        + `<span>${tDef.tubesPerBroadside}× šachta/bok · ${tDef.energyMountsPerBroadside}× energet.</span></div>`
      const ourEnv = poweredEnvelope(own.pos, own.vel, est, c.vel, 0)
      const hisEnv = tDef.tubesPerBroadside > 0
        ? poweredEnvelope(est, c.vel, own.pos, own.vel, 0)
        : 0
      const fmtEnv = (km: number): string => (km / 1e6).toFixed(1).replace('.', ',')
      const timeTo = (env: number): string => {
        if (d <= env) return 'TEĎ'
        if (vr >= -0.5) return '—'
        const min = (d - env) / -vr / 60
        return min > 600 ? '—' : `~${Math.max(1, Math.round(min))} min`
      }
      body += `<div class="row"><span>naše obálka:</span><span>${fmtEnv(ourEnv)} M km · dostřel ${timeTo(ourEnv)}</span></div>`
      body += tDef.tubesPerBroadside > 0
        ? `<div class="row"><span>jeho obálka:</span><span class="amber">${fmtEnv(hisEnv)} M km · dostřelí nás ${timeTo(hisEnv)}</span></div>`
        : `<div class="row dim"><span>raketami neozbrojen</span></div>`
    } else if (c.idQuality < 2) {
      body += `<div class="row dim"><span>výzbroj neznámá (ident. vyžaduje aktivní senzory zblízka)</span></div>`
    }

    return `<div class="panel"><h3>Detail cíle #${c.shipId}</h3>${body}</div>`
  }

  private panelOrders(own: ShipState | null, ui: UiState): string {
    const hasTarget = ui.targetId != null
    const dis = (cond: boolean): string => (cond ? '' : ' disabled')
    const noShip = !own || own.destroyed
    const canFire = !noShip && hasTarget
    const rolled = own?.rolledTo != null
    const tubes = SHIP_CLASSES[own?.classId ?? '']?.tubesPerBroadside ?? 4
    const hiC = Math.max(1, Math.round(tubes / 3))
    const loC = Math.max(1, tubes - hiC)
    const auto = own?.fireControl.mode === 'auto'
    return `<div class="panel"><h3>Rozkazy</h3>`
      + `<div class="btnrow">`
      + `<button data-act="intercept"${dis(canFire)}>Intercept</button>`
      + `<button data-act="course" class="${ui.courseMode ? 'active' : ''}"${dis(!noShip)}>${ui.courseMode ? 'Kurz: klikni do plotu…' : 'Kurz sem'}</button>`
      + `</div>`
      + `<div class="btnrow">`
      + `<button data-act="salvo2"${dis(canFire && (own?.missiles ?? 0) > 0)}>Salva 2</button>`
      + `<button data-act="salvo4"${dis(canFire && (own?.missiles ?? 0) > 0)}>Salva 4</button>`
      + `<button data-act="salvoFull"${dis(canFire && (own?.missiles ?? 0) > 0)}>Plná salva</button>`
      + `<button data-act="mode" title="režim pohonu raket">Pohon: ${ui.salvoMode === 1 ? 'HI' : 'LO'}</button>`
      + `</div>`
      + `<div class="btnrow">`
      + `<button data-act="salvoLayered" title="vrstvená salva: LO vlna + HI follow-up na společný přílet (saturace obrany)"${dis(canFire && (own?.missiles ?? 0) > 0)}>Salva ${loC}+${hiC}</button>`
      + `<button data-act="autoFire" class="${auto ? 'active' : ''}" title="AUTO palba na vybraný cíl (A)"${dis(canFire || auto)}>AUTO palba: ${auto ? 'ZAP' : 'VYP'}</button>`
      + `</div>`
      + `<div class="btnrow">`
      + `<button data-act="energy"${dis(canFire)}>Energie</button>`
      + (rolled
        ? `<button data-act="rollBack" class="active">Roll zpět</button>`
        : `<button data-act="rollThreat"${dis(!noShip)}>Roll k hrozbě</button>`)
      + `</div>`
      + `<div class="btnrow">`
      + `<button data-act="wedge" class="${own?.wedgeOn ? 'active' : ''}"${dis(!noShip)}>Klín: ${own?.wedgeOn ? 'ZAP' : 'VYP'}</button>`
      + `<button data-act="sensors" class="${own?.activeSensors ? 'active' : ''}"${dis(!noShip)}>Akt. senzory: ${own?.activeSensors ? 'ZAP' : 'VYP'}</button>`
      + `</div>`
      + `<div class="dim">mezerník pauza · +/− komprese · R roll · A auto · H nápověda</div>`
      + `</div>`
  }

  private panelObjectives(state: SimState): string {
    const rows = state.objectives.map(o => {
      const mark = o.state === 'done' ? '■' : o.state === 'failed' ? '✗' : '□'
      return `<div class="obj ${o.state}">${mark} ${esc(o.text)}</div>`
    }).join('')
    return `<div class="panel"><h3>Cíle mise</h3>${rows || '<div class="dim">—</div>'}</div>`
  }

  /** komunikační log — avatary a hlášky (kind 'comm') */
  private panelComms(): string {
    const rows = this.commLog.slice(0, 5).map(c => {
      const sp = SPEAKERS[c.speaker] ?? { name: c.speaker, initials: '??' }
      return `<div class="comm-row">${avatarHtml(c.speaker)}`
        + `<div class="comm-body"><div class="comm-name">${esc(sp.name)} <span class="dim">[${fmtTime(c.t)}]</span></div>`
        + `<div class="comm-text">${esc(c.text)}</div></div></div>`
    }).join('')
    return `<div class="panel"><h3>Komunikace</h3>${rows || '<div class="dim">žádná komunikace</div>'}</div>`
  }

  private panelLog(): string {
    const rows = this.log.slice(0, 12).map(l =>
      `<div class="${l.warn ? 'ev-warn' : ''}">[${fmtTime(l.t)}] ${esc(l.text)}</div>`,
    ).join('')
    return `<div class="panel"><h3>Log událostí</h3><div id="log">${rows || '<div class="dim">zatím žádné události</div>'}</div></div>`
  }
}
