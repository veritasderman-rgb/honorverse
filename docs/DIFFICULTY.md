# Obtížnostní křivka kampaně

Generováno z misí — needituj ručně, spusť `npx tsx scripts/audit-difficulty.mts`.

**Poměr P/E** = bojová síla hráče / nepřítele (model v `src/data/balance.ts`;
vyšší = snazší). Počítá i posily ze spawn triggerů, „spící" nepřátele v masce
obchodníka a ozbrojené stanice. U stealth/útěkových misí poměr nevypovídá —
obtížnost tam dělá scénář, ne palebná síla. Pásma hlídá `tests/balance.test.ts`.

| Mise | Úroveň | Typ | Lodě P/E | Síla P | Síla E | Poměr P/E |
| --- | --- | --- | --- | --- | --- | --- |
| mission01 | lehká | výcvik — pohyb a senzory | 1/1 | 11 | 5 | 2.20 |
| mission02 | lehká | výcvik — palba (eskorta konvoje) | 1/3 | 11 | 20 | 0.56 |
| mission03 | lehká | výcvik — obrana zblízka (past) | 1/1 | 11 | 11 | 0.99 |
| mission04 | střední | stealth průzkum (boji se VYHÝBÁŠ) | 1/3 | 18 | 55 | 0.32 |
| mission05 | střední | obrana stanice (stanice bojuje s tebou) | 2/8 | 63 | 85 | 0.73 |
| mission06 | střední | útěk (nepřítele nemusíš porazit) | 1/5 | 29 | 95 | 0.31 |
| mission07 | těžká | nájezd — udeř a zmiz | 1/3 | 39 | 24 | 1.61 |
| mission08 | těžká | společná hlídka proti stěně | 2/3 | 47 | 64 | 0.73 |
| mission09 | těžká | bitva o Křižovatku (dva sledy) | 6/8 | 182 | 147 | 1.24 |
| mission10 | finále | úderný svaz na Cádiz | 4/6 | 144 | 157 | 0.91 |
| mission11 | finále | simulátor: stěna proti stěně | 20/21 | 669 | 439 | 1.52 |
| side01 | bonus | bonus — záchrana kurýra | 1/2 | 18 | 14 | 1.26 |
| side02 | bonus | bonus — pirátský depot | 2/3 | 40 | 48 | 0.85 |
| side03 | bonus | bonus — tichá likvidace hlídky (závod s časem) | 2/2 | 57 | 20 | 2.83 |

## Zamýšlená křivka

Model zrcadlí loadouty scénářů (spec.missiles, plošiny hráče dle třídy) a
zvraty setSide (převlečené lodě se počítají za konečnou stranu).

- **Lehké (1–3, tutoriál):** shovívavý úvod; mise 2 fázuje posily pirátů
  v čase (1v1 sekvenčně), mise 3 je vyrovnaný duel s Q-shipem.
- **Střední (4–6):** poměr klame — 4 je stealth, 6 útěk (falešná
  „záchranná" eskadra se počítá nepříteli); 5 je první saturační obrana.
- **Těžké (7–9):** 8 = podvážená hlídka proti stěně (0,55–0,95). U 7 a 9
  je poměr VYSOKÝ záměrně: 7 je nájezd — sílu máš, obtížnost dělá časovka
  útěku před reakčním svazem; 9 je obrana s plošinami a stanicí — tlak
  dělají dva útočné sledy a civilisté v sázce.
- **Finále (10–11):** 10 = hluboký úder do připravené obrany (0,7–1,1);
  11 je simulátor — papírová převaha hráče (plošiny + kratší imperiální
  zásobníky), ale bez doktríny stěny prohraješ (viz E2E mise 11).
- **Bonusy:** side01/02 drží úroveň své trojice; side03 je silově snadná
  ZÁMĚRNĚ — obtížnost dělá závod s varováním, ne palebná síla.
