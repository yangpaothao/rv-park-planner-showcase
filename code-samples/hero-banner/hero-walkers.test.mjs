// PORTFOLIO SAMPLE - RV Park Planner (c) 2026 Yang Pao Thao. All rights reserved.
// Shows: Node's built-in test runner (node:test) exercising hero-walkers.ts directly.
// Import path adjusted for this folder; otherwise verbatim. Run: node --test

// Run with `node --test code-samples/hero-banner/hero-walkers.test.mjs` (Node 22.18+ reads the .ts directly).
// Also run from the PHP suite by tests/Unit/HeroCalendarTest.php.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    beamSpan,
    CHASE_CAP,
    stepMummy,
    strideAdvance,
    TURN_MS,
    vehicleNow,
    coverage,
    isLit,
    leftEdge,
    LEG_SHARE,
    LEG_SWING_DEG,
    progress,
    speedOf,
    strideCycleMs,
} from './hero-walkers.ts';

const W = 1000;

test('a crossing runs from fully off one edge to fully off the other', () => {
    const c = { start: 1_000, dur: 10_000, w: 200 };

    assert.equal(progress(c, 999), null);
    assert.equal(progress(c, 11_001), null);
    assert.equal(leftEdge(c, true, 1_000, W), -200);
    assert.equal(leftEdge(c, true, 11_000, W), 1_000);
    assert.equal(leftEdge(c, true, 6_000, W), 400);
    assert.equal(leftEdge(c, false, 1_000, W), 1_000);
    assert.equal(leftEdge(c, false, 11_000, W), -200);
    assert.equal(leftEdge(c, false, 6_000, W), 400);
});

test('front-lane beams reach right of the body, back-lane beams left', () => {
    const vehicle = { start: 0, dur: 10_000, w: 300, body: 160 };

    // Halfway: the drawing's left edge is at (1000 + 300) / 2 - 300 = 350.
    assert.deepEqual(beamSpan({ ...vehicle, lane: 'front' }, 5_000, W), [510, 650]);
    // Back lane, halfway: left edge 1000 - 650 = 350; beam is the left 140 px.
    assert.deepEqual(beamSpan({ ...vehicle, lane: 'back' }, 5_000, W), [350, 490]);
    assert.equal(beamSpan({ ...vehicle, lane: 'front' }, 12_000, W), null);
});

test('a walker is lit when a beam covers enough of it', () => {
    const walker = [100, 140];

    assert.equal(coverage(walker, [0, 90]), 0);
    assert.equal(coverage(walker, [120, 400]), 0.5);
    assert.equal(coverage(walker, [0, 400]), 1);
    assert.equal(isLit(walker, [[130, 400]]), false); // a quarter
    assert.equal(isLit(walker, [[0, 90], [120, 400]]), true);
    assert.equal(isLit(walker, []), false);
});

test('a beam sweeps over a walker and moves on', () => {
    const car = { lane: 'front', start: 0, dur: 8_000, w: 400, body: 200 };
    const walker = [600, 630];
    const lit = (t) => isLit(walker, [beamSpan(car, t, W)].filter(Boolean));

    // The beam's leading edge reaches the walker before the car does.
    const times = Array.from({ length: 81 }, (_, i) => i * 100).filter(lit);
    assert.ok(times.length > 0);
    const first = times[0];
    const last = times[times.length - 1];
    assert.ok(beamSpan(car, first, W)[1] >= 600);
    assert.ok(beamSpan(car, last, W)[0] <= 630 - 30 * 0.35);
    assert.equal(lit(first - 300), false);
    assert.equal(lit(last + 300), false);
});

test('the stride matches the ground speed, so feet don’t slide', () => {
    const height = 40;
    const speed = 0.05; // px per ms
    const cycle = strideCycleMs(height, speed);
    const leg = height * LEG_SHARE;
    const footTravel = 2 * leg * Math.sin((LEG_SWING_DEG * Math.PI) / 180);

    // In half a cycle the body moves exactly what a planted foot sweeps.
    assert.ok(Math.abs(speed * (cycle / 2) - footTravel) < 1e-9);
    // Slower walkers step slower; taller ones take longer strides.
    assert.ok(strideCycleMs(height, speed / 2) > cycle);
    assert.ok(strideCycleMs(height * 2, speed) > cycle);
    assert.equal(speedOf({ start: 0, dur: 50_000, w: 40 }, 1_000), 1_040 / 50_000);
});

// --- Steering.

const chaser = (over = {}) => ({
    kind: 'chaser',
    x: 500,
    w: 20,
    dir: 1,
    speed: 0.02,
    idle: 0.02,
    run: 0.08,
    react: 300,
    pending: null,
    turn: 0,
    turnTo: 1,
    wander: 60_000,
    chasing: false,
    gone: false,
    ...over,
});

