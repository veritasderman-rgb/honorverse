/**
 * Příběh kampaně — texty z docs/LORE.md (kanonický zdroj).
 * CAMPAIGN_INTRO: úvod kampaně (svět, proč válka hrozí, kdo je hráč).
 * MISSION_STORY: prology (před-misijní kontext, druhá osoba) a epilogy
 * („Význam" mise) pro mise 1–8; epilogy vážou mise na sebe.
 */

export const CAMPAIGN_INTRO: string =
  'Hvězdné království Avalon: tři obydlené světy, trůn a Parlament — a jedna '
  + 'nezasloužená výhra v kosmické loterii: Avalonská křižovatka, jediný '
  + 'známý svazek stabilních červích děr v celém sektoru. Kdo veze náklad '
  + 'mezi jádrem a periferií, platí mýto koruně; z mýta se platí Královské '
  + 'námořnictvo — malé, ale technologicky nejlepší široko daleko. Na trůnu '
  + 'sedí královna Eleanor III., mladá, tvrdohlavá a oblíbená; vládne, ale '
  + 'nerozkazuje — rozpočet drží Parlament. A pak je tu druhý, tišší příjem: '
  + 'kaperské listy, které Parlament oficiálně nikdy neschválil a admiralita '
  + 'oficiálně nevydává — a doradské zlaté konvoje přesto v Pomezí mizí '
  + 's pozoruhodnou pravidelností. Avalon válku nechce, válka je špatná pro '
  + 'obchod. Právě proto se jí nakonec nevyhne.\n\n'
  + 'Na druhé straně mapy leží Doradské impérium: dvacet soustav, jeden muž. '
  + 'Caudillo Ferrante Salazar převzal moc po nástupnické krizi „na jedno '
  + 'volební období" — před devatenácti lety. Impérium žije ze zlatých '
  + 'flotil: konvojů palivových izotopů, které dvakrát ročně táhnou do '
  + 'metropole a platí všechno — dvůr, flotilu, příděly, mlčení. Jenže '
  + 'rafinerie stárnou, konvoje řídnou, kapeři je škubou — a mýto z Avalonské '
  + 'křižovatky by sanovalo říši na generaci. Salazarův plán má tři fáze: '
  + 'rozvrátit Pomezí piráty v zastoupení, vyprovokovat incident, který '
  + 'z Avalonu udělá v očích neutrálů agresora, a nakonec Velká armáda — '
  + 'úder na Křižovatku z tajně budovaného kotviště v soustavě Cádiz.\n\n'
  + 'Ty jsi poručík Alex Rowan, Královské námořnictvo Avalonu. Kampaň sleduje '
  + 'tvou službu od celní hlídky po velení útočné eskadře — a cestu Avalonu '
  + 'od míru k válce. Tvoje mise nejsou epizody: každá z nich posouvá válku, '
  + 'často aniž to v tu chvíli tušíš.'

export interface MissionStory {
  prolog: string
  epilog: string
  epilogLose?: string
  /**
   * Epilogy výhry podle flagů stavu (finále s více konci): první klíč,
   * který je v state.flags nastaven, vybírá text; jinak platí `epilog`.
   */
  epilogByFlag?: Record<string, string>
}

