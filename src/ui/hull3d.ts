/**
 * Objemové (pseudo-3D) trupy pro „Homeworld" režim plotu.
 *
 * Trik „3D shora": trup se kreslí jako VYPLNĚNÉ těleso stínované podle
 * PEVNÉ hvězdy ve světě (ne podle natočení lodi) — světlo přichází zleva
 * shora a když se loď otočí, přejede po ní odlesk. K tomu specular hřbet
 * po ose příď–záď, rim-light na osvětlené hraně a kontaktní stín pod
 * trupem (loď se „vznáší" nad senzorovou rovinou). Vše je čistě RENDER
 * (performance.now), simulace o tom neví — determinismus zůstává.
 *
 * Geometrie trupů je společná s CIC siluetami (stejné obrysy, jen tady
 * vyplněné a nasvícené), aby se obě vrstvy nerozešly.
 */

/**
 * Směr světla v OBRAZOVCE (jednotkový): odkud svítí hvězda soustavy, y dolů.
 * Nastavuje ho plot per mise podle scény (setLightDir), ať rim a stínování
 * trupů souhlasí s pozicí slunce na pozadí. Výchozí: vlevo nahoře.
 */
let LIGHT_SX = -0.55
let LIGHT_SY = -0.83

/** nastaví směr světla (normalizuje se); volá plot při změně scény mise */
export function setLightDir(sx: number, sy: number): void {
  const m = Math.hypot(sx, sy) || 1
  LIGHT_SX = sx / m
  LIGHT_SY = sy / m
}

export interface HullPalette {
  /** osvětlená strana trupu (přivrácená ke hvězdě) */
  light: string
  /** střední tón kovu */
  mid: string
  /** zastíněná strana */
  dark: string
  /** odlesk hřbetu / rim-light (jasný) */
  spec: string
  /** poziční světla (blikají) — nepovinné */
  lights?: string
  /** teplý sluneční rim na přivrácené hraně (soumrak) — nepovinné */
  sun?: string
  /** svítící okna trupu — nepovinné */
  window?: string
}

/** výchozí teplý sluneční rim (soumraková scéna) */
const SUN_RIM = '#ffcaa0'

interface HullGeom {
  /** obrys trupu (příď = +x), lokální km ~ px */
  outline: [number, number][]
  /** vnitřní členění (panely, příčníky) — úsečky */
  details: [[number, number], [number, number]][]
  /** poloha kontrolek/světel na trupu */
  lights: [number, number][]
  /** přibližný poloměr (pro gradient a stín) */
  r: number
  /** poloha zádi (kořen pohonné záře) */
  stern: number
}

/** obrysy odpovídají CIC siluetám ve fx.ts (vyplněná varianta) */
export const HULL_GEOM: Record<string, HullGeom> = {
  DD: {
    outline: [[9, 0], [6, 2], [-6, 2.5], [-8, 1], [-8, -1], [-6, -2.5], [6, -2]],
    details: [[[6, -3.2], [6, 3.2]], [[-2, -2], [-2, 2]]],
    lights: [[7, 0], [-5, 1.6], [-5, -1.6]],
    r: 9, stern: -8,
  },
  DB: {
    outline: [[7, 0], [-5, 3], [-3, 0], [-5, -3]],
    details: [[[-3, 0], [4, 0]]],
    lights: [[5, 0], [-4, 1.5], [-4, -1.5]],
    r: 7, stern: -4,
  },
  CL: {
    outline: [[10, 0], [6, 2.5], [-7, 3], [-9, 1.2], [-9, -1.2], [-7, -3], [6, -2.5]],
    details: [[[7, -3.6], [7, 3.6]], [[-1, -2.6], [-1, -5.2]], [[-3, -2.4], [-3, 2.4]]],
    lights: [[8, 0], [-6, 2], [-6, -2], [-1, -5]],
    r: 10, stern: -9,
  },
  CA: {
    outline: [[11, 0], [7, 3.5], [-8, 4], [-10, 1.5], [-10, -1.5], [-8, -4], [7, -3.5]],
    details: [[[8, -4.6], [8, 4.6]], [[-2, -3.6], [-2, 3.6]], [[3, -3], [3, 3]]],
    lights: [[9, 0], [-7, 3], [-7, -3], [1, 3.4], [1, -3.4]],
    r: 11, stern: -10,
  },
  BC: {
    outline: [[14, 0], [9, 3], [-10, 4], [-12, 1.5], [-12, -1.5], [-10, -4], [9, -3]],
    details: [[[10, -4.2], [10, 4.2]], [[0, -3.5], [0, 3.5]], [[-6, -3.6], [-6, 3.6]]],
    lights: [[12, 0], [-9, 3.2], [-9, -3.2], [0, 3.2], [0, -3.2]],
    r: 14, stern: -12,
  },
  DN: {
    outline: [[14, 0], [9, 5], [-11, 6], [-13, 2.5], [-13, -2.5], [-11, -6], [9, -5]],
    details: [[[10, -6], [10, 6]], [[2, -5.2], [2, 5.2]], [[-5, -5.6], [-5, 5.6]], [[-9, -5.6], [-9, 5.6]]],
    lights: [[12, 0], [-10, 5], [-10, -5], [2, 5], [2, -5], [-5, 5], [-5, -5]],
    r: 14, stern: -13,
  },
  MERCH: {
    outline: [[8, 2.5], [8, -2.5], [5, -4], [-7, -4], [-8, -2], [-8, 2], [-7, 4], [5, 4]],
    details: [[[1, -4], [1, 4]], [[-3, -4], [-3, 4]], [[5, -4], [5, 4]]],
    lights: [[7, 0], [-7, 3.2], [-7, -3.2]],
    r: 8, stern: -8,
  },
  DEFAULT: {
    outline: [[10, 0], [0, 6], [-10, 0], [0, -6]],
    details: [],
    lights: [[6, 0]],
    r: 10, stern: -8,
  },
}

