import type { ShipClassDef, MissileDef } from '../sim/types'

/** Třídy lodí — éra knih 1–6, hodnoty viz docs/GAME_DESIGN.md kap. 2. */
export const SHIP_CLASSES: Record<string, ShipClassDef> = {
  'dd-havoc': {
    id: 'dd-havoc', name: 'třída Havoc', hullCode: 'DD', tonnage: 75_000,
    maxAccelG: 520, sidewallStrength: 12, hullPoints: 60,
    tubesPerBroadside: 3, cmLaunchers: 4, pdlcClusters: 6,
    energyMountsPerBroadside: 2, energyDamage: 25,
    magazineMissiles: 90, magazineCMs: 120,
    wedgeDetectionRange: 100_000_000, activeSensorRange: 5_000_000, ecm: 0.35,
  },
  'cl-courageous': {
    id: 'cl-courageous', name: 'třída Courageous', hullCode: 'CL', tonnage: 130_000,
    maxAccelG: 505, sidewallStrength: 16, hullPoints: 90,
    tubesPerBroadside: 5, cmLaunchers: 6, pdlcClusters: 8,
    energyMountsPerBroadside: 3, energyDamage: 30,
    magazineMissiles: 150, magazineCMs: 180,
    wedgeDetectionRange: 120_000_000, activeSensorRange: 6_000_000, ecm: 0.4,
  },
  'ca-star-knight': {
    id: 'ca-star-knight', name: 'třída Star Knight', hullCode: 'CA', tonnage: 300_000,
    maxAccelG: 490, sidewallStrength: 22, hullPoints: 150,
    tubesPerBroadside: 8, cmLaunchers: 10, pdlcClusters: 12,
    energyMountsPerBroadside: 4, energyDamage: 40,
    magazineMissiles: 280, magazineCMs: 320,
    wedgeDetectionRange: 150_000_000, activeSensorRange: 8_000_000, ecm: 0.45,
  },
  'merch-freighter': {
    id: 'merch-freighter', name: 'nákladní loď', hullCode: 'MERCH', tonnage: 4_000_000,
    maxAccelG: 200, sidewallStrength: 4, hullPoints: 80,
    tubesPerBroadside: 0, cmLaunchers: 0, pdlcClusters: 1,
    energyMountsPerBroadside: 0, energyDamage: 0,
    magazineMissiles: 0, magazineCMs: 10,
    wedgeDetectionRange: 60_000_000, activeSensorRange: 2_000_000, ecm: 0.05,
  },
  /** „obchodník" s vojenským kompenzátorem — mise 1 (zvrat) */
  'merch-runner': {
    id: 'merch-runner', name: 'nákladní loď (?)', hullCode: 'MERCH', tonnage: 2_000_000,
    maxAccelG: 420, sidewallStrength: 8, hullPoints: 70,
    tubesPerBroadside: 2, cmLaunchers: 2, pdlcClusters: 3,
    energyMountsPerBroadside: 1, energyDamage: 20,
    magazineMissiles: 30, magazineCMs: 40,
    wedgeDetectionRange: 80_000_000, activeSensorRange: 4_000_000, ecm: 0.3,
  },
}

export const MISSILES: Record<string, MissileDef> = {
  /** standardní útočná raketa éry (Mk padesátky) */
  'std-shipkiller': {
    id: 'std-shipkiller', name: 'útočná raketa',
    accelG: [46_000, 92_000], driveTime: [180, 60],
    standoffRange: 30_000, laserRods: 6, rodDamage: 14,
    maxSpeed: 0.8 * 299_792.458,
  },
}
