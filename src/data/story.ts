/**
 * Příběh kampaně — texty z docs/LORE.md (kanonický zdroj).
 * CAMPAIGN_INTRO: úvod kampaně (svět, proč válka hrozí, kdo je hráč).
 * MISSION_STORY: prology (před-misijní kontext, druhá osoba) a epilogy
 * („Význam" mise) pro mise 1–8; epilogy vážou mise na sebe.
 */

export const CAMPAIGN_INTRO: string =
  'Hvězdné království Albion: tři obydlené světy a jedna nezasloužená výhra '
  + 'v kosmické loterii — Albionská křižovatka, jediný známý svazek stabilních '
  + 'červích děr v celém sektoru. Kdo veze náklad mezi jádrem a periferií, '
  + 'platí mýto Albionu; z mýta se platí Královské námořnictvo — malé, ale '
  + 'technologicky nejlepší široko daleko. Albion válku nechce, válka je '
  + 'špatná pro obchod. Právě proto se jí nakonec nevyhne.\n\n'
  + 'Na druhé straně mapy leží Vegský direktoriát: zkostnatělý stát dvaceti '
  + 'soustav řízený výborem, který nikdo nevolil a který se bojí vlastních '
  + 'občanů víc než nepřátel. Jeho plánovaná ekonomika už neunese příděly ani '
  + 'flotilu najednou — expanze je pro Direktoriát účetní nutnost a mýto '
  + 'z Křižovatky by sanovalo rozpočet na generaci. Plán má tři fáze: '
  + 'rozvrátit Pomezí pirátskými „svobodnými flotilami" v zastoupení, '
  + 'vyprovokovat incident, který z Albionu udělá v očích neutrálů agresora, '
  + 'a udeřit první z tajně budované základny v soustavě Kastor.\n\n'
  + 'Ty jsi poručík Alex Rowan, Královské námořnictvo Albionu. Kampaň sleduje '
  + 'tvou službu od celní hlídky po velení útočné eskadře — a cestu Albionu '
  + 'od míru k válce. Tvoje mise nejsou epizody: každá z nich posouvá válku, '
  + 'často aniž to v tu chvíli tušíš.'

export interface MissionStory {
  prolog: string
  epilog: string
  epilogLose?: string
}

