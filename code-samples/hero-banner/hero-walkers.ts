// ---------------------------------------------------------------------------
// PORTFOLIO SAMPLE - RV Park Planner (c) 2026 Yang Pao Thao. All rights reserved.
// Shows: deterministic animation/steering maths kept out of React -
// positions of CSS-animated vehicles, headlight-beam overlap ("is this
// walker lit?"), a chase/wander state machine with eased turns, and stride
// timing so feet don't slide. Copied verbatim; tested by hero-walkers.test.mjs.
// ---------------------------------------------------------------------------

// Position maths for the Halloween mummies on the living hero banner
// (components/night-hero-extras.tsx): where a walker or a vehicle is at a
// moment, where each vehicle's headlight beam reaches, whether a beam is
// lighting a walker, and how fast the legs step so the feet don't slide.
// Pure functions only (no React, no `@/` imports), tested directly with
// `node --test tests/js/hero-walkers.test.mjs` (run from the PHP suite by
// tests/Unit/HeroCalendarTest.php).
//
// Everything moves like the banner's CSS animations: linearly from fully
// off one edge to fully off the other — rightward `translateX(-100%)` →
// `translateX(100cqw)`, leftward the reverse — so the distance covered is
// the banner's width plus the mover's own width. Times are in ms (one
// clock, e.g. performance.now()), positions in px from the banner's left.

/** [left, right] in px. */
export type BeamSpan = [number, number];

/** Something crossing the banner: when it set off, how long the crossing
 *  takes and how wide its drawing is. */
export type Crossing = { start: number; dur: number; w: number };

/** Front-lane vehicles drive right with their beam ahead (to the right of
 *  the body); back-lane vehicles drive left, mirrored, beam to the left. */
export type Lane = 'front' | 'back';

/** How far through its crossing it is, 0–1 (null before or after). */
export function progress(c: Crossing, now: number): number | null {
    const p = (now - c.start) / c.dur;

    return p < 0 || p > 1 ? null : p;
}

/** The left edge of the drawing at `now` (null when not crossing). */
export function leftEdge(
    c: Crossing,
    rightward: boolean,
    now: number,
    bannerWidth: number,
): number | null {
    const p = progress(c, now);

    if (p === null) {
        return null;
    }

    const travel = (bannerWidth + c.w) * p;

    return rightward ? -c.w + travel : bannerWidth - travel;
}

/**
 * Where a vehicle's headlight beam reaches at `now`. The drawing runs from
 * the back bumper to the end of the beam, so the beam is the part past the
 * body: the right-hand end in the front lane, the left-hand end (mirrored)
 * in the back lane.
 */
export function beamSpan(
    vehicle: Crossing & { lane: Lane; body: number },
    now: number,
    bannerWidth: number,
): BeamSpan | null {
    const front = vehicle.lane === 'front';
    const left = leftEdge(vehicle, front, now, bannerWidth);

    if (left === null) {
        return null;
    }

    return front
        ? [left + vehicle.body, left + vehicle.w]
        : [left, left + vehicle.w - vehicle.body];
}

/** How much of a walker (its [left, right]) a beam covers, 0–1. */
export function coverage(walker: BeamSpan, beam: BeamSpan): number {
    const overlap = Math.min(walker[1], beam[1]) - Math.max(walker[0], beam[0]);

    return Math.max(0, overlap) / Math.max(1, walker[1] - walker[0]);
}

/** A walker counts as lit once a beam covers this much of it. */
export const LIT_COVERAGE = 0.35;

/** Whether any beam lights a walker. */
export function isLit(
    walker: BeamSpan,
    beams: BeamSpan[],
    threshold = LIT_COVERAGE,
): boolean {
    return beams.some((beam) => coverage(walker, beam) >= threshold);
}

/** The leg swings this far (degrees) each side of straight down. */
export const LEG_SWING_DEG = 20;
/** Hip to sole, as a share of the walker's height (its drawing). */
export const LEG_SHARE = 0.44;

/**
 * One full walk cycle (left step + right step), in ms, for a walker this
 * tall moving at this ground speed (px per ms). A planted foot moves back
 * under the body by 2·leg·sin(swing) during half a cycle; matching that to
 * the ground speed keeps the feet from sliding.
 */
export function strideCycleMs(heightPx: number, speedPxPerMs: number): number {
    const leg = heightPx * LEG_SHARE;
    const step = 2 * leg * Math.sin((LEG_SWING_DEG * Math.PI) / 180);

    return (2 * step) / Math.max(speedPxPerMs, 1e-6);
}

/** A crossing's ground speed in px per ms. */
export function speedOf(c: Crossing, bannerWidth: number): number {
    return (bannerWidth + c.w) / c.dur;
}

// --- Steering: crossers and chasers.

/** A vehicle on the road right now: its whole drawing, its beam, its body
 *  centre, which way it drives (1 = right) and its speed (px per ms). */
export type VehicleNow = {
    span: BeamSpan;
    beam: BeamSpan;
    center: number;
    dir: 1 | -1;
    speed: number;
};

/** Where a vehicle is at `now` (null when not on the road). */
export function vehicleNow(
    vehicle: Crossing & { lane: Lane; body: number },
    now: number,
    bannerWidth: number,
): VehicleNow | null {
    const front = vehicle.lane === 'front';
    const left = leftEdge(vehicle, front, now, bannerWidth);
    const beam = beamSpan(vehicle, now, bannerWidth);

    if (left === null || beam === null) {
        return null;
    }

    const body: BeamSpan = front
        ? [left, left + vehicle.body]
        : [left + vehicle.w - vehicle.body, left + vehicle.w];

    return {
        span: [left, left + vehicle.w],
        beam,
        center: (body[0] + body[1]) / 2,
        dir: front ? 1 : -1,
        speed: speedOf(vehicle, bannerWidth),
    };
}

