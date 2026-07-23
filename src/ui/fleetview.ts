/**
 * Kinematický „beauty" render flotily (faux-3D perspektiva) — pozadí menu.
 *
 * NENÍ to taktický plot: kamera je nízko nad rovinou a dívá se k obzoru za
 * soumraku, flotila stojí v řadách ustupujících do dálky, v čele velká
 * mateřská loď. Cíl = přiblížit se koncept-artu (Homeworld / Star Citizen
 * „fleet over a hazy planet at sunset").
 *
 * Vše canvas 2D, deterministické (hash místo Math.random), animace z času.
 * Trupy jsou ploché horní paluby zkosené perspektivou (foreshortening) +
 * vytažený bok (výška) + nasvícení nízkým sluncem + rim + svítící okna.
 */

/** foreshortening horní paluby (nízký úhel pohledu) */
const FORE = 0.42

/** hash → [0,1) */
function h01(a: number, b: number): number {
  let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 40503)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

type Poly = [number, number][]

/** archetypy horních palub — dlouhé, štíhlé, ploché (x napříč, y příď=-1 … záď=+1) */
const HULLS: Record<string, Poly> = {
  // mateřská loď: dlouhá nízká šestihranná paluba se zúženou přídí
  carrier: [[0, -1.2], [0.18, -0.92], [0.28, -0.2], [0.28, 0.55], [0.19, 1.0],
    [-0.19, 1.0], [-0.28, 0.55], [-0.28, -0.2], [-0.18, -0.92]],
  // těžký křižník: štíhlý šestihran
  capital: [[0, -1.15], [0.24, -0.5], [0.28, 0.45], [0.17, 1.0],
    [-0.17, 1.0], [-0.28, 0.45], [-0.24, -0.5]],
  // eskorta: protáhlá šipka
  escort: [[0, -1.15], [0.28, 0.3], [0.16, 1.0], [-0.16, 1.0], [-0.28, 0.3]],
  // stíhač: úzká střela
  fighter: [[0, -1], [0.34, 0.55], [0, 0.9], [-0.34, 0.55]],
}

export interface FleetPalette {
  deckLight: string
  deckDark: string
  side: string
  rim: string
  window: string
  engine: string
}

const PAL: FleetPalette = {
  deckLight: '#8fa6bd', deckDark: '#24303f', side: '#0e151f',
  rim: '#ffcf9c', window: '#bfe6ff', engine: '#7fd8ff',
}

interface ShipInst {
  kind: keyof typeof HULLS
  x: number       // laterální pozice ve světě
  z: number       // hloubka (větší = dál)
  size: number    // základní velikost
  bob: number     // fáze pohupování
}

/** rozestavení flotily — deterministické, ustupující řady + hrdinská loď */
function buildFleet(): ShipInst[] {
  const ships: ShipInst[] = []
  // hrdinská mateřská loď — velká, blízko, mírně vlevo
  ships.push({ kind: 'carrier', x: -0.28, z: 1.15, size: 1.25, bob: 0.3 })
  // kapitální lodě v druhém plánu
  ships.push({ kind: 'capital', x: 0.5, z: 1.75, size: 0.66, bob: 1.1 })
  ships.push({ kind: 'capital', x: 1.15, z: 2.4, size: 0.5, bob: 2.0 })
  ships.push({ kind: 'capital', x: -1.25, z: 2.2, size: 0.54, bob: 0.7 })
  // řady eskort ustupující do dálky
  const rows = [
    { z: 2.6, n: 4, size: 0.34, spread: 0.62 },
    { z: 3.3, n: 5, size: 0.27, spread: 0.58 },
    { z: 4.2, n: 6, size: 0.2, spread: 0.52 },
    { z: 5.4, n: 7, size: 0.15, spread: 0.48 },
  ]
  let seed = 7
  for (const r of rows) {
    for (let i = 0; i < r.n; i++) {
      const t = r.n === 1 ? 0.5 : i / (r.n - 1)
      const x = (t - 0.5) * 2 * r.spread * r.z
      ships.push({
        kind: r.size < 0.18 ? 'fighter' : 'escort',
        x: x + (h01(seed, i) - 0.5) * 0.2,
        z: r.z + (h01(seed + 1, i) - 0.5) * 0.25,
        size: r.size, bob: h01(seed + 2, i) * 6.28,
      })
      seed += 3
    }
  }
  // hejno stíhaček nízko vepředu
  for (let i = 0; i < 9; i++) {
    ships.push({
      kind: 'fighter',
      x: (h01(99, i) - 0.5) * 3.2,
      z: 2.2 + h01(100, i) * 1.4,
      size: 0.08 + h01(101, i) * 0.04,
      bob: h01(102, i) * 6.28,
    })
  }
  // vzdálené drobné lodě u obzoru
  for (let i = 0; i < 14; i++) {
    ships.push({
      kind: 'escort',
      x: (h01(51, i) - 0.5) * 16,
      z: 6.5 + h01(52, i) * 5,
      size: 0.12, bob: h01(53, i) * 6.28,
    })
  }
  return ships
}