/** obrys → cesta (bez vykreslení) */
function tracePath(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

/**
 * Objemový trup. Kreslí se v LOKÁLNÍM rámci (volající udělal translate na
 * pozici + rotate(-heading)); `heading` sem předáme zvlášť, ať světlo
 * míří pevně do světa, ne po natočení lodi.
 */
export function shipBody(
  ctx: CanvasRenderingContext2D, hullCode: string,
  heading: number, pal: HullPalette,
): void {
  if (hullCode === 'STN') { station(ctx, pal); return }
  const g = HULL_GEOM[hullCode] ?? HULL_GEOM.DEFAULT
  const r = g.r
  const sun = pal.sun ?? SUN_RIM
  // směr světla přepočtený do lokálního rámce (inverze rotace ctx = rotace o +heading)
  const c = Math.cos(heading)
  const s = Math.sin(heading)
  const lx = c * LIGHT_SX - s * LIGHT_SY   // světlo → míří DO trupu (osvětlená hrana je na -L)
  const ly = s * LIGHT_SX + c * LIGHT_SY
  // „dolů po obrazovce" v lokálním rámci — sem extrudujeme bok trupu (výška)
  const dx = -s
  const dy = c
  const th = Math.max(1.2, r * 0.22)       // tloušťka trupu (px)

  // 0) EXTRUZE: tmavý bok trupu posunutý dolů → dojem výšky nad rovinou.
  // Nakreslíme spojnici obrysu a jeho posunuté kopie jako „stěnu".
  ctx.save()
  ctx.beginPath()
  const o = g.outline
  for (let i = 0; i < o.length; i++) {
    const a = o[i]
    const b = o[(i + 1) % o.length]
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.lineTo(b[0] + dx * th, b[1] + dy * th)
    ctx.lineTo(a[0] + dx * th, a[1] + dy * th)
    ctx.closePath()
  }
  const wall = ctx.createLinearGradient(0, 0, dx * th, dy * th)
  wall.addColorStop(0, pal.mid)
  wall.addColorStop(1, pal.dark)
  ctx.fillStyle = wall
  ctx.fill()
  ctx.restore()

  // 1) HORNÍ PALUBA: gradient od osvětlené (proti světlu) k zastíněné straně
  const grad = ctx.createLinearGradient(-lx * r, -ly * r, lx * r, ly * r)
  grad.addColorStop(0, pal.light)
  grad.addColorStop(0.45, pal.mid)
  grad.addColorStop(1, pal.dark)
  tracePath(ctx, g.outline)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.save()
  tracePath(ctx, g.outline)
  ctx.clip()
  // 2) fasetový přísvit: jasnější příďová/osvětlená část paluby (aditivně)
  const facet = ctx.createLinearGradient(-lx * r, -ly * r, lx * r * 0.3, ly * r * 0.3)
  facet.addColorStop(0, pal.light)
  facet.addColorStop(1, 'transparent')
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.35
  ctx.fillStyle = facet
  tracePath(ctx, g.outline)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  // 3) panelové členění (jemné tmavé linky uvnitř trupu)
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = pal.dark
  ctx.lineWidth = 0.6
  ctx.beginPath()
  for (const [a, b] of g.details) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]) }
  ctx.stroke()
  // 4) svítící okna: řada drobných teplých teček podél osy (aditivně)
  drawWindows(ctx, g, pal.window ?? '#ffe4b0')
  // 5) specular hřbet: jasná čára po ose příď–záď (kovový lesk)
  const spineFront = g.outline[0][0]
  const spine = ctx.createLinearGradient(spineFront, 0, g.stern, 0)
  spine.addColorStop(0, pal.spec)
  spine.addColorStop(0.45, pal.spec)
  spine.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.5
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = spine
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(spineFront - 1, 0)
  ctx.lineTo(g.stern + 1, 0)
  ctx.stroke()
  ctx.restore()

  // 5b) nadstavba/můstek na větších trupech: menší vyvýšený blok s okny
  if (r >= 9 && hullCode !== 'DB' && hullCode !== 'MERCH') {
    superstructure(ctx, g, lx, ly, dx, dy, pal, sun)
  }

  // 5c) specular hotspot: ostrý lesk na přivrácené (osvětlené) straně přídě
  ctx.save()
  tracePath(ctx, g.outline)
  ctx.clip()
  const hx = g.outline[0][0] * 0.4 - lx * r * 0.4
  const hy = -ly * r * 0.4
  const hot = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.5)
  hot.addColorStop(0, pal.spec)
  hot.addColorStop(1, 'transparent')
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.5
  ctx.fillStyle = hot
  ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.restore()

  // 6) sluneční rim-light: teplá jasná hrana na přivrácené straně (soumrak)
  ctx.save()
  ctx.translate(-lx * 0.6, -ly * 0.6)
  tracePath(ctx, g.outline)
  ctx.globalAlpha = 0.7
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = sun
  ctx.lineWidth = 0.9
  ctx.stroke()
  ctx.restore()

  // 7) obrysová linka (drží čitelnost na malém zoomu)
  tracePath(ctx, g.outline)
  ctx.globalAlpha = 0.8
  ctx.strokeStyle = pal.light
  ctx.lineWidth = 0.5
  ctx.stroke()
  ctx.globalAlpha = 1
}

