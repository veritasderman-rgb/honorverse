/**
 * Vizuální efekty plotu (fáze A grafického upgradu, docs/GFX_PLAN.md).
 * Čistě RENDER vrstva: efekty vznikají z eventů simu (které nesou pos)
 * a stárnou podle render hodin (performance.now) — simulace o nich neví,
 * determinismus zůstává nedotčený. Pool efektů má tvrdý strop.
 */
import type { ShipState, SimEvent, Vec2 } from '../sim/types'

export type EffectKind =
  | 'cmHit'   // protiraketa zničila raketu (jiskra + linka od obránce)
  | 'pdlc'    // bodová obrana — laserové paprsky
  | 'wedgeHit'// raketa roztříštěná o klín
  | 'fizzle'  // ztráta zámku / návnada / hlavice mimo — zhasnutí
  | 'hit'     // zásah laserové hlavice — expandující prstenec
  | 'energy'  // energetická salva — ostrý zákmit
  | 'spark'   // zásah subsystému — jiskry z trupu
  | 'boom'    // zničení lodi — exploze

export interface Effect {
  kind: EffectKind
  /** světová pozice (km) — efekt zůstává tam, kde se stal */
  pos: Vec2
  /** zdroj paprsku/linky (obránce) — cmHit/pdlc */
  from?: Vec2
  /** strana RAKETY u zásahů (player = náš zásah → zelený) */
  side?: string
  /** render čas vzniku (ms) */
  born: number
}

export interface Wreck {
  pos: Vec2
  name: string
}

/** životnost efektů (ms) */
const TTL: Record<EffectKind, number> = {
  cmHit: 500, pdlc: 320, wedgeHit: 550, fizzle: 650,
  hit: 900, energy: 700, spark: 450, boom: 1600,
}

/** tvrdý strop poolu — FIFO (starší efekty padají první) */
const MAX_EFFECTS = 200
const MAX_WRECKS = 60

/** deterministický hash → [0,1) pro rozhoz úlomků (žádný Math.random) */
const hash01 = (a: number, b: number): number => {
  let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 40503)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

/**
 * Převod eventů snapshotu na efekty. Volat JEDNOU per snapshot
 * (worker eventy po odeslání maže — nehrozí dvojité započtení).
 */
export function ingestEvents(
  events: SimEvent[], ships: ShipState[],
  effects: Effect[], wrecks: Wreck[], now: number,
): void {
  const shipPos = (id: number | undefined): Vec2 | undefined => {
    const s = id !== undefined ? ships.find(x => x.id === id) : undefined
    return s ? { ...s.pos } : undefined
  }
  for (const ev of events) {
    if (!ev.pos) continue
    const pos = { ...ev.pos }
    switch (ev.kind) {
      case 'missileKilled':
        if (ev.cause === 'cm') {
          effects.push({ kind: 'cmHit', pos, from: shipPos(ev.shipId), born: now })
        } else if (ev.cause === 'pdlc') {
          effects.push({ kind: 'pdlc', pos, from: shipPos(ev.shipId), born: now })
        } else if (ev.cause === 'wedge') {
          effects.push({ kind: 'wedgeHit', pos, born: now })
        } else {
          effects.push({ kind: 'fizzle', pos, born: now })
        }
        break
      case 'missileMiss':
        effects.push({ kind: 'fizzle', pos, born: now })
        break
      case 'missileHit':
        effects.push({ kind: 'hit', pos, side: ev.side, born: now })
        break
      case 'energyHit':
        effects.push({ kind: 'energy', pos, born: now })
        break
      case 'subsystemHit':
        effects.push({ kind: 'spark', pos, born: now })
        break
      case 'shipDestroyed': {
        effects.push({ kind: 'boom', pos, born: now })
        const name = ev.text.replace(/ zničena$/, '')
        wrecks.push({ pos, name })
        if (wrecks.length > MAX_WRECKS) wrecks.shift()
        break
      }
      default:
        break
    }
  }
  while (effects.length > MAX_EFFECTS) effects.shift()
}

