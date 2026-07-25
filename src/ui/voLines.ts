/**
 * Přehrávač namluvených hlášek (docs/VO_LINES.md): eventy simulace nesou
 * voId a UI k nim zkouší audio/vo/lines/<voId>-<jazyk>.(mp3|m4a|wav).
 * Hraje vždy jen jedna hláška; čekat smí max. jedna další (novější vytlačí
 * starší — v bitvě nesmí vzniknout dluh minut starých replik). Chybějící
 * soubor se tiše přeskočí, hra bez audia funguje beze změny.
 */
import { getLang } from './i18n'
import type { SimEvent } from '../sim/types'

const EXTS = ['mp3', 'm4a', 'wav']

let current: HTMLAudioElement | null = null
let queued: string | null = null
/** externí umlčení (ovládá main.ts dle AudioManageru) */
let isMuted: () => boolean = () => false
let volume: () => number = () => 1

/** napojení na zvukové volby hry (mute + hlasitost efektů) */
export function configureVoLines(muted: () => boolean, vol: () => number): void {
  isMuted = muted
  volume = vol
}

/** tvrdé zastavení (konec mise, návrat do menu) */
export function stopVoLines(): void {
  current?.pause()
  current = null
  queued = null
}

function playNext(): void {
  if (current || queued === null) return
  const voId = queued
  queued = null
  const audio = new Audio()
  audio.preload = 'auto'
  audio.volume = Math.max(0, Math.min(1, volume()))
  for (const ext of EXTS) {
    const s = document.createElement('source')
    s.src = `audio/vo/lines/${voId}-${getLang()}.${ext}`
    audio.appendChild(s)
  }
  const done = (): void => {
    if (current === audio) current = null
    playNext()
  }
  audio.addEventListener('ended', done)
  audio.addEventListener('error', done, true) // poslední <source> selhal → dál
  current = audio
  audio.play().catch(done) // autoplay/chybějící soubor → tiše dál
}

/** zpracuj dávku eventů ze snapshotu — hlášky s voId jdou do přehrávače */
export function voLinesOnEvents(events: SimEvent[]): void {
  if (isMuted()) return
  for (const ev of events) {
    if (!ev.voId) continue
    // nová hláška vytlačí čekající (přehrávanou nepřerušuje — dozní)
    queued = ev.voId
  }
  playNext()
}