/**
 * Vyvýšená nadstavba (můstek): menší blok posunutý k přídi, s vlastní
 * výškou (extruze dolů), nasvícením a řádkou oken — vrstvená paluba.
 */
function superstructure(
  ctx: CanvasRenderingContext2D, g: HullGeom,
  lx: number, ly: number, dx: number, dy: number, pal: HullPalette, sun: string,
): void {
  const r = g.r
  const bow = g.outline[0][0]
  const cx = (bow + g.stern) / 2 + r * 0.12   // mírně k přídi
  const halfL = r * 0.42
  const halfW = r * 0.34
  const th = Math.max(1, r * 0.16)
  const box: [number, number][] = [
    [cx + halfL, -halfW], [cx + halfL * 0.7, -halfW],
    [cx - halfL, -halfW * 0.7], [cx - halfL, halfW * 0.7],
    [cx + halfL * 0.7, halfW], [cx + halfL, halfW],
  ]
  ctx.save()
  // bok nadstavby (výška)
  ctx.beginPath()
  for (let i = 0; i < box.length; i++) {
    const a = box[i], b = box[(i + 1) % box.length]
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
    ctx.lineTo(b[0] + dx * th, b[1] + dy * th); ctx.lineTo(a[0] + dx * th, a[1] + dy * th)
    ctx.closePath()
  }
  ctx.fillStyle = pal.dark
  ctx.fill()
  // horní plocha nadstavby
  ctx.beginPath()
  ctx.moveTo(box[0][0], box[0][1])
  for (let i = 1; i < box.length; i++) ctx.lineTo(box[i][0], box[i][1])
  ctx.closePath()
  const gr = ctx.createLinearGradient(cx - lx * halfL, -ly * halfL, cx + lx * halfL, ly * halfL)
  gr.addColorStop(0, pal.light)
  gr.addColorStop(1, pal.mid)
  ctx.fillStyle = gr
  ctx.fill()
  // rim + okna nadstavby
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.6
  ctx.strokeStyle = sun
  ctx.lineWidth = 0.6
  ctx.stroke()
  ctx.fillStyle = pal.window ?? '#ffe4b0'
  ctx.globalAlpha = 0.55
  for (let i = -1; i <= 1; i++) ctx.fillRect(cx + i * halfL * 0.5 - 0.3, -0.3, 0.6, 0.6)
  ctx.restore()
}

