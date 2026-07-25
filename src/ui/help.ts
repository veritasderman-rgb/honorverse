/**
 * Obsah overlaye NÁPOVĚDA (H/?) v obou jazycích. Česká mutace je kanonická;
 * anglická je její věrné zrcadlo. Vrací se vnitřní HTML boxu — otevírání,
 * zavírání a Esc řeší input.ts.
 */
import { getLang } from './i18n'

const CS = `<h2>NÁPOVĚDA</h2>
  <h4>Klávesy</h4>
  <div class="help-grid">
    <b>mezerník</b><span>pauza / pokračovat</span>
    <b>+ / −</b><span>komprese času (1× až 10 000×)</span>
    <b>A</b><span>AUTO palba na vybraný cíl</span>
    <b>1–9</b><span>přepnutí aktivní lodi flotily (panel FLOTILA)</span>
    <b>H nebo ?</b><span>tato nápověda</span>
    <b>kolečko</b><span>zoom plotu, tažení = posun kamery</span>
    <b>klik</b><span>výběr lodi/kontaktu; vlastní loď = převzetí</span>
    <b>Shift-klik</b><span>přidá/odebere vlastní ovladatelnou loď z hromadného výběru (plot i panel FLOTILA)</span>
    <b>Shift-tažení</b><span>obdélníkový výběr vlastních lodí na plotu (čárkovaný rám); bez Shiftu posun kamery</span>
  </div>
  <h4>Rozkazy</h4>
  <div class="help-grid">
    <b>Intercept</b><span>autopilot spočítá stíhací kurz na cíl</span>
    <b>Kurz sem</b><span>klikni do plotu — loď poletí na bod; u vybrané lodi plot kreslí PREDIKOVANOU KŘIVKU manévru (otáčení + setrvačnost, značka = 1 minuta letu) — čím rychleji letíš, tím širší oblouk</span>
    <b>Trasa (Shift)</b><span>v režimu kurzu SHIFT-klik přidává další waypointy (kosočtverce spojené čarou); obyčejný klik zadá poslední bod a režim ukončí — predikovaná křivka ukáže skutečný průlet body včetně setrvačnosti</span>
    <b>Salva 2/4/plná</b><span>odpal raket na vybraný cíl; POHON VOLÍ ŘÍZENÍ PALBY SAMO — zblízka (do ~1,6 M km) rychlé HI, na dálku LO (dostřel ~7 M km)</span>
    <b>ŠKOLA VZDÁLENOSTI</b><span>obrana cíle slábne s krátícím se letem salvy: nad ~7 M km jen balistický dojezd (mizivá šance), na 5+ M km má obrana plný reakční čas, pod ~1,5 M km protirakety stihnou max. 1 pokus a bodová obrana střílí nepřipravená — ZBLÍZKA JE SALVA VRAŽEDNÁ</span>
    <b>Plošiny</b><span>tažené raketové plošiny (6 raket/ks; DD 1, CL 2, CA 4, BC 6, DN 8): odpal VŠECH najednou mimo šachty — drtivá první salva, která saturuje obranu; jednorázové</span>
    <b>Salva X+Y</b><span>vrstvená salva: LO vlna + zpožděná HI vlna dorazí spolu a saturují bodovou obranu</span>
    <b>Obě salvy</b><span>dvojitá boční salva: levobok LO, otočka (8 s, bez palby), pravobok HI na společný dopad — dvojnásobná vlna</span>
    <b>AUTO palba</b><span>loď sama opakuje salvy, dokud je cíl v poháněné obálce — a řídí i ENERGETICKÉ baterie (pálí na cíl či nejbližšího nepřítele v dosahu 500 tis. km)</span>
    <b>Energie</b><span>lasery/grasery — drtivé pod 100 tis. km, max. 500 tis. km</span>
    <b>Návnada</b><span>tažená návnada: příchozí raketa na ni může přeskočit (šance dle kvality ECM lodi, víc při slabém zámku) a návnadu ZNIČÍ — jedna návnada ≈ jedna raketa, další lze vypustit hned; omezená zásoba</span>
    <b>+rušička</b><span>salva obětuje 1 raketu jako eskortní rušičku — zbytek má proti bodové obraně cíle Pk ×0,75 (min. 3 rakety)</span>
    <b>Klín VYP</b><span>EMCON: skoro neviditelná, ale bez akcelerace a bočních štítů</span>
    <b>Akt. senzory</b><span>plná identifikace zblízka + lepší zámek našich raket; pozor — vyzařování zlepšuje řešení nepříteli o 15 %</span>
  </div>
  <h4>Výkon pohonu a rozpočet reaktoru</h4>
  <div class="help-grid">
    <b>Akcelerace, ne rychlost</b><span>klín dává ZRYCHLENÍ — rychlost se střádá (torpédoborec na 100 % ≈ +300 km/s každou minutu) a otočka/brzdění trvá stejně dlouho jako rozjezd; kdo zrychlí dřív, jeho náskok roste kvadraticky — honičky se vyhrávají v prvních minutách</span>
    <b>Vektor jako zbraň</b><span>rakety DĚDÍ vektor lodi: odpal po směru letu doletí dál a dorazí rychleji (obálka na plotu se natahuje) — někdy je cílem se NEPOTKAT: prolétnout kolem s převýšením rychlosti, udeřit po směru a nenechat se zatáhnout do boje za podmínek pomalejšího</span>
    <b>tah 20–120 %</b><span>stupňovitý přepínač v liště rozkazů; 80 % je standard s bezpečnostní rezervou kompenzátoru</span>
    <b>100 %</b><span>plný projektovaný výkon — bez rizika, ale bez rezervy</span>
    <b>120 % (červeně)</b><span>NOUZOVÝ výkon „za červenou čarou": +20 % akcelerace, ale se zapnutým klínem hrozí poškození impelerového prstence (v průměru ~1× za 33 minut) — inženýr varuje</span>
    <b>Tah vs. boční štíty</b><span>reaktor neutáhne pohon i štítové generátory: tah ≤ 40 % ⇒ boční štíty 120 %, 60 % ⇒ 100 %, 80 % ⇒ 60 %, 100 % ⇒ 40 %, 120 % ⇒ 25 % — rychlý přílet znamená papírové boky (readout „výkon bočních štítů" v panelu lodi)</span>
    <b>Hromadně</b><span>přepínač platí pro celý hromadný výběr — „(×N)" u tlačítka</span>
  </div>
  <h4>Poškození a opravy</h4>
  <div class="help-grid">
    <b>Boční štíty tlumí, neblokují</b><span>boční zásah VŽDY něco prosákne (silný boční štít slabý paprsek čtvrtí); absorbovaná energie navíc generátory bočního štítu opotřebovává — soustavná palba štít postupně mele</span>
    <b>Umírání po částech</b><span>loď vydrží řádově 10–15 zásahů; každý prošlý paprsek má slušnou šanci vyřadit kus vybavení (šachty, impelery, senzory…) — bojeschopnost klesá dřív, než dojde trup</span>
    <b>Poškozené impelery</b><span>akcelerace klesá s průměrem obou prstenců — loď se zásahem do pohonu reálně zpomaluje v manévru</span>
    <b>Polní opravy</b><span>poškozené subsystémy se BĚHEM boje samy opravují (~7 % za minutu do 70 %, pak dolaďování polovičním tempem do 90 % — plných 100 % vrátí jen dok); šipka ↗ u baru = čety na systému pracují; buff inženýra opravy ×4</span>
    <b>Priorita oprav</b><span>v panelu VLASTNÍ LOĎ (řádek „opravy:"): Rovnoměrně / Zbraně / Pohon / Obrana — prioritní skupina se opravuje ×3, ostatní ×0,5 (čety nejsou nafukovací); TRUP se v poli opravit nedá — strukturální poškození spraví jen loděnice</span>
  </div>
  <h4>Eskadra a formace</h4>
  <div class="help-grid">
    <b>Hromadný výběr</b><span>Shift-klik / Shift-tažení; rozkazy s „(×N)" (kurz, intercept, tah, klín, senzory, AUTO, roll) platí všem vybraným</span>
    <b>Palba výběru</b><span>salvy pálí jen aktivní loď — hromadná palba jde přes AUTO palbu na vybraný cíl</span>
    <b>FORMACE</b><span>při výběru ≥ 2 lodí: aktivní loď = leader, ostatní dostanou sloty a drží je samy (vlastní kurz ignorují); rozpad při ztrátě leadera</span>
    <b>Stěna Σ</b><span>kolmá řada (400 tis. km): disciplinovaná palebná síť — protirakety Pk ×1,15, příchozí rakety −5 % zámku</span>
    <b>Šíp V</b><span>šíp za leaderem (60°): sdílený senzorový obraz — +5 % palebného řešení členů</span>
    <b>Rozptyl ◦</b><span>mřížka 1,5 M km: útočník nesaturuje eskadru jako celek, členové +3 % efektivního ECM</span>
    <b>Plot</b><span>členové mají tenkou čáru k leaderovi; v panelu FLOTILA značky Σ / V / ◦</span>
    <b>ESKADRA (≥ 3 lodě)</b><span>doktríny palby pro celý výběr — lodě si cíle volí SAMY a po zničení plynule přejdou na další: Nejbližší (každá na svůj nejbližší kontakt), Největší (všechny na nejtěžší trup — koncentrace saturuje obranu), Rozdělit (každá loď jiný cíl — proti hejnu slabších), Salva výběru (všechny nabité lodě TEĎ plnou salvu na vybraný cíl — koordinovaný úder bez přepínání), Soustředit (AUTO všech na tebou vybraný cíl), Držet palbu (vše vypnout)</span>
    <b>Roster = velín</b><span>panel FLOTILA ukazuje u každé lodi rakety, plošiny (+NP), režim palby a připravenost šachet (✓ = nabito, ⌛ = přebíjí) — koordinuješ eskadru bez přepínání lodí</span>
    <b>Doktrína + energie</b><span>doktríny řídí i energetické baterie a pálí dál energií, i když dojdou rakety; v rosteru FLOTILA vidíš režim každé lodi (AUTO·nejbl. …)</span>
  </div>
  <h4>Senzorový duel (EMCON)</h4>
  <div class="help-grid">
    <b>Palebné řešení</b><span>počáteční zámek raket: 70 % jen z pasivních dat, 100 % s aktivními senzory a cílem v jejich dosahu</span>
    <b>Vyzařující cíl</b><span>cíl se zapnutými aktivními senzory dává +15 % k řešení PROTI sobě — ticho má cenu</span>
    <b>Kvalitní track</b><span>plná identifikace cíle (ident.) přidává +10 %; poškozené senzory řešení srážejí</span>
    <b>Aktivní vedení</b><span>střelec s aktivy a cílem v dosahu drží track — ECM cíle eroduje zámek raket pomaleji</span>
    <b>AI to hraje taky</b><span>nepřítel „rozsvítí" aktivy, když zahajuje palbu, a zhasne při ústupu — čti to na plotu ([AKT])</span>
  </div>
  <h4>Řízení salv</h4>
  <div class="help-grid">
    <b>Výběr salvy</b><span>klikni na vlastní raketu v plotu — panel SALVA ukáže počet, zámek, fázi a čas do cíle</span>
    <b>Přesměrování</b><span>letící salvu lze poslat na jiný klasifikovaný cíl (zámek ×0,75) — jen do 10 M km od lodi</span>
    <b>Řízená salva</b><span>loď ji vede: při ztrátě kontaktu na cíl nebo za dosahem řízení zámek eroduje</span>
    <b>Dno zámku</b><span>posádky se ECM propálí: řízená salva s aktivními senzory neklesne pod 40 % zámku, raketa s vlastním seekerem pod 30 %; jen balistický dojezd bez vedení eroduje dál</span>
    <b>Odhad průniku</b><span>detail cíle ukazuje očekávaný průnik plné salvy (CM · PDLC · ECM) — odhad, ne slib</span>
    <b>Autonomní salva</b><span>zámek ×0,85 při odpalu, ale letí sama — „vystřel a zhasni" s vypnutým klínem</span>
    <b>⚠ v topbaru</b><span>auto-zpomalování času u důležitých událostí — přepínač ZAP/VYP (odpaly už nezpomalují)</span>
  </div>
  <h4>Mechaniky</h4>
  <div class="help-grid">
    <b>Poháněná obálka</b><span>dostřel raket = pohon + vektor lodi při odpalu; odpal „po směru" dostřel natahuje</span>
    <b>Vrstvená obrana</b><span>ECM → protirakety → PDLC → klín; z velké salvy projde jen zlomek — ale projde: úspěšná salva poškozuje, opotřebovávací boj</span>
    <b>Reakční čas obrany</b><span>protirakety stihnou max. 2 pokusy na raketu — a jen když mají čas: rychlá HI salva zblízka (pod ~1 M km) nechá obraně čas na JEDEN pokus, pod ~300 tis. km na žádný. Zblízka se zabíjí</span>
    <b>Asymetrie stran</b><span>Avalon sází na technologickou převahu (lepší raketová elektronika — zámek salv ×1,08), Impérium na tonáž a kvantitu (víc trupů a šachet, horší senzory); pirátská elektronika je o generaci pozadu (×0,9)</span>
    <b>Saturace</b><span>víc raket ve stejném okně = PDLC nestíhá (vrstvená salva!)</span>
    <b>Poškození</b><span>subsystémy po částech; posádka provizorně opravuje do 70 %</span>
    <b>Trysky</b><span>s vypnutým klínem má loď ~5 g na korekce driftu — neviditelné, ale plánuj hodiny dopředu</span>
    <b>Light-lag</b><span>kontakty jsou staré vzdálenost/c sekund — u 30 M km ~100 s</span>
    <b>Hyperlimit</b><span>jantarová čára — za ní lodě unikají do hyperprostoru</span>
  </div>
  <h4>Kapitulace</h4>
  <div class="help-grid">
    <b>Výzva</b><span>v detailu cíle „Vyzvat ke kapitulaci" — jen na klasifikovaný nepřátelský kontakt</span>
    <b>Šance</b><span>≈ (poškození − 20 %) × morálka posádky; +15 % při vyřazených šachtách či prázdných zásobnících</span>
    <b>Odpověď</b><span>letí rychlostí světla tam i zpět (2×vzdálenost/c); další výzva na týž cíl až po 180 s</span>
    <b>Po kapitulaci</b><span>loď vypne klín a přestane bojovat — na plotu šedá se symbolem ▽; nestřílej na ni</span>
  </div>
  <h4>Bojová statistika</h4>
  <div class="help-grid">
    <b>Panel nad logem</b><span>NAŠE PALBA: odpáleno / sestřeleno / zásahy / úspěšnost; PŘÍCHOZÍ: odpáleno na nás / pobráno obranou / zásahy do nás</span>
    <b>Šachty</b><span>panel vlastní lodi ukazuje „šachty N/M funkční" — poškozené šachty zmenšují salvu</span>
    <b>Nabíjení</b><span>bary „šachty nabití" a „energetika nabití" v panelu vlastní lodi — plný bar = zbraň připravena</span>
  </div>`

