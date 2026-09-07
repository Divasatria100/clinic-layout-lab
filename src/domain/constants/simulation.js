// Simulation domain constants (Phase 4).
//
// Normative values (09 §5, §12; 10 §8.2, §11.1): fixed-tick,
// time-based, FPS-independent. Not user-configurable in Phase 4.
export const SIM_SPEED = 80 // world units per second
export const SIM_DELTA_TIME_MS = 100 // fixed tick length
export const SIM_DISTANCE_PER_TICK = (SIM_SPEED * SIM_DELTA_TIME_MS) / 1000 // 8 units/tick
