/**
 * Anglická mutace POVRCHU lodních tříd: jméno a lore (medailonek v detailu
 * třídy). Česká data v defs.ts zůstávají kanonická (sim, testy); UI je při
 * angličtině překládá přes gettery níže — fallback je vždy český originál.
 */
import type { ShipClassDef } from '../sim/types'
import { getLang } from '../ui/i18n'

interface ShipSurfaceEn {
  name: string
  lore?: string
}

const EN: Record<string, ShipSurfaceEn> = {
  'dd-vichr': {
    name: 'Vichr class',
    lore: 'The backbone destroyer of the Royal Navy. Against the Imperial Cádiz '
      + 'the Vichr is a shield, not a sword: four counter-missile launchers and six '
      + 'PDLC clusters to the Cádiz\'s three and five, plus electronics a generation '
      + 'ahead — her locks hold where Imperial ones slip. The price: only three '
      + 'tubes per broadside against four. A Vichr survives a Cádiz\'s salvo more '
      + 'readily than the Cádiz survives her accuracy — but she cannot out-shout '
      + 'her in missiles. Ten g faster: the initiative is hers.',
  },
  'cl-sokol': {
    name: 'Sokol class',
    lore: 'A light cruiser for independent operations — scout and raider-hunter. '
      + 'Against the Imperial Sevilla the Sokol bets on information: better sensors, '
      + 'stronger ECM and 1.08 missile electronics mean her firing solutions win at '
      + 'range. The Sevilla carries six tubes to her five and deeper magazines — '
      + 'the closer you let her get, the more those broader salvos hurt. The Sokol '
      + 'wins while she dictates the range; she loses when she lets herself be '
      + 'dragged into a knife fight.',
  },
  'ca-bastion': {
    name: 'Bastion class',
    lore: 'A heavy cruiser built as a mobile fortress — hence the name. Against '
      + 'the Imperial Burgos the Bastion is defence against saturation: ten '
      + 'counter-missiles and twelve PDLC to eight and ten, sidewalls 22 to 20. '
      + 'The Burgos throws ten tubes against her eight and hauls a fifth more '
      + 'missiles — saturation is his game. The Bastion\'s job is to ride it out '
      + 'and let her own, more accurate salvos through the thinner Imperial '
      + 'defence. CA against CA is an endurance race: quality of defence versus '
      + 'width of salvo.',
  },
  'merch-freighter': {
    name: 'freighter',
    lore: 'A standard four-million-ton freighter — the container backbone of '
      + 'interstellar trade. Her civilian compensator barely allows 200 g and her '
      + 'armament is a single defensive cluster. Without an escort she is helpless; '
      + 'with a cargo worth a colony\'s annual budget she is exactly what the '
      + 'pirates of the Marches are after.',
  },
  'merch-qship': {
    name: 'armed auxiliary (Q-ship)',
    lore: 'An auxiliary cruiser: a freighter\'s hull, a warship\'s deck inside. The '
      + 'Empire deploys them as traps for escorts — the containers hide missile '
      + 'cradles and energy batteries that reveal themselves only up close. Against '
      + 'an unsuspecting ship a Q-ship is lethal; once unmasked, her civilian '
      + 'compensator and improvised sidewalls betray her.',
  },
  'disp-courier': {
    name: 'dispatch courier',
    lore: 'A courier is essentially an impeller ring with a cabin — the fastest '
      + 'hull any yard builds. She carries dispatches, ciphers and passengers who '
      + 'cannot be kept waiting. No weapons, no armor: her only defense is '
      + 'acceleration and a prayer that nobody takes her seriously.',
  },
  'bc-praporec': {
    name: 'Praporec class',
    lore: 'A battlecruiser — in Avalon doctrine, the attack flies under the '
      + 'banner (praporec). Against the Imperial Aragon the Praporec has speed '
      + '(475 g to 465) and the best ECM below a dreadnought: she picks the range, '
      + 'fools the sensors, strikes and vanishes. The Aragon mounts twelve tubes '
      + 'to her ten and magazines two hundred missiles deeper — in a long line '
      + 'engagement he wins. The Praporec must never stand still: her victory is '
      + 'the raid, not the wall of battle.',
  },
  'dn-vladar': {
    name: 'Vladař class',
    lore: 'A dreadnought — the wall of battle made six million tons of steel. '
      + 'Against the Toledo the Vladař is the pure Avalon answer: twenty-two '
      + 'counter-missiles and PDLC clusters to eighteen, sidewalls 34 to 30, '
      + 'electronics that hold locks through Imperial jamming — and magazines for '
      + '1,400 missiles against 800. The Toledo answers with sixteen tubes to '
      + 'fourteen: a broader salvo, a blunter blow. The Vladař wins by patience — '
      + 'she aims better, lasts longer, and runs out of missiles last.',
  },
  'dd-cadiz': {
    name: 'Cádiz class',
    lore: 'An Imperial destroyer — a sword, not a shield. The Cádiz mounts four '
      + 'tubes per broadside to the Avalon Vichr\'s three and a quarter deeper '
      + 'magazines: her job is to bury the target. She pays for it with everything '
      + 'else — three counter-missile launchers and five PDLC clusters to four and '
      + 'six, thinner sidewalls, electronics a generation behind. Against a Vichr '
      + 'she wins only if the salvos add up faster than the Vichr\'s defence can '
      + 'shoot them down.',
  },
  'cl-sevilla': {
    name: 'Sevilla class',
    lore: 'An Imperial light cruiser — the workhorse of the Doradan squadrons. Six '
      + 'tubes per broadside to the Avalon Sokol\'s five and magazines a fifth '
      + 'deeper: the Sevilla wants a short, dense firefight where salvo width beats '
      + 'accuracy. At range the Sokol walks away from her, firing solution and all '
      + '— worse sensors and weaker ECM are the price of the armament tonnage. '
      + 'Sevilla captains know it: close the range or lose on points.',
  },
  'ca-burgos': {
    name: 'Burgos class',
    lore: 'An Imperial heavy cruiser — saturation as a trade. Ten tubes per '
      + 'broadside to the Avalon Bastion\'s eight and 660 missiles in the '
      + 'magazines: the Burgos wins by simply overloading the target\'s defence. '
      + 'Her own umbrella is thinner — eight counter-missiles and ten PDLC to ten '
      + 'and twelve, sidewalls 20 to 22. A duel with a Bastion is a bet: does the '
      + 'Burgos run out of missiles first, or the Bastion out of defence?',
  },
  'bc-aragon': {
    name: 'Aragon class',
    lore: 'An Imperial battlecruiser — a million tons of the "more is more" '
      + 'doctrine. Twelve tubes per broadside to the Avalon Praporec\'s ten and '
      + 'magazines two hundred missiles deeper: the Aragon is built for the long '
      + 'line engagement the Praporec cannot afford. But he cannot run her down — '
      + '465 g to 475 — and his ECM is half a craft next to Avalon\'s. While the '
      + 'Praporec dances, the Aragon stands and hammers.',
  },
  'dn-ural': {
    name: 'Toledo class',
    lore: 'An Imperial dreadnought — a mountain of steel named after the old '
      + 'imperial capital, and the template of the whole Doradan line. Sixteen '
      + 'tubes per broadside against the Vladař\'s fourteen: the widest salvo in '
      + 'the skies of the Marches. Everything else is the price — eighteen '
      + 'counter-missiles and PDLC to twenty-two, sidewalls 30 to 34, half the '
      + 'magazines and electronics a generation behind. The Toledo does not win '
      + 'by elegance: she wins if the enemy\'s defence collapses before her '
      + 'ammunition does.',
  },
  'station-zeta': {
    name: 'orbital station',
    lore: 'An orbital transshipment hub and fortress in one. Without a wedge she '
      + 'goes nowhere, but shield generators replace sidewalls around her whole '
      + 'circumference and her counter-missile magazines last hours of continuous '
      + 'fire. Whoever wants to take the station must first exhaust her defenses — '
      + 'or bypass and cut her off.',
  },
  'cl-korzar': {
    name: 'Korzár class',
    lore: 'A prize cruiser from a collapsed border fleet, patched with wrecks and '
      + 'the black market. The corsairs fly her for as long as she holds together: '
      + 'sensors past their zenith, last-generation ECM and magazines nobody '
      + 'refills. She still carries four tubes per broadside — more than enough '
      + 'for a merchantman.',
  },
  'dd-korzar': {
    name: 'pirate sloop',
    lore: 'The light raider of the pirate fleets — fast, cheap and expendable. '
      + 'Sloops hunt in packs: one pins the escort, the others tear the convoy '
      + 'apart. Two tubes and paper sidewalls mean she cannot survive a single '
      + 'proper volley of concentrated fire — and her captains know it.',
  },
  'probe': {
    name: 'probe',
    lore: 'A weather probe — the system\'s silent witness. She measures solar '
      + 'wind, reports her position and interests no one. Which is exactly why '
      + 'she is everywhere.',
  },
  'planet': {
    name: 'planet',
    lore: 'A planet — the anchor of the system and the reason it is fought over. '
      + 'Once charted she never moves: the last known plot holds forever.',
  },
  'merch-runner': {
    name: 'freighter (?)',
    lore: 'On paper an ordinary two-million-ton merchantman. Under the cargo '
      + 'decks, though, she carries a military compensator and a few hidden tubes '
      + '— the kind of refit smugglers and intelligence services pay for. You only '
      + 'find out the moment the "slow merchantman" suddenly pulls 400 g.',
  },
}

/** jméno třídy v aktuálním jazyce (fallback: český název z defs) */
export function shipClassName(def: ShipClassDef): string {
  return (getLang() === 'en' ? EN[def.id]?.name : undefined) ?? def.name
}

/** lore třídy v aktuálním jazyce (fallback: český text z defs) */
export function shipClassLore(def: ShipClassDef): string | undefined {
  return (getLang() === 'en' ? EN[def.id]?.lore : undefined) ?? def.lore
}

/** interní export pro testy úplnosti */
export const SHIP_SURFACE_EN = EN
