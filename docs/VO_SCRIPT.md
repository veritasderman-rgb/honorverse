# Nahrávací skript voiceoveru (VO)

Vygenerováno z `src/data/story.ts` — needituj ručně, spusť
`npx tsx scripts/gen-vo-script.mts`.

## Jak nahrávat

- **Formát:** MP3 (mono, 96 kbps+) preferovaný; hra zkusí i `.m4a` a `.wav`
  se stejným jménem, takže jde nahrát bez převodu.
- **Umístění:** `public/audio/vo/<jméno souboru>` přesně dle tabulky.
- Soubor, který neexistuje, hra tiše přeskočí — nahrávat jde po částech.
- **Povinné minimum na zítřek:** `intro` + prology misí. Epilogy jsou
  označené _(volitelné)_ — hráč je čte na obrazovce výsledku.
- Čti přesně text níže (zobrazuje se zároveň jako titulky). Tón: klidný
  vojenský briefing, druhá osoba.

## Přehled souborů

| Soubor | Obsah | Stopáž (odhad) |
| --- | --- | --- |
| `intro-cs.mp3` | Úvod kampaně (CS) | ~111 s |
| `intro-en.mp3` | Úvod kampaně (EN) | ~143 s |
| `mission01-prolog-cs.mp3` | mission01 — prolog (CS) | ~18 s |
| `mission01-prolog-en.mp3` | mission01 — prolog (EN) | ~21 s |
| `mission01-epilog-cs.mp3` | mission01 — epilog (výhra) (CS) _(volitelné)_ | ~14 s |
| `mission01-epilog-en.mp3` | mission01 — epilog (výhra) (EN) _(volitelné)_ | ~17 s |
| `mission01-epiloglose-cs.mp3` | mission01 — epilog (porážka) (CS) _(volitelné)_ | ~13 s |
| `mission01-epiloglose-en.mp3` | mission01 — epilog (porážka) (EN) _(volitelné)_ | ~14 s |
| `mission02-prolog-cs.mp3` | mission02 — prolog (CS) | ~21 s |
| `mission02-prolog-en.mp3` | mission02 — prolog (EN) | ~26 s |
| `mission02-epilog-cs.mp3` | mission02 — epilog (výhra) (CS) _(volitelné)_ | ~16 s |
| `mission02-epilog-en.mp3` | mission02 — epilog (výhra) (EN) _(volitelné)_ | ~20 s |
| `mission02-epiloglose-cs.mp3` | mission02 — epilog (porážka) (CS) _(volitelné)_ | ~14 s |
| `mission02-epiloglose-en.mp3` | mission02 — epilog (porážka) (EN) _(volitelné)_ | ~16 s |
| `mission03-prolog-cs.mp3` | mission03 — prolog (CS) | ~18 s |
| `mission03-prolog-en.mp3` | mission03 — prolog (EN) | ~19 s |
| `mission03-epilog-cs.mp3` | mission03 — epilog (výhra) (CS) _(volitelné)_ | ~19 s |
| `mission03-epilog-en.mp3` | mission03 — epilog (výhra) (EN) _(volitelné)_ | ~24 s |
| `mission03-epiloglose-cs.mp3` | mission03 — epilog (porážka) (CS) _(volitelné)_ | ~12 s |
| `mission03-epiloglose-en.mp3` | mission03 — epilog (porážka) (EN) _(volitelné)_ | ~14 s |
| `mission04-prolog-cs.mp3` | mission04 — prolog (CS) | ~24 s |
| `mission04-prolog-en.mp3` | mission04 — prolog (EN) | ~30 s |
| `mission04-epilog-cs.mp3` | mission04 — epilog (výhra) (CS) _(volitelné)_ | ~15 s |
| `mission04-epilog-en.mp3` | mission04 — epilog (výhra) (EN) _(volitelné)_ | ~20 s |
| `mission04-epiloglose-cs.mp3` | mission04 — epilog (porážka) (CS) _(volitelné)_ | ~12 s |
| `mission04-epiloglose-en.mp3` | mission04 — epilog (porážka) (EN) _(volitelné)_ | ~15 s |
| `mission05-prolog-cs.mp3` | mission05 — prolog (CS) | ~21 s |
| `mission05-prolog-en.mp3` | mission05 — prolog (EN) | ~26 s |
| `mission05-epilog-cs.mp3` | mission05 — epilog (výhra) (CS) _(volitelné)_ | ~16 s |
| `mission05-epilog-en.mp3` | mission05 — epilog (výhra) (EN) _(volitelné)_ | ~20 s |
| `mission05-epiloglose-cs.mp3` | mission05 — epilog (porážka) (CS) _(volitelné)_ | ~13 s |
| `mission05-epiloglose-en.mp3` | mission05 — epilog (porážka) (EN) _(volitelné)_ | ~15 s |
| `mission06-prolog-cs.mp3` | mission06 — prolog (CS) | ~20 s |
| `mission06-prolog-en.mp3` | mission06 — prolog (EN) | ~23 s |
| `mission06-epilog-cs.mp3` | mission06 — epilog (výhra) (CS) _(volitelné)_ | ~21 s |
| `mission06-epilog-en.mp3` | mission06 — epilog (výhra) (EN) _(volitelné)_ | ~26 s |
| `mission06-epiloglose-cs.mp3` | mission06 — epilog (porážka) (CS) _(volitelné)_ | ~14 s |
| `mission06-epiloglose-en.mp3` | mission06 — epilog (porážka) (EN) _(volitelné)_ | ~16 s |
| `mission07-prolog-cs.mp3` | mission07 — prolog (CS) | ~24 s |
| `mission07-prolog-en.mp3` | mission07 — prolog (EN) | ~30 s |
| `mission07-epilog-cs.mp3` | mission07 — epilog (výhra) (CS) _(volitelné)_ | ~20 s |
| `mission07-epilog-en.mp3` | mission07 — epilog (výhra) (EN) _(volitelné)_ | ~26 s |
| `mission07-epiloglose-cs.mp3` | mission07 — epilog (porážka) (CS) _(volitelné)_ | ~12 s |
| `mission07-epiloglose-en.mp3` | mission07 — epilog (porážka) (EN) _(volitelné)_ | ~16 s |
| `mission08-prolog-cs.mp3` | mission08 — prolog (CS) | ~22 s |
| `mission08-prolog-en.mp3` | mission08 — prolog (EN) | ~30 s |
| `mission08-epilog-cs.mp3` | mission08 — epilog (výhra) (CS) _(volitelné)_ | ~23 s |
| `mission08-epilog-en.mp3` | mission08 — epilog (výhra) (EN) _(volitelné)_ | ~27 s |
| `mission08-epiloglose-cs.mp3` | mission08 — epilog (porážka) (CS) _(volitelné)_ | ~12 s |
| `mission08-epiloglose-en.mp3` | mission08 — epilog (porážka) (EN) _(volitelné)_ | ~16 s |
| `mission09-prolog-cs.mp3` | mission09 — prolog (CS) | ~44 s |
| `mission09-prolog-en.mp3` | mission09 — prolog (EN) | ~53 s |
| `mission09-epilog-cs.mp3` | mission09 — epilog (výhra) (CS) _(volitelné)_ | ~27 s |
| `mission09-epilog-en.mp3` | mission09 — epilog (výhra) (EN) _(volitelné)_ | ~34 s |
| `mission09-epiloglose-cs.mp3` | mission09 — epilog (porážka) (CS) _(volitelné)_ | ~23 s |
| `mission09-epiloglose-en.mp3` | mission09 — epilog (porážka) (EN) _(volitelné)_ | ~29 s |
| `mission10-prolog-cs.mp3` | mission10 — prolog (CS) | ~38 s |
| `mission10-prolog-en.mp3` | mission10 — prolog (EN) | ~47 s |
| `mission10-epilog-cs.mp3` | mission10 — epilog (výhra) (CS) _(volitelné)_ | ~11 s |
| `mission10-epilog-en.mp3` | mission10 — epilog (výhra) (EN) _(volitelné)_ | ~12 s |
| `mission10-epiloglose-cs.mp3` | mission10 — epilog (porážka) (CS) _(volitelné)_ | ~17 s |
| `mission10-epiloglose-en.mp3` | mission10 — epilog (porážka) (EN) _(volitelné)_ | ~21 s |
| `mission10-epilog-ending-clean-cs.mp3` | mission10 — konec „ending-clean" (CS) _(volitelné)_ | ~25 s |
| `mission10-epilog-ending-clean-en.mp3` | mission10 — konec „ending-clean" (EN) _(volitelné)_ | ~29 s |
| `mission10-epilog-ending-spirit-cs.mp3` | mission10 — konec „ending-spirit" (CS) _(volitelné)_ | ~26 s |
| `mission10-epilog-ending-spirit-en.mp3` | mission10 — konec „ending-spirit" (EN) _(volitelné)_ | ~35 s |
| `mission10-epilog-ending-orders-cs.mp3` | mission10 — konec „ending-orders" (CS) _(volitelné)_ | ~29 s |
| `mission10-epilog-ending-orders-en.mp3` | mission10 — konec „ending-orders" (EN) _(volitelné)_ | ~36 s |
| `mission11-prolog-cs.mp3` | mission11 — prolog (CS) | ~37 s |
| `mission11-prolog-en.mp3` | mission11 — prolog (EN) | ~39 s |
| `mission11-epilog-cs.mp3` | mission11 — epilog (výhra) (CS) _(volitelné)_ | ~24 s |
| `mission11-epilog-en.mp3` | mission11 — epilog (výhra) (EN) _(volitelné)_ | ~33 s |
| `mission11-epiloglose-cs.mp3` | mission11 — epilog (porážka) (CS) _(volitelné)_ | ~21 s |
| `mission11-epiloglose-en.mp3` | mission11 — epilog (porážka) (EN) _(volitelné)_ | ~30 s |
| `side01-prolog-cs.mp3` | side01 — prolog (CS) | ~19 s |
| `side01-prolog-en.mp3` | side01 — prolog (EN) | ~24 s |
| `side01-epilog-cs.mp3` | side01 — epilog (výhra) (CS) _(volitelné)_ | ~16 s |
| `side01-epilog-en.mp3` | side01 — epilog (výhra) (EN) _(volitelné)_ | ~19 s |
| `side01-epiloglose-cs.mp3` | side01 — epilog (porážka) (CS) _(volitelné)_ | ~11 s |
| `side01-epiloglose-en.mp3` | side01 — epilog (porážka) (EN) _(volitelné)_ | ~14 s |
| `side02-prolog-cs.mp3` | side02 — prolog (CS) | ~16 s |
| `side02-prolog-en.mp3` | side02 — prolog (EN) | ~21 s |
| `side02-epilog-cs.mp3` | side02 — epilog (výhra) (CS) _(volitelné)_ | ~20 s |
| `side02-epilog-en.mp3` | side02 — epilog (výhra) (EN) _(volitelné)_ | ~24 s |
| `side02-epiloglose-cs.mp3` | side02 — epilog (porážka) (CS) _(volitelné)_ | ~13 s |
| `side02-epiloglose-en.mp3` | side02 — epilog (porážka) (EN) _(volitelné)_ | ~15 s |
| `side03-prolog-cs.mp3` | side03 — prolog (CS) | ~17 s |
| `side03-prolog-en.mp3` | side03 — prolog (EN) | ~21 s |
| `side03-epilog-cs.mp3` | side03 — epilog (výhra) (CS) _(volitelné)_ | ~17 s |
| `side03-epilog-en.mp3` | side03 — epilog (výhra) (EN) _(volitelné)_ | ~21 s |
| `side03-epiloglose-cs.mp3` | side03 — epilog (porážka) (CS) _(volitelné)_ | ~11 s |
| `side03-epiloglose-en.mp3` | side03 — epilog (porážka) (EN) _(volitelné)_ | ~15 s |
| `defeat-generic-cs.mp3` | Obecná porážka (mise bez vlastního epilogu) (CS) _(volitelné)_ | ~10 s |
| `defeat-generic-en.mp3` | Obecná porážka (mise bez vlastního epilogu) (EN) _(volitelné)_ | ~11 s |