export const MISSION_STORY: Record<string, MissionStory> = {
  mission01: {
    prolog:
      'Rutinní celní služba u Avalonské křižovatky — nejnudnější přidělení, '
      + 'jaké Královské námořnictvo nabízí. Tvoje loď, torpédoborec ANS '
      + 'Dauntless, drží hlídku u wormhole terminálu Strážné brány. Kontrola '
      + 'Brány hlásí nákladní loď Cygnus s podezřelým manifestem. Nejspíš jen '
      + 'další pašerák, který si nezaplatil mýto. Nejspíš.',
    epilog:
      'V zajetém nákladu Cygnusu nejsou zemědělské stroje: jsou to impelerové '
      + 'komponenty pro imperiální program přestavby obchodních lodí na '
      + 'pomocné křižníky. První hmatatelný důkaz, že se Impérium chystá '
      + 'na něco velkého. Admiralita začíná poslouchat.',
    epilogLose:
      'Cygnus zmizel v hyperprostoru i s nákladem — a s ním i důkaz, který '
      + 'mohl Admiralitu probudit o půl roku dřív. Imperiální program '
      + 'přestavby obchodních lodí poběží dál, nerušen a nepojmenován.',
  },

  mission02: {
    prolog:
      'Po nálezu z Cygnusu Avalon posiluje pohraniční stanice — a posily '
      + 'potřebují munici a náhradní díly. Tvoje Dauntless eskortuje konvoj '
      + 'čtyř obchodníků Pomezím: pásem slabých vlád a silných pirátů mezi '
      + 'oběma mocnostmi. Zpravodajství hlásí v oblasti nájezdníky. Zatím '
      + 'nikdo netuší, že piráti znají složení konvoje dřív, než vyplul.',
    epilog:
      'Z trosek pirátské šalupy vytáhly výsadkové čety imperiální munici '
      + 'z aktuální výrobní série — ne starou kořist, čerstvé zásoby. Piráti '
      + 'nejsou jen piráti: jsou to zástupci. Někdo destabilizuje Pomezí '
      + 'systematicky a ten někdo sedí v paláci caudilla Salazara.',
    epilogLose:
      'Konvoj cíle nedosáhl a pohraniční stanice zůstávají bez zásob. '
      + 'Piráti — a ti, kdo jim platí palivo a munici — dostali přesně to, '
      + 'co chtěli: Pomezí, kterým se bez válečné lodi nedá proletět.',
  },

  mission03: {
    prolog:
      'Imperiální munice v pirátských zásobnících — Admiralita té stopě '
      + 'pořád nechce úplně věřit. Mezitím rutina: obchodní loď Mercator '
      + 'hlásí poškozený impelerový prstenec a žádá o doprovod ke stanici '
      + 'Sázava. Tvoje Dauntless je nejblíž. Zpravodajství o Mercatoru nemá '
      + 'žádné záznamy. Vůbec žádné.',
    epilog:
      'Mercator nebyl obchodník: imperiální pomocný křižník s rozkazem '
      + 'zabít avalonskou eskortu a incident svést na kapery. Provokace '
      + 'selhala — a z navigačního jádra Mercatoru vytáhli analytici '
      + 'souřadnice zásobovacích tras do soustavy, kde Impérium nemá co '
      + 'pohledávat: do Cádizu. Někdo se tam bude muset podívat zblízka.',
    epilogLose:
      'Dauntless se z „doprovodné mise" nevrátila a titulky píší o pirátském '
      + 'přepadu — přesně jak si caudillo objednal. A nikdo se nedozví, '
      + 'že navigační jádro Mercatoru ukazovalo do Cádizu.',
  },

  mission04: {
    prolog:
      'Souřadnice z Mercatoru vedou do Cádizu — a Admiralita musí vědět, co '
      + 'tam Impérium skrývá. Tvoje loď, lehký křižník ANS Aurora, '
      + 'proklouzne soustavou balisticky: klín vypnutý, jen drift a pasivní '
      + 'senzory. Zmapuj hlídkové rozestavění a kotviště. A hlavně se nenech '
      + 'spatřit — loď, která tam nemá být, nesmí uvidět loď, která tam taky '
      + 'nemá být.',
    epilog:
      'Hlídkové rozestavění, kotviště, rozestavěná základna Velké armády — '
      + 'všechno je v záznamech Aurory. Avalon teď ví, odkud první úder '
      + 'přijde. Tyhle záznamy se jednou stanou válečným plánem; zatím putují '
      + 'do trezoru Admirality s nejvyšším stupněm utajení.',
    epilogLose:
      'Aurora se z Cádizu nevrátila — a Impérium teď ví, že Avalon ví, '
      + 'kde hledat. Hlídky zhoustnou, kotviště se přeskupí a příští '
      + 'průzkumník už poletí do připravené pasti.',
  },

  mission05: {
    prolog:
      'Diplomaté si vyměňují nóty, ale na okraji Pomezí se mluví jinou řečí. '
      + 'Na stanici Zeta míří „pirátský" svaz — lodě bez vlajky, zato '
      + 's imperiální kázní ve formaci. Tvůj těžký křižník ANS Bastion je '
      + 'jediná válečná loď v dosahu. Zásobníky nejsou bezedné a nikdo ti je '
      + 'uprostřed boje nedoplní.',
    epilog:
      'Mezi útočníky letěl unesený obchodník s civilisty — past na titulky: '
      + '„avalonské námořnictvo střílí do civilistů". Provokace selhala, '
      + 'rukojmí žijí a stanice stojí. Ale oběma stranám je teď jasné, že '
      + 'diplomacie skončila. Další salva už nepřiletí v zastoupení.',
    epilogLose:
      'Stanice Zeta hoří a imperiální tisk si může vybrat titulek: '
      + 'avalonská neschopnost, nebo avalonská palba do civilistů. Provokace '
      + 'vyšla dokonale — válka přijde tak jako tak, jen s hůř rozdanými '
      + 'kartami.',
  },

  mission06: {
    prolog:
      'Válka začala bez vyhlášení: imperiální úder rozprášil avalonskou '
      + 'eskadru u Tharsis. Tvoje poškozená ANS Resolute nese domů jediné, '
      + 'co z bitvy zbylo — senzorové záznamy dokazující, kdo vystřelil '
      + 'první. Za zádí visí svaz, který je rychlejší než ty. Doma potřebují '
      + 'ty záznamy víc než tvou loď.',
    epilog:
      'Záznamy dorazily. Imperiální verze o „avalonské agresi" se '
      + 'rozpadla, neutrálové zůstali neutrální — a Kaledon podepsal pakt. '
      + '„Záchranná" eskadra na půli cesty byla imperiální léčka na ty '
      + 'záznamy; protože jsi ji prokoukl, má dnes důkazy celý sektor — '
      + 'a Parlament odhlasoval válečné rozpočty jednomyslně. Prohraná '
      + 'bitva, vyhraný argument.',
    epilogLose:
      'Resolute nedoletěla a záznamy z Tharsis shořely s ní. Slovo stojí '
      + 'proti slovu a imperiální verze je hlasitější — neutrálové krčí '
      + 'rameny a Kaledon s podpisem paktu váhá. Avalon je ve válce sám.',
  },

  mission07: {
    prolog:
      'Avalon nemůže vyhrát opotřebovací válku — čtyřnásobnou přesilu '
      + 'v přímém střetu neupálíš. Může ale podříznout pokladnu, ze které se '
      + 'platí. Průzkum Aurory ukázal, kudy teče imperiální zlato: flotila '
      + 'palivových izotopů táhne přes soustavu Kerav do Cádizu, dostavět '
      + 'kotviště Velké armády. Tvůj bitevní křižník ANS Praporec ji tam '
      + 'přepadne. Udeř, potop, zmiz — dřív, než dorazí reakční svaz.',
    epilog:
      'Dno soustavy Kerav pokrývá zlato Impéria: izotopy, které měly '
      + 'dostavět cádizské kotviště a zaplatit caudillův dvůr. Dostavba se '
      + 'zpozdí o měsíce — a imperiální dvůr poprvé ucítí, že válka něco '
      + 'stojí. Impérium stahuje eskorty z první linie. Měsíce jsou přesně '
      + 'ten čas, který Avalon zoufale potřebuje.',
    epilogLose:
      'Zlatá flotila prošla a cádizské kotviště dostane všechno podle '
      + 'harmonogramu. Okno, které otevřel průzkum Aurory, se zavírá — '
      + 'a Admiralita škrtá jednu z mála věcí, které mohly válku zkrátit.',
  },

  mission08: {
    prolog:
      'Salazar zkouší vyrazit Kaledon z války demonstrací síly dřív, '
      + 'než aliance sroste. Společná hlídka: tvůj ANS Vanguard a kaledonský '
      + 'KNS Claymore proti imperiální stěně. Kaledonci jsou stateční až '
      + 'za hranici rozumu a rozkazy chápou jako doporučení — a kapitán '
      + 'Claymoru má u Impéria padlého bratra. Nevelíš mu. Ale '
      + 'zodpovídáš za něj.',
    epilog:
      'Stěna je rozbitá a Claymore — potlučený, ale živý — letí domů vedle '
      + 'tebe. Aliance přežila křest ohněm: kaledonská odvaha a avalonská '
      + 'metoda se navzájem potřebují a poprvé to obě strany vědí. A ty ses '
      + 'naučil, že velet spojencům je těžší než velet lodím. Bude se ti to '
      + 'hodit — příště půjde o všechno.',
    epilogLose:
      'Demonstrace síly vyšla: stěna prorazila hlídku a kaledonské přístavy '
      + 'počítají ztráty. Hlasy proti paktu sílí — přesně jak Salazar '
      + 'plánoval. Aliance krvácí dřív, než se stačila narodit.',
  },

  mission09: {
    prolog:
      'Nájezdy podřezávají zlaté flotily a Salazar to ví — proto vsadil '
      + 'všechno na jednu kartu: Velká armáda pluje na Avalonskou '
      + 'křižovatku, dřív než mu dojde dech. Bitva, na kterou se obě strany '
      + 'celou válku chystaly, přijde k tobě domů. Admiralita ti svěřila, '
      + 'co má nejcennějšího: dreadnought Vladař, první loď stěny, jakou kdy '
      + 'Avalon postavil — technologickou odpověď na imperiální tonáž. '
      + 'Tvoje eskadra — vlajkový Vladař, Praporec, Hradba, Vichr a Bouře — '
      + 'je to jediné, co stojí mezi '
      + 'invazním svazem a třemi tisíci lidí na stanici Křižovatka. Útočník '
      + 'musí přistát na hyperlimitu a hodiny se dopravovat dovnitř. Ty ty '
      + 'hodiny musíš proměnit v hřbitov.',
    epilog:
      'Oba sledy Velké armády leží rozbité mezi hyperlimitem a Křižovatkou. '
      + 'Salazar vsadil na jeden úder všechno, co mu zlaté flotily ještě '
      + 'unesly — a prohrál obojí: lodě i iniciativu. Poprvé od Tharsis je '
      + 'to Avalon, kdo si vybere, kde se bude bojovat příště. A Admiralita '
      + 'už vybrala: v trezoru čekají čtyři roky staré záznamy Aurory '
      + 'a na nich soustava, kde tohle všechno začalo. Cádiz.',
    epilogLose:
      'Křižovatka hoří a s ní i všechno, z čeho se platí avalonská flotila. '
      + 'Zbytek námořnictva se stahuje k domovské planetě na poslední obrannou '
      + 'linii — a caudillo si může vybrat, co zaplatí anexi příštích '
      + 'deset let. Bitva, na kterou se obě strany chystaly celou válku, '
      + 'skončila špatně pro tu, která si nemohla dovolit prohrát.',
  },

  mission10: {
    prolog:
      'Kruh se uzavírá. Před čtyřmi lety jsi Cádizem proklouzl balisticky '
      + 'a tvoje Aurora přivezla mapy rozestavěného kotviště; loni jsi '
      + 'u Keravu potopil zlatou flotilu, která ho měla dostavět. Teď vedeš '
      + 'úderný svaz — dreadnought Vladař, Praporec, Vanguard a tu samou '
      + 'Auroru — proti základně, '
      + 'která je díky tobě pořád jen napůl hotová. Rozkaz Admirality zní '
      + 'jasně: Cádiz nesmí být nikdy dokončen — opálit caudillovi vousy. '
      + 'Mezi hyperlimitem a základnou leží hlídka, hluboká soustava — '
      + 'a všechno, co si obránce připravil na osu útoku, kterou zná stejně '
      + 'dobře jako ty.',
    epilog:
      'Cádiz je vyřízený a válka u konce. Kruh, který se otevřel nad '
      + 'zabaveným nákladem u Strážné brány, se uzavřel tam, kde Impérium '
      + 'začalo svou válku stavět.',
    epilogByFlag: {
      'ending-clean':
        'Základna Cádiz přestala existovat dřív, než stačila diplomacie '
        + 'cokoli podepsat. Předsunutá pěst Impéria je pryč a s ní '
        + 'i poslední šance obnovit ofenzívu: příměří, které přijde o týden '
        + 'později, se podepisuje podle avalonských podmínek. Kruh se uzavřel '
        + '— data z Aurory, čas vykoupený u Keravu a jedna přesná salva. '
        + 'Admiralita ti vzkazuje: „Dobrá práce." Víc u Admirality neexistuje.',
      'ending-spirit':
        'Základna padla minutu před platností příměří — Cádiz už Impérium '
        + 'nikdy neopevní. Právníci Admirality budou měsíce řešit, jestli jsi '
        + 'rozkaz porušil, nebo naplnil; historici budou stručnější: doslovné '
        + 'znění rozkazu by válku jen přerušilo, jeho duch ji ukončil. Příměří '
        + 'drží — protože caudillovi nezbylo nic, od čeho by příští útok '
        + 'odrazil. Tvoje kariéra u soudu skončí. Tvoje jméno v učebnicích ne.',
      'ending-orders':
        'Rozkaz je rozkaz: svaz se stáhl a příměří vstoupilo v platnost — '
        + 's nedostavěnou základnou Cádiz jako zástavou na imperiální '
        + 'straně stolu. Diplomaté slaví, Admiralita mlčí. Za pět let, až '
        + 'Impérium doplní sklady a dostaví doky, se k Strážné bráně '
        + 'poletí znovu — ale to už bude jiná válka a jiný příběh. Dnes ses '
        + 'naučil poslední lekci důstojníka: některá vítězství chutnají '
        + 'jako prohra a nosí se stejně těžko.',
    },
    epilogLose:
      'Vladař zůstal v Cádizu a úderný svaz se domů vrací bez vlajkové '
      + 'lodi. Základna se dostaví, příměří se podepíše podle imperiálních '
      + 'podmínek — a mapy, které kdysi přivezla Aurora, zestárnou v trezoru '
      + 'na papír. Válka nekončí porážkou. Jen se odkládá.',
  },
}

/** obecná porážková věta (mise bez vlastního epilogLose) */
export const DEFEAT_GENERIC: string =
  'Mise selhala. Válka se ale neptá, jestli jsi připraven — Admiralita tě '
  + 'posílá znovu. Tentokrát to musí vyjít.'
