// PORTFOLIO SAMPLE - RV Park Planner (c) 2026 Yang Pao Thao. All rights reserved.
// Shows: Node's built-in test runner (node:test) exercising hero-calendar.ts directly.
// Import path adjusted for this folder; otherwise verbatim. Run: node --test

// Run with `node --test code-samples/hero-banner/hero-calendar.test.mjs` (Node 22.18+ reads the .ts directly).
// Also run from the PHP suite by tests/Unit/HeroCalendarTest.php.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    activeHolidays,
    allOptions,
    arcPoint,
    ARC,
    dayNumber,
    defaultLongitude,
    easter,
    hanukkahNight,
    heroLook,
    holidayWindow,
    isAll,
    isMonthDay,
    isNewYearFinale,
    localTime,
    moonAltitude,
    MOON_HORIZON,
    normalizeOptions,
    nthWeekday,
    parsePreview,
    previewDate,
    seasonOf,
    skyState,
    specialOf,
    SUN_HORIZON,
    sunAltitude,
    sunTimes,
    timeOfDay,
    zonedDate,
} from './hero-calendar.ts';

const CHICAGO = { lat: 41.88, lng: -87.63, timeZone: 'America/Chicago' };
const ymd = (n) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const at = (y, m, d, h = 12, mi = 0, s = 0, tz = CHICAGO.timeZone) => zonedDate(y, m, d, h, mi, s, tz);

// --- Calendar rules.

test('moving holidays follow their rules', () => {
    assert.equal(ymd(nthWeekday(2026, 11, 4, 4)), '2026-11-26'); // Thanksgiving
    assert.equal(ymd(nthWeekday(2027, 11, 4, 4)), '2027-11-25');
    assert.equal(ymd(nthWeekday(2026, 1, 1, 3)), '2026-01-19'); // MLK Day
    assert.equal(ymd(nthWeekday(2026, 2, 1, 3)), '2026-02-16'); // Presidents' Day
    assert.equal(ymd(nthWeekday(2026, 5, 1, -1)), '2026-05-25'); // Memorial Day
    assert.equal(ymd(nthWeekday(2026, 9, 1, 1)), '2026-09-07'); // Labor Day
    assert.equal(ymd(nthWeekday(2026, 5, 0, 2)), '2026-05-10'); // Mother's Day
    assert.equal(ymd(nthWeekday(2026, 6, 0, 3)), '2026-06-21'); // Father's Day
});

test('Easter Sunday', () => {
    assert.equal(ymd(easter(2026)), '2026-04-05');
    assert.equal(ymd(easter(2027)), '2027-03-28');
    assert.equal(ymd(easter(2030)), '2030-04-21');
    assert.equal(ymd(easter(2035)), '2035-03-25');
});

test('every holiday has a window in every year 2026–2035', () => {
    for (let y = 2026; y <= 2035; y++) {
        for (const id of allOptions().holidays) {
            const w = holidayWindow(id, y);
            assert.ok(w, `${id} ${y}`);
            assert.ok(w[1] >= w[0], `${id} ${y} runs forward`);
            assert.ok(w[1] - w[0] <= 31, `${id} ${y} is short`);
        }
    }
});

test('table holidays show on their dates', () => {
    assert.deepEqual(activeHolidays({ year: 2026, month: 2, day: 17 }), ['lunar-new-year']);
    assert.deepEqual(activeHolidays({ year: 2026, month: 11, day: 8 }), ['diwali']);
    assert.ok(activeHolidays({ year: 2026, month: 12, day: 4 }).includes('hanukkah'));
    assert.equal(hanukkahNight({ year: 2026, month: 12, day: 4 }), 1);
    assert.equal(hanukkahNight({ year: 2026, month: 12, day: 11 }), 8);
    assert.equal(hanukkahNight({ year: 2026, month: 12, day: 12 }), null);
});

test('fixed holidays and their windows', () => {
    assert.deepEqual(activeHolidays({ year: 2026, month: 7, day: 4 }), ['july-4']);
    assert.deepEqual(activeHolidays({ year: 2026, month: 7, day: 5 }), []);
    assert.deepEqual(activeHolidays({ year: 2026, month: 2, day: 14 }), ['valentines', 'presidents-day']); // a Saturday
    assert.deepEqual(activeHolidays({ year: 2026, month: 2, day: 15 }), ['presidents-day']);
    assert.deepEqual(activeHolidays({ year: 2026, month: 11, day: 29 }), ['thanksgiving', 'hmong-new-year']);
    assert.deepEqual(activeHolidays({ year: 2027, month: 1, day: 1 }), ['new-year']);
    assert.deepEqual(activeHolidays({ year: 2026, month: 12, day: 31 }), ['new-year']);
    assert.deepEqual(activeHolidays({ year: 2026, month: 12, day: 25 }), ['christmas']);
});