---

## Úvod kampaně

### `intro-cs.mp3`

> Hvězdné království Avalon: tři obydlené světy, trůn a Parlament — a jedna nezasloužená výhra v kosmické loterii: Avalonská křižovatka, jediný známý svazek stabilních červích děr v celém sektoru. Kdo veze náklad mezi jádrem a periferií, platí mýto koruně; z mýta se platí Královské námořnictvo — malé, ale technologicky nejlepší široko daleko. Na trůnu sedí královna Eleanor III., mladá, tvrdohlavá a oblíbená; vládne, ale nerozkazuje — rozpočet drží Parlament. A pak je tu druhý, tišší příjem: kaperské listy, které Parlament oficiálně nikdy neschválil a admiralita oficiálně nevydává — a doradské zlaté konvoje přesto v Pomezí mizí s pozoruhodnou pravidelností. Avalon válku nechce, válka je špatná pro obchod. Právě proto se jí nakonec nevyhne.
>
> Na druhé straně mapy leží Doradské impérium: dvacet soustav, jeden muž. Caudillo Ferrante Salazar převzal moc po nástupnické krizi „na jedno volební období" — před devatenácti lety. Impérium žije ze zlatých flotil: konvojů palivových izotopů, které dvakrát ročně táhnou do metropole a platí všechno — dvůr, flotilu, příděly, mlčení. Jenže rafinerie stárnou, konvoje řídnou, kapeři je škubou — a mýto z Avalonské křižovatky by sanovalo říši na generaci. Salazarův plán má tři fáze: rozvrátit Pomezí piráty v zastoupení, vyprovokovat incident, který z Avalonu udělá v očích neutrálů agresora, a nakonec Velká armáda — úder na Křižovatku z tajně budovaného kotviště v soustavě Cádiz.
>
> Ty jsi poručík Alex Rowan, Královské námořnictvo Avalonu. Kampaň sleduje tvou službu od celní hlídky po velení útočné eskadře — a cestu Avalonu od míru k válce. Tvoje mise nejsou epizody: každá z nich posouvá válku, často aniž to v tu chvíli tušíš.