/** řada svítících oken podél osy trupu (aditivní teplé tečky) */
function drawWindows(ctx: CanvasRenderingContext2D, g: HullGeom, col: string): void {
  const bow = g.outline[0][0]
  const stern = g.stern
  const len = bow - stern
  const n = Math.max(2, Math.round(len / 3.5))
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = col
  for (let i = 1; i < n; i++) {
    const x = stern + (len * i) / n
    // dvě řady mírně od osy
    for (const yy of [-g.r * 0.28, g.r * 0.28]) {
      ctx.globalAlpha = 0.5
      ctx.fillRect(x - 0.35, yy - 0.35, 0.7, 0.7)
    }
  }
  ctx.restore()
}

/** blikající poziční světla trupu (aditivně; fáze blikání z času + id) */
export function hullLights(
  ctx: CanvasRenderingContext2D, hullCode: string,
  pal: HullPalette, now: number, id: number,
): void {
  const col = pal.lights
  if (!col || hullCode === 'STN') return
  const g = HULL_GEOM[hullCode] ?? HULL_GEOM.DEFAULT
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = col
  for (let i = 0; i < g.lights.length; i++) {
    const [x, y] = g.lights[i]
    // příďové (x>0) svítí trvale, ostatní blikají v mírně rozházené fázi
    const blink = x > 0 ? 0.9 : 0.35 + 0.65 * Math.abs(Math.sin(now / 520 + id * 0.9 + i * 1.7))
    ctx.globalAlpha = blink
    ctx.beginPath()
    ctx.arc(x, y, 0.85, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Pohonná záře ve stylu Homeworldu: jasný horký kotouč u zádi + zužující
 * se vlečka. Aditivní blending (světla se sčítají → přesvit). Lokální rámec,
 * plamen míří dozadu (-x). Délka a jas rostou s tahem, mihotá render časem.
 */
export function enginePlume(
  ctx: CanvasRenderingContext2D, sternX: number, throttle: number,
  now: number, id: number, coreCol: string, haloCol: string,
): void {
  if (throttle <= 0) return
  const flick = 0.85 + 0.15 * Math.sin(now / 46 + id * 1.7) + 0.06 * Math.sin(now / 17 + id)
  const L = (7 + throttle * 16) * flick   // délka vlečky
  const w = 1.6 + throttle * 1.8          // pološířka u trysky
  const x0 = sternX                       // tryska
  const x1 = sternX - L                   // konec vlečky
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  // vlečka: podlouhlý trojúhelníkový přesvit
  const halo = ctx.createLinearGradient(x0, 0, x1, 0)
  halo.addColorStop(0, haloCol)
  halo.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.55
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.moveTo(x0 + 1, -w)
  ctx.quadraticCurveTo(x1 * 0.5 + x0 * 0.5, -w * 0.4, x1, 0)
  ctx.quadraticCurveTo(x1 * 0.5 + x0 * 0.5, w * 0.4, x0 + 1, w)
  ctx.closePath()
  ctx.fill()
  // horký kotouč u trysky
  const core = ctx.createRadialGradient(x0, 0, 0, x0, 0, w * 1.8)
  core.addColorStop(0, coreCol)
  core.addColorStop(0.5, haloCol)
  core.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.9
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(x0, 0, w * 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** stanice: nasvícený prstenec s nábojem a paprsky */
function station(ctx: CanvasRenderingContext2D, pal: HullPalette): void {
  const R = 8
  const g = ctx.createRadialGradient(-R * 0.4, -R * 0.4, R * 0.2, 0, 0, R)
  g.addColorStop(0, pal.light)
  g.addColorStop(0.6, pal.mid)
  g.addColorStop(1, pal.dark)
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  // vnitřní otvor prstence
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  // náboj
  ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2)
  ctx.fillStyle = pal.mid
  ctx.fill()
  // paprsky + odlesk
  ctx.strokeStyle = pal.spec
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 0.8
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2
    ctx.moveTo(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42)
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

/**
 * Kontaktní stín pod trupem — měkká tmavá elipsa posunutá po směru
 * světla; dělá dojem, že loď „visí" nad senzorovou rovinou (3D shora).
 * Kreslí se PŘED trupem, ve stejném lokálním rámci.
 */
export function hullShadow(ctx: CanvasRenderingContext2D, hullCode: string, heading: number): void {
  const g = HULL_GEOM[hullCode] ?? HULL_GEOM.DEFAULT
  const r = g.r
  const c = Math.cos(heading)
  const s = Math.sin(heading)
  const lx = c * LIGHT_SX - s * LIGHT_SY
  const ly = s * LIGHT_SX + c * LIGHT_SY
  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.translate(lx * r * 0.45, ly * r * 0.45)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.05)
  sh.addColorStop(0, '#000000')
  sh.addColorStop(1, 'transparent')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.05, r * 0.75, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
