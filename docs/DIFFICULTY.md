# Obtížnostní křivka kampaně

Generováno z misí — needituj ručně, spusť `npx tsx scripts/audit-difficulty.mts`.

**Poměr P/E** = bojová síla hráče / nepřítele (model v `src/data/balance.ts`;
vyšší = snazší). Počítá i posily ze spawn triggerů, „spící" nepřátele v masce
obchodníka a ozbrojené stanice. U stealth/útěkových misí poměr nevypovídá —
obtížnost tam dělá scénář, ne palebná síla. Pásma hlídá `tests/balance.test.ts`.

| Mise | Úroveň | Typ | Lodě P/E | Síla P | Síla E | Poměr P/E |
| --- | --- | --- | --- | --- | --- | --- |
| mission01 | lehká | výcvik — pohyb a senzory | 1/1 | 10 | 5 | 1.97 |
| mission02 | lehká | výcvik — palba (eskorta konvoje) | 1/3 | 10 | 20 | 0.50 |
| mission03 | lehká | výcvik — obrana zblízka (past) | 1/1 | 10 | 14 | 0.72 |
| mission04 | střední | stealth průzkum (boji se VYHÝBÁŠ) | 1/3 | 15 | 55 | 0.28 |
| mission05 | střední | obrana stanice (stanice bojuje s tebou) | 2/8 | 58 | 85 | 0.68 |
| mission06 | střední | útěk (nepřítele nemusíš porazit) | 1/3 | 24 | 64 | 0.38 |
| mission07 | těžká | nájezd — udeř a zmiz | 1/3 | 31 | 35 | 0.89 |
| mission08 | těžká | společná hlídka proti stěně | 2/3 | 40 | 64 | 0.62 |
| mission09 | těžká | bitva o Křižovatku (dva sledy) | 6/8 | 158 | 192 | 0.82 |
| mission10 | finále | úderný svaz na Cádiz | 4/6 | 120 | 161 | 0.74 |
| mission11 | finále | simulátor: stěna proti stěně | 20/21 | 558 | 505 | 1.10 |
| side01 | bonus | bonus — záchrana kurýra | 1/2 | 15 | 14 | 1.09 |
| side02 | bonus | bonus — pirátský depot | 2/3 | 34 | 48 | 0.72 |
| side03 | bonus | bonus — tichá likvidace hlídky (závod s časem) | 2/2 | 47 | 20 | 2.35 |

## Zamýšlená křivka

- **Lehké (1–3, tutoriál):** poměr ≥ ~0,65 a klesá; mise 2 fázuje posily
  pirátů v čase (1v1 sekvenčně), mise 3 je duel s Q-shipem.
- **Střední (4–6):** poměr klame — 4 je stealth, 6 útěk; 5 je první
  saturační obrana (stanice pomáhá, ale zásobníky nejsou bezedné).
- **Těžké (7–9):** poměr 0,6–0,85 + tlak scénáře (reakční svaz, spojenec
  mimo velení, dva útočné sledy).
- **Finále (10–11):** 10 = hluboký úder do připravené obrany; 11 je
  simulátor — mírná převaha hráče, o výhře rozhoduje doktrína stěny.
- **Bonusy:** side01/02 drží úroveň své trojice; side03 je silově snadná
  ZÁMĚRNĚ — obtížnost dělá závod s varováním, ne palebná síla.