### `intro-en.mp3`

> The Star Kingdom of Avalon: three inhabited worlds, a throne and a Parliament — and one unearned win in the cosmic lottery: the Avalon Junction, the only known cluster of stable wormholes in the entire sector. Whoever hauls cargo between the core and the periphery pays toll to the Crown; the toll pays for the Royal Navy — small, but the finest technology for light-years around. On the throne sits Queen Eleanor III, young, stubborn and beloved; she reigns but does not rule — Parliament holds the budget. And then there is a second, quieter income: letters of marque that Parliament never officially approved and the Admiralty officially does not issue — and yet Doradan gold convoys keep vanishing in the Marches with remarkable regularity. Avalon does not want war; war is bad for trade. Which is exactly why, in the end, it will not avoid one.
>
> On the other side of the map lies the Doradan Empire: twenty systems, one man. Caudillo Ferrante Salazar seized power after a succession crisis "for a single term" — nineteen years ago. The Empire lives off its gold fleets: convoys of fuel isotopes that crawl to the capital twice a year and pay for everything — the court, the fleet, the rations, the silence. But the refineries are aging, the convoys are thinning, privateers keep plucking at them — and the toll from the Avalon Junction would refloat the Empire for a generation. Salazar's plan has three phases: destabilize the Marches with pirates by proxy, provoke an incident that paints Avalon as the aggressor in neutral eyes, and finally the Grand Army — a strike at the Junction from a secretly built anchorage in the Cádiz system.
>
> You are Lieutenant Alex Rowan, Royal Avalon Navy. The campaign follows your service from customs patrol to command of a strike squadron — and Avalon's road from peace to war. Your missions are not episodes: every one of them moves the war, often without you knowing it at the time.

## mission01 — prolog

### `mission01-prolog-cs.mp3`

> Rutinní celní služba u Avalonské křižovatky — nejnudnější přidělení, jaké Královské námořnictvo nabízí. Tvoje loď, torpédoborec ANS Dauntless, drží hlídku u wormhole terminálu Strážné brány. Kontrola Brány hlásí nákladní loď Cygnus s podezřelým manifestem. Nejspíš jen další pašerák, který si nezaplatil mýto. Nejspíš.

### `mission01-prolog-en.mp3`

> Routine customs duty at the Avalon Junction — the dullest posting the Royal Navy has to offer. Your ship, the destroyer ANS Dauntless, holds picket near the Watchgate wormhole terminal. Gate Control reports a freighter, Cygnus, with a suspicious manifest. Probably just another smuggler dodging the toll. Probably.

## mission01 — epilog (výhra) _(volitelné)_

### `mission01-epilog-cs.mp3`

> V zajetém nákladu Cygnusu nejsou zemědělské stroje: jsou to impelerové komponenty pro imperiální program přestavby obchodních lodí na pomocné křižníky. První hmatatelný důkaz, že se Impérium chystá na něco velkého. Admiralita začíná poslouchat.

### `mission01-epilog-en.mp3`

> The cargo seized aboard Cygnus is not farm machinery: it is impeller components for the Imperial program of converting merchantmen into auxiliary cruisers. The first tangible proof that the Empire is preparing something big. The Admiralty is starting to listen.

## mission01 — epilog (porážka) _(volitelné)_

### `mission01-epiloglose-cs.mp3`

> Cygnus zmizel v hyperprostoru i s nákladem — a s ním i důkaz, který mohl Admiralitu probudit o půl roku dřív. Imperiální program přestavby obchodních lodí poběží dál, nerušen a nepojmenován.

### `mission01-epiloglose-en.mp3`

> Cygnus vanished into hyperspace, cargo and all — and with her the evidence that could have woken the Admiralty half a year earlier. The Imperial conversion program will run on, undisturbed and unnamed.

## mission02 — prolog

### `mission02-prolog-cs.mp3`

> Po nálezu z Cygnusu Avalon posiluje pohraniční stanice — a posily potřebují munici a náhradní díly. Tvoje Dauntless eskortuje konvoj čtyř obchodníků Pomezím: pásem slabých vlád a silných pirátů mezi oběma mocnostmi. Zpravodajství hlásí v oblasti nájezdníky. Zatím nikdo netuší, že piráti znají složení konvoje dřív, než vyplul.

### `mission02-prolog-en.mp3`

> After the Cygnus find, Avalon reinforces its border stations — and reinforcements need munitions and spare parts. Your Dauntless escorts a convoy of four merchantmen through the Marches: a belt of weak governments and strong pirates between the two powers. Intelligence reports raiders in the area. So far nobody suspects the pirates knew the convoy's composition before it ever sailed.

## mission02 — epilog (výhra) _(volitelné)_

### `mission02-epilog-cs.mp3`

> Z trosek pirátské šalupy vytáhly výsadkové čety imperiální munici z aktuální výrobní série — ne starou kořist, čerstvé zásoby. Piráti nejsou jen piráti: jsou to zástupci. Někdo destabilizuje Pomezí systematicky a ten někdo sedí v paláci caudilla Salazara.