test('only the holidays the owner kept are shown', () => {
    assert.deepEqual(activeHolidays({ year: 2026, month: 12, day: 5 }, ['christmas']), ['christmas']);
    assert.deepEqual(activeHolidays({ year: 2026, month: 7, day: 4 }, []), []);
});

test('Hmong New Year: the default window and the business’s own dates', () => {
    assert.ok(activeHolidays({ year: 2026, month: 11, day: 25 }).includes('hmong-new-year'));
    assert.ok(activeHolidays({ year: 2026, month: 12, day: 7 }).includes('hmong-new-year'));
    assert.ok(!activeHolidays({ year: 2026, month: 12, day: 8 }).includes('hmong-new-year'));
    assert.ok(!activeHolidays({ year: 2026, month: 11, day: 24 }).includes('hmong-new-year'));

    const own = { start: '12-20', end: '01-05' }; // wraps past Dec 31
    assert.ok(activeHolidays({ year: 2026, month: 12, day: 30 }, ['hmong-new-year'], own).length === 1);
    assert.ok(activeHolidays({ year: 2027, month: 1, day: 5 }, ['hmong-new-year'], own).length === 1);
    assert.ok(activeHolidays({ year: 2027, month: 1, day: 6 }, ['hmong-new-year'], own).length === 0);
    assert.ok(activeHolidays({ year: 2026, month: 11, day: 30 }, ['hmong-new-year'], own).length === 0);
});

test('special windows start and end exactly at local midnight', () => {
    const special = (y, m, d, h, mi, s) => specialOf(localTime(at(y, m, d, h, mi, s), CHICAGO.timeZone));

    assert.equal(special(2026, 9, 30, 23, 59, 59), null);
    assert.equal(special(2026, 10, 1, 0, 0, 0), 'halloween');
    assert.equal(special(2026, 10, 31, 23, 59, 59), 'halloween');
    assert.equal(special(2026, 11, 1, 0, 0, 0), null);
    assert.equal(special(2026, 11, 30, 23, 59, 59), null);
    assert.equal(special(2026, 12, 1, 0, 0, 0), 'christmas');
    assert.equal(special(2026, 12, 25, 23, 59, 59), 'christmas');
    assert.equal(special(2026, 12, 26, 0, 0, 0), 'new-year');
    assert.equal(special(2027, 1, 1, 23, 59, 59), 'new-year');
    assert.equal(special(2027, 1, 2, 0, 0, 0), null);
});

test('the same moment is a different day in another park’s zone', () => {
    // 2026-10-01 03:00 UTC is still Sep 30 in Chicago, Oct 1 in Paris.
    const moment = new Date('2026-10-01T03:00:00Z');
    assert.equal(specialOf(localTime(moment, 'America/Chicago')), null);
    assert.equal(specialOf(localTime(moment, 'Europe/Paris')), 'halloween');
});

test('the New Year finale glows for the first minute of Jan 1', () => {
    const t = (h, mi, s, m = 1, d = 1) => ({ year: 2027, month: m, day: d, hour: h, minute: mi, second: s });
    assert.equal(isNewYearFinale(t(0, 0, 0)), true);
    assert.equal(isNewYearFinale(t(0, 0, 59)), true);
    assert.equal(isNewYearFinale(t(0, 1, 0)), false);
    assert.equal(isNewYearFinale(t(23, 59, 59, 12, 31)), false);
});

test('seasons', () => {
    assert.equal(seasonOf({ month: 3, day: 19 }), 'winter');
    assert.equal(seasonOf({ month: 3, day: 20 }), 'spring');
    assert.equal(seasonOf({ month: 6, day: 21 }), 'summer');
    assert.equal(seasonOf({ month: 9, day: 22 }), 'fall');
    assert.equal(seasonOf({ month: 11, day: 30 }), 'fall');
    assert.equal(seasonOf({ month: 12, day: 1 }), 'winter');
    assert.equal(seasonOf({ month: 1, day: 15 }), 'winter');
});

test('zonedDate and localTime round-trip, across a DST change', () => {
    for (const [m, d] of [
        [3, 8],
        [11, 1],
        [7, 4],
    ]) {
        const t = localTime(at(2026, m, d, 9, 30), CHICAGO.timeZone);
        assert.deepEqual([t.month, t.day, t.hour, t.minute], [m, d, 9, 30]);
    }
});

// --- Sun and moon.

