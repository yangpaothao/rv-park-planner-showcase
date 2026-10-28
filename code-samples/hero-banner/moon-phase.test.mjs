// PORTFOLIO SAMPLE - RV Park Planner (c) 2026 Yang Pao Thao. All rights reserved.
// Shows: Node's built-in test runner (node:test) exercising moon-phase.ts directly.
// Import path adjusted for this folder; otherwise verbatim. Run: node --test

// Run with `node --test code-samples/hero-banner/moon-phase.test.mjs` (Node 22.18+ reads the .ts directly).
// Also run from the PHP suite by tests/Unit/MoonPhaseTest.php.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moonPhase } from './moon-phase.ts';

test('2026-01-03 is a full moon', () => {
    const moon = moonPhase(new Date('2026-01-03T10:03:00Z'));

    assert.equal(moon.name, 'full');
    assert.ok(moon.illumination > 0.97, `illumination ${moon.illumination}`);
});

test('2026-01-18 is a new moon', () => {
    const moon = moonPhase(new Date('2026-01-18T19:52:00Z'));

    assert.equal(moon.name, 'new');
    assert.ok(moon.illumination < 0.03, `illumination ${moon.illumination}`);
});

test('a week after new is about first quarter, lit on the right', () => {
    const moon = moonPhase(new Date('2026-01-26T04:47:00Z'));

    assert.equal(moon.name, 'first-quarter');
    assert.equal(moon.waxing, true);
    assert.ok(Math.abs(moon.illumination - 0.5) < 0.1);
});

test('a week after full is about last quarter, lit on the left', () => {
    const moon = moonPhase(new Date('2026-01-10T15:48:00Z'));

    assert.equal(moon.name, 'last-quarter');
    assert.equal(moon.waxing, false);
});

test('works for dates before the reference new moon', () => {
    const moon = moonPhase(new Date('1999-12-22T17:31:00Z'));

    assert.equal(moon.name, 'full');
    assert.ok(moon.age >= 0 && moon.age < 29.54);
});