### `mission02-epilog-en.mp3`

> From the wreck of the pirate sloop, the boarding parties pulled Imperial munitions from the current production run — not old loot, fresh stores. The pirates are not just pirates: they are proxies. Someone is destabilizing the Marches systematically, and that someone sits in Caudillo Salazar's palace.

## mission02 — epilog (porážka) _(volitelné)_

### `mission02-epiloglose-cs.mp3`

> Konvoj cíle nedosáhl a pohraniční stanice zůstávají bez zásob. Piráti — a ti, kdo jim platí palivo a munici — dostali přesně to, co chtěli: Pomezí, kterým se bez válečné lodi nedá proletět.

### `mission02-epiloglose-en.mp3`

> The convoy never reached its destination and the border stations remain unsupplied. The pirates — and whoever pays for their fuel and munitions — got exactly what they wanted: a Marches no one can cross without a warship.

## mission03 — prolog

### `mission03-prolog-cs.mp3`

> Imperiální munice v pirátských zásobnících — Admiralita té stopě pořád nechce úplně věřit. Mezitím rutina: obchodní loď Mercator hlásí poškozený impelerový prstenec a žádá o doprovod ke stanici Sázava. Tvoje Dauntless je nejblíž. Zpravodajství o Mercatoru nemá žádné záznamy. Vůbec žádné.

### `mission03-prolog-en.mp3`

> Imperial munitions in pirate magazines — the Admiralty still refuses to fully believe that trail. Meanwhile, routine: the merchantman Mercator reports a damaged impeller ring and requests escort to Sázava Station. Your Dauntless is closest. Intelligence has no records on Mercator. None at all.

## mission03 — epilog (výhra) _(volitelné)_

### `mission03-epilog-cs.mp3`

> Mercator nebyl obchodník: imperiální pomocný křižník s rozkazem zabít avalonskou eskortu a incident svést na kapery. Provokace selhala — a z navigačního jádra Mercatoru vytáhli analytici souřadnice zásobovacích tras do soustavy, kde Impérium nemá co pohledávat: do Cádizu. Někdo se tam bude muset podívat zblízka.

### `mission03-epilog-en.mp3`

> Mercator was no merchant: an Imperial auxiliary cruiser under orders to kill an Avalonian escort and pin the incident on privateers. The provocation failed — and from Mercator's navigation core the analysts extracted supply-route coordinates into a system where the Empire has no business at all: Cádiz. Someone will have to go take a close look.

## mission03 — epilog (porážka) _(volitelné)_

### `mission03-epiloglose-cs.mp3`

> Dauntless se z „doprovodné mise" nevrátila a titulky píší o pirátském přepadu — přesně jak si caudillo objednal. A nikdo se nedozví, že navigační jádro Mercatoru ukazovalo do Cádizu.

### `mission03-epiloglose-en.mp3`

> Dauntless never came back from her "escort mission" and the headlines read pirate ambush — exactly as the caudillo ordered. And no one will ever learn that Mercator's navigation core pointed to Cádiz.

## mission04 — prolog

### `mission04-prolog-cs.mp3`

> Souřadnice z Mercatoru vedou do Cádizu — a Admiralita musí vědět, co tam Impérium skrývá. Tvoje loď, lehký křižník ANS Aurora, proklouzne soustavou balisticky: klín vypnutý, jen drift a pasivní senzory. Zmapuj hlídkové rozestavění a kotviště. A hlavně se nenech spatřit — loď, která tam nemá být, nesmí uvidět loď, která tam taky nemá být.

### `mission04-prolog-en.mp3`

> The Mercator coordinates lead to Cádiz — and the Admiralty must know what the Empire is hiding there. Your ship, the light cruiser ANS Aurora, slips through the system ballistic: wedge down, nothing but drift and passive sensors. Map the picket dispositions and the anchorage. And above all, stay unseen — a ship that should not be there must not be seen by a ship that should not be there either.

## mission04 — epilog (výhra) _(volitelné)_

### `mission04-epilog-cs.mp3`

> Hlídkové rozestavění, kotviště, rozestavěná základna Velké armády — všechno je v záznamech Aurory. Avalon teď ví, odkud první úder přijde. Tyhle záznamy se jednou stanou válečným plánem; zatím putují do trezoru Admirality s nejvyšším stupněm utajení.

### `mission04-epilog-en.mp3`

> Picket dispositions, the anchorage, a half-built Grand Army base — it is all in Aurora's records. Avalon now knows where the first blow will come from. One day these records will become a war plan; for now they go into the Admiralty vault under the highest classification.

## mission04 — epilog (porážka) _(volitelné)_

### `mission04-epiloglose-cs.mp3`

> Aurora se z Cádizu nevrátila — a Impérium teď ví, že Avalon ví, kde hledat. Hlídky zhoustnou, kotviště se přeskupí a příští průzkumník už poletí do připravené pasti.

### `mission04-epiloglose-en.mp3`

> Aurora never returned from Cádiz — and now the Empire knows that Avalon knows where to look. The pickets will thicken, the anchorage will redeploy, and the next scout will fly into a prepared trap.

## mission05 — prolog

### `mission05-prolog-cs.mp3`

> Diplomaté si vyměňují nóty, ale na okraji Pomezí se mluví jinou řečí. Na stanici Zeta míří „pirátský" svaz — lodě bez vlajky, zato s imperiální kázní ve formaci. Tvůj těžký křižník ANS Bastion je jediná válečná loď v dosahu. Zásobníky nejsou bezedné a nikdo ti je uprostřed boje nedoplní.

### `mission05-prolog-en.mp3`

> The diplomats exchange notes, but out on the edge of the Marches a different language is spoken. A "pirate" task group is heading for Station Zeta — ships with no flag, but with Imperial discipline in their formation. Your heavy cruiser ANS Bastion is the only warship in range. Magazines are not bottomless, and nobody will refill them for you mid-battle.

## mission05 — epilog (výhra) _(volitelné)_

### `mission05-epilog-cs.mp3`

> Mezi útočníky letěl unesený obchodník s civilisty — past na titulky: „avalonské námořnictvo střílí do civilistů". Provokace selhala, rukojmí žijí a stanice stojí. Ale oběma stranám je teď jasné, že diplomacie skončila. Další salva už nepřiletí v zastoupení.

### `mission05-epilog-en.mp3`

