import type { ShipClassDef, MissileDef } from '../sim/types'

/**
 * Třídy lodí — éra knih 1–6, hodnoty viz docs/GAME_DESIGN.md kap. 2.
 *
 * Trupy (hullPoints) kalibrovány na „lodě umírají po částech": DD přežije
 * jeden plný zásah salvy (těžce poškozen), CA ~3–4, BC ~5, DN je pohyblivá
 * pevnost. Vyšší trup = víc mezizásahů = víc subsystémového umírání.
 *
 * Asymetrie stran (missileQuality): Hvězdné království Avalon sází na
 * technologickou převahu — méně větších lodí s lepší raketovou elektronikou
 * (1.08). Doradské impérium sází na tonáž a kvantitu — víc trupů, víc
 * šachet, průměrná elektronika (1.0). Pirátské kořistní lodě létají
 * s elektronikou minulé generace (0.9).
 */
export const SHIP_CLASSES: Record<string, ShipClassDef> = {
  'dd-vichr': {
    id: 'dd-vichr', name: 'třída Vichr', hullCode: 'DD', tonnage: 75_000,
    maxAccelG: 520, sidewallStrength: 12, hullPoints: 120,
    tubesPerBroadside: 3, cmLaunchers: 4, pdlcClusters: 6,
    energyMountsPerBroadside: 2, energyDamage: 30,
    magazineMissiles: 180, magazineCMs: 260,
    wedgeDetectionRange: 100_000_000, activeSensorRange: 5_000_000, ecm: 0.35, decoyCount: 4,
    missileQuality: 1.08, podCapacity: 1,
    lore: 'Páteřní torpédoborec Královského námořnictva. Proti imperiálnímu Cádizu '
      + 'je Vichr štít, ne meč: čtyři protiraketové odpalovače a šest PDLC věží proti '
      + 'třem a pěti Cádizu, k tomu elektronika o generaci lepší — jeho zámky drží, '
      + 'kde imperiální sklouznou. Daň: jen tři šachty na bok proti čtyřem. Vichr '
      + 'přežije salvu Cádizu spíš, než Cádiz přežije jeho přesnost — ale ukřičet '
      + 'ho počtem raket neumí. O 10 g rychlejší: iniciativa je jeho.',
  },
  'cl-sokol': {
    id: 'cl-sokol', name: 'třída Sokol', hullCode: 'CL', tonnage: 130_000,
    maxAccelG: 505, sidewallStrength: 16, hullPoints: 180,
    tubesPerBroadside: 5, cmLaunchers: 6, pdlcClusters: 8,
    energyMountsPerBroadside: 3, energyDamage: 38,
    magazineMissiles: 300, magazineCMs: 340,
    wedgeDetectionRange: 120_000_000, activeSensorRange: 6_000_000, ecm: 0.4, decoyCount: 6,
    missileQuality: 1.08, podCapacity: 2,
    lore: 'Lehký křižník pro samostatné operace — průzkumník a lovec nájezdníků. '
      + 'Proti imperiální Seville sází Sokol na informace: lepší senzory, silnější ECM '
      + 'a raketová elektronika 1.08 znamenají, že na dálku vítězí jeho řešení palby. '
      + 'Sevilla nese šest šachet proti jeho pěti a hlubší zásobníky — čím blíž ji '
      + 'pustíš, tím víc její širší salvy bolí. Sokol vyhrává, dokud určuje '
      + 'vzdálenost; prohrává, když se nechá zatáhnout do přestřelky na krátko.',
  },
  'ca-bastion': {
    id: 'ca-bastion', name: 'třída Bastion', hullCode: 'CA', tonnage: 300_000,
    maxAccelG: 490, sidewallStrength: 22, hullPoints: 300,
    tubesPerBroadside: 8, cmLaunchers: 10, pdlcClusters: 12,
    energyMountsPerBroadside: 4, energyDamage: 55,
    magazineMissiles: 560, magazineCMs: 420,
    wedgeDetectionRange: 150_000_000, activeSensorRange: 8_000_000, ecm: 0.45, decoyCount: 8,
    missileQuality: 1.08, podCapacity: 4,
    lore: 'Těžký křižník stavěný jako pohyblivá pevnost — odtud jméno. Proti '
      + 'imperiálnímu Burgosu je Bastion obrana proti salvě: deset protiraket '
      + 'a dvanáct PDLC proti osmi a deseti, boční štíty 22 proti 20. Burgos sype '
      + 'deset šachet proti osmi a táhne o pětinu víc raket — jeho hra je saturace. '
      + 'Bastion ji má přestát a nechat vlastní přesnější salvy proniknout řidší '
      + 'imperiální obranou. Souboj CA proti CA je vytrvalostní závod: kvalita '
      + 'obrany proti šířce salvy.',
  },
  'merch-freighter': {
    // hullPoints 120 (dřív 160): civilní trup bez pancíře a vnitřních
    // přepážek — velký cíl, ale pár salv těžkého křižníku ho rozebere
    id: 'merch-freighter', name: 'nákladní loď', hullCode: 'MERCH', tonnage: 4_000_000,
    maxAccelG: 200, sidewallStrength: 4, hullPoints: 120,
    tubesPerBroadside: 0, cmLaunchers: 0, pdlcClusters: 1,
    energyMountsPerBroadside: 0, energyDamage: 0,
    magazineMissiles: 0, magazineCMs: 10,
    wedgeDetectionRange: 60_000_000, activeSensorRange: 2_000_000, ecm: 0.05, decoyCount: 1,
    lore: 'Standardní čtyřmilionová nákladní loď — kontejnerová páteř mezihvězdného '
      + 'obchodu. Civilní kompenzátor jí dovolí sotva 200 g a výzbroj se omezuje na '
      + 'jediný obranný cluster. Bez eskorty je bezbranná; s nákladem v hodnotě '
      + 'ročního rozpočtu kolonie je přesně tím, po čem piráti v Pomezí jdou.',
  },
  /** Q-ship: imperiální pomocný křižník maskovaný jako obchodník — mise 3 (zvrat) */
  'merch-qship': {
    id: 'merch-qship', name: 'pomocný křižník (Q-ship)', hullCode: 'MERCH', tonnage: 3_000_000,
    maxAccelG: 310, sidewallStrength: 15, hullPoints: 220,
    // obranné baterie jen improvizované (kontejnerová přestavba nemá
    // vojenskou hustotu obrany) — útočná past, ne linková loď
    tubesPerBroadside: 5, cmLaunchers: 4, pdlcClusters: 5,
    energyMountsPerBroadside: 3, energyDamage: 38,
    magazineMissiles: 140, magazineCMs: 120,
    wedgeDetectionRange: 120_000_000, activeSensorRange: 6_000_000, ecm: 0.35, decoyCount: 6,
    missileQuality: 1.0,
    lore: 'Pomocný křižník: trup nákladní lodi, uvnitř vojenská paluba. Impérium '
      + 'je nasazuje jako pasti na eskorty — kontejnery skrývají raketová lůžka '
      + 'a energetické baterie, které se odhalí až zblízka. Proti nic netušící lodi '
      + 'je Q-ship smrtící; jakmile je odhalen, zrazuje ho civilní kompenzátor '
      + 'a improvizované boční štíty.',
  },
  /** kurýrní loď: rychlá, beze zbraní — mise 4 (zvrat) */
  'disp-courier': {
    id: 'disp-courier', name: 'kurýrní loď', hullCode: 'DB', tonnage: 20_000,
    maxAccelG: 560, sidewallStrength: 6, hullPoints: 50,
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
    maxAccelG: 475, sidewallStrength: 26, hullPoints: 440,
    tubesPerBroadside: 10, cmLaunchers: 14, pdlcClusters: 14,
    energyMountsPerBroadside: 5, energyDamage: 65,
    magazineMissiles: 800, magazineCMs: 500,
    wedgeDetectionRange: 160_000_000, activeSensorRange: 8_000_000, ecm: 0.5, decoyCount: 10,
    missileQuality: 1.08, podCapacity: 6,
    lore: 'Bitevní křižník — pod praporcem se v avalonské doktríně vede útok. '
      + 'Proti imperiálnímu Aragonu má Praporec rychlost (475 g proti 465) '
      + 'a nejlepší ECM pod dreadnoughtem: volí vzdálenost, klame senzory, '
      + 'udeří a zmizí. Aragon nese dvanáct šachet proti deseti a o dvě stě raket '
      + 'hlubší zásobníky — v dlouhé přestřelce v linii vyhrává on. Praporec '
      + 'nesmí stát: jeho vítězství je nájezd, ne bitevní stěna.',
  },
  /** dreadnought Avalonu — vlajková loď stěny, finále kampaně (mise 9–10) */
  'dn-vladar': {
    id: 'dn-vladar', name: 'třída Vladař', hullCode: 'DN', tonnage: 6_000_000,
    maxAccelG: 435, sidewallStrength: 34, hullPoints: 900,
    tubesPerBroadside: 14, cmLaunchers: 22, pdlcClusters: 22,
    energyMountsPerBroadside: 7, energyDamage: 80,
    magazineMissiles: 1400, magazineCMs: 900,
    wedgeDetectionRange: 170_000_000, activeSensorRange: 10_000_000, ecm: 0.55, decoyCount: 14,
    missileQuality: 1.08, podCapacity: 8,
    lore: 'Dreadnought — stěna bitvy vtělená do šesti milionů tun. Proti Toledu '
      + 'je Vladař čistá avalonská odpověď: dvaadvacet protiraket a PDLC věží proti '
      + 'osmnácti, boční štíty 34 proti 30, elektronika, která drží zámky i skrz '
      + 'imperiální rušení — a zásobníky na 1 400 raket proti 800. Toledo odpovídá '
      + 'šestnácti šachtami proti čtrnácti: širší salva, hrubší úder. Vladař '
      + 'vyhrává trpělivostí — míří líp, vydrží déle a munice mu dojde poslední.',
  },
  /**
   * Imperiální bojová řada (mise proti Impériu, skirmish): doktrína Toleda
   * v malém — víc šachet a hlubší zásobníky než královský protějšek, za cenu
   * pomalejší akcelerace, řidší protiraketové obrany, slabších bočních štítů
   * a elektroniky 1.0. Avalon míří líp; Dorada sype víc.
   */
  'dd-cadiz': {
    id: 'dd-cadiz', name: 'třída Cádiz', hullCode: 'DD', tonnage: 82_000,
    maxAccelG: 510, sidewallStrength: 11, hullPoints: 130,
    tubesPerBroadside: 4, cmLaunchers: 3, pdlcClusters: 5,
    energyMountsPerBroadside: 2, energyDamage: 30,
    magazineMissiles: 220, magazineCMs: 200,
    wedgeDetectionRange: 95_000_000, activeSensorRange: 4_500_000, ecm: 0.3, decoyCount: 3,
    missileQuality: 1.0, podCapacity: 1,
    lore: 'Imperiální torpédoborec — meč, ne štít. Cádiz nese čtyři šachty na bok '
      + 'proti třem avalonského Vichru a o čtvrtinu hlubší zásobníky: jeho práce je '
      + 'zasypat cíl. Platí za to vším ostatním — tři protiraketové odpalovače '
      + 'a pět PDLC věží proti čtyřem a šesti, tenčí boční štíty, elektronika '
      + 'o generaci pozadu. Proti Vichru vyhrává, jen když se salvy počítají '
      + 'rychleji, než Vichrova obrana stíhá střílet.',
  },
  'cl-sevilla': {
    id: 'cl-sevilla', name: 'třída Sevilla', hullCode: 'CL', tonnage: 145_000,
    maxAccelG: 495, sidewallStrength: 15, hullPoints: 195,
    tubesPerBroadside: 6, cmLaunchers: 5, pdlcClusters: 7,
    energyMountsPerBroadside: 3, energyDamage: 38,
    magazineMissiles: 360, magazineCMs: 280,
    wedgeDetectionRange: 105_000_000, activeSensorRange: 5_000_000, ecm: 0.35, decoyCount: 5,
    missileQuality: 1.0, podCapacity: 2,
    lore: 'Imperiální lehký křižník — dělník doradských eskader. Šest šachet na bok '
      + 'proti pěti avalonského Sokola a zásobníky o pětinu hlubší: Sevilla chce '
      + 'krátkou, hustou přestřelku, kde šířka salvy přebije přesnost. Sokol jí '
      + 'na dálku uteče i s palebným řešením — horší senzory a slabší ECM jsou '
      + 'daň za tonáž výzbroje. Kapitáni Sevilly to vědí: zavřít vzdálenost, '
      + 'nebo prohrát na body.',
  },
  'ca-burgos': {
    id: 'ca-burgos', name: 'třída Burgos', hullCode: 'CA', tonnage: 330_000,
    maxAccelG: 480, sidewallStrength: 20, hullPoints: 320,
    tubesPerBroadside: 10, cmLaunchers: 8, pdlcClusters: 10,
    energyMountsPerBroadside: 4, energyDamage: 55,
    magazineMissiles: 660, magazineCMs: 360,
    wedgeDetectionRange: 135_000_000, activeSensorRange: 7_000_000, ecm: 0.4, decoyCount: 7,
    missileQuality: 1.0, podCapacity: 4,
    lore: 'Imperiální těžký křižník — saturace jako řemeslo. Deset šachet na bok '
      + 'proti osmi avalonského Bastionu a 660 raket v zásobnících: Burgos vyhrává '
      + 'tím, že obranu cíle prostě přetíží. Vlastní deštník má ale řidší — osm '
      + 'protiraket a deset PDLC proti deseti a dvanácti, štíty 20 proti 22. '
      + 'Souboj s Bastionem je sázka: dojdou dřív rakety Burgosu, nebo obrana '
      + 'Bastionu?',
  },
  'bc-aragon': {
    id: 'bc-aragon', name: 'třída Aragon', hullCode: 'BC', tonnage: 1_000_000,
    maxAccelG: 465, sidewallStrength: 24, hullPoints: 470,
    tubesPerBroadside: 12, cmLaunchers: 12, pdlcClusters: 12,
    energyMountsPerBroadside: 5, energyDamage: 65,
    magazineMissiles: 950, magazineCMs: 440,
    wedgeDetectionRange: 145_000_000, activeSensorRange: 7_000_000, ecm: 0.42, decoyCount: 8,
    missileQuality: 1.0, podCapacity: 6,
    lore: 'Imperiální bitevní křižník — milion tun doktríny „víc je víc". Dvanáct '
      + 'šachet na bok proti deseti avalonského Praporce a o dvě stě raket hlubší '
      + 'sklady: Aragon je stavěný na dlouhou přestřelku v linii, kterou si '
      + 'Praporec nemůže dovolit. Neuteče mu ale — 465 g proti 475 — a jeho ECM '
      + 'je proti avalonskému poloviční řemeslo. Když Praporec tančí, Aragon '
      + 'stojí a mlátí.',
  },
  /** dreadnought Impéria — kvantita a tonáž proti avalonské kvalitě */
  'dn-ural': {
    id: 'dn-ural', name: 'třída Toledo', hullCode: 'DN', tonnage: 6_500_000,
    maxAccelG: 425, sidewallStrength: 30, hullPoints: 850,
    tubesPerBroadside: 16, cmLaunchers: 18, pdlcClusters: 18,
    energyMountsPerBroadside: 7, energyDamage: 72,
    magazineMissiles: 800, magazineCMs: 700,
    wedgeDetectionRange: 150_000_000, activeSensorRange: 8_000_000, ecm: 0.35, decoyCount: 8,
    missileQuality: 1.0, podCapacity: 8,
    lore: 'Imperiální dreadnought — hora oceli pojmenovaná po staré císařské '
      + 'metropoli a vzor celé doradské řady. Šestnáct šachet na bok proti '
      + 'čtrnácti avalonského Vladaře: nejširší salva, jakou obloha Pomezí zná. '
      + 'Zbytek je daň — osmnáct protiraket a PDLC proti dvaadvaceti, štíty 30 '
      + 'proti 34, zásobníky poloviční a elektronika o generaci pozadu. Toledo '
      + 'nevyhrává elegancí: vyhrává, když protivníkova obrana spadne dřív, '
      + 'než mu dojde munice.',
  },
  /** orbitální stanice — nehybný opěrný bod se štítovými generátory, mise 5 */
  'station-zeta': {
    id: 'station-zeta', name: 'orbitální stanice', hullCode: 'STN', tonnage: 8_000_000,
    maxAccelG: 0, sidewallStrength: 30, hullPoints: 800,
    tubesPerBroadside: 6, cmLaunchers: 20, pdlcClusters: 20,
    energyMountsPerBroadside: 6, energyDamage: 55,
    magazineMissiles: 300, magazineCMs: 600,
    wedgeDetectionRange: 150_000_000, activeSensorRange: 8_000_000, ecm: 0.3, decoyCount: 12,
    lore: 'Orbitální překladiště a pevnost v jednom. Bez klínu se nikam nehne, '
      + 'zato štítové generátory nahrazují boční štíty po celém obvodu a zásobníky '
      + 'protiraket vydrží hodiny nepřetržité palby. Kdo chce stanici dobýt, musí '
      + 'nejdřív vyčerpat její obranu — nebo ji obejít a odříznout.',
  },
  /** pirátský křižník — opotřebovaná kořistní loď, ne první linie (Pomezí) */
  'cl-korzar': {
    id: 'cl-korzar', name: 'třída Korzár', hullCode: 'CL', tonnage: 110_000,
    maxAccelG: 480, sidewallStrength: 10, hullPoints: 140,
    tubesPerBroadside: 4, cmLaunchers: 4, pdlcClusters: 5,
    energyMountsPerBroadside: 2, energyDamage: 30,
    magazineMissiles: 60, magazineCMs: 80,
    wedgeDetectionRange: 90_000_000, activeSensorRange: 4_000_000, ecm: 0.2, decoyCount: 2,
    missileQuality: 0.9,
    lore: 'Kořistní křižník z rozpadlé pomezní flotily, látaný vraky a černým '
      + 'trhem. Korzáři na něm létají, dokud drží pohromadě: senzory za zenitem, '
      + 'ECM z minulé generace a zásobníky, které nikdo nedoplňuje. Pořád ale nese '
      + 'čtyři šachty na bok — na obchodníka víc než dost.',
  },
  /** pirátská šalupa — lehký nájezdník (Pomezí) */
  'dd-korzar': {
    id: 'dd-korzar', name: 'pirátská šalupa', hullCode: 'DD', tonnage: 55_000,
    maxAccelG: 500, sidewallStrength: 8, hullPoints: 90,
    tubesPerBroadside: 2, cmLaunchers: 3, pdlcClusters: 4,
    energyMountsPerBroadside: 1, energyDamage: 24,
    magazineMissiles: 40, magazineCMs: 60,
    wedgeDetectionRange: 80_000_000, activeSensorRange: 3_500_000, ecm: 0.15, decoyCount: 2,
    missileQuality: 0.9,
    lore: 'Lehký nájezdník pirátských flotil — rychlý, laciný a postradatelný. '
      + 'Šalupa loví ve smečkách: jedna váže eskortu, ostatní trhají konvoj. '
      + 'Dvě šachty a papírové boční štíty znamenají, že proti soustředěné palbě '
      + 'nevydrží ani jednu pořádnou salvu — a její kapitáni to vědí.',
  },
  /** sonda/maják — drobný kosmetický objekt mapy (pulzující bod na plotu) */
  'probe': {
    id: 'probe', name: 'sonda', hullCode: 'PRB', tonnage: 12,
    maxAccelG: 0, sidewallStrength: 0, hullPoints: 5,
    tubesPerBroadside: 0, cmLaunchers: 0, pdlcClusters: 0,
    energyMountsPerBroadside: 0, energyDamage: 0,
    magazineMissiles: 0, magazineCMs: 0,
    wedgeDetectionRange: 0, activeSensorRange: 0, ecm: 0, decoyCount: 0,
    lore: 'Meteorologická sonda — tichý svědek soustavy. Měří sluneční vítr, '
      + 'hlásí polohu a nikoho nezajímá. Přesně proto je všude.',
  },
  /** planeta — statický objekt mapy (nehybná, nezničitelná v praxi, beze zbraní) */
  'planet': {
    id: 'planet', name: 'planeta', hullCode: 'PLT', tonnage: 5.97e18,
    maxAccelG: 0, sidewallStrength: 0, hullPoints: 1_000_000,
    tubesPerBroadside: 0, cmLaunchers: 0, pdlcClusters: 0,
    energyMountsPerBroadside: 0, energyDamage: 0,
    magazineMissiles: 0, magazineCMs: 0,
    wedgeDetectionRange: 0, activeSensorRange: 0, ecm: 0, decoyCount: 0,
    lore: 'Planeta — kotva soustavy a důvod, proč se o ni bojuje. Jednou '
      + 'zanesená do map se už nikam nehne: poslední známé zakreslení platí navždy.',
  },
  /** „obchodník" s vojenským kompenzátorem — mise 1 (zvrat) */
  'merch-runner': {
    id: 'merch-runner', name: 'nákladní loď (?)', hullCode: 'MERCH', tonnage: 2_000_000,
    maxAccelG: 420, sidewallStrength: 8, hullPoints: 140,
    tubesPerBroadside: 2, cmLaunchers: 2, pdlcClusters: 3,
    energyMountsPerBroadside: 1, energyDamage: 24,
    magazineMissiles: 30, magazineCMs: 40,
    wedgeDetectionRange: 80_000_000, activeSensorRange: 4_000_000, ecm: 0.3, decoyCount: 1,
    lore: 'Na papíře obyčejný dvoumilionový obchodník. Pod nákladovými palubami '
      + 'ale nese vojenský kompenzátor a pár skrytých šachet — přestavba, jakou si '
      + 'platí pašeráci a zpravodajské služby. Pozná se až ve chvíli, kdy „pomalý '
      + 'obchodník" najednou táhne 400 g.',
  },
}

export const MISSILES: Record<string, MissileDef> = {
  /**
   * Standardní útočná raketa éry. rodDamage 10 (dřív 14): honorverse rytmus
   * „loď vydrží 10–15 zásahů a umírá po částech" — jednotlivý paprsek trhá
   * subsystémy, ne půlku trupu. Párová rekalibrace s CM_PK/PDLC_PK dolů:
   * zásahů je VÍC, každý bolí MÍŇ.
   */
  'std-shipkiller': {
    id: 'std-shipkiller', name: 'útočná raketa',
    accelG: [46_000, 92_000], driveTime: [180, 60],
    standoffRange: 30_000, laserRods: 6, rodDamage: 10,
    maxSpeed: 0.8 * 299_792.458,
  },
}
