/**
 * AudioManager — adaptivní hudba + syntetizované zvukové efekty.
 *
 * Hudba: MP3 soubory z public/audio (názvy dle docs/AUDIO_PROMPTS.md),
 * HTMLAudioElement → MediaElementSource → GainNode, crossfade ~3 s.
 * Chybějící soubor (404) se tiše ignoruje — hra běží bez hudby.
 *
 * SFX: čistá WebAudio syntéza (oscilátory, šumový buffer, filtry, obálky),
 * žádné soubory. Stejný efekt hraje max 1× za ~0,5 s (dávky událostí
 * při kompresi času).
 *
 * AudioContext se vytváří až při prvním uživatelském gestu (unlock()) —
 * autoplay politika prohlížečů; do té doby jsou všechna volání no-op.
 */
import { SHIP_CLASSES } from '../data/defs'
import type { SimState } from '../sim/types'

export type MusicState =
  | 'menu' | 'cruise' | 'tension' | 'combat' | 'critical' | 'victory' | 'defeat'

// ---------- prahy hudebního automatu ----------

/** trup vlastní lodi pod 40 % → critical */
const CRITICAL_HULL = 0.4
/** nepřítel v energetickém dosahu (km) → critical */
const CRITICAL_RANGE = 600_000
/** nepřítel blízko (km) → combat */
const COMBAT_RANGE = 8_000_000
/** hystereze: stav smí KLESNOUT až po tolika ms klidu */
const CALM_DOWN_MS = 20_000
/** délka crossfade hudby (s) */
const FADE_S = 3

/** pořadí bojové eskalace (menu/victory/defeat stojí mimo žebřík) */
const RANK: Partial<Record<MusicState, number>> = {
  cruise: 0, tension: 1, combat: 2, critical: 3,
}

/** Určení hudebního stavu z posledního snapshotu simulace. */
export function musicStateFor(state: SimState): MusicState {
  if (state.outcome === 'win') return 'victory'
  if (state.outcome === 'lose') return 'defeat'

  const players = state.ships.filter(s => s.side === 'player' && !s.destroyed)
  const enemies = state.ships.filter(s => s.side === 'enemy' && !s.destroyed)

  // nejmenší skutečná vzdálenost vlastní–nepřátelská loď
  let minDist = Infinity
  for (const p of players) {
    for (const e of enemies) {
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y)
      if (d < minDist) minDist = d
    }
  }

  const lowHull = players.some(s => {
    const def = SHIP_CLASSES[s.classId]
    return def ? s.hull / def.hullPoints < CRITICAL_HULL : false
  })
  if (lowHull || minDist < CRITICAL_RANGE) return 'critical'

  if (state.missiles.some(m => m.phase !== 'dead') || minDist < COMBAT_RANGE) return 'combat'

  // nepřátelský kontakt: Contact nemá side → lookup přes state.ships
  const enemyContact = state.contacts.player.some(c => {
    const sh = state.ships.find(s => s.id === c.shipId)
    return sh?.side === 'enemy' && !sh.destroyed
  })
  if (enemyContact) return 'tension'

  return 'cruise'
}

// ---------- persistence nastavení ----------

const STORE_KEY = 'wob.audio'

interface AudioSettings { music: number; sfx: number; muted: boolean }