> Among the attackers flew a hijacked merchantman full of civilians — a trap built for headlines: "Avalon Navy fires on civilians". The provocation failed, the hostages live and the station stands. But both sides now know diplomacy is over. The next salvo will not arrive by proxy.

## mission05 — epilog (porážka) _(volitelné)_

### `mission05-epiloglose-cs.mp3`

> Stanice Zeta hoří a imperiální tisk si může vybrat titulek: avalonská neschopnost, nebo avalonská palba do civilistů. Provokace vyšla dokonale — válka přijde tak jako tak, jen s hůř rozdanými kartami.

### `mission05-epiloglose-en.mp3`

> Station Zeta burns, and the Imperial press can pick its headline: Avalonian incompetence, or Avalonian fire on civilians. The provocation worked perfectly — war will come either way, only with a worse hand dealt.

## mission06 — prolog

### `mission06-prolog-cs.mp3`

> Válka začala bez vyhlášení: imperiální úder rozprášil avalonskou eskadru u Tharsis. Tvoje poškozená ANS Resolute nese domů jediné, co z bitvy zbylo — senzorové záznamy dokazující, kdo vystřelil první. Za zádí visí svaz, který je rychlejší než ty. Doma potřebují ty záznamy víc než tvou loď.

### `mission06-prolog-en.mp3`

> The war began without a declaration: an Imperial strike scattered an Avalonian squadron at Tharsis. Your battered ANS Resolute carries home the only thing left of the battle — sensor records proving who fired first. Astern hangs a task group faster than you are. Home needs those records more than it needs your ship.

## mission06 — epilog (výhra) _(volitelné)_

### `mission06-epilog-cs.mp3`

> Záznamy dorazily. Imperiální verze o „avalonské agresi" se rozpadla, neutrálové zůstali neutrální — a Kaledon podepsal pakt. „Záchranná" eskadra na půli cesty byla imperiální léčka na ty záznamy; protože jsi ji prokoukl, má dnes důkazy celý sektor — a Parlament odhlasoval válečné rozpočty jednomyslně. Prohraná bitva, vyhraný argument.

### `mission06-epilog-en.mp3`

> The records made it. The Imperial line about "Avalonian aggression" collapsed, the neutrals stayed neutral — and Caledon signed the pact. The "rescue" squadron halfway home was an Imperial snare set for those records; because you saw through it, the whole sector has the proof today — and Parliament voted the war budgets unanimously. A lost battle, a won argument.

## mission06 — epilog (porážka) _(volitelné)_

### `mission06-epiloglose-cs.mp3`

> Resolute nedoletěla a záznamy z Tharsis shořely s ní. Slovo stojí proti slovu a imperiální verze je hlasitější — neutrálové krčí rameny a Kaledon s podpisem paktu váhá. Avalon je ve válce sám.

### `mission06-epiloglose-en.mp3`

> Resolute never made it and the Tharsis records burned with her. Word stands against word and the Imperial version is louder — the neutrals shrug, and Caledon hesitates over signing the pact. Avalon is at war alone.

## mission07 — prolog

### `mission07-prolog-cs.mp3`

> Avalon nemůže vyhrát opotřebovací válku — čtyřnásobnou přesilu v přímém střetu neupálíš. Může ale podříznout pokladnu, ze které se platí. Průzkum Aurory ukázal, kudy teče imperiální zlato: flotila palivových izotopů táhne přes soustavu Kerav do Cádizu, dostavět kotviště Velké armády. Tvůj bitevní křižník ANS Praporec ji tam přepadne. Udeř, potop, zmiz — dřív, než dorazí reakční svaz.

### `mission07-prolog-en.mp3`

> Avalon cannot win a war of attrition — you do not burn down a four-to-one advantage in a stand-up fight. But you can cut the purse that pays for it. Aurora's reconnaissance showed where the Imperial gold flows: a fuel-isotope fleet hauls through the Kerav system toward Cádiz to finish the Grand Army anchorage. Your battlecruiser ANS Praporec will ambush it there. Strike, sink, vanish — before the reaction force arrives.

## mission07 — epilog (výhra) _(volitelné)_

### `mission07-epilog-cs.mp3`

> Dno soustavy Kerav pokrývá zlato Impéria: izotopy, které měly dostavět cádizské kotviště a zaplatit caudillův dvůr. Dostavba se zpozdí o měsíce — a imperiální dvůr poprvé ucítí, že válka něco stojí. Impérium stahuje eskorty z první linie. Měsíce jsou přesně ten čas, který Avalon zoufale potřebuje.

### `mission07-epilog-en.mp3`

> The floor of the Kerav system is covered in the Empire's gold: isotopes that were meant to finish the Cádiz anchorage and pay the caudillo's court. Completion slips by months — and the Imperial court feels for the first time that the war costs something. The Empire pulls escorts from the front line. Months are exactly the time Avalon desperately needs.

## mission07 — epilog (porážka) _(volitelné)_

### `mission07-epiloglose-cs.mp3`

> Zlatá flotila prošla a cádizské kotviště dostane všechno podle harmonogramu. Okno, které otevřel průzkum Aurory, se zavírá — a Admiralita škrtá jednu z mála věcí, které mohly válku zkrátit.

### `mission07-epiloglose-en.mp3`

> The gold fleet got through and the Cádiz anchorage will receive everything on schedule. The window Aurora's reconnaissance opened is closing — and the Admiralty strikes out one of the few things that could have shortened the war.

## mission08 — prolog

### `mission08-prolog-cs.mp3`

> Salazar zkouší vyrazit Kaledon z války demonstrací síly dřív, než aliance sroste. Společná hlídka: tvůj ANS Vanguard a kaledonský KNS Claymore proti imperiální stěně. Kaledonci jsou stateční až za hranici rozumu a rozkazy chápou jako doporučení — a kapitán Claymoru má u Impéria padlého bratra. Nevelíš mu. Ale zodpovídáš za něj.

### `mission08-prolog-en.mp3`

> Salazar is trying to knock Caledon out of the war with a show of force before the alliance can knit together. A joint patrol: your ANS Vanguard and the Caledonian KNS Claymore against an Imperial wall. The Caledonians are brave past the edge of reason and treat orders as suggestions — and Claymore's captain lost a brother to the Empire. You do not command him. But you answer for him.

## mission08 — epilog (výhra) _(volitelné)_

### `mission08-epilog-cs.mp3`

