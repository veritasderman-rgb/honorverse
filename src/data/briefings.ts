/**
 * Anglická mutace POVRCHU misí: názvy, briefingy a texty cílů. Česká data ve
 * scénářích zůstávají kanonická (simulace, testy); UI je při angličtině
 * překládá přes gettery níže — fallback je vždy původní český text.
 *
 * Texty cílů se překládají podle (missionId, objectiveId) — id cílů jsou
 * stabilní součást scénářů.
 */
import { getLang } from '../ui/i18n'

interface MissionSurfaceEn {
  title: string
  briefing: string
  objectives: Record<string, string>
}

const EN: Record<string, MissionSurfaceEn> = {
  mission01: {
    title: 'Watchgate Patrol',
    briefing:
      'ANS Dauntless holds customs picket at the Watchgate wormhole terminal. '
      + 'Gate Control reports the freighter Cygnus with a suspicious manifest — '
      + 'run an inspection: close to 1 million km and do not let her leave the '
      + 'system across the hyper limit. Careful: if that ship has something to '
      + 'hide, she will run — and the hyper limit is only 250 million km away. '
      + 'TRAINING: acceleration (the wedge gives you thrust, not speed — speed '
      + 'accumulates), the reactor budget (throttle vs. sidewalls), and the '
      + 'vector as a weapon: sometimes the goal is not to meet, but to FLY PAST '
      + 'with a speed advantage and strike along your course.',
    objectives: {
      'obj-inspect': 'Inspect the contact (close to 1 million km)',
      'obj-no-escape': 'Do not let her escape past the hyper limit',
    },
  },
  mission02: {
    title: 'Convoy Through the Marches',
    briefing:
      'ANS Dauntless escorts a convoy of four merchantmen through the Marches — '
      + 'the pirate border belt — to a navigation buoy at the system\'s edge. '
      + 'Intelligence reports raiders in the area. Hold a covering position '
      + 'between the threat and the convoy — intercepts take tens of minutes and '
      + 'the merchants cannot defend themselves. Bring at least three of the '
      + 'four ships home. TRAINING: position beats aggression; let the pirates '
      + 'COME TO YOU and fire up close — and try a missile pod (6 missiles in '
      + 'one wave saturates a defence).',
    objectives: {
      'obj-convoy': 'Bring the convoy through (at least 3 of 4 merchants)',
      'obj-raiders': 'Destroy or drive off the raiders',
    },
  },
  mission03: {
    title: 'Q-ship',
    briefing:
      'The merchantman Mercator reports impeller-ring damage and requests '
      + 'escort to Sázava Station (~80 million km). ANS Dauntless is to escort '
      + 'her — stay within 2.5 million km; the merchant can only crawl. '
      + 'Intelligence has no records on the ship. TRAINING: range control — '
      + 'whoever controls the distance controls the fight. Close means murderous '
      + 'salvos for BOTH sides.',
    objectives: {
      'obj-escort': 'Escort the merchant to Sázava Station (stay within 2.5 M km)',
    },
  },
  mission04: {
    title: 'Silent Observer',
    briefing:
      'ANS Aurora slipped into the Imperial Cádiz system on a fast pass and '
      + 'killed her wedge — she now flies ballistic at 2,000 km/s. The task: on '
      + 'passives only, map the pickets (get within 6 million km of each, but '
      + 'BEWARE — under 4 million km they will fix you even silent) and escape '
      + 'across the far hyper limit. Without the wedge you have only manoeuvring '
      + 'thrusters (~5 g) — plan course corrections hours ahead. Lighting the '
      + 'impeller betrays you to the whole system. TRAINING: the sensor duel and '
      + 'EMCON — whoever radiates is seen; silence is a weapon.',
    objectives: {
      'obj-map': 'Map the Imperial forces (within 6 M km of every picket)',
      'obj-escape': 'Return past the hyper limit',
    },
  },
  mission05: {
    title: 'Station Zeta',
    briefing:
      'The heavy cruiser ANS Bastion holds a defensive station off orbital '
      + 'Station Zeta at the edge of the Marches. Intelligence reports a large '
      + 'pirate force — expect the attack in several waves. The station survives '
      + 'only with your help: stay close, layer your defences (counter-missiles, '
      + 'point defence, rolling) and HUSBAND YOUR MAGAZINES — they are not '
      + 'bottomless and nobody refills them mid-battle. Destroy or drive off '
      + 'all raiders.',
    objectives: {
      'obj-defend': 'Defend Station Zeta — destroy or drive off all raiders',
    },
  },
  mission06: {
    title: 'Retreat from Tharsis',
    briefing:
      'We lost the engagement at Tharsis. ANS Resolute withdraws with her aft '
      + 'impeller ring down, her starboard sidewall in tatters and half her '
      + 'port tubes gone — and astern hangs an Imperial force FASTER than you. '
      + 'The only chance: keep your lead to the hyper limit, save the decoys '
      + 'for their salvos and refuse to be dragged into a fight. Every wasted '
      + 'manoeuvre costs you metres of lead.',
    objectives: {
      'obj-escape': 'Bring the damaged Resolute past the hyper limit (to the buoy)',
    },
  },
  mission07: {
    title: 'The Gold Fleet',
    briefing:
      'The roles reverse: the battlecruiser ANS Praporec ambushes an Imperial '
      + 'gold fleet — a convoy of fuel isotopes crossing the Kerav system for '
      + 'Cádiz. Four merchantmen, escorted by two destroyers and a light '
      + 'cruiser. The order: sink at least three merchants and vanish past the '
      + 'hyper limit before the reaction force arrives. Pick your targets '
      + 'wisely — you do not need to destroy the escort, only to survive it.',
    objectives: {
      'obj-merch': 'Destroy at least 3 gold-fleet merchants',
      'obj-escape': 'Escape past the hyper limit (to the buoy)',
    },
  },
  mission08: {
    title: 'The Caledonian Star',
    briefing:
      'The first joint operation with the Kingdom of Caledon: ANS Vanguard and '
      + 'the light cruiser KNS Claymore patrol the edge of a Caledonian system. '
      + 'Reconnaissance reports an Imperial wall — two heavy cruisers and a '
      + 'light cruiser in silent formation. Destroy it, but remember: Claymore '
      + 'does not answer to you. The Caledonians are brave to the point of '
      + 'suicide, and their captain has a fallen brother to avenge.',
    objectives: {
      'obj-wall': 'Destroy the Imperial wall or force its surrender',
    },
  },
  mission09: {
    title: 'The Grand Army',
    briefing:
      'Salazar has bet everything: the Grand Army sails straight for the Avalon '
      + 'Junction, and at its head, for the first time, a Toledo-class '
      + 'dreadnought. The Admiralty answers with its most precious asset — you '
      + 'command a five-ship squadron around the flagship dreadnought ANS '
      + 'Vladař: Avalonian electronics against Imperial tonnage. The '
      + 'battlecruiser ANS Praporec, heavy cruiser ANS Hradba and destroyers '
      + 'ANS Vichr and ANS Bouře complete the wall — and at your back is '
      + 'Junction Station by the homeworld. The attacker must "land" at the '
      + 'hyper limit and spend hours crawling inward: build your intercept '
      + 'geometry, keep the squadron in formation (wall covers, vee aims) and '
      + 'decide in advance WHEN to split — who defends everything defends '
      + 'nothing. The station has defensive pods of its own, but the only '
      + 'wedges between the invasion and the Junction are yours.',
    objectives: {
      'obj-invasion': 'Destroy or force the surrender of both invasion echelons',
      'obj-station': 'Junction Station must survive',
    },
  },
  mission10: {
    title: 'Cádiz',
    briefing:
      'The finale: the attack on the Cádiz system. You know Aurora\'s survey '
      + 'maps by heart, and thanks to the sunken gold fleet the base is still '
      + 'only half built — now or never. You lead a strike force: the flagship '
      + 'dreadnought ANS Vladař, battlecruiser ANS Praporec, heavy cruiser ANS '
      + 'Vanguard and light cruiser ANS Aurora. It is deep from the hyper limit '
      + 'to the base — first you break a screen of two heavy and two light '
      + 'cruisers, then comes everything the defender prepared along the '
      + 'predicted axis of attack — and at the base waits the dreadnought '
      + 'Sevilla, the last one the Empire has. The Admiralty\'s order: the base '
      + 'must never be completed.',
    objectives: {
      'obj-base': 'Destroy the unfinished Cádiz base',
    },
  },
  mission11: {
    title: 'Wall Against Wall',
    briefing:
      'An Admiralty training simulation, the Queen Eleanor Hall: a full battle '
      + 'wall against a full wall, twenty ships on twenty — and all twenty '
      + 'answer to you (Shift-drag selects a squadron, WALL holds formation, '
      + 'AUTO fire shoots on its own). Break the Imperial wall — destroy all '
      + 'four Toledos and disable at least 14 of 20 ships. Mind the reactor '
      + 'budget: a wall that flies slow has sidewalls; a wall in a hurry '
      + 'burns. Optional bonus: the supply base behind their wall.',
    objectives: {
      'obj-dns': 'Destroy all four Imperial dreadnoughts',
      'obj-break': 'Break the wall: disable at least 14 of 20 ships',
    },
  },
  side01: {
    title: 'Distress Call',
    briefing:
      'SIDE OPERATION. The courier Wren broadcasts a distress signal from the '
      + 'Marches: two pirate raiders are running her down toward her jump. Your '
      + 'light cruiser ANS Petrel is closest. Interpose yourself between the '
      + 'courier and the raiders and bring Wren to the jump buoy — or take the '
      + 'raiders out. The courier cannot defend herself; stay between her and '
      + 'the threat, let the pirates close the range, and take them up close.',
    objectives: {
      'obj-protect': 'Bring the courier Wren to the jump buoy',
      'obj-raiders': 'Destroy or drive off the raiders',
    },
  },
  side02: {
    title: 'The Pirate Depot',
    briefing:
      'SIDE OPERATION. Intelligence has fixed a hidden pirate haven in the '
      + 'Marches — the depot of stores and munitions that keeps the raids '
      + 'afloat. Your pair, the heavy cruiser ANS Rampart and destroyer ANS '
      + 'Skua, is to break it. Two light ships guard the depot. Destroy the '
      + 'depot — and the guards, if they stand. You tow missile pods too: dump '
      + 'them into the guards so Rampart can sail in clean.',
    objectives: {
      'obj-depot': 'Destroy the pirate depot',
      'obj-guards': 'Take out the depot guards',
    },
  },
  side03: {
    title: 'The Forward Picket',
    briefing:
      'SIDE OPERATION. An Imperial picket of two destroyers watches the jump '
      + 'lane to Cádiz. Your pair — the battlecruiser ANS Vanguard and light '
      + 'cruiser ANS Talon — is to break it before it can warn the fleet. The '
      + 'prize is a shielded depot of missile pods. Ambush the picket and take '
      + 'out both ships.',
    objectives: {
      'obj-picket': 'Take out the Imperial picket (both ships)',
    },
  },
}

/** název mise v aktuálním jazyce (fallback: český text ze scénáře) */
export function missionTitle(id: string, fallback: string): string {
  return (getLang() === 'en' ? EN[id]?.title : undefined) ?? fallback
}

/** briefing mise v aktuálním jazyce (fallback: český text ze scénáře) */
export function missionBriefing(id: string, fallback: string): string {
  return (getLang() === 'en' ? EN[id]?.briefing : undefined) ?? fallback
}

/** text cíle mise v aktuálním jazyce (fallback: český text ze stavu) */
/** EN text cíle bez ohledu na aktuální jazyk (pro mapování CS→EN v logu) */
export function objectiveTextEn(missionId: string, objectiveId: string): string | undefined {
  return EN[missionId]?.objectives[objectiveId]
}

export function objectiveText(missionId: string, objectiveId: string, fallback: string): string {
  return (getLang() === 'en' ? EN[missionId]?.objectives[objectiveId] : undefined) ?? fallback
}

/** interní export pro testy úplnosti */
export const MISSION_SURFACE_EN = EN