const FLEET = buildFleet()

/** perspektivní projekce: střed obzoru + ohnisko */
interface Cam { w: number; h: number; horizon: number; focal: number; sunX: number }

function project(cam: Cam, x: number, z: number): { sx: number; sy: number; k: number } {
  const k = cam.focal / z
  const sx = cam.w / 2 + x * k
  const sy = cam.horizon + (0.9 * k)  // rovina lodí mírně nad obzorem klesá s blízkostí
  return { sx, sy, k }
}

/** obloha, slunce, opar, planeta */
function drawSky(ctx: CanvasRenderingContext2D, cam: Cam, t: number): void {
  const { w, h, horizon, sunX } = cam
  const sunY = horizon - h * 0.06
  // obloha: nahoře chladná, k obzoru teplá
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + h * 0.1)
  sky.addColorStop(0, '#20263c')
  sky.addColorStop(0.45, '#5a3f4e')
  sky.addColorStop(0.78, '#c9743f')
  sky.addColorStop(1, '#ffd27a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, horizon + h * 0.12)
  // sluneční záře nad obzorem
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.5)
  halo.addColorStop(0, '#fff4d8')
  halo.addColorStop(0.12, '#ffcf8a')
  halo.addColorStop(0.5, '#a8552e')
  halo.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.9
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, w, horizon + h * 0.2)
  // jádro slunce (jemné chvění)
  const rc = 26 + Math.sin(t / 900) * 2
  const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, rc)
  core.addColorStop(0, '#fffdf7')
  core.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.95
  ctx.fillStyle = core
  ctx.beginPath(); ctx.arc(sunX, sunY, rc, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  // planeta / povrch pod obzorem: reddish plane do hloubky
  const ground = ctx.createLinearGradient(0, horizon, 0, h)
  ground.addColorStop(0, '#b5673a')
  ground.addColorStop(0.25, '#7a4430')
  ground.addColorStop(1, '#2a1620')
  ctx.fillStyle = ground
  ctx.fillRect(0, horizon, w, h - horizon)
  // atmosférický opar u obzoru (překrývá spodek oblohy i zem)
  const haze = ctx.createLinearGradient(0, horizon - h * 0.1, 0, horizon + h * 0.18)
  haze.addColorStop(0, 'rgba(255,180,110,0)')
  haze.addColorStop(0.5, 'rgba(255,170,100,0.5)')
  haze.addColorStop(1, 'rgba(200,110,70,0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, horizon - h * 0.1, w, h * 0.28)
}

/** jedna loď v perspektivě: bok (výška) + horní paluba + rim + okna + pohon */
function drawShip(
  ctx: CanvasRenderingContext2D, cam: Cam, s: ShipInst, t: number,
): void {
  const p = project(cam, s.x, s.z)
  const bob = Math.sin(t / 1400 + s.bob) * (2.2 / s.z)
  const cx = p.sx
  const cy = p.sy + bob - p.k * 0.12 * s.size  // lehce nad rovinou
  const size = p.k * s.size * 0.5
  if (size < 0.6) return
  const poly = HULLS[s.kind]
  const aspect = 1
  // atmosférické splynutí do dálky (vzdálené lodě blednou do oparu)
  const fade = Math.max(0.15, Math.min(1, 2.6 / s.z))

  const top: [number, number][] = poly.map(([x, y]) => [cx + x * size * aspect, cy + y * size * FORE])
  const depth = size * (s.kind === 'carrier' ? 0.16 : 0.12)

  ctx.save()
  ctx.globalAlpha = fade

  // 1) BOK (výška): spodní hrany paluby vytažené dolů
  ctx.beginPath()
  for (let i = 0; i < top.length; i++) {
    const a = top[i], b = top[(i + 1) % top.length]
    // jen hrany na přivrácené (spodní) polovině tvoří viditelný bok
    if ((a[1] + b[1]) / 2 < cy - 0.01) continue
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
    ctx.lineTo(b[0], b[1] + depth); ctx.lineTo(a[0], a[1] + depth)
    ctx.closePath()
  }
  const sideG = ctx.createLinearGradient(0, cy, 0, cy + depth)
  sideG.addColorStop(0, PAL.side)
  sideG.addColorStop(1, '#05080c')
  ctx.fillStyle = sideG
  ctx.fill()

  // 2) HORNÍ PALUBA: gradient od osvětlené (vpravo/nahoře) k zastíněné
  ctx.beginPath()
  ctx.moveTo(top[0][0], top[0][1])
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1])
  ctx.closePath()
  const deck = ctx.createLinearGradient(cx - size * 0.7, cy - size * FORE, cx + size * 0.7, cy + size * FORE)
  deck.addColorStop(0, '#2b3644')
  deck.addColorStop(0.55, '#3e4c5d')
  deck.addColorStop(1, '#5d7183')
  ctx.fillStyle = deck
  ctx.fill()

  // 3) panelové linky podél osy (jemné, tmavé)
  ctx.save()
  ctx.clip()
  ctx.globalAlpha = fade * 0.35
  ctx.strokeStyle = '#1a222d'
  ctx.lineWidth = Math.max(0.4, size * 0.025)
  ctx.beginPath()
  // podélná osa + pár příčných spár
  ctx.moveTo(cx, cy - size * FORE); ctx.lineTo(cx, cy + size * FORE)
  for (let i = -1; i <= 1; i++) {
    const yy = cy + i * size * FORE * 0.45
    ctx.moveTo(cx - size * 0.3, yy); ctx.lineTo(cx + size * 0.3, yy)
  }
  ctx.stroke()
  // 4) svítící okna: řídké teplé/chladné tečky, jen u větších lodí
  if (size > 4) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = PAL.window
    const rows = s.kind === 'carrier' ? 2 : 1
    const n = Math.min(10, Math.max(3, Math.round(size * 0.18)))
    const ws = Math.max(0.5, size * 0.028)
    for (let r = 0; r < rows; r++) {
      const yy = cy + (r - (rows - 1) / 2) * size * FORE * 0.4
      for (let i = 0; i < n; i++) {
        const xx = cx + (i / (n - 1) - 0.5) * size * 0.5
        const on = h01(i * 7 + r, Math.floor(t / 650) + (s.bob | 0)) > 0.35
        ctx.globalAlpha = fade * (on ? 0.8 : 0.15)
        ctx.fillRect(xx - ws / 2, yy - ws / 2, ws, ws)
      }
    }
  }
  ctx.restore()

  // 5) podélný hřbet + superstruktura (můstek) u velkých lodí
  if (s.kind === 'carrier' || s.kind === 'capital') {
    // hřbet: dlouhý mírně vyvýšený pás po ose (kovový lesk)
    ctx.save()
    const spineW = size * 0.12
    const sg = ctx.createLinearGradient(cx - spineW, 0, cx + spineW, 0)
    sg.addColorStop(0, '#4a5a6d'); sg.addColorStop(0.5, '#6b8093'); sg.addColorStop(1, '#33404e')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.moveTo(cx - spineW, cy - size * FORE * 0.7); ctx.lineTo(cx + spineW, cy - size * FORE * 0.7)
    ctx.lineTo(cx + spineW * 0.7, cy + size * FORE * 0.75); ctx.lineTo(cx - spineW * 0.7, cy + size * FORE * 0.75)
    ctx.closePath(); ctx.fill()
    ctx.restore()
    // můstek: menší blok blíž k přídi
    const bw = size * 0.15, bh = size * FORE * 0.28
    const bx = cx, by = cy - size * FORE * 0.42
    ctx.fillStyle = '#6a8093'
    ctx.beginPath()
    ctx.moveTo(bx - bw, by + bh); ctx.lineTo(bx - bw * 0.6, by - bh)
    ctx.lineTo(bx + bw * 0.6, by - bh); ctx.lineTo(bx + bw, by + bh)
    ctx.closePath()
    ctx.fill()
    // jen horní hrana můstku chytá slunce
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade * 0.7
    ctx.strokeStyle = PAL.rim; ctx.lineWidth = Math.max(0.4, size * 0.03)
    ctx.beginPath(); ctx.moveTo(bx - bw * 0.6, by - bh); ctx.lineTo(bx + bw * 0.6, by - bh); ctx.stroke()
    ctx.restore()
  }

  // 6) sluneční rim jen na přivrácených (horních/vzdálených) hranách paluby
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = fade * 0.85
  ctx.strokeStyle = PAL.rim
  ctx.lineWidth = Math.max(0.5, size * 0.045)
  ctx.beginPath()
  for (let i = 0; i < top.length; i++) {
    const a = top[i], b = top[(i + 1) % top.length]
    // hrana je „přivrácená ke slunci", když leží v horní polovině paluby
    if ((a[1] + b[1]) / 2 < cy - size * FORE * 0.08) {
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
    }
  }
  ctx.stroke()
  ctx.restore()

  // 7) trysky na zádi: pár malých zářících bodů + krátký oplach dolů
  const tailY = cy + size * FORE + depth
  const flick = 0.82 + 0.18 * Math.sin(t / 70 + s.bob * 3)
  const nEng = s.kind === 'carrier' ? 4 : s.kind === 'capital' ? 3 : s.kind === 'fighter' ? 1 : 2
  const engW = size * (s.kind === 'fighter' ? 0.0 : 0.2)
  const er = Math.max(0.9, size * 0.11) * flick
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < nEng; i++) {
    const ex = cx + (nEng === 1 ? 0 : (i / (nEng - 1) - 0.5) * 2 * engW)
    // oplach: protáhlá záře směrem k divákovi (dolů)
    const plume = ctx.createLinearGradient(ex, tailY, ex, tailY + er * 3.2)
    plume.addColorStop(0, PAL.engine)
    plume.addColorStop(1, 'transparent')
    ctx.globalAlpha = fade * 0.4
    ctx.fillStyle = plume
    ctx.beginPath(); ctx.ellipse(ex, tailY + er * 1.4, er * 0.7, er * 2, 0, 0, Math.PI * 2); ctx.fill()
    // horké jádro trysky
    const eng = ctx.createRadialGradient(ex, tailY, 0, ex, tailY, er)
    eng.addColorStop(0, '#f2ffff')
    eng.addColorStop(0.5, PAL.engine)
    eng.addColorStop(1, 'transparent')
    ctx.globalAlpha = fade * 0.8
    ctx.fillStyle = eng
    ctx.beginPath(); ctx.arc(ex, tailY, er, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()

  ctx.restore()
}

/**
 * Vykresli celou scénu do canvasu (w×h v CSS px, ctx už má DPR transform).
 * `t` = čas v ms (animace).
 */
export function renderFleet(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const cam: Cam = { w, h, horizon: h * 0.34, focal: h * 0.62, sunX: w * 0.6 }
  drawSky(ctx, cam, t)
  // lodě odzadu dopředu (painter's algorithm — větší z první)
  const order = [...FLEET].sort((a, b) => b.z - a.z)
  for (const s of order) drawShip(ctx, cam, s, t)
  // atmosférický prach: pomalu plující teplé částice (hloubka a život)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 48; i++) {
    const depth = 0.3 + h01(i, 3) * 0.7
    const drift = (t / 1000) * (6 + depth * 14)
    const px = ((h01(i, 1) * w + drift) % (w + 40)) - 20
    const py = cam.horizon + h01(i, 2) * (h - cam.horizon)
    const s = depth * 1.6
    ctx.globalAlpha = 0.05 + h01(i, 4) * 0.08
    ctx.fillStyle = '#ffcf9a'
    ctx.fillRect(px, py + Math.sin(t / 2000 + i) * 3, s, s)
  }
  ctx.restore()
  // jemná vinětace + filmové zrno oparu
  const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.7)
  vg.addColorStop(0, 'transparent')
  vg.addColorStop(1, 'rgba(6,4,10,0.55)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
}

/** samostatná animační smyčka na daném canvasu (pro pozadí menu / demo) */
export function startFleetView(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  let raf = 0
  const loop = (): void => {
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w > 0 && h > 0) {
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr)
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderFleet(ctx, w, h, performance.now())
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    // uvolni DPR-scaled backing bitmap, ať nedrží druhý full-screen buffer
    // během mise (na hi-DPI mobilu ~10–25 MB); při restartu se obnoví v loop()
    canvas.width = 0
    canvas.height = 0
  }
}