> Stěna je rozbitá a Claymore — potlučený, ale živý — letí domů vedle tebe. Aliance přežila křest ohněm: kaledonská odvaha a avalonská metoda se navzájem potřebují a poprvé to obě strany vědí. A ty ses naučil, že velet spojencům je těžší než velet lodím. Bude se ti to hodit — příště půjde o všechno.

### `mission08-epilog-en.mp3`

> The wall is broken and Claymore — battered but alive — flies home at your side. The alliance survived its baptism of fire: Caledonian courage and Avalonian method need each other, and for the first time both sides know it. And you learned that commanding allies is harder than commanding ships. You will need that — next time everything will be at stake.

## mission08 — epilog (porážka) _(volitelné)_

### `mission08-epiloglose-cs.mp3`

> Demonstrace síly vyšla: stěna prorazila hlídku a kaledonské přístavy počítají ztráty. Hlasy proti paktu sílí — přesně jak Salazar plánoval. Aliance krvácí dřív, než se stačila narodit.

### `mission08-epiloglose-en.mp3`

> The show of force worked: the wall punched through the patrol and the Caledonian ports are counting losses. Voices against the pact grow louder — exactly as Salazar planned. The alliance bleeds before it was even born.

## mission09 — prolog

### `mission09-prolog-cs.mp3`

> Nájezdy podřezávají zlaté flotily a Salazar to ví — proto vsadil všechno na jednu kartu: Velká armáda pluje na Avalonskou křižovatku, dřív než mu dojde dech. Bitva, na kterou se obě strany celou válku chystaly, přijde k tobě domů. Admiralita ti svěřila, co má nejcennějšího: dreadnought Vladař, první loď stěny, jakou kdy Avalon postavil — technologickou odpověď na imperiální tonáž. Tvoje eskadra — vlajkový Vladař, Praporec, Hradba, Vichr a Bouře — je to jediné, co stojí mezi invazním svazem a třemi tisíci lidí na stanici Křižovatka. Útočník musí přistát na hyperlimitu a hodiny se dopravovat dovnitř. Ty ty hodiny musíš proměnit v hřbitov.

### `mission09-prolog-en.mp3`

> The raids are bleeding the gold fleets dry and Salazar knows it — so he bets everything on one card: the Grand Army sails for the Avalon Junction before his breath runs out. The battle both sides spent the whole war preparing for is coming to your home. The Admiralty has entrusted you with its most precious possession: the dreadnought Vladař, the first ship of the wall Avalon ever built — the technological answer to Imperial tonnage. Your squadron — flagship Vladař, Praporec, Hradba, Vichr and Bouře — is all that stands between the invasion force and three thousand people on Junction Station. The attacker must drop at the hyper limit and spend hours crawling inward. You must turn those hours into a graveyard.

## mission09 — epilog (výhra) _(volitelné)_

### `mission09-epilog-cs.mp3`

> Oba sledy Velké armády leží rozbité mezi hyperlimitem a Křižovatkou. Salazar vsadil na jeden úder všechno, co mu zlaté flotily ještě unesly — a prohrál obojí: lodě i iniciativu. Poprvé od Tharsis je to Avalon, kdo si vybere, kde se bude bojovat příště. A Admiralita už vybrala: v trezoru čekají čtyři roky staré záznamy Aurory a na nich soustava, kde tohle všechno začalo. Cádiz.

### `mission09-epilog-en.mp3`

> Both echelons of the Grand Army lie broken between the hyper limit and the Junction. Salazar staked everything the gold fleets could still carry on a single blow — and lost both: the ships and the initiative. For the first time since Tharsis it is Avalon that chooses where the next battle will be fought. And the Admiralty has already chosen: in the vault wait Aurora's four-year-old records, and on them the system where all of this began. Cádiz.

## mission09 — epilog (porážka) _(volitelné)_

### `mission09-epiloglose-cs.mp3`

> Křižovatka hoří a s ní i všechno, z čeho se platí avalonská flotila. Zbytek námořnictva se stahuje k domovské planetě na poslední obrannou linii — a caudillo si může vybrat, co zaplatí anexi příštích deset let. Bitva, na kterou se obě strany chystaly celou válku, skončila špatně pro tu, která si nemohla dovolit prohrát.

### `mission09-epiloglose-en.mp3`

> The Junction burns, and with it everything that pays for the Avalonian fleet. What remains of the Navy falls back on the homeworld for a last line of defense — and the caudillo can pick what the annexation will pay for over the next ten years. The battle both sides spent the war preparing for ended badly for the one that could not afford to lose it.

## mission10 — prolog

### `mission10-prolog-cs.mp3`

> Kruh se uzavírá. Před čtyřmi lety jsi Cádizem proklouzl balisticky a tvoje Aurora přivezla mapy rozestavěného kotviště; loni jsi u Keravu potopil zlatou flotilu, která ho měla dostavět. Teď vedeš úderný svaz — dreadnought Vladař, Praporec, Vanguard a tu samou Auroru — proti základně, která je díky tobě pořád jen napůl hotová. Rozkaz Admirality zní jasně: Cádiz nesmí být nikdy dokončen — opálit caudillovi vousy. Mezi hyperlimitem a základnou leží hlídka, hluboká soustava — a všechno, co si obránce připravil na osu útoku, kterou zná stejně dobře jako ty.

### `mission10-prolog-en.mp3`

> The circle closes. Four years ago you slipped through Cádiz ballistic and your Aurora brought home maps of a half-built anchorage; last year at Kerav you sank the gold fleet meant to finish it. Now you lead a strike force — the dreadnought Vladař, Praporec, Vanguard and that same Aurora — against a base that is still only half finished because of you. The Admiralty's order is plain: Cádiz must never be completed — singe the caudillo's beard. Between the hyper limit and the base lie a picket line, a deep system — and everything a defender could prepare along an attack axis he knows as well as you do.

## mission10 — epilog (výhra) _(volitelné)_

### `mission10-epilog-cs.mp3`

> Cádiz je vyřízený a válka u konce. Kruh, který se otevřel nad zabaveným nákladem u Strážné brány, se uzavřel tam, kde Impérium začalo svou válku stavět.

### `mission10-epilog-en.mp3`

> Cádiz is finished and the war is over. The circle that opened over a seized cargo at the Watchgate closed where the Empire began building its war.

## mission10 — epilog (porážka) _(volitelné)_

### `mission10-epiloglose-cs.mp3`