test('the sun is at the horizon at sunrise and sunset', () => {
    const times = sunTimes(at(2026, 6, 21), CHICAGO.lat, CHICAGO.lng, CHICAGO.timeZone);

    // Chicago, June solstice: sunrise about 5:15 a.m. CDT, sunset about 8:29 p.m.
    assert.ok(Math.abs(times.sunrise - new Date('2026-06-21T10:15:00Z')) < 6 * 60_000, `sunrise ${times.sunrise.toISOString()}`);
    assert.ok(Math.abs(times.sunset - new Date('2026-06-22T01:29:00Z')) < 6 * 60_000, `sunset ${times.sunset.toISOString()}`);
    assert.ok(Math.abs(sunAltitude(times.sunrise, CHICAGO.lat, CHICAGO.lng) - SUN_HORIZON) < 0.05);
    assert.ok(Math.abs(sunAltitude(times.sunset, CHICAGO.lat, CHICAGO.lng) - SUN_HORIZON) < 0.05);
});

test('the sun is highest near solar noon, at the top of its arc', () => {
    const { solarNoon } = sunTimes(at(2026, 6, 21), CHICAGO.lat, CHICAGO.lng, CHICAGO.timeZone);
    const alt = (d) => sunAltitude(d, CHICAGO.lat, CHICAGO.lng);
    const hour = 3_600_000;

    // About 12:52 p.m. CDT.
    assert.ok(Math.abs(solarNoon - new Date('2026-06-21T17:52:00Z')) < 8 * 60_000, solarNoon.toISOString());
    assert.ok(alt(solarNoon) > alt(new Date(solarNoon - hour)));
    assert.ok(alt(solarNoon) > alt(new Date(solarNoon.getTime() + hour)));
    assert.ok(Math.abs(alt(solarNoon) - 71.6) < 1, `noon altitude ${alt(solarNoon)}`);

    const point = arcPoint(alt, solarNoon, SUN_HORIZON);
    assert.ok(Math.abs(point.p - 0.5) < 0.03, `p ${point.p}`);
    assert.ok(Math.abs(point.y - ARC.peak) < 0.5);
    assert.ok(Math.abs(point.x - 50) < 3);
});

test('the sun climbs from the left edge and sets at the right', () => {
    const { sunrise, sunset } = sunTimes(at(2026, 3, 20), CHICAGO.lat, CHICAGO.lng, CHICAGO.timeZone);
    const alt = (d) => sunAltitude(d, CHICAGO.lat, CHICAGO.lng);
    const early = arcPoint(alt, new Date(sunrise.getTime() + 5 * 60_000), SUN_HORIZON);
    const late = arcPoint(alt, new Date(sunset.getTime() - 5 * 60_000), SUN_HORIZON);

    assert.ok(early.p < 0.02 && early.x < ARC.left + 2 && early.y > ARC.horizon - 2);
    assert.ok(late.p > 0.98 && late.x > ARC.right - 2);
    assert.equal(arcPoint(alt, new Date(sunset.getTime() + 30 * 60_000), SUN_HORIZON), null);
});

test('the moon follows its own rise and set, by day too', () => {
    const alt = (d) => moonAltitude(d, CHICAGO.lat, CHICAGO.lng);
    let up = 0;
    let upByDay = 0;

    // Over a month, sampled hourly: up about half the time, sometimes in daylight.
    for (let h = 0; h < 24 * 30; h++) {
        const d = new Date(Date.UTC(2026, 9, 1) + h * 3_600_000);
        const point = arcPoint(alt, d, MOON_HORIZON);

        if (point) {
            up++;
            assert.ok(point.p >= 0 && point.p <= 1);
            assert.ok(point.x >= ARC.left && point.x <= ARC.right);

            if (sunAltitude(d, CHICAGO.lat, CHICAGO.lng) > 10) {
                upByDay++;
            }
        }
    }

    assert.ok(up > 24 * 30 * 0.4 && up < 24 * 30 * 0.6, `up ${up}`);
    assert.ok(upByDay > 24, `up by day ${upByDay}`);
});

test('time of day from the sun', () => {
    assert.equal(timeOfDay(30, true), 'day');
    assert.equal(timeOfDay(-20, false), 'night');
    assert.equal(timeOfDay(-2, true), 'dawn');
    assert.equal(timeOfDay(2, false), 'dusk');

    const noon = skyState(at(2026, 6, 21, 13), CHICAGO.lat, CHICAGO.lng);
    assert.equal(noon.timeOfDay, 'day');
    assert.ok(noon.dayness > 0.99 && noon.sun);

    const midnight = skyState(at(2026, 6, 21, 0, 30), CHICAGO.lat, CHICAGO.lng);
    assert.equal(midnight.timeOfDay, 'night');
    assert.equal(midnight.sun, null);

    const off = skyState(at(2026, 6, 21, 13), CHICAGO.lat, CHICAGO.lng, false);
    assert.equal(off.timeOfDay, 'night');
    assert.equal(off.dayness, 0);
});

