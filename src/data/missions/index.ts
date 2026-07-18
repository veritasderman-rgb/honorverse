/** Registr misí kampaně. */
import type { Scenario } from '../../sim/types'
import { mission01 } from './mission01'

export const SCENARIOS: Record<string, Scenario> = {
  [mission01.id]: mission01,
}