> Vladař zůstal v Cádizu a úderný svaz se domů vrací bez vlajkové lodi. Základna se dostaví, příměří se podepíše podle imperiálních podmínek — a mapy, které kdysi přivezla Aurora, zestárnou v trezoru na papír. Válka nekončí porážkou. Jen se odkládá.

### `mission10-epiloglose-en.mp3`

> Vladař stayed at Cádiz and the strike force sails home without its flagship. The base will be finished, the armistice signed on Imperial terms — and the maps Aurora once brought home will age into paper in a vault. The war does not end in defeat. It is merely postponed.

## mission10 — konec „ending-clean" _(volitelné)_

### `mission10-epilog-ending-clean-cs.mp3`

> Základna Cádiz přestala existovat dřív, než stačila diplomacie cokoli podepsat. Předsunutá pěst Impéria je pryč a s ní i poslední šance obnovit ofenzívu: příměří, které přijde o týden později, se podepisuje podle avalonských podmínek. Kruh se uzavřel — data z Aurory, čas vykoupený u Keravu a jedna přesná salva. Admiralita ti vzkazuje: „Dobrá práce." Víc u Admirality neexistuje.

### `mission10-epilog-ending-clean-en.mp3`

> The Cádiz base ceased to exist before diplomacy could sign anything. The Empire's forward fist is gone and with it the last chance of renewing the offensive: the armistice that comes a week later is signed on Avalonian terms. The circle closed — Aurora's data, the time bought at Kerav, and one precise salvo. The Admiralty sends word: "Well done." At the Admiralty, there is nothing higher.

## mission10 — konec „ending-spirit" _(volitelné)_

### `mission10-epilog-ending-spirit-cs.mp3`

> Základna padla minutu před platností příměří — Cádiz už Impérium nikdy neopevní. Právníci Admirality budou měsíce řešit, jestli jsi rozkaz porušil, nebo naplnil; historici budou stručnější: doslovné znění rozkazu by válku jen přerušilo, jeho duch ji ukončil. Příměří drží — protože caudillovi nezbylo nic, od čeho by příští útok odrazil. Tvoje kariéra u soudu skončí. Tvoje jméno v učebnicích ne.

### `mission10-epilog-ending-spirit-en.mp3`

> The base fell one minute before the armistice took effect — the Empire will never fortify Cádiz again. The Admiralty's lawyers will spend months on whether you broke the order or fulfilled it; the historians will be briefer: the letter of the order would only have paused the war, its spirit ended it. The armistice holds — because the caudillo has nothing left to launch the next attack from. Your career ends in a courtroom. Your name in the textbooks does not.

## mission10 — konec „ending-orders" _(volitelné)_

### `mission10-epilog-ending-orders-cs.mp3`

> Rozkaz je rozkaz: svaz se stáhl a příměří vstoupilo v platnost — s nedostavěnou základnou Cádiz jako zástavou na imperiální straně stolu. Diplomaté slaví, Admiralita mlčí. Za pět let, až Impérium doplní sklady a dostaví doky, se k Strážné bráně poletí znovu — ale to už bude jiná válka a jiný příběh. Dnes ses naučil poslední lekci důstojníka: některá vítězství chutnají jako prohra a nosí se stejně těžko.

### `mission10-epilog-ending-orders-en.mp3`

> Orders are orders: the force withdrew and the armistice took effect — with the unfinished Cádiz base as collateral on the Imperial side of the table. The diplomats celebrate, the Admiralty says nothing. In five years, when the Empire has restocked its magazines and finished its yards, ships will fly for the Watchgate again — but that will be another war and another story. Today you learned the officer's last lesson: some victories taste like defeat and are just as heavy to carry.

## mission11 — prolog

### `mission11-prolog-cs.mp3`

> Rok po příměří. V sále Královny Eleanor běží největší taktický simulátor, jaký kdy admiralita postavila — a na jeho plástve dnes nahráli otázku, která nedala spát nikomu z veteránů: co kdyby se u Křižovatky střetly OBĚ stěny v plné síle? Dvacet trupů na dvacet. Žádné zvraty, žádná diplomacie, žádná záchrana v hyperprostoru. Jen doktrína proti doktríně: avalonská kvalita proti imperiální tonáži. Admirál Rowan usedá do křesla vlajkové lodi — a všech dvacet trupů čeká na tvoje rozkazy. „Tak dobře," říká tiše. „Ukažme jim, co jsme se naučili."

### `mission11-prolog-en.mp3`

> A year after the armistice. In the Queen Eleanor Hall runs the largest tactical simulator the Admiralty has ever built — and today its cells hold the question that has kept every veteran awake: what if BOTH walls met at the Junction in full strength? Twenty hulls against twenty. No twists, no diplomacy, no rescue in hyperspace. Doctrine against doctrine: Avalonian quality against Imperial tonnage. Admiral Rowan settles into the flag chair — and all twenty hulls wait for your orders. "All right," he says quietly. "Let's show them what we've learned."

## mission11 — epilog (výhra) _(volitelné)_

### `mission11-epilog-cs.mp3`

> Simulace končí a sál dlouho mlčí. Pak někdo začne tleskat. Rozhodčí protokol je suchý: imperiální stěna zlomena, jádro zničeno, avalonská linie držela. Do učebnic taktiky přibude nová kapitola — a pod ní poznámka drobným písmem: stěna nevyhrává tonáží ani elegancí. Vyhrává disciplínou: kdo drží formaci, šetří zásobníky a ví, kdy zpomalit a nechat štíty pracovat.

### `mission11-epilog-en.mp3`

> The simulation ends and the hall is silent for a long time. Then someone starts to applaud. The umpire protocol is dry: Imperial wall broken, core destroyed, the Avalonian line held. A new chapter goes into the tactics textbooks — and beneath it a note in small print: a wall does not win by tonnage or by elegance. It wins by discipline: hold formation, husband your magazines, and know when to slow down and let the sidewalls work.

## mission11 — epilog (porážka) _(volitelné)_

### `mission11-epiloglose-cs.mp3`

> Rozhodčí protokol nezná soucit: avalonská stěna se zlomila. V sále Královny Eleanor se rozsvítí světla a admirál Rowan si dlouze prohlíží záznam. „Dobře," řekne nakonec. „Proto simulujeme. Znovu — od začátku." Příště to vyjde: drž formaci, šetři rakety na jádro a pamatuj, že tah nad šedesát procent platíš štíty.

### `mission11-epiloglose-en.mp3`