// --- Options and the whole look.

test('options: all on by default, unknown dropped, missing switched on', () => {
    const all = allOptions();
    assert.equal(isAll(all), true);
    assert.deepEqual(normalizeOptions(null), all);

    const some = normalizeOptions({ features: { plane: false, bogus: true }, holidays: ['christmas', 'nope'], hmong: { start: '02-30', end: '12-01' } });
    assert.equal(some.features.plane, false);
    assert.equal(some.features.timeOfDay, true);
    assert.equal('bogus' in some.features, false);
    assert.deepEqual(some.holidays, ['christmas']);
    assert.deepEqual(some.hmong, { start: '11-25', end: '12-01' });
    assert.equal(isAll(some), false);
    assert.equal(isMonthDay('02-29'), true);
    assert.equal(isMonthDay('04-31'), false);
});

test('heroLook puts it all together, honouring the owner’s choices', () => {
    const place = { ...CHICAGO, weather: 'rain' };
    const halloweenNight = heroLook(at(2026, 10, 31, 21), place, allOptions(), 'Cedar Ridge');

    assert.equal(halloweenNight.special, 'halloween');
    assert.equal(halloweenNight.timeOfDay, 'night');
    assert.equal(halloweenNight.season, 'fall');
    assert.deepEqual(halloweenNight.holidays, ['halloween']);
    assert.equal(halloweenNight.weather, 'rain');
    assert.equal(halloweenNight.planeText, 'Cedar Ridge');

    const noMummies = allOptions();
    noMummies.features.zombies = false;
    noMummies.features.weather = false;
    const plain = heroLook(at(2026, 10, 31, 21), place, noMummies, 'Cedar Ridge');
    assert.equal(plain.special, null);
    assert.equal(plain.weather, 'clear');

    const newYear = heroLook(at(2026, 12, 28, 12), place, allOptions(), 'Cedar Ridge');
    assert.equal(newYear.planeText, 'Happy New Year from Cedar Ridge!');

    const finale = heroLook(at(2027, 1, 1, 0, 0, 30), place, allOptions(), 'Cedar Ridge');
    assert.equal(finale.finale, true);
});

test('preview dates land on the chosen look and time of day', () => {
    const now = at(2026, 10, 27, 15);
    const look = (l, t) => heroLook(previewDate(now, l, t, CHICAGO), CHICAGO, allOptions(), 'X');

    assert.equal(look('christmas', 'night').special, 'christmas');
    assert.equal(look('christmas', 'night').timeOfDay, 'night');
    assert.equal(look('summer', 'day').season, 'summer');
    assert.equal(look('summer', 'day').timeOfDay, 'day');
    assert.equal(look('summer', 'day').holidays.length, 0);
    assert.equal(look('fall', 'dusk').timeOfDay, 'dusk');
    assert.equal(look('spring', 'dawn').timeOfDay, 'dawn');
    assert.equal(look('winter', 'night').holidays.length, 0);
    assert.deepEqual(look('july-4', 'night').holidays, ['july-4']);
    assert.ok(look('thanksgiving', 'day').holidays.includes('thanksgiving'));
    assert.equal(look('finale', 'live').finale, true);
    assert.deepEqual(look('new-year', 'night').holidays, ['new-year']);
    assert.equal(dayNumber(2026, 1, 1) > 0, true);
});

test('the ?hero_preview= spec parser keeps only known values', () => {
    assert.deepEqual(parsePreview('look:halloween,time:night,speed:120,weather:storm,bogus:1'), {
        look: 'halloween',
        time: 'night',
        speed: 120,
        weather: 'storm',
    });
    assert.deepEqual(parsePreview('time:noon,weather:hail,speed:-1'), {});
    assert.equal(parsePreview(''), null);
});

test('with no map, the longitude comes from the zone’s standard time', () => {
    assert.equal(defaultLongitude(new Date('2026-07-01T12:00:00Z'), 'America/Chicago'), -90);
    assert.equal(defaultLongitude(new Date('2026-01-01T12:00:00Z'), 'America/Denver'), -105);
    assert.equal(defaultLongitude(new Date('2026-07-01T12:00:00Z'), 'America/Phoenix'), -105);
});
