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
    lore: 'The backbone destroyer of the Royal Navy, named for the sudden mountain '
      + 'gales of the Avalonian homeland. The design favors counter-missile magazines '
      + 'and defensive rate of fire over striking power — the Vichr is built as a '
      + 'convoy escort umbrella. Her weakness: a mere three tubes per broadside and '
      + 'thin sidewalls; she has no business in a straight shootout with a cruiser.',
  },
  'cl-sokol': {
    name: 'Sokol class',
    lore: 'A light cruiser for independent operations far from home ports — named '
      + 'for the hunting falcon of the Avalonian kings. A balanced mix of sensors, '
      + 'ECM and armament makes her the ideal scout and raider-hunter. Five tubes '
      + 'per broadside give her a striking voice, but the armor stays cruiser-thin — '
      + 'the Sokol wins by maneuver and information, not endurance.',
  },
  'ca-bastion': {
    name: 'Bastion class',
    lore: 'A heavy cruiser built as a mobile fortress — hence the name. Eight tubes '
      + 'per broadside, strong sidewalls and layered point defense make the Bastion '
      + 'a ship that can hold the line even against odds. The price is tonnage: '
      + 'slower acceleration and a big sensor signature that hides poorly.',
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
    lore: 'A battlecruiser — in Avalonian doctrine the attack is led under the '
      + 'banner (hence the name): ten tubes per broadside, first-rate ECM and a '
      + 'speed the bigger ships lack. The Praporec is built for raids deep into '
      + 'enemy space: strike, break, vanish. The one thing she cannot do is stand '
      + 'in the line against true capital ships; her armor is a class too thin for that.',
  },
  'dn-vladar': {
    name: 'Vladař class',
    lore: 'A dreadnought — the wall of battle incarnate in six million tons. The '
      + 'Vladař is Avalon\'s answer to Imperial tonnage: instead of hull count, '
      + 'Avalonian quality — the best sensors, ECM and missile electronics the '
      + 'Kingdom\'s yards can build. Fourteen tubes per broadside, sidewalls that '
      + 'up close will not pass even a graser, and a layered defense deeper than '
      + 'any lesser class. The price is the old familiar one: 435 g and maneuver '
      + 'that is mostly symbolic. The Vladař does not dodge — the Vladař stands '
      + 'and holds the line.',
  },
  'dn-ural': {
    name: 'Toledo class',
    lore: 'An Imperial dreadnought — a mountain of steel named after the old '
      + 'imperial capital. The Toledo\'s doctrine is the doctrine of the whole '
      + 'caudillo\'s navy: tonnage above all, and sixteen tubes per broadside make '
      + 'up for what the electronics cannot do. Her volleys are broader than '
      + 'Avalon\'s; her sensors and ECM stay a generation behind. The Toledo does '
      + 'not win by elegance — she wins by standing, pouring out broadsides and '
      + 'waiting for the enemy to run out of missiles before she runs out of hull.',
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
