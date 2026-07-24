/** Registr misí kampaně. */
import type { Scenario } from '../../sim/types'
import { mission01 } from './mission01'
import { mission02 } from './mission02'
import { mission03 } from './mission03'
import { mission04 } from './mission04'
import { mission05 } from './mission05'
import { mission06 } from './mission06'
import { mission07 } from './mission07'
import { mission08 } from './mission08'
import { mission09 } from './mission09'
import { mission10 } from './mission10'
import { mission11 } from './mission11'
import { side01 } from './side01'
import { side02 } from './side02'
import { side03 } from './side03'

export const SCENARIOS: Record<string, Scenario> = {
  [mission01.id]: mission01,
  [mission02.id]: mission02,
  [mission03.id]: mission03,
  [mission04.id]: mission04,
  [mission05.id]: mission05,
  [mission06.id]: mission06,
  [mission07.id]: mission07,
  [mission08.id]: mission08,
  [mission09.id]: mission09,
  [mission10.id]: mission10,
  [mission11.id]: mission11,
  // volitelné boční operace (mimo hlavní linii, odemykají se po m3/m6/m9)
  [side01.id]: side01,
  [side02.id]: side02,
  [side03.id]: side03,
}
