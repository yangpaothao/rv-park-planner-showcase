// ---------------------------------------------------------------------------
// PORTFOLIO SAMPLE - RV Park Planner (c) 2026 Yang Pao Thao. All rights reserved.
// Shows: a small, well-documented pure function (moon phase, illumination,
// waxing/waning) with exhaustive types. Copied verbatim; tested by
// moon-phase.test.mjs.
// ---------------------------------------------------------------------------

// The moon's phase for a moment in time, for the night-scene banner's moon
// (components/night-hero.tsx). A mean-phase approximation: days since a
// known new moon (2000-01-06 18:14 UTC) modulo the synodic month, good to
// within about a day — plenty for drawing it. No network, no timezone
// data: a Date is an absolute moment, so the visitor's local clock is
// already accounted for. Kept dependency-free (no `@/` imports) so it can
// be tested directly with `node --test tests/js/moon-phase.test.mjs`.

/** Mean length of a lunar cycle (new moon to new moon), in days. */
export const SYNODIC_MONTH_DAYS = 29.530588853;

/** A known new moon: 2000-01-06 18:14 UTC. */
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

const DAY_MS = 86_400_000;

export type MoonPhaseName =
    | 'new'
    | 'waxing-crescent'
    | 'first-quarter'
    | 'waxing-gibbous'
    | 'full'
    | 'waning-gibbous'
    | 'last-quarter'
    | 'waning-crescent';

export type MoonPhase = {
    /** 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
    phase: number;
    /** Days since the last new moon (0 to ~29.53). */
    age: number;
    /** Share of the disc that's lit, 0 to 1. */
    illumination: number;
    /** Lit on the right (northern-hemisphere view) while waxing. */
    waxing: boolean;
    name: MoonPhaseName;
};

const NAMES: MoonPhaseName[] = [
    'new',
    'waxing-crescent',
    'first-quarter',
    'waxing-gibbous',
    'full',
    'waning-gibbous',
    'last-quarter',
    'waning-crescent',
];

export function moonPhase(date: Date): MoonPhase {
    const days = (date.getTime() - KNOWN_NEW_MOON_MS) / DAY_MS;
    const age =
        ((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
    const phase = age / SYNODIC_MONTH_DAYS;

    return {
        phase,
        age,
        illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2,
        waxing: phase < 0.5,
        // Eight equal slices, each centred on its named moment.
        name: NAMES[Math.floor(phase * 8 + 0.5) % 8],
    };
}
