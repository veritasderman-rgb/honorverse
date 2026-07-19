import type { ShipClassDef, MissileDef } from '../sim/types'

/** Třídy lodí — éra knih 1–6, hodnoty viz docs/GAME_DESIGN.md kap. 2. */
export const SHIP_CLASSES: Record<string, ShipClassDef> = {
  'dd-vichr': {
    id: 'dd-vichr', name: 'třída Vichr', hullCode: 'DD', tonnage: 75_000,
    maxAccelG: 520, sidewallStrength: 12, hullPoints: 60,
    tubesPerBroadside: 3, cmLaunchers: 4, pdlcClusters: 6,
    energyMountsPerBroadside: 2, energyDamage: 25,
    magazineMissiles: 90, magazineCMs: 260,
    wedgeDetectionRange: 100_000_000, activeSensorRange: 5_000_000, ecm: 0.35, decoyCount: 4,
    lore: 'Páteřní torpédoborec Královského námořnictva, pojmenovaný po náhlých '
      + 'horských vichrech albionské domoviny. Konstrukce upřednostňuje protiraketové '
      + 'zásobníky a kadenci obrany před vlastní údernou silou — Vichr je stavěný jako '
      + 'eskortní deštník konvojů. Slabina: pouhé tři šachty na bok a tenké bočníky; '
      + 'v přímém přestřelu s křižníkem nemá co pohledávat.',
  },
  'cl-sokol': {
    id: 'cl-sokol', name: 'třída Sokol', hullCode: 'CL', tonnage: 130_000,
    maxAccelG: 505, sidewallStrength: 16, hullPoints: 90,
    tubesPerBroadside: 5, cmLaunchers: 6, pdlcClusters: 8,
    energyMountsPerBroadside: 3, energyDamage: 30,
    magazineMissiles: 150, magazineCMs: 340,
    wedgeDetectionRange: 120_000_000, activeSensorRange: 6_000_000, ecm: 0.4, decoyCount: 6,
    lore: 'Lehký křižník pro samostatné operace daleko od domovských přístavů — '
      + 'jméno nese po loveckém sokolovi albionských králů. Vyvážený poměr senzorů, '
      + 'ECM a výzbroje z něj dělá ideální průzkumník a lovce nájezdníků. Pět šachet '
      + 'na bok mu dává úderné slovo, ale pancéřování zůstává křižníkově tenké — '
      + 'Sokol vítězí manévrem a informacemi, ne výdrží.',
  },
  'ca-bastion': {
    id: 'ca-bastion', name: 'třída Bastion', hullCode: 'CA', tonnage: 300_000,
    maxAccelG: 490, sidewallStrength: 22, hullPoints: 150,
    tubesPerBroadside: 8, cmLaunchers: 10, pdlcClusters: 12,
    energyMountsPerBroadside: 4, energyDamage: 40,
    magazineMissiles: 280, magazineCMs: 420,
    wedgeDetectionRange: 150_000_000, activeSensorRange: 8_000_000, ecm: 0.45, decoyCount: 8,
    lore: 'Těžký křižník stavěný jako pohyblivá pevnost — odtud jméno. Osm šachet '
      + 'na bok, silné bočníky a vrstvená bodová obrana z Bastionu dělají loď, která '
      + 'dokáže držet linii i proti přesile. Daní je tonáž: pomalejší akcelerace '
      + 'a velký senzorový obraz, který se špatně skrývá.',
  },
  'merch-freighter': {
    id: 'merch-freighter', name: 'nákladní loď', hullCode: 'MERCH', tonnage: 4_000_000,
    maxAccelG: 200, sidewallStrength: 4, hullPoints: 80,
    tubesPerBroadside: 0, cmLaunchers: 0, pdlcClusters: 1,
    energyMountsPerBroadside: 0, energyDamage: 0,
    magazineMissiles: 0, magazineCMs: 10,
    wedgeDetectionRange: 60_000_000, activeSensorRange: 2_000_000, ecm: 0.05, decoyCount: 1,
    lore: 'Standardní čtyřmilionová nákladní loď — kontejnerová páteř mezihvězdného '
      + 'obchodu. Civilní kompenzátor jí dovolí sotva 200 g a výzbroj se omezuje na '
      + 'jediný obranný cluster. Bez eskorty je bezbranná; s nákladem v hodnotě '
      + 'ročního rozpočtu kolonie je přesně tím, po čem piráti v Pomezí jdou.',
  },
  /** Q-ship: direktoriátní pomocný křižník maskovaný jako obchodník — mise 3 (zvrat) */
  'merch-qship': {
    id: 'merch-qship', name: 'pomocný křižník (Q-ship)', hullCode: 'MERCH', tonnage: 3_000_000,
    maxAccelG: 310, sidewallStrength: 15, hullPoints: 110,
    tubesPerBroadside: 5, cmLaunchers: 6, pdlcClusters: 8,
    energyMountsPerBroadside: 3, energyDamage: 30,
    magazineMissiles: 140, magazineCMs: 160,
    wedgeDetectionRange: 120_000_000, activeSensorRange: 6_000_000, ecm: 0.35, decoyCount: 6,
    lore: 'Pomocný křižník: trup nákladní lodi, uvnitř vojenská paluba. Direktoriát '
      + 'je nasazuje jako pasti na eskorty — kontejnery skrývají raketová lůžka '
      + 'a energetické baterie, které se odhalí až zblízka. Proti nic netušící lodi '
      + 'je Q-ship smrtící; jakmile je odhalen, zrazuje ho civilní kompenzátor '
      + 'a improvizované bočníky.',
  },
  /** kurýrní loď: rychlá, beze zbraní — mise 4 (zvrat) */
  'disp-courier': {
    id: 'disp-courier', name: 'kurýrní loď', hullCode: 'DB', tonnage: 20_000,
    maxAccelG: 560, sidewallStrength: 6, hullPoints: 25,
    tubesPerBroadside: 0, cmLaunchers: 2, pdlcClusters: 2,
    energyMountsPerBroadside: 0, energyDamage: 0,
    magazineMissiles: 0, magazineCMs: 30,
    wedgeDetectionRange: 80_000_000, activeSensorRange: 3_000_000, ecm: 0.25, decoyCount: 2,
    lore: 'Kurýr je v podstatě impelerový prstenec s kabinou — nejrychlejší trup, '
      + 'jaký loděnice staví. Vozí depeše, šifry a pasažéry, na které nesmí nikdo '
      + 'čekat. Beze zbraní a bez pancíře: jeho jedinou obranou je akcelerace '
      + 'a modlitba, aby ho nikdo nebral vážně.',
  },
  /** bitevní křižník — údernou silou převyšuje CA, mise 7 (hráč útočí) */
  'bc-praporec': {
    id: 'bc-praporec', name: 'třída Praporec', hullCode: 'BC', tonnage: 900_000,
    maxAccelG: 475, sidewallStrength: 26, hullPoints: 220,
    tubesPerBroadside: 10, cmLaunchers: 14, pdlcClusters: 14,
    energyMountsPerBroadside: 5, energyDamage: 45,
    magazineMissiles: 400, magazineCMs: 500,
    wedgeDetectionRange: 160_000_000, activeSensorRange: 8_000_000, ecm: 0.5, decoyCount: 10,
    lore: 'Bitevní křižník — pod praporcem (odtud jméno) se v albionské doktríně '
      + 'vede útok: deset šachet na bok, špičkové ECM a rychlost, jaká větším lodím '
      + 'chybí. Praporec je stavěný na nájezdy hluboko do nepřátelského prostoru: '
      + 'udeřit, rozbít, zmizet. Neumí jediné — stát v linii proti skutečným '
      + 'bitevním lodím; jeho pancíř je na to o třídu tenčí.',
  },
  /** orbitální stanice — nehybný opěrný bod se štítovými generátory, mise 5 */
  'station-zeta': {
    id: 'station-zeta', name: 'orbitální stanice', hullCode: 'STN', tonnage: 8_000_000,
    maxAccelG: 0, sidewallStrength: 30, hullPoints: 400,
    tubesPerBroadside: 6, cmLaunchers: 20, pdlcClusters: 20,
    energyMountsPerBroadside: 6, energyDamage: 40,
    magazineMissiles: 300, magazineCMs: 600,
    wedgeDetectionRange: 150_000_000, activeSensorRange: 8_000_000, ecm: 0.3, decoyCount: 12,
    lore: 'Orbitální překladiště a pevnost v jednom. Bez klínu se nikam nehne, '
      + 'zato štítové generátory nahrazují bočníky po celém obvodu a zásobníky '
      + 'protiraket vydrží hodiny nepřetržité palby. Kdo chce stanici dobýt, musí '
      + 'nejdřív vyčerpat její obranu — nebo ji obejít a odříznout.',
  },
  /** pirátský křižník — opotřebovaná kořistní loď, ne první linie (Pomezí) */
  'cl-korzar': {
    id: 'cl-korzar', name: 'třída Korzár', hullCode: 'CL', tonnage: 110_000,
    maxAccelG: 480, sidewallStrength: 10, hullPoints: 70,
    tubesPerBroadside: 4, cmLaunchers: 4, pdlcClusters: 5,
    energyMountsPerBroadside: 2, energyDamage: 25,
    magazineMissiles: 60, magazineCMs: 80,
    wedgeDetectionRange: 90_000_000, activeSensorRange: 4_000_000, ecm: 0.2, decoyCount: 2,
    lore: 'Kořistní křižník z rozpadlé pomezní flotily, látaný vraky a černým '
      + 'trhem. Korzáři na něm létají, dokud drží pohromadě: senzory za zenitem, '
      + 'ECM z minulé generace a zásobníky, které nikdo nedoplňuje. Pořád ale nese '
      + 'čtyři šachty na bok — na obchodníka víc než dost.',
  },
  /** pirátská šalupa — lehký nájezdník (Pomezí) */
  'dd-korzar': {
    id: 'dd-korzar', name: 'pirátská šalupa', hullCode: 'DD', tonnage: 55_000,
    maxAccelG: 500, sidewallStrength: 8, hullPoints: 45,
    tubesPerBroadside: 2, cmLaunchers: 3, pdlcClusters: 4,
    energyMountsPerBroadside: 1, energyDamage: 20,
    magazineMissiles: 40, magazineCMs: 60,
    wedgeDetectionRange: 80_000_000, activeSensorRange: 3_500_000, ecm: 0.15, decoyCount: 2,
    lore: 'Lehký nájezdník pirátských flotil — rychlý, laciný a postradatelný. '
      + 'Šalupa loví ve smečkách: jedna váže eskortu, ostatní trhají konvoj. '
      + 'Dvě šachty a papírové bočníky znamenají, že proti soustředěné palbě '
      + 'nevydrží ani jednu pořádnou salvu — a její kapitáni to vědí.',
  },
  /** „obchodník" s vojenským kompenzátorem — mise 1 (zvrat) */
  'merch-runner': {
    id: 'merch-runner', name: 'nákladní loď (?)', hullCode: 'MERCH', tonnage: 2_000_000,
    maxAccelG: 420, sidewallStrength: 8, hullPoints: 70,
    tubesPerBroadside: 2, cmLaunchers: 2, pdlcClusters: 3,
    energyMountsPerBroadside: 1, energyDamage: 20,
    magazineMissiles: 30, magazineCMs: 40,
    wedgeDetectionRange: 80_000_000, activeSensorRange: 4_000_000, ecm: 0.3, decoyCount: 1,
    lore: 'Na papíře obyčejný dvoumilionový obchodník. Pod nákladovými palubami '
      + 'ale nese vojenský kompenzátor a pár skrytých šachet — přestavba, jakou si '
      + 'platí pašeráci a zpravodajské služby. Pozná se až ve chvíli, kdy „pomalý '
      + 'obchodník" najednou táhne 400 g.',
  },
}

export const MISSILES: Record<string, MissileDef> = {
  /** standardní útočná raketa éry */
  'std-shipkiller': {
    id: 'std-shipkiller', name: 'útočná raketa',
    accelG: [46_000, 92_000], driveTime: [180, 60],
    standoffRange: 30_000, laserRods: 6, rodDamage: 14,
    maxSpeed: 0.8 * 299_792.458,
  },
}
