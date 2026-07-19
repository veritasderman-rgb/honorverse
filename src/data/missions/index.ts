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

export const SCENARIOS: Record<string, Scenario> = {
  [mission01.id]: mission01,
  [mission02.id]: mission02,
  [mission03.id]: mission03,
  [mission04.id]: mission04,
  [mission05.id]: mission05,
  [mission06.id]: mission06,
  [mission07.id]: mission07,
  [mission08.id]: mission08,
}