/** A vehicle drawing at `left`, `w` wide; its body is the first 60%. */
const car = (left, w, lane, speed = 0.12) => {
    const front = lane === 'front';
    const body = w * 0.6;
    const span = [left, left + w];
    const beam = front ? [left + body, left + w] : [left, left + w - body];
    const b = front ? [left, left + body] : [left + w - body, left + w];

    return { span, beam, center: (b[0] + b[1]) / 2, dir: front ? 1 : -1, speed };
};

const steer = (m, vehiclesAt, ms, step = 16) => {
    let s = m;
    const seen = [];

    for (let t = 0; t < ms; t += step) {
        s = stepMummy(s, vehiclesAt(t), step, 1000, () => 0.5);
        seen.push(s);
    }

    return { s, seen };
};

test('a chaser turns toward a car whose headlights come near, after its reaction delay', () => {
    // Facing right; a front-lane car approaching from the left, its beam
    // ending 60 px short of the mummy.
    const m = chaser({ dir: 1 });
    const approaching = () => [car(200, 240, 'front')];

    assert.equal(steer(m, approaching, 200).s.dir, 1, 'not before the reaction delay');
    const later = steer(m, approaching, 1_000).s;
    assert.equal(later.dir, -1, 'turned to face the car');
    assert.equal(later.chasing, true);
});

test('a chaser never goes faster than the car it chases', () => {
    const m = chaser({ dir: 1, run: 0.5 });
    // The car drives right at 0.12 px/ms, passing the mummy.
    const { seen } = steer(m, (t) => [car(300 + 0.12 * t, 240, 'front')], 4_000);

    assert.ok(seen.some((s) => s.chasing && s.speed > 0.05), 'it lurches');
    assert.ok(seen.every((s) => s.speed <= CHASE_CAP * 0.12 + 1e-9));
    assert.equal(seen[seen.length - 1].dir, 1, 'after the car, which drove right');
});

test('a chaser slows to idle after the car leaves, still heading the same way', () => {
    const m = chaser({ dir: 1, speed: 0.08, chasing: true });
    const { s } = steer(m, () => [], 3_000);

    assert.equal(s.chasing, false);
    assert.equal(s.dir, 1);
    assert.ok(Math.abs(s.speed - 0.02) < 0.002, `speed ${s.speed}`);
});

test('a chaser reverses for a car coming the other way', () => {
    // A front-lane car passes and the mummy ends up chasing it right…
    let { s } = steer(chaser({ dir: -1 }), (t) => [car(250 + 0.12 * t, 240, 'front')], 4_000);
    assert.equal(s.dir, 1);
    // …then a back-lane car comes from the right, driving left: it faces
    // it (already facing right) and, once it has passed, chases it left.
    const x = s.x;
    const oncoming = (t) => [car(x + 60 - 0.12 * t, 240, 'back')];
    assert.equal(steer(s, oncoming, 800).s.dir, 1);
    ({ s } = steer(s, oncoming, 3_000));
    assert.equal(s.dir, -1);
    assert.equal(s.chasing, true);
});

test('turning is a short pause, not a snap', () => {
    const m = chaser({ dir: 1, react: 100 });
    const { seen } = steer(m, () => [car(200, 240, 'front')], 1_000);
    const turning = seen.filter((s) => s.turn > 0);

    assert.ok(turning.length >= Math.floor(TURN_MS / 16) - 1);
    assert.ok(turning.every((s) => s.speed <= 0.02));
});

test('a crosser ignores the cars and walks off the far edge', () => {
    const m = chaser({ kind: 'crosser', x: 900, dir: 1, idle: 0.03, speed: 0.03 });
    const { s, seen } = steer(m, () => [car(800, 240, 'back')], 6_000);

    assert.ok(seen.every((x) => x.dir === 1 && x.speed === 0.03));
    assert.equal(s.gone, true);
    assert.ok(s.x > 1000);
});

test('an idle chaser turns back at the edges and wanders now and then', () => {
    assert.equal(steer(chaser({ x: 990, dir: 1, react: 50 }), () => [], 800).s.dir, -1);
    assert.equal(steer(chaser({ wander: 100, react: 50 }), () => [], 800).s.dir, -1);
});

test('the stride advance keeps the feet planted', () => {
    // One full cycle covers two steps at any speed.
    const h = 40;
    const step = 2 * h * LEG_SHARE * Math.sin((LEG_SWING_DEG * Math.PI) / 180);
    assert.ok(Math.abs(strideAdvance(h, 0.05, (2 * step) / 0.05) - 1) < 1e-9);
    assert.equal(strideAdvance(h, 0, 1_000), 0);
});

test('vehicleNow puts the body behind the beam in both lanes', () => {
    const v = { start: 0, dur: 10_000, w: 300, body: 160 };
    const front = vehicleNow({ ...v, lane: 'front' }, 5_000, W);
    assert.deepEqual(front.beam, [510, 650]);
    assert.equal(front.center, 430);
    assert.equal(front.dir, 1);
    const back = vehicleNow({ ...v, lane: 'back' }, 5_000, W);
    assert.deepEqual(back.beam, [350, 490]);
    assert.equal(back.center, 570);
    assert.equal(back.dir, -1);
});
