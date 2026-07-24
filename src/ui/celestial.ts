/**
 * Nebeská tělesa pro HW režim plotu — víc typů, nasvícených od hvězdy
 * soustavy (terminátor na odvrácené straně, jasný limb ke hvězdě).
 * Čistě render (performance.now pro pomalý drift pásem). Kreslí se buď na
 * světové pozici entity (planeta na mapě), nebo jako vzdálené pozadí scény.
 */

export type BodyStyle =
  | 'rocky' | 'ocean' | 'gas' | 'ringed' | 'ice' | 'moon' | 'lava'

export interface StarLight { core: string; halo: string }

/** deterministický hash → [0,1) */
function h01(a: number, b: number): number {
  let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 40503)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

/** lineární míchání #rrggbb → rgb() (t=0 → a, t=1 → b) */
function mix(a: string, b: string, t: number): string {
  if (a[0] !== '#' || b[0] !== '#') return a
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`
}

/** stabilní styl tělesa z jména (pár pojmenovaných výjimek) */
export function bodyStyleFor(name: string): BodyStyle {
  const n = name.toLowerCase()
  if (n.includes('avalon')) return 'ocean'   // domovská planeta — modrozelená
  if (n.includes('zeta')) return 'ice'
  if (n.includes('cádiz') || n.includes('cadiz')) return 'lava'
  if (n.includes('tharsis')) return 'rocky'
  if (n.includes('kaledon') || n.includes('caledon')) return 'gas'
  const styles: BodyStyle[] = ['rocky', 'ocean', 'gas', 'ringed', 'ice']
  let s = 0
  for (let i = 0; i < name.length; i++) s += name.charCodeAt(i) * (i + 1)
  return styles[s % styles.length]
}

/**
 * Vykreslí těleso. `lx,ly` = jednotkový směr KE HVĚZDĚ (osvětlená strana).
 * `seed` drží detaily (kontinenty/krátery/skvrny) stabilní přes snímky.
 */
export function drawBody(
  ctx: CanvasRenderingContext2D, x: number, y: number, R: number,
  style: BodyStyle, tint: string, star: StarLight,
  lx: number, ly: number, now: number, seed: number,
): void {
  const lightAng = Math.atan2(ly, lx)
  const hasAtmo = style !== 'moon'

  ctx.save()

  // prstenec (zadní polovina) — kreslí se PŘED tělesem
  if (style === 'ringed') drawRing(ctx, x, y, R, tint, star, 'back')

  // atmosférický přísvit
  if (hasAtmo) {
    const atm = ctx.createRadialGradient(x, y, R * 0.9, x, y, R * 1.3)
    atm.addColorStop(0, 'transparent')
    atm.addColorStop(0.55, star.halo)
    atm.addColorStop(1, 'transparent')
    ctx.globalAlpha = style === 'ice' ? 0.5 : 0.38
    ctx.fillStyle = atm
    ctx.beginPath(); ctx.arc(x, y, R * 1.3, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }

  // základní koule: světlá strana ke hvězdě → terminátor
  const base = ctx.createRadialGradient(x + lx * R * 0.55, y + ly * R * 0.55, R * 0.1, x, y, R)
  base.addColorStop(0, mix(tint, '#ffffff', 0.18))
  base.addColorStop(0.5, tint)
  base.addColorStop(0.8, mix(tint, '#000000', 0.45))
  base.addColorStop(1, '#04060a')
  ctx.fillStyle = base
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill()

  // povrch dle stylu (ořezaný na kotouč)
  ctx.save()
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip()
  switch (style) {
    case 'ocean': surfaceOcean(ctx, x, y, R, tint, seed); break
    case 'rocky': surfaceBlotches(ctx, x, y, R, mix(tint, '#000000', 0.4), seed, 7); break
    case 'gas': case 'ringed': surfaceBands(ctx, x, y, R, tint, seed, now); break
    case 'ice': surfaceBlotches(ctx, x, y, R, mix(tint, '#ffffff', 0.35), seed, 5); break
    case 'moon': surfaceCraters(ctx, x, y, R, tint, seed); break
    case 'lava': surfaceLava(ctx, x, y, R, seed, now); break
  }
  // terminátor: ztmavení odvrácené strany (překryv přes povrch)
  const term = ctx.createRadialGradient(x + lx * R, y + ly * R, R * 0.2, x - lx * R * 0.3, y - ly * R * 0.3, R * 1.5)
  term.addColorStop(0, 'rgba(0,0,0,0)')
  term.addColorStop(0.55, 'rgba(0,0,0,0)')
  term.addColorStop(1, 'rgba(2,4,8,0.92)')
  ctx.fillStyle = term
  ctx.fillRect(x - R, y - R, R * 2, R * 2)
  ctx.restore()

  // jasný limb na osvětlené hraně
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 1.6
  ctx.strokeStyle = star.core
  ctx.beginPath()
  ctx.arc(x, y, R - 0.6, lightAng - 1.25, lightAng + 1.25)
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1

  // prstenec (přední polovina) — přes tělo
  if (style === 'ringed') drawRing(ctx, x, y, R, tint, star, 'front')

  ctx.restore()
}

/** oceánská planeta: kontinenty + polární čepičky */
function surfaceOcean(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, tint: string, seed: number): void {
  const land = mix(tint, '#6a7a3a', 0.7)
  ctx.fillStyle = land
  ctx.globalAlpha = 0.7
  for (let i = 0; i < 6; i++) {
    const a = h01(seed, i) * Math.PI * 2
    const r = h01(seed + 1, i) * R * 0.7
    const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r
    const rr = R * (0.18 + h01(seed + 2, i) * 0.22)
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.7, a, 0, Math.PI * 2); ctx.fill()
  }
  // polární čepičky
  ctx.fillStyle = '#e8f4ff'
  ctx.globalAlpha = 0.8
  ctx.beginPath(); ctx.ellipse(x, y - R * 0.85, R * 0.55, R * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(x, y + R * 0.85, R * 0.5, R * 0.2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

/** rozházené skvrny (kamenná/ledová textura) */
function surfaceBlotches(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, col: string, seed: number, n: number): void {
  ctx.fillStyle = col
  for (let i = 0; i < n; i++) {
    const a = h01(seed, i) * Math.PI * 2
    const r = Math.sqrt(h01(seed + 3, i)) * R * 0.85
    const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r
    const rr = R * (0.1 + h01(seed + 5, i) * 0.2)
    ctx.globalAlpha = 0.25 + h01(seed + 7, i) * 0.3
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.8, a, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** plynný obr: vodorovná pásma s pomalým driftem + skvrna (bouře) */
function surfaceBands(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, tint: string, seed: number, now: number): void {
  const drift = (now / 9000) % 1
  for (let i = -5; i <= 5; i++) {
    const t = i / 5
    const yy = y + t * R * 0.95
    const bh = R * 0.16
    const shade = (i + Math.floor(drift * 3)) % 2 === 0 ? 0.22 : -0.15
    ctx.fillStyle = shade > 0 ? mix(tint, '#000000', shade) : mix(tint, '#ffffff', -shade)
    ctx.globalAlpha = 0.5
    ctx.beginPath(); ctx.ellipse(x, yy, R, bh, 0, 0, Math.PI * 2); ctx.fill()
  }
  // bouře (oválná skvrna)
  ctx.globalAlpha = 0.6
  ctx.fillStyle = mix(tint, '#ff9060', 0.5)
  const sx = x + (h01(seed, 1) - 0.5) * R
  const sy = y + (h01(seed, 2) - 0.5) * R * 0.6
  ctx.beginPath(); ctx.ellipse(sx, sy, R * 0.2, R * 0.12, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

/** měsíc: krátery (tmavá jamka + světlý okraj) */
function surfaceCraters(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, tint: string, seed: number): void {
  for (let i = 0; i < 9; i++) {
    const a = h01(seed, i) * Math.PI * 2
    const r = Math.sqrt(h01(seed + 2, i)) * R * 0.82
    const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r
    const rr = R * (0.06 + h01(seed + 4, i) * 0.12)
    ctx.globalAlpha = 0.5
    ctx.fillStyle = mix(tint, '#000000', 0.45)
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 0.4
    ctx.strokeStyle = mix(tint, '#ffffff', 0.5)
    ctx.lineWidth = 0.6
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** lávový svět: tmavý povrch se žhnoucími prasklinami (aditivně) */
function surfaceLava(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, seed: number, now: number): void {
  ctx.fillStyle = '#1a0e0a'
  ctx.globalAlpha = 0.5
  ctx.fillRect(x - R, y - R, R * 2, R * 2)
  ctx.globalCompositeOperation = 'lighter'
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(now / 700 + seed))
  ctx.strokeStyle = `rgba(255,120,40,${0.5 * pulse})`
  ctx.lineWidth = 1
  for (let i = 0; i < 6; i++) {
    const a = h01(seed, i) * Math.PI * 2
    ctx.beginPath()
    let px = x + Math.cos(a) * R * 0.2, py = y + Math.sin(a) * R * 0.2
    ctx.moveTo(px, py)
    for (let j = 0; j < 4; j++) {
      const aa = a + (h01(seed + i, j) - 0.5) * 1.5
      px += Math.cos(aa) * R * 0.3; py += Math.sin(aa) * R * 0.3
      ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

/** prstenec (nakloněná elipsa) — zadní/přední polovina zvlášť kvůli překryvu */
function drawRing(
  ctx: CanvasRenderingContext2D, x: number, y: number, R: number,
  tint: string, star: StarLight, half: 'back' | 'front',
): void {
  const rx = R * 2.05, ry = R * 0.62
  const tilt = -0.32
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.strokeStyle = mix(tint, '#ffffff', 0.3)
  // dvě soustředné čáry s mezerou
  for (const [rr, a, lw] of [[1, 0.5, R * 0.34], [0.82, 0.35, R * 0.16]] as const) {
    ctx.globalAlpha = a
    ctx.lineWidth = lw
    ctx.strokeStyle = rr === 1 ? mix(tint, star.core, 0.25) : mix(tint, '#000000', 0.2)
    ctx.beginPath()
    // back = horní půlka (za tělesem), front = spodní půlka (před tělesem)
    if (half === 'back') ctx.ellipse(0, 0, rx * rr, ry * rr, 0, Math.PI, Math.PI * 2)
    else ctx.ellipse(0, 0, rx * rr, ry * rr, 0, 0, Math.PI)
    ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}