const DEFAULTS: AudioSettings = { music: 0.6, sfx: 0.8, muted: false }

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<AudioSettings>
    return {
      music: typeof p.music === 'number' ? Math.min(1, Math.max(0, p.music)) : DEFAULTS.music,
      sfx: typeof p.sfx === 'number' ? Math.min(1, Math.max(0, p.sfx)) : DEFAULTS.sfx,
      muted: !!p.muted,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

// ---------- AudioManager ----------

type SfxName =
  | 'launch' | 'incoming' | 'hitOwn' | 'hitEnemy' | 'missileKilled'
  | 'energy' | 'comm' | 'objective' | 'click'

interface MusicTrack {
  el: HTMLAudioElement
  gain: GainNode
  failed: boolean
}

export class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain!: GainNode
  private musicGain!: GainNode
  private sfxGain!: GainNode
  private noiseBuf!: AudioBuffer

  private tracks = new Map<MusicState, MusicTrack>()
  /** logický stav hudby (drží se i před unlock — spustí se pak) */
  private current: MusicState = 'menu'
  /** od kdy je požadovaný stav NIŽŠÍ než hrající (hystereze), null = klid neběží */
  private calmSince: number | null = null
  /** victory/defeat už zazněly — dál ticho */
  private finalDone = false

  private menuMode = true
  private lastState: SimState | null = null

  private settings = loadSettings()
  /** čas posledního přehrání každého SFX (throttle dávek událostí) */
  private lastSfx = new Map<SfxName, number>()

  // ---------- veřejné API ----------

  get muted(): boolean { return this.settings.muted }
  get musicVolume(): number { return this.settings.music }
  get sfxVolume(): number { return this.settings.sfx }

  /**
   * Vytvoří/odemkne AudioContext. Volat z uživatelského gesta (klik);
   * opakovaná volání jen zkusí resume — bezpečné volat kdykoliv.
   */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
    } catch {
      return
    }
    const ctx = this.ctx
    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = this.settings.muted ? 0 : 1
    this.masterGain.connect(ctx.destination)
    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = this.settings.music
    this.musicGain.connect(this.masterGain)
    this.sfxGain = ctx.createGain()
    this.sfxGain.gain.value = this.settings.sfx
    this.sfxGain.connect(this.masterGain)
    // sdílený buffer bílého šumu (1 s) pro všechny šumové efekty
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    ctx.resume().catch(() => {})
    // spustí hudbu aktuálního logického stavu (typicky 'menu')
    this.applyMusic(this.current)
  }

  /** menu + briefing → hudba 'menu'; false → stav dle snapshotů */
  setMenuMode(on: boolean): void {
    this.menuMode = on
    if (on) this.setDesired('menu')
    else if (this.lastState) this.setDesired(musicStateFor(this.lastState))
  }

  /** volat z snapshot callbacku — řídí hudbu i SFX z událostí */
  onSnapshot(state: SimState): void {
    this.lastState = state
    this.handleEvents(state)
    if (!this.menuMode) this.setDesired(musicStateFor(state))
  }

  /** tiché UI ťuknutí pro tlačítka rozkazů (volá se z gesta → i unlock) */
  uiClick(): void {
    this.unlock()
    this.sfx('click', 1, 90)
  }

  setMuted(m: boolean): void {
    this.settings.muted = m
    this.save()
    if (this.ctx) this.ramp(this.masterGain, m ? 0 : 1, 0.05)
  }

  setMusicVolume(v: number): void {
    this.settings.music = Math.min(1, Math.max(0, v))
    this.save()
    if (this.ctx) this.ramp(this.musicGain, this.settings.music, 0.05)
  }

  setSfxVolume(v: number): void {
    this.settings.sfx = Math.min(1, Math.max(0, v))
    this.save()
    if (this.ctx) this.ramp(this.sfxGain, this.settings.sfx, 0.05)
  }

  // ---------- hudba: stavový automat s hysterezí ----------

  private setDesired(desired: MusicState): void {
    if (this.finalDone) return
    if (desired === this.current) { this.calmSince = null; return }
    const cur = RANK[this.current]
    const des = RANK[desired]
    // pokles v bojovém žebříčku (combat→tension→cruise) až po 20 s klidu
    if (cur !== undefined && des !== undefined && des < cur) {
      const now = performance.now()
      if (this.calmSince == null) { this.calmSince = now; return }
      if (now - this.calmSince < CALM_DOWN_MS) return
    }
    this.calmSince = null
    this.applyMusic(desired)
  }

  /** provede přepnutí: crossfade ~3 s; victory/defeat jednou bez loop */
  private applyMusic(target: MusicState): void {
    this.current = target
    const oneShot = target === 'victory' || target === 'defeat'
    if (oneShot) this.finalDone = true
    const ctx = this.ctx
    if (!ctx) return // spustí se při unlock()
    const t = ctx.currentTime

    // fade-out všech ostatních běžících stop
    for (const [name, tr] of this.tracks) {
      if (name === target) continue
      tr.gain.gain.cancelScheduledValues(t)
      tr.gain.gain.setValueAtTime(tr.gain.gain.value, t)
      tr.gain.gain.linearRampToValueAtTime(0, t + FADE_S)
      if (!tr.el.paused) {
        const el = tr.el
        window.setTimeout(() => { if (this.current !== name) el.pause() }, FADE_S * 1000 + 200)
      }
    }

    // fade-in cílové stopy
    const tr = this.track(target)
    if (tr.failed) return // soubor chybí → ticho (stav ale platí)
    tr.el.loop = !oneShot
    tr.gain.gain.cancelScheduledValues(t)
    tr.gain.gain.setValueAtTime(tr.gain.gain.value, t)
    tr.gain.gain.linearRampToValueAtTime(1, t + FADE_S)
    tr.el.play().catch(() => { /* 404 / autoplay — tiše bez hudby */ })
  }

  /** lazy vytvoření stopy: audio/music-<stav>.mp3, error → failed (ticho) */
  private track(name: MusicState): MusicTrack {
    let tr = this.tracks.get(name)
    if (tr) return tr
    const ctx = this.ctx!
    const el = new Audio(`audio/music-${name}.mp3`)
    el.preload = 'auto'
    el.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.musicGain)
    const created: MusicTrack = { el, gain, failed: false }
    el.addEventListener('error', () => { created.failed = true })
    ctx.createMediaElementSource(el).connect(gain)
    this.tracks.set(name, created)
    return created
  }

  // ---------- SFX: mapování událostí ----------

  private handleEvents(state: SimState): void {
    if (!this.ctx) return
    for (const ev of state.events) {
      const side = ev.side ?? state.ships.find(s => s.id === ev.shipId)?.side
      switch (ev.kind) {
        case 'launch':
          // side = strana střílející lodi
          if (side === 'player') this.sfx('launch')
          else if (side === 'enemy') this.sfx('incoming')
          break
        case 'missileHit':
          // side = strana zasažené lodi
          if (side === 'player') this.sfx('hitOwn')
          else this.sfx('hitEnemy')
          break
        case 'missileKilled':
          this.sfx('missileKilled')
          break
        case 'energyHit':
          // side = strana zasažené lodi
          this.sfx('energy')
          if (side === 'player') this.sfx('hitOwn', 0.5)
          break
        case 'shipDestroyed':
          if (side === 'player') this.sfx('hitOwn', 1.6)
          else this.sfx('hitEnemy', 1.5)
          break
        case 'comm':
          this.sfx('comm')
          break
        case 'objective':
          this.sfx('objective')
          break
        default:
          break
      }
    }
  }

  /** přehraje SFX; stejný zvuk max 1× za minGapMs (dávky při kompresi času) */
  private sfx(name: SfxName, vol = 1, minGapMs = 500): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const now = performance.now()
    if (now - (this.lastSfx.get(name) ?? -Infinity) < minGapMs) return
    this.lastSfx.set(name, now)

    // per-play výstupní gain (umožňuje škálovat hlasitost jednoho přehrání)
    const out = ctx.createGain()
    out.gain.value = vol
    out.connect(this.sfxGain)
    const t = ctx.currentTime
    switch (name) {
      case 'launch': this.sLaunch(t, out); break
      case 'incoming': this.sIncoming(t, out); break
      case 'hitOwn': this.sHitOwn(t, out); break
      case 'hitEnemy': this.sHitEnemy(t, out); break
      case 'missileKilled': this.sPip(t, out); break
      case 'energy': this.sEnergy(t, out); break
      case 'comm': this.sComm(t, out); break
      case 'objective': this.sObjective(t, out); break
      case 'click': this.sClick(t, out); break
    }
  }

  // ---------- SFX: syntéza (sdílený ctx, krátké obálky) ----------

  /** oscilátor s gain obálkou; vrací gain node pro připojení filtru apod. */
  private osc(
    type: OscillatorType, freq: number, t0: number, dur: number, out: AudioNode,
  ): { o: OscillatorNode; g: GainNode } {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t0)
    o.connect(g)
    g.connect(out)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
    return { o, g }
  }

  /** zdroj šumu ze sdíleného bufferu */
  private noise(t0: number, dur: number): AudioBufferSourceNode {
    const ctx = this.ctx!
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    n.loop = true
    n.start(t0)
    n.stop(t0 + dur + 0.05)
    return n
  }

  /** odpal vlastní salvy: hluboký thump + stoupající filtered-noise whoosh */
  private sLaunch(t: number, out: AudioNode): void {
    const ctx = this.ctx!
    const { o, g } = this.osc('sine', 75, t, 0.45, out)
    o.frequency.exponentialRampToValueAtTime(28, t + 0.4)
    g.gain.linearRampToValueAtTime(0.7, t + 0.02)
    g.gain.linearRampToValueAtTime(0, t + 0.45)

    const n = this.noise(t, 0.6)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(250, t)
    bp.frequency.exponentialRampToValueAtTime(2800, t + 0.55)
    bp.Q.value = 1.2
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(0.35, t + 0.08)
    ng.gain.linearRampToValueAtTime(0, t + 0.6)
    n.connect(bp)
    bp.connect(ng)
    ng.connect(out)
  }

  /** příchozí nepřátelská salva: dvojitý varovný klakson (pilový osc) */
  private sIncoming(t: number, out: AudioNode): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(620, t)
    o.frequency.setValueAtTime(460, t + 0.42) // druhý tón níž
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1500
    const g = ctx.createGain()
    // dvě houknutí: 0–0,3 s a 0,42–0,75 s
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.3, t + 0.02)
    g.gain.setValueAtTime(0.3, t + 0.28)
    g.gain.linearRampToValueAtTime(0, t + 0.32)
    g.gain.setValueAtTime(0, t + 0.42)
    g.gain.linearRampToValueAtTime(0.3, t + 0.44)
    g.gain.setValueAtTime(0.3, t + 0.72)
    g.gain.linearRampToValueAtTime(0, t + 0.78)
    o.connect(lp)
    lp.connect(g)
    g.connect(out)
    o.start(t)
    o.stop(t + 0.85)
  }

  /** zásah vlastní lodi: kovový úder — šumový burst + rezonance + sub thump */
  private sHitOwn(t: number, out: AudioNode): void {
    const ctx = this.ctx!
    // rezonanční kovové zazvonění
    for (const [freq, q, amp] of [[850, 9, 0.5], [2300, 12, 0.25]] as const) {
      const n = this.noise(t, 0.35)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = freq
      bp.Q.value = q
      const g = ctx.createGain()
      g.gain.setValueAtTime(amp, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      n.connect(bp)
      bp.connect(g)
      g.connect(out)
    }
    // sub thump
    const { o, g } = this.osc('sine', 60, t, 0.3, out)
    o.frequency.exponentialRampToValueAtTime(35, t + 0.25)
    g.gain.linearRampToValueAtTime(0.6, t + 0.01)
    g.gain.linearRampToValueAtTime(0, t + 0.3)
  }

  /** zásah nepřátelské lodi: vzdálený tlumený výbuch (tišší) */
  private sHitEnemy(t: number, out: AudioNode): void {
    const ctx = this.ctx!
    const n = this.noise(t, 0.6)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(400, t)
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.55)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.28, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    n.connect(lp)
    lp.connect(g)
    g.connect(out)
  }

  /** sestřelená raketa: krátké tiché pip */
  private sPip(t: number, out: AudioNode): void {
    const { g } = this.osc('sine', 1350, t, 0.06, out)
    g.gain.linearRampToValueAtTime(0.12, t + 0.005)
    g.gain.linearRampToValueAtTime(0, t + 0.06)
  }

  /** energetická palba: ostrý zap — rychlý pitch-sweep pilového osc */
  private sEnergy(t: number, out: AudioNode): void {
    const ctx = this.ctx!
    const { o, g } = this.osc('sawtooth', 2200, t, 0.2, out)
    o.frequency.exponentialRampToValueAtTime(160, t + 0.18)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 250
    g.disconnect()
    g.connect(hp)
    hp.connect(out)
    g.gain.linearRampToValueAtTime(0.35, t + 0.008)
    g.gain.linearRampToValueAtTime(0, t + 0.2)
  }

  /** příchozí komunikace: dvě rádiová pípnutí + krátká statická tečka */
  private sComm(t: number, out: AudioNode): void {
    const ctx = this.ctx!
    for (const [freq, at] of [[880, 0], [1245, 0.13]] as const) {
      const { g } = this.osc('sine', freq, t + at, 0.09, out)
      g.gain.linearRampToValueAtTime(0.2, t + at + 0.01)
      g.gain.setValueAtTime(0.2, t + at + 0.07)
      g.gain.linearRampToValueAtTime(0, t + at + 0.09)
    }
    // statická tečka
    const n = this.noise(t + 0.26, 0.05)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3200
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.09, t + 0.26)
    g.gain.linearRampToValueAtTime(0, t + 0.31)
    n.connect(hp)
    hp.connect(g)
    g.connect(out)
  }

  /** splněný cíl: jemný potvrzovací dvojtón */
  private sObjective(t: number, out: AudioNode): void {
    for (const [freq, at] of [[660, 0], [880, 0.16]] as const) {
      const { g } = this.osc('triangle', freq, t + at, 0.25, out)
      g.gain.linearRampToValueAtTime(0.18, t + at + 0.02)
      g.gain.linearRampToValueAtTime(0, t + at + 0.25)
    }
  }

  /** tiché UI ťuknutí */
  private sClick(t: number, out: AudioNode): void {
    const ctx = this.ctx!
    const n = this.noise(t, 0.025)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 2
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.1, t)
    g.gain.linearRampToValueAtTime(0, t + 0.025)
    n.connect(bp)
    bp.connect(g)
    g.connect(out)
  }

  // ---------- pomocné ----------

  private ramp(node: GainNode, v: number, dur: number): void {
    const t = this.ctx!.currentTime
    node.gain.cancelScheduledValues(t)
    node.gain.setValueAtTime(node.gain.value, t)
    node.gain.linearRampToValueAtTime(v, t + dur)
  }

  private save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.settings))
    } catch { /* soukromý režim apod. — nastavení se prostě nepersistuje */ }
  }
}