export const MISSION_STORY: Record<string, MissionStory> = {
  mission01: {
    prolog:
      'Rutinní celní služba u Albionské křižovatky — nejnudnější přidělení, '
      + 'jaké Královské námořnictvo nabízí. Tvoje loď, torpédoborec ANS '
      + 'Dauntless, drží hlídku u wormhole terminálu Strážné brány. Kontrola '
      + 'Brány hlásí nákladní loď Cygnus s podezřelým manifestem. Nejspíš jen '
      + 'další pašerák, který si nezaplatil mýto. Nejspíš.',
    epilog:
      'V zajetém nákladu Cygnusu nejsou zemědělské stroje: jsou to impelerové '
      + 'komponenty pro direktoriátní program přestavby obchodních lodí na '
      + 'pomocné křižníky. První hmatatelný důkaz, že se Direktoriát chystá '
      + 'na něco velkého. Admiralita začíná poslouchat.',
    epilogLose:
      'Cygnus zmizel v hyperprostoru i s nákladem — a s ním i důkaz, který '
      + 'mohl Admiralitu probudit o půl roku dřív. Direktoriátní program '
      + 'přestavby obchodních lodí poběží dál, nerušen a nepojmenován.',
  },

  mission02: {
    prolog:
      'Po nálezu z Cygnusu Albion posiluje pohraniční stanice — a posily '
      + 'potřebují munici a náhradní díly. Tvoje Dauntless eskortuje konvoj '
      + 'čtyř obchodníků Pomezím: pásem slabých vlád a silných pirátů mezi '
      + 'oběma mocnostmi. Zpravodajství hlásí v oblasti nájezdníky. Zatím '
      + 'nikdo netuší, že piráti znají složení konvoje dřív, než vyplul.',
    epilog:
      'Z trosek pirátské šalupy vytáhly výsadkové čety direktoriátní munici '
      + 'z aktuální výrobní série — ne starou kořist, čerstvé zásoby. Piráti '
      + 'nejsou jen piráti: jsou to zástupci. Někdo destabilizuje Pomezí '
      + 'systematicky a ten někdo sedí ve Vegském direktoriátu.',
    epilogLose:
      'Konvoj cíle nedosáhl a pohraniční stanice zůstávají bez zásob. '
      + 'Piráti — a ti, kdo jim platí palivo a munici — dostali přesně to, '
      + 'co chtěli: Pomezí, kterým se bez válečné lodi nedá proletět.',
  },

  mission03: {
    prolog:
      'Direktoriátní munice v pirátských zásobnících — Admiralita té stopě '
      + 'pořád nechce úplně věřit. Mezitím rutina: obchodní loď Mercator '
      + 'hlásí poškozený impelerový prstenec a žádá o doprovod ke stanici '
      + 'Sázava. Tvoje Dauntless je nejblíž. Zpravodajství o Mercatoru nemá '
      + 'žádné záznamy. Vůbec žádné.',
    epilog:
      'Mercator nebyl obchodník: direktoriátní pomocný křižník s rozkazem '
      + 'zabít albionskou eskortu a incident svést na piráty. Provokace '
      + 'selhala — a z navigačního jádra Mercatoru vytáhli analytici '
      + 'souřadnice zásobovacích tras do soustavy, kde Direktoriát nemá co '
      + 'pohledávat: do Kastoru. Někdo se tam bude muset podívat zblízka.',
    epilogLose:
      'Dauntless se z „doprovodné mise" nevrátila a titulky píší o pirátském '
      + 'přepadu — přesně jak si Direktoriát objednal. A nikdo se nedozví, '
      + 'že navigační jádro Mercatoru ukazovalo do Kastoru.',
  },

  mission04: {
    prolog:
      'Souřadnice z Mercatoru vedou do Kastoru — a Admiralita musí vědět, co '
      + 'tam Direktoriát skrývá. Tvoje loď, lehký křižník ANS Aurora, '
      + 'proklouzne soustavou balisticky: klín vypnutý, jen drift a pasivní '
      + 'senzory. Zmapuj hlídkové rozestavění a kotviště. A hlavně se nenech '
      + 'spatřit — loď, která tam nemá být, nesmí uvidět loď, která tam taky '
      + 'nemá být.',
    epilog:
      'Hlídkové rozestavění, kotviště, rozestavěná základna — všechno je '
      + 'v záznamech Aurory. Albion teď ví, odkud první úder přijde. Tyhle '
      + 'záznamy se jednou stanou válečným plánem; zatím putují do trezoru '
      + 'Admirality s nejvyšším stupněm utajení.',
    epilogLose:
      'Aurora se z Kastoru nevrátila — a Direktoriát teď ví, že Albion ví, '
      + 'kde hledat. Hlídky zhoustnou, kotviště se přeskupí a příští '
      + 'průzkumník už poletí do připravené pasti.',
  },

  mission05: {
    prolog:
      'Diplomaté si vyměňují nóty, ale na okraji Pomezí se mluví jinou řečí. '
      + 'Na stanici Zeta míří „pirátský" svaz — lodě bez vlajky, zato '
      + 's direktoriátní kázní ve formaci. Tvůj těžký křižník ANS Bastion je '
      + 'jediná válečná loď v dosahu. Zásobníky nejsou bezedné a nikdo ti je '
      + 'uprostřed boje nedoplní.',
    epilog:
      'Mezi útočníky letěl unesený obchodník s civilisty — past na titulky: '
      + '„albionské námořnictvo střílí do civilistů". Provokace selhala, '
      + 'rukojmí žijí a stanice stojí. Ale oběma stranám je teď jasné, že '
      + 'diplomacie skončila. Další salva už nepřiletí v zastoupení.',
    epilogLose:
      'Stanice Zeta hoří a direktoriátní tisk si může vybrat titulek: '
      + 'albionská neschopnost, nebo albionská palba do civilistů. Provokace '
      + 'vyšla dokonale — válka přijde tak jako tak, jen s hůř rozdanými '
      + 'kartami.',
  },

  mission06: {
    prolog:
      'Válka začala bez vyhlášení: direktoriátní úder rozprášil albionskou '
      + 'eskadru u Tharsis. Tvoje poškozená ANS Resolute nese domů jediné, '
      + 'co z bitvy zbylo — senzorové záznamy dokazující, kdo vystřelil '
      + 'první. Za zádí visí svaz, který je rychlejší než ty. Doma potřebují '
      + 'ty záznamy víc než tvou loď.',
    epilog:
      'Záznamy dorazily. Direktoriátní verze o „albionské agresi" se '
      + 'rozpadla, neutrálové zůstali neutrální — a Kaledon podepsal pakt. '
      + '„Záchranná" eskadra na půli cesty byla direktoriátní léčka na ty '
      + 'záznamy; protože jsi ji prokoukl, má dnes důkazy celý sektor. '
      + 'Prohraná bitva, vyhraný argument.',
    epilogLose:
      'Resolute nedoletěla a záznamy z Tharsis shořely s ní. Slovo stojí '
      + 'proti slovu a direktoriátní verze je hlasitější — neutrálové krčí '
      + 'rameny a Kaledon s podpisem paktu váhá. Albion je ve válce sám.',
  },

  mission07: {
    prolog:
      'Albion nemůže vyhrát opotřebovací válku — čtyřnásobnou přesilu '
      + 'v přímém střetu neupálíš. Může jí ale podříznout logistiku. Průzkum '
      + 'Aurory z Kastoru ukázal, kudy tečou zásoby pro nedostavěnou '
      + 'základnu; tvůj bitevní křižník ANS Praporec teď v soustavě Kerav '
      + 'přepadá konvoj, který je veze. Udeř, potop, zmiz — dřív, než dorazí '
      + 'reakční svaz.',
    epilog:
      'Dno soustavy Kerav pokrývá náklad, který měl dostavět kastorskou '
      + 'základnu. Dokončení se zpozdí o měsíce — a měsíce jsou přesně ten '
      + 'čas, který Albion zoufale potřebuje. Direktoriát stahuje eskorty '
      + 'z první linie. Válka logistiky začala.',
    epilogLose:
      'Konvoj prošel a kastorská základna dostane všechno podle '
      + 'harmonogramu. Okno, které otevřel průzkum Aurory, se zavírá — '
      + 'a Admiralita škrtá jednu z mála věcí, které mohly válku zkrátit.',
  },

  mission08: {
    prolog:
      'Direktoriát zkouší vyrazit Kaledon z války demonstrací síly dřív, '
      + 'než aliance sroste. Společná hlídka: tvůj ANS Vanguard a kaledonský '
      + 'KNS Claymore proti direktoriátní stěně. Kaledonci jsou stateční až '
      + 'za hranici rozumu a rozkazy chápou jako doporučení — a kapitán '
      + 'Claymoru má u Direktoriátu padlého bratra. Nevelíš mu. Ale '
      + 'zodpovídáš za něj.',
    epilog:
      'Stěna je rozbitá a Claymore — potlučený, ale živý — letí domů vedle '
      + 'tebe. Aliance přežila křest ohněm: kaledonská odvaha a albionská '
      + 'metoda se navzájem potřebují a poprvé to obě strany vědí. A ty ses '
      + 'naučil, že velet spojencům je těžší než velet lodím. Bude se ti to '
      + 'hodit — příště půjde o všechno.',
    epilogLose:
      'Demonstrace síly vyšla: stěna prorazila hlídku a kaledonské přístavy '
      + 'počítají ztráty. Hlasy proti paktu sílí — přesně jak Direktoriát '
      + 'plánoval. Aliance krvácí dřív, než se stačila narodit.',
  },
}

/** obecná porážková věta (mise bez vlastního epilogLose) */
export const DEFEAT_GENERIC: string =
  'Mise selhala. Válka se ale neptá, jestli jsi připraven — Admiralita tě '
  + 'posílá znovu. Tentokrát to musí vyjít.'