> The umpire protocol knows no mercy: the Avalonian wall broke. The lights come up in the Queen Eleanor Hall and Admiral Rowan studies the replay for a long moment. "Good," he says at last. "That is why we simulate. Again — from the top." Next time it will work: hold formation, save your missiles for the core, and remember that thrust above sixty percent is paid for in sidewalls.

## side01 — prolog

### `side01-prolog-cs.mp3`

> Mezi misemi kampaně zachytí tvůj senzorový operátor nouzový signál: kurýr Wren, sám a bez doprovodu, prchá Pomezím před dvěma pirátskými nájezdníky. Tvoje loď je nejblíž. Rozkazy zní jasně — civilistům se pomáhá — a ty víš, že jestli Wren nedoletí ke skoku, nedoletí nikam.

### `side01-prolog-en.mp3`

> Between campaign missions your sensor operator picks up a distress signal: the courier Wren, alone and unescorted, fleeing through the Marches ahead of two pirate raiders. Your ship is closest. The orders are plain — civilians get help — and you know that if Wren does not make her jump, she is not making it anywhere.

## side01 — epilog (výhra) _(volitelné)_

### `side01-epilog-cs.mp3`

> Wren skočila do bezpečí a její kapitán ti do odletu stačil poslat jediné slovo: díky. V nákladu, který nájezdníci nestihli ukořistit, byly raketové plošiny z pohraničního arzenálu — a teď je táhne tvoje flotila. Malá odbočka, hmatatelná kořist.

### `side01-epilog-en.mp3`

> Wren jumped to safety, and before departure her captain managed to send you a single word: thanks. The cargo the raiders never got to loot held missile pods from a frontier arsenal — and now your fleet tows them. A small detour, tangible spoils.

## side01 — epilog (porážka) _(volitelné)_

### `side01-epiloglose-cs.mp3`

> Wren zmizela v pekle impelerových klínů dřív, než jsi dorazil na dostřel. Nouzový signál utichl. Někdy dorazíš pozdě — a Pomezí ti to nezapomene připomínat.

### `side01-epiloglose-en.mp3`

> Wren vanished in a hell of impeller wedges before you got into range. The distress signal went silent. Sometimes you arrive too late — and the Marches will not let you forget it.

## side02 — prolog

### `side02-prolog-cs.mp3`

> Zpravodajství ti předhodí souřadnice, které nikdo neměl znát: skrytý pirátský přístav v asteroidovém poli, depot placený imperiálními penězi. Tvoje dvojice má rozkaz jej rozbít. Vezmi Rampart dovnitř, nech Skuu krýt záda a nedej pirátům čas naložit a zmizet.

### `side02-prolog-en.mp3`

> Intelligence hands you coordinates nobody was supposed to know: a hidden pirate haven in an asteroid field, a depot paid for with Imperial money. Your pair has orders to break it. Take Rampart in, keep Skua covering your back, and give the pirates no time to load up and vanish.

## side02 — epilog (výhra) _(volitelné)_

### `side02-epilog-cs.mp3`

> Depot hoří za tebou jako druhé slunce. U mola ale kotvil nedotčený lehký křižník korzárů — posádka ho opustila dřív, než stačila odrazit. Tvůj výsadek ho zajal netknutý; v docích ho přeznačí na ANS Kaper a od téhle chvíle pluje ve tvé flotile. Kořist, která střílí zpátky.

### `side02-epilog-en.mp3`

> The depot burns behind you like a second sun. But moored at the pier lay an untouched corsair light cruiser — her crew abandoned her before they could cast off. Your boarding party took her intact; the yards will rename her ANS Kaper, and from this moment she sails with your fleet. A prize that shoots back.

## side02 — epilog (porážka) _(volitelné)_

### `side02-epiloglose-cs.mp3`

> Přístav tě čekal lépe, než zpravodajství slíbilo. Rampart i Skua se stáhly v troskách — a depot, nedotčený, do hodiny zmizel do hyperprostoru i se zásobami. Napříště víc trupů, míň sebedůvěry.

### `side02-epiloglose-en.mp3`

> The haven was better prepared for you than intelligence promised. Rampart and Skua withdrew in tatters — and the depot, untouched, vanished into hyperspace with its stores within the hour. Next time: more hulls, less confidence.

## side03 — prolog

### `side03-prolog-cs.mp3`

> Před finálním úderem ti admiralita svěří tichou práci: imperiální hlídka dvou torpédoborců sedí na skokové trase k Cádizu a hlídá příchod posil. Tvoje dvojice ji má vyřadit — potichu a rychle — dřív, než stačí odeslat jediné varování k flotile.

### `side03-prolog-en.mp3`

> Before the final blow, the Admiralty entrusts you with quiet work: an Imperial picket of two destroyers sits on the jump lane to Cádiz, watching for reinforcements. Your pair is to take it out — quickly and quietly — before it can send a single warning to the fleet.

## side03 — epilog (výhra) _(volitelné)_

### `side03-epilog-cs.mp3`

> Obě hlídkové lodě mlčí a Cádiz o tobě pořád neví. V krytém skladišti, které hlídaly, čekaly plošiny odsvahované pro Velkou armádu — teď jsou tvoje. Vplul jsi do slepého místa nepřítele a vyšel z něj silnější, než jsi tam přišel.

### `side03-epilog-en.mp3`

> Both picket ships are silent and Cádiz still does not know you are coming. In the shielded depot they guarded waited missile pods earmarked for the Grand Army — now they are yours. You sailed into the enemy's blind spot and came out stronger than you went in.

## side03 — epilog (porážka) _(volitelné)_

### `side03-epiloglose-cs.mp3`

> Jedna z hlídek stačila odeslat varování dřív, než zhasla — a Cádiz teď ví, že přicházíš. Cena za předsunutou práci, která nevyšla: nepřítel, který tě čeká.

### `side03-epiloglose-en.mp3`

> One of the pickets got its warning out before it went dark — and Cádiz now knows you are coming. The price of forward work gone wrong: an enemy who is waiting for you.

## Obecná porážka (mise bez vlastního epilogu) _(volitelné)_

### `defeat-generic-cs.mp3`

> Mise selhala. Válka se ale neptá, jestli jsi připraven — Admiralita tě posílá znovu. Tentokrát to musí vyjít.

### `defeat-generic-en.mp3`

> Mission failed. But the war does not ask whether you are ready — the Admiralty is sending you back in. This time it has to work.
