/**
 * Audit obtížnosti kampaně → docs/DIFFICULTY.md.
 * Spouštět po každé změně misí: npx tsx scripts/audit-difficulty.mts
 */
import { writeFileSync } from 'node:fs'
import { SCENARIOS } from '../src/data/missions/index.ts'
import { scenarioPower } from '../src/data/balance.ts'

/** typ mise: u stealth/útěkových misí poměr sil nevypovídá o obtížnosti */
const KIND: Record<string, string> = {
  mission01: 'výcvik — pohyb a senzory',
  mission02: 'výcvik — palba (eskorta konvoje)',
  mission03: 'výcvik — obrana zblízka (past)',
  mission04: 'stealth průzkum (boji se VYHÝBÁŠ)',
  mission05: 'obrana stanice (stanice bojuje s tebou)',
  mission06: 'útěk (nepřítele nemusíš porazit)',
  mission07: 'nájezd — udeř a zmiz',
  mission08: 'společná hlídka proti stěně',
  mission09: 'bitva o Křižovatku (dva sledy)',
  mission10: 'úderný svaz na Cádiz',
  mission11: 'simulátor: stěna proti stěně',
  side01: 'bonus — záchrana kurýra',
  side02: 'bonus — pirátský depot',
  side03: 'bonus — tichá likvidace hlídky (závod s časem)',
}

const TIER: Record<string, string> = {
  mission01: 'lehká', mission02: 'lehká', mission03: 'lehká',
  mission04: 'střední', mission05: 'střední', mission06: 'střední',
  mission07: 'těžká', mission08: 'těžká', mission09: 'těžká',
  mission10: 'finále', mission11: 'finále',
  side01: 'bonus', side02: 'bonus', side03: 'bonus',
}

let md = `# Obtížnostní křivka kampaně

Generováno z misí — needituj ručně, spusť \`npx tsx scripts/audit-difficulty.mts\`.

**Poměr P/E** = bojová síla hráče / nepřítele (model v \`src/data/balance.ts\`;
vyšší = snazší). Počítá i posily ze spawn triggerů, „spící" nepřátele v masce
obchodníka a ozbrojené stanice. U stealth/útěkových misí poměr nevypovídá —
obtížnost tam dělá scénář, ne palebná síla. Pásma hlídá \`tests/balance.test.ts\`.

| Mise | Úroveň | Typ | Lodě P/E | Síla P | Síla E | Poměr P/E |
| --- | --- | --- | --- | --- | --- | --- |
`

for (const id of Object.keys(SCENARIOS)) {
  const p = scenarioPower(SCENARIOS[id])
  const ratio = Number.isFinite(p.ratio) ? p.ratio.toFixed(2) : '—'
  md += `| ${id} | ${TIER[id] ?? '?'} | ${KIND[id] ?? '?'} | ${p.playerShips}/${p.enemyShips} `
    + `| ${p.player.toFixed(0)} | ${p.enemy.toFixed(0)} | ${ratio} |\n`
}

md += `
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
`

writeFileSync('docs/DIFFICULTY.md', md)
console.log('docs/DIFFICULTY.md aktualizován')
