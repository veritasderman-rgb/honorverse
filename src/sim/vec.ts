import type { Vec2 } from './types'

export const vec = (x = 0, y = 0): Vec2 => ({ x, y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k })
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const norm = (a: Vec2): Vec2 => {
  const l = len(a)
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }
}
export const fromAngle = (rad: number, mag = 1): Vec2 => ({ x: Math.cos(rad) * mag, y: Math.sin(rad) * mag })
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x)
/** nejkratší úhlový rozdíl a-b v (-PI, PI] */
export const angleDiff = (a: number, b: number): number => {
  let d = (a - b) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d <= -Math.PI) d += 2 * Math.PI
  return d
}
/** omezí délku vektoru na max */
export const clampLen = (a: Vec2, max: number): Vec2 => {
  const l = len(a)
  return l > max ? scale(a, max / l) : a
}