/** vykreslení + úklid prošlých efektů (mutuje pole) */
export function drawEffects(
  ctx: CanvasRenderingContext2D, effects: Effect[], now: number,
  w2s: (p: Vec2) => Vec2,
): void {
  let write = 0
  ctx.save()
  for (const e of effects) {
    const age = now - e.born
    const ttl = TTL[e.kind]
    if (age >= ttl) continue
    effects[write++] = e
    const t = age / ttl               // 0 → 1
    const fade = 1 - t
    const p = w2s(e.pos)

    switch (e.kind) {
      case 'cmHit': {
        // linka protiraketa (od obránce) + křížová jiskra
        ctx.globalAlpha = fade * 0.7
        if (e.from) {
          const f = w2s(e.from)
          ctx.strokeStyle = '#9fe08a'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 4])
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(p.x, p.y); ctx.stroke()
          ctx.setLineDash([])
        }
        const r = 2 + t * 5
        ctx.strokeStyle = '#eaffea'
        ctx.beginPath()
        ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y)
        ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r)
        ctx.stroke()
        break
      }
      case 'pdlc': {
        // 3 tenké laserové paprsky od obránce k raketě
        ctx.globalAlpha = fade
        ctx.strokeStyle = '#d9ffd0'
        ctx.lineWidth = 0.8
        const f = e.from ? w2s(e.from) : { x: p.x - 20, y: p.y + 10 }
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath()
          ctx.moveTo(f.x + i * 2, f.y + i * 2)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }
        break
      }
      case 'wedgeHit': {
        // roztříštění o klín: krátký oblouk
        ctx.globalAlpha = fade
        ctx.strokeStyle = '#8fe08a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4 + t * 6, -1.2, 1.2)
        ctx.stroke()
        break
      }
      case 'fizzle': {
        ctx.globalAlpha = fade * 0.5
        ctx.fillStyle = '#8a9a8a'
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0.5, 2 * fade), 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'hit': {
        // expandující prstenec + 4 jiskry; barva dle strany rakety
        const col = e.side === 'player' ? '#9fe08a' : '#ff705c'
        ctx.globalAlpha = fade
        ctx.strokeStyle = col
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2 + t * 13, 0, Math.PI * 2)
        ctx.stroke()
        ctx.lineWidth = 1
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.6
          const r0 = 3 + t * 10
          ctx.beginPath()
          ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0)
          ctx.lineTo(p.x + Math.cos(a) * (r0 + 4), p.y + Math.sin(a) * (r0 + 4))
          ctx.stroke()
        }
        break
      }
      case 'energy': {
        // ostrý zákmit: dvě zkřížené čepele + malý prstenec
        ctx.globalAlpha = fade
        ctx.strokeStyle = '#eaffea'
        ctx.lineWidth = 1.5
        const L = 8 + t * 6
        ctx.beginPath()
        ctx.moveTo(p.x - L, p.y - L * 0.4); ctx.lineTo(p.x + L, p.y + L * 0.4)
        ctx.moveTo(p.x - L, p.y + L * 0.4); ctx.lineTo(p.x + L, p.y - L * 0.4)
        ctx.stroke()
        ctx.globalAlpha = fade * 0.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3 + t * 8, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'spark': {
        ctx.globalAlpha = fade
        ctx.strokeStyle = '#ffd27a'
        ctx.lineWidth = 1
        for (let i = 0; i < 3; i++) {
          const a = hash01(e.born | 0, i) * Math.PI * 2
          const r = 2 + t * 7
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)
          ctx.stroke()
        }
        break
      }
      case 'boom': {
        // dvojitý expandující prstenec + úlomky letící ven
        ctx.globalAlpha = fade
        ctx.strokeStyle = '#ffb37a'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 + t * 22, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = fade * 0.5
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 + t * 34, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = '#ffd9d0'
        for (let i = 0; i < 8; i++) {
          const a = hash01(e.born | 0, i) * Math.PI * 2
          const r = 4 + t * (14 + hash01(i, e.born | 0) * 22)
          ctx.globalAlpha = fade * 0.9
          ctx.fillRect(p.x + Math.cos(a) * r - 1, p.y + Math.sin(a) * r - 1, 2, 2)
        }
        break
      }
    }
  }
  effects.length = write
  ctx.restore()
}

/** vraky: šedý kříž s polem trosek — poslední známé zakreslení zůstává */
export function drawWrecks(
  ctx: CanvasRenderingContext2D, wrecks: Wreck[], w2s: (p: Vec2) => Vec2,
): void {
  ctx.save()
  for (let wi = 0; wi < wrecks.length; wi++) {
    const w = wrecks[wi]
    const p = w2s(w.pos)
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = '#7a8a7e'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(p.x - 4, p.y - 4); ctx.lineTo(p.x + 4, p.y + 4)
    ctx.moveTo(p.x - 4, p.y + 4); ctx.lineTo(p.x + 4, p.y - 4)
    ctx.stroke()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = '#7a8a7e'
    for (let i = 0; i < 5; i++) {
      const a = hash01(wi + 1, i) * Math.PI * 2
      const r = 6 + hash01(i, wi + 7) * 8
      ctx.fillRect(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1.5, 1.5)
    }
    ctx.globalAlpha = 0.4
    ctx.fillText(`✕ ${w.name}`, p.x + 8, p.y + 10)
  }
  ctx.restore()
}