/**
 * A Halloween mummy. Crossers ignore the cars and walk all the way across
 * and off the far edge (then `gone`). Chasers mill about; when a vehicle
 * (its beam or body) comes within notice range they turn toward it — after
 * their own reaction delay and a short turning pause — and lurch after it
 * at their run speed, capped below the car's speed so they never catch
 * it; once it has gone they slow back to an idle shuffle in the same
 * direction. `x` is the centre (px), `w` the drawing's width.
 */
export type Mummy = {
    kind: 'crosser' | 'chaser';
    x: number;
    w: number;
    dir: 1 | -1;
    speed: number;
    idle: number;
    run: number;
    /** Reaction delay (ms) before turning toward a car. */
    react: number;
    pending: { dir: 1 | -1; wait: number } | null;
    /** Turning: ms left of the pause, and the way it will face. */
    turn: number;
    turnTo: 1 | -1;
    /** An idle chaser now and then turns around (ms until it may). */
    wander: number;
    chasing: boolean;
    gone: boolean;
};

/** How close (px) a car must come before a chaser notices it. */
export const noticeDistance = (bannerWidth: number) => 40 + bannerWidth * 0.1;
/** A chaser never goes faster than this share of the car's speed. */
export const CHASE_CAP = 0.7;
/** The turning pause (ms); the mummy flips halfway through. */
export const TURN_MS = 280;
/** How quickly the speed changes (ms to close most of the gap). */
export const EASE_MS = 450;
/** An idle chaser turns around every so often (ms, random). */
export const WANDER_MS: [number, number] = [7_000, 16_000];
/** Idle chasers turn back this close to an edge (share of the width). */
export const EDGE_SHARE = 0.04;

const gap = (x: number, [a, b]: BeamSpan) =>
    x < a ? a - x : x > b ? x - b : 0;

/** The mummy after `dt` ms, given the vehicles on the road now. */
export function stepMummy(
    m: Mummy,
    vehicles: VehicleNow[],
    dt: number,
    bannerWidth: number,
    rand: () => number = Math.random,
): Mummy {
    const next: Mummy = { ...m };

    if (m.kind === 'crosser') {
        next.speed = m.idle;
        next.x = m.x + m.dir * m.idle * dt;
        next.gone =
            m.dir > 0 ? next.x - m.w / 2 > bannerWidth : next.x + m.w / 2 < 0;

        return next;
    }

    // The nearest car within notice range (its beam or body).
    const notice = noticeDistance(bannerWidth);
    let near: VehicleNow | null = null;
    let nearest = Infinity;

    for (const v of vehicles) {
        const d = Math.min(gap(m.x, v.beam), gap(m.x, v.span));

        if (d < notice && d < nearest) {
            near = v;
            nearest = d;
        }
    }

    let want: 1 | -1 = m.dir;
    let target = m.idle;
    next.chasing = near !== null;

    if (near) {
        // Toward the car; once it has gone past, after it.
        want = near.center === m.x ? near.dir : near.center > m.x ? 1 : -1;
        target = Math.min(m.run, CHASE_CAP * near.speed);
    } else {
        next.wander = m.wander - dt;
        const edge = bannerWidth * EDGE_SHARE;

        // A turn it has already decided on (at an edge, or wandering).
        if (m.pending) {
            want = m.pending.dir;
        }

        if (
            (m.dir < 0 && m.x < edge) ||
            (m.dir > 0 && m.x > bannerWidth - edge)
        ) {
            want = m.dir > 0 ? -1 : 1;
        } else if (next.wander <= 0) {
            want = m.dir > 0 ? -1 : 1;
            next.wander = WANDER_MS[0] + rand() * (WANDER_MS[1] - WANDER_MS[0]);
        }
    }

    // Turning: wait out the reaction delay, then a short pause with the
    // flip halfway through.
    if (m.turn > 0) {
        next.turn = Math.max(0, m.turn - dt);

        if (next.turn <= TURN_MS / 2) {
            next.dir = m.turnTo;
        }

        target = 0;
    } else if (want !== m.dir) {
        const wait =
            m.pending && m.pending.dir === want ? m.pending.wait - dt : m.react;

        if (wait <= 0) {
            next.pending = null;
            next.turn = TURN_MS;
            next.turnTo = want;
            target = 0;
        } else {
            // Not reacting yet: carry on at the idle pace.
            next.pending = { dir: want, wait };
            target = Math.min(target, m.idle);
        }
    } else {
        next.pending = null;
    }

    // Ease toward the target speed (never past it); stop quickly to turn.
    const ease = next.turn > 0 ? TURN_MS / 3 : EASE_MS;
    next.speed = m.speed + (target - m.speed) * Math.min(1, dt / ease);
    next.x = m.x + next.dir * next.speed * dt;

    // A chaser that ran off an edge comes back in from the other side.
    if (next.x - m.w / 2 > bannerWidth) {
        next.x = -m.w / 2;
    } else if (next.x + m.w / 2 < 0) {
        next.x = bannerWidth + m.w / 2;
    }

    return next;
}

/** How far through its walk cycle (0–1) a mummy moves in `dt` ms: one
 *  cycle covers two steps, so the planted foot keeps pace with the ground. */
export function strideAdvance(
    heightPx: number,
    speedPxPerMs: number,
    dt: number,
): number {
    const leg = heightPx * LEG_SHARE;
    const step = 2 * leg * Math.sin((LEG_SWING_DEG * Math.PI) / 180);

    return (speedPxPerMs * dt) / (2 * step);
}
