/** Registr misí kampaně. */
import type { Scenario } from '../../sim/types'
import { mission01 } from './mission01'
import { mission02 } from './mission02'
import { mission03 } from './mission03'
import { mission04 } from './mission04'

export const SCENARIOS: Record<string, Scenario> = {
  [mission01.id]: mission01,
  [mission02.id]: mission02,
  [mission03.id]: mission03,
  [mission04.id]: mission04,
}