/**
 * Vektorová silueta lodi per třída trupu (lokální souřadnice, +x = příď,
 * měřítko ladí s dřívějšími ikonami ~8–14 px). Jen path + stroke — barvu
 * a tloušťku nastavuje volající.
 */
export function shipSilhouette(ctx: CanvasRenderingContext2D, hullCode: string): void {
  ctx.beginPath()
  switch (hullCode) {
    case 'DD': // úzká jehla s kladivounní přídí
      ctx.moveTo(9, 0); ctx.lineTo(6, 2); ctx.lineTo(-6, 2.5); ctx.lineTo(-8, 1)
      ctx.lineTo(-8, -1); ctx.lineTo(-6, -2.5); ctx.lineTo(6, -2); ctx.closePath()
      ctx.moveTo(6, -3.5); ctx.lineTo(6, 3.5) // příďový příčník
      break
    case 'DB': // kurýr: šipka, skoro jen pohon
      ctx.moveTo(7, 0); ctx.lineTo(-5, 3); ctx.lineTo(-3, 0); ctx.lineTo(-5, -3)
      ctx.closePath()
      break
    case 'CL': // štíhlý trup se senzorovým mastem
      ctx.moveTo(10, 0); ctx.lineTo(6, 2.5); ctx.lineTo(-7, 3); ctx.lineTo(-9, 1.2)
      ctx.lineTo(-9, -1.2); ctx.lineTo(-7, -3); ctx.lineTo(6, -2.5); ctx.closePath()
      ctx.moveTo(7, -4); ctx.lineTo(7, 4)      // příčník
      ctx.moveTo(-1, -3); ctx.lineTo(-1, -5.5) // mast
      break
    case 'CA': // hranatá pevnost
      ctx.moveTo(11, 0); ctx.lineTo(7, 3.5); ctx.lineTo(-8, 4); ctx.lineTo(-10, 1.5)
      ctx.lineTo(-10, -1.5); ctx.lineTo(-8, -4); ctx.lineTo(7, -3.5); ctx.closePath()
      ctx.moveTo(8, -5); ctx.lineTo(8, 5)
      ctx.moveTo(-2, -4); ctx.lineTo(-2, 4) // střední přepážka
      break
    case 'BC': // dlouhý klín nájezdníka
      ctx.moveTo(14, 0); ctx.lineTo(9, 3); ctx.lineTo(-10, 4); ctx.lineTo(-12, 1.5)
      ctx.lineTo(-12, -1.5); ctx.lineTo(-10, -4); ctx.lineTo(9, -3); ctx.closePath()
      ctx.moveTo(10, -4.5); ctx.lineTo(10, 4.5)
      ctx.moveTo(0, -3.7); ctx.lineTo(0, 3.7)
      break
    case 'DN': // stěna bitvy: masivní blok
      ctx.moveTo(14, 0); ctx.lineTo(9, 5); ctx.lineTo(-11, 6); ctx.lineTo(-13, 2.5)
      ctx.lineTo(-13, -2.5); ctx.lineTo(-11, -6); ctx.lineTo(9, -5); ctx.closePath()
      ctx.moveTo(10, -6.5); ctx.lineTo(10, 6.5)
      ctx.moveTo(2, -5.5); ctx.lineTo(2, 5.5)
      ctx.moveTo(-5, -6); ctx.lineTo(-5, 6)
      break
    case 'MERCH': // kontejnerová housenka
      ctx.moveTo(8, 2.5); ctx.lineTo(8, -2.5); ctx.lineTo(5, -4); ctx.lineTo(-7, -4)
      ctx.lineTo(-8, -2); ctx.lineTo(-8, 2); ctx.lineTo(-7, 4); ctx.lineTo(5, 4)
      ctx.closePath()
      ctx.moveTo(1, -4); ctx.lineTo(1, 4)   // spáry kontejnerů
      ctx.moveTo(-3, -4); ctx.lineTo(-3, 4)
      break
    case 'STN': // stanice: prstenec s paprsky
      ctx.arc(0, 0, 8, 0, Math.PI * 2)
      ctx.moveTo(4, 0); ctx.arc(0, 0, 4, 0, Math.PI * 2)
      ctx.moveTo(-8, 0); ctx.lineTo(8, 0)
      ctx.moveTo(0, -8); ctx.lineTo(0, 8)
      break
    default: // neznámý trup — kosočtverec (fallback)
      ctx.moveTo(10, 0); ctx.lineTo(0, 6); ctx.lineTo(-10, 0); ctx.lineTo(0, -6)
      ctx.closePath()
      break
  }
  ctx.stroke()
}