const EN = `<h2>HELP</h2>
  <h4>Keys</h4>
  <div class="help-grid">
    <b>space</b><span>pause / resume</span>
    <b>+ / −</b><span>time compression (1× to 10,000×)</span>
    <b>A</b><span>AUTO fire at the selected target</span>
    <b>1–9</b><span>switch the active fleet ship (FLEET panel)</span>
    <b>H or ?</b><span>this help</span>
    <b>wheel</b><span>plot zoom, dragging = camera pan</span>
    <b>click</b><span>select a ship/contact; your own ship = take command</span>
    <b>Shift-click</b><span>adds/removes your own controllable ship from the multi-selection (plot and FLEET panel)</span>
    <b>Shift-drag</b><span>rectangle-select your own ships on the plot (dashed frame); without Shift the camera pans</span>
  </div>
  <h4>Orders</h4>
  <div class="help-grid">
    <b>Intercept</b><span>the autopilot computes an intercept course on the target</span>
    <b>Course here</b><span>click the plot — the ship flies to the point; for the selected ship the plot draws the PREDICTED maneuver CURVE (turning + inertia, tick = 1 minute of flight) — the faster you fly, the wider the arc</span>
    <b>Route (Shift)</b><span>in course mode SHIFT-click adds more waypoints (diamonds joined by a line); a plain click sets the final point and ends the mode — the predicted curve shows the real fly-through, inertia included</span>
    <b>Volley 2/4/full</b><span>missile launch at the selected target; FIRE CONTROL PICKS THE DRIVE ITSELF — up close (under ~1.6 M km) fast HI, at range LO (reach ~7 M km)</span>
    <b>SCHOOL OF RANGE</b><span>the target's defense weakens as the volley's flight shortens: above ~7 M km only a ballistic coast (negligible chance), at 5+ M km the defense has full reaction time, under ~1.5 M km counter-missiles get at most 1 attempt and point defense fires unprepared — UP CLOSE A VOLLEY IS MURDEROUS</span>
    <b>Pods</b><span>towed missile pods (6 missiles each; DD 1, CL 2, CA 4, BC 6, DN 8): launch ALL at once outside the tubes — a crushing first strike that saturates the defense; single-use</span>
    <b>Volley X+Y</b><span>layered volley: an LO wave + a delayed HI wave arrive together and saturate point defense</span>
    <b>Both sides</b><span>double broadside with a roll: port LO now, roll (8 s, no fire), starboard HI timed for simultaneous impact — a doubled wave</span>
    <b>AUTO fire</b><span>the ship repeats volleys on its own while the target stays in the powered envelope — and also runs the ENERGY batteries (firing at the target or the nearest enemy within 500k km)</span>
    <b>Energy</b><span>lasers/grasers — crushing under 100k km, max 500k km</span>
    <b>Decoy</b><span>a towed decoy: an incoming missile may jump to it (chance per the ship's ECM quality, higher against a weak lock) and DESTROYS it — one decoy ≈ one missile, the next can go out immediately; limited stock</span>
    <b>+jammer</b><span>the volley sacrifices 1 missile as an escort jammer — the rest takes Pk ×0.75 against the target's point defense (min. 3 missiles)</span>
    <b>Wedge OFF</b><span>EMCON: nearly invisible, but no acceleration and no sidewalls</span>
    <b>Act. sensors</b><span>full identification up close + better lock for our missiles; careful — radiating improves the enemy's solution by 15 %</span>
  </div>
  <h4>Drive power and the reactor budget</h4>
  <div class="help-grid">
    <b>Acceleration, not speed</b><span>the wedge gives ACCELERATION — speed accumulates (a destroyer at 100 % ≈ +300 km/s every minute) and turning/braking takes as long as speeding up; whoever accelerates first grows their lead quadratically — chases are won in the first minutes</span>
    <b>The vector as a weapon</b><span>missiles INHERIT the ship's vector: launching along your course flies farther and arrives faster (the envelope on the plot stretches) — sometimes the goal is NOT to meet: fly past with a speed advantage, strike along your course and refuse to fight on the slower ship's terms</span>
    <b>throttle 20–120 %</b><span>the stepped switch in the orders bar; 80 % is the standard with a compensator safety margin</span>
    <b>100 %</b><span>full designed power — no risk, but no margin</span>
    <b>120 % (red)</b><span>EMERGENCY power "past the red line": +20 % acceleration, but with the wedge up you risk impeller-ring damage (on average ~once per 33 minutes) — the engineer warns you</span>
    <b>Throttle vs. sidewalls</b><span>the reactor cannot feed both drive and shield generators: throttle ≤ 40 % ⇒ sidewalls 120 %, 60 % ⇒ 100 %, 80 % ⇒ 60 %, 100 % ⇒ 40 %, 120 % ⇒ 25 % — a fast approach means paper flanks (the "sidewall power" readout in the ship panel)</span>
    <b>In bulk</b><span>the switch applies to the whole multi-selection — "(×N)" on the button</span>
  </div>
  <h4>Damage and repairs</h4>
  <div class="help-grid">
    <b>Sidewalls attenuate, not block</b><span>a broadside hit ALWAYS leaks something through (a strong sidewall quarters a weak beam); absorbed energy also wears the sidewall generators — sustained fire grinds the shield down</span>
    <b>Dying by pieces</b><span>a ship takes roughly 10–15 hits; every beam that gets through has a fair chance to knock out equipment (tubes, impellers, sensors…) — combat power fades before the hull runs out</span>
    <b>Damaged impellers</b><span>acceleration drops with the average of both rings — a ship hit in the drive genuinely slows in the maneuver</span>
    <b>Field repairs</b><span>damaged subsystems repair themselves DURING battle (~7 % per minute up to 70 %, then at half pace to 90 % — only a dock restores 100 %); the ↗ arrow by a bar = crews at work on the system; the engineer buff repairs ×4</span>
    <b>Repair priority</b><span>in the OWN SHIP panel (the "repairs:" row): Even / Weapons / Drive / Defense — the priority group repairs at ×3, the rest at ×0.5 (crews don't stretch); the HULL cannot be repaired in the field — structural damage takes a shipyard</span>
  </div>
  <h4>Squadron and formations</h4>
  <div class="help-grid">
    <b>Multi-select</b><span>Shift-click / Shift-drag; orders with "(×N)" (course, intercept, throttle, wedge, sensors, AUTO, roll) apply to everything selected</span>
    <b>Selection fire</b><span>volleys fire only from the active ship — bulk fire goes through AUTO fire at the selected target</span>
    <b>FORMATION</b><span>with ≥ 2 ships selected: the active ship is the leader, the rest get slots and hold them on their own (ignoring their own course); it breaks if the leader is lost</span>
    <b>Wall Σ</b><span>a perpendicular line (400k km): a disciplined fire net — counter-missile Pk ×1.15, incoming missiles −5 % lock</span>
    <b>Vee V</b><span>a vee behind the leader (60°): shared sensor picture — members +5 % firing solution</span>
    <b>Dispersed ◦</b><span>a 1.5 M km grid: an attacker cannot saturate the squadron as a whole, members +3 % effective ECM</span>
    <b>Plot</b><span>members show a thin line to the leader; the FLEET panel marks Σ / V / ◦</span>
    <b>SQUADRON (≥ 3 ships)</b><span>fire doctrines for the whole selection — ships pick targets THEMSELVES and roll smoothly to the next after a kill: Nearest (each at its own nearest contact), Biggest (all at the heaviest hull — concentration saturates the defense), Spread (each ship a different target — against a swarm of weaker ships), Selection volley (every loaded ship fires a full volley NOW at the selected target — a coordinated strike without switching), Focus (AUTO of all at the target you picked), Hold fire (everything off)</span>
    <b>Roster = flag bridge</b><span>the FLEET panel shows each ship's missiles, pods (+NP), fire mode and tube readiness (✓ = loaded, ⌛ = reloading) — you coordinate the squadron without switching ships</span>
    <b>Doctrine + energy</b><span>doctrines also run the energy batteries and keep firing energy even when missiles run out; the FLEET roster shows each ship's mode (AUTO·near. …)</span>
  </div>
  <h4>The sensor duel (EMCON)</h4>
  <div class="help-grid">
    <b>Firing solution</b><span>initial missile lock: 70 % from passive data alone, 100 % with active sensors and the target inside their range</span>
    <b>A radiating target</b><span>a target with active sensors on gives +15 % to the solution AGAINST itself — silence has value</span>
    <b>A quality track</b><span>full target identification (ident) adds +10 %; damaged sensors degrade the solution</span>
    <b>Active guidance</b><span>a shooter with actives and the target in range holds the track — the target's ECM erodes missile lock more slowly</span>
    <b>The AI plays it too</b><span>the enemy "lights up" actives when opening fire and goes dark when withdrawing — read it on the plot ([AKT])</span>
  </div>
  <h4>Salvo management</h4>
  <div class="help-grid">
    <b>Selecting a salvo</b><span>click your own missile on the plot — the SALVO panel shows count, lock, phase and time to target</span>
    <b>Retargeting</b><span>a flying salvo can be sent at another classified target (lock ×0.75) — only within 10 M km of the ship</span>
    <b>Guided salvo</b><span>the ship guides it: lock erodes when contact on the target is lost or beyond control range</span>
    <b>Lock floor</b><span>crews burn through ECM: a guided salvo with active sensors won't drop below 40 % lock, a missile on its own seeker below 30 %; only an unguided ballistic coast keeps eroding</span>
    <b>Penetration estimate</b><span>the target detail shows the expected leakers of a full volley (CM · PDLC · ECM) — an estimate, not a promise</span>
    <b>Autonomous salvo</b><span>lock ×0.85 at launch, but it flies on its own — "fire and forget" with the wedge down</span>
    <b>⚠ in the topbar</b><span>auto time-slowdown on important events — ON/OFF switch (launches no longer slow time)</span>
  </div>
  <h4>Mechanics</h4>
  <div class="help-grid">
    <b>Powered envelope</b><span>missile reach = drive + the ship's vector at launch; launching "downrange" stretches the reach</span>
    <b>Layered defense</b><span>ECM → counter-missiles → PDLC → wedge; only a fraction of a big volley gets through — but it gets through: a successful volley damages, a battle of attrition</span>
    <b>Defense reaction time</b><span>counter-missiles get at most 2 attempts per missile — and only with time: a fast HI volley up close (under ~1 M km) leaves the defense time for ONE attempt, under ~300k km for none. Killing is done up close</span>
    <b>Asymmetric sides</b><span>Avalon bets on a technological edge (better missile electronics — volley lock ×1.08), the Empire on tonnage and quantity (more hulls and tubes, worse sensors); pirate electronics are a generation behind (×0.9)</span>
    <b>Saturation</b><span>more missiles in the same window = PDLC can't keep up (layered volley!)</span>
    <b>Damage</b><span>subsystems piece by piece; the crew jury-rigs repairs up to 70 %</span>
    <b>Thrusters</b><span>with the wedge down the ship has ~5 g for drift corrections — invisible, but plan hours ahead</span>
    <b>Light-lag</b><span>contacts are distance/c seconds old — at 30 M km ~100 s</span>
    <b>Hyper limit</b><span>the amber line — beyond it ships escape into hyperspace</span>
  </div>
  <h4>Surrender</h4>
  <div class="help-grid">
    <b>The demand</b><span>"Demand surrender" in the target detail — only on a classified enemy contact</span>
    <b>The chance</b><span>≈ (damage − 20 %) × crew morale; +15 % with knocked-out tubes or empty magazines</span>
    <b>The reply</b><span>travels at lightspeed both ways (2×distance/c); the next demand on the same target only after 180 s</span>
    <b>After surrender</b><span>the ship drops its wedge and stops fighting — grey on the plot with the ▽ symbol; don't shoot at her</span>
  </div>
  <h4>Combat statistics</h4>
  <div class="help-grid">
    <b>Panel above the log</b><span>OUR FIRE: launched / shot down / hits / hit rate; INCOMING: launched at us / stopped by defense / hits on us</span>
    <b>Tubes</b><span>the own-ship panel shows "tubes N/M working" — damaged tubes shrink the volley</span>
    <b>Reloading</b><span>the "missile tubes" and "energy weapons" bars in the own-ship panel — a full bar = weapon ready</span>
  </div>`

/** vnitřní HTML boxu nápovědy v aktuálním jazyce + tlačítko ZAVŘÍT */
export function helpBoxHtml(): string {
  const body = getLang() === 'en' ? EN : CS
  const close = getLang() === 'en' ? 'CLOSE (Esc)' : 'ZAVŘÍT (Esc)'
  return `<div class="box help-box">${body}
      <div style="margin-top:12px"><button id="btn-help-close">${close}</button></div>
    </div>`
}
