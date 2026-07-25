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

/** tvrdé zastavení (start nové mise — leftover hlásky nesmí přežít) */
export function stopVoLines(): void {
  current?.pause()
  current = null
  queued = null
}

/**
 * Měkké uklizení na konci mise: zahodí čekající hlášku, ale rozehranou
 * nechá doznít — závěrečná komunikace (např. gratulace stanice) přichází
 * ve stejném snapshotu jako výhra a hráč ji má slyšet.
 */
export function clearVoLinesQueue(): void {
  queued = null
}

/** promítne aktuální nastavení zvuku do hrajícího elementu */
function applySettings(audio: HTMLAudioElement): void {
  audio.muted = isMuted()
  audio.volume = Math.max(0, Math.min(1, volume()))
}

function playNext(): void {
  if (current || queued === null) return
  const voId = queued
  queued = null
  const audio = new Audio()
  audio.preload = 'auto'
  applySettings(audio)
  let lastSource: HTMLSourceElement | null = null
  for (const ext of EXTS) {
    const s = document.createElement('source')
    s.src = `audio/vo/lines/${voId}-${getLang()}.${ext}`
    audio.appendChild(s)
    lastSource = s
  }
  const done = (): void => {
    if (current === audio) current = null
    playNext()
  }
  audio.addEventListener('ended', done)
  // selhání VŠECH zdrojů hlásí error až na POSLEDNÍM <source> (stejný vzor
  // jako příběhový voPlayer) — error z prvního zdroje jen posouvá na další
  lastSource?.addEventListener('error', done)
  audio.addEventListener('error', done) // chyba elementu (síť/dekodér po výběru)
  // ztlumení/hlasitost se může změnit ZA hraní — timeupdate (~4 Hz) je promítá
  audio.addEventListener('timeupdate', () => applySettings(audio))
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
