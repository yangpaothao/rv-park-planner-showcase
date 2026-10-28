// ---------------------------------------------------------------------------
// PORTFOLIO SAMPLE - RV Park Planner (c) 2026 Yang Pao Thao. All rights reserved.
// Shows: pure, dependency-free TypeScript for the living hero banner -
// time-zone-aware local time via Intl, Easter/nth-weekday/lunar-calendar
// holiday windows, seasons, and real sun/moon altitude + rise/set search
// (low-precision ephemeris) mapped onto an on-screen arc. Copied verbatim
// from the private repo; tested by hero-calendar.test.mjs (node --test).
// ---------------------------------------------------------------------------

// Date, holiday, season and sky maths for the living hero banner
// (components/night-hero.tsx): what the banner should look like at a given
// moment, in a given place. Pure functions only — no React, no network, no
// `@/` imports — so it is tested directly with
// `node --test tests/js/hero-calendar.test.mjs` (tests/Unit/HeroCalendarTest.php
// runs that from the PHP suite).
//
// Everything works from an absolute moment (a Date) plus, optionally, a
// time zone (a park's own zone; the visitor's browser zone when omitted)
// and a latitude/longitude (a park's map centre; a default for the main
// site, which has no location).
//
// The sun and moon follow their real paths: their altitude comes from the
// standard low-precision formulas (after the BSD-licensed "suncalc" by
// Vladimir Agafonkin), and each draws along a gentle arc across the banner
// from where it rises (left edge) to where it sets (right edge), placed by
// how far through its time above the horizon it is.

// --- Types and the owner's choices.

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog';
export type Special = 'halloween' | 'christmas' | 'new-year';

export const WEATHERS: Weather[] = [
    'clear',
    'cloudy',
    'rain',
    'snow',
    'storm',
    'fog',
];

/**
 * Every holiday the banner decorates for, in calendar order, with when it
 * shows (in the park's own time; the visitor's on the main site). Keep the
 * ids in step with Tenant::HERO_HOLIDAYS (PHP).
 */
export const HOLIDAYS = [
    { id: 'new-year', label: "New Year's", when: 'Dec 31 – Jan 1' },
    {
        id: 'mlk-day',
        label: 'Martin Luther King Jr. Day',
        when: 'the day (3rd Monday of January)',
    },
    {
        id: 'lunar-new-year',
        label: 'Lunar New Year',
        when: 'the eve through 6 days after',
    },
    { id: 'valentines', label: "Valentine's Day", when: 'Feb 7 – 14' },
    {
        id: 'presidents-day',
        label: "Presidents' Day",
        when: 'the weekend and the day (3rd Monday of February)',
    },
    { id: 'st-patricks', label: "St. Patrick's Day", when: 'Mar 14 – 17' },
    { id: 'easter', label: 'Easter', when: 'the week up to Easter Sunday' },
    { id: 'cinco-de-mayo', label: 'Cinco de Mayo', when: 'May 5' },
    {
        id: 'mothers-day',
        label: "Mother's Day",
        when: 'the weekend (2nd Sunday of May)',
    },
    {
        id: 'memorial-day',
        label: 'Memorial Day',
        when: 'the weekend and the day (last Monday of May)',
    },
    {
        id: 'fathers-day',
        label: "Father's Day",
        when: 'the weekend (3rd Sunday of June)',
    },
    { id: 'juneteenth', label: 'Juneteenth', when: 'Jun 19' },
    { id: 'july-4', label: 'Independence Day (July 4th)', when: 'Jul 1 – 4' },
    {
        id: 'labor-day',
        label: 'Labor Day',
        when: 'the weekend and the day (1st Monday of September)',
    },
    { id: 'halloween', label: 'Halloween', when: 'all of October' },
    { id: 'diwali', label: 'Diwali', when: '2 days before to 2 days after' },
    { id: 'veterans-day', label: 'Veterans Day', when: 'Nov 11' },
    {
        id: 'thanksgiving',
        label: 'Thanksgiving',
        when: 'Thursday to Sunday (4th Thursday of November)',
    },
    {
        id: 'hmong-new-year',
        label: 'Hmong New Year',
        when: 'your dates (default Nov 25 – Dec 7)',
    },
    { id: 'hanukkah', label: 'Hanukkah', when: 'all 8 nights' },
    { id: 'christmas', label: 'Christmas', when: 'Dec 1 – 25' },
] as const;

export type HolidayId = (typeof HOLIDAYS)[number]['id'];

export const HOLIDAY_IDS: HolidayId[] = HOLIDAYS.map((h) => h.id);

/** The owner's on/off choices (Settings → Configuration → Website hero
 *  banner). Keep in step with Tenant::HERO_FEATURES (PHP). */
export const HERO_FEATURES = [
    'timeOfDay',
    'plane',
    'seasons',
    'weather',
    'holidays',
    'zombies',
    'santa',
    'fireworks',
] as const;

export type HeroFeature = (typeof HERO_FEATURES)[number];

export type HeroOptions = {
    features: Record<HeroFeature, boolean>;
    /** The holidays decorated for (when `features.holidays` is on). */
    holidays: HolidayId[];
    /** Hmong New Year's window, 'MM-DD' to 'MM-DD' (may wrap past Dec 31). */
    hmong: { start: string; end: string };
};

export const DEFAULT_HMONG = { start: '11-25', end: '12-07' };

/** Everything on — a business that never changed it, and the main site
 *  (which then turns weather off: it has no location). */
export function allOptions(): HeroOptions {
    return {
        features: Object.fromEntries(
            HERO_FEATURES.map((f) => [f, true]),
        ) as Record<HeroFeature, boolean>,
        holidays: [...HOLIDAY_IDS],
        hmong: { ...DEFAULT_HMONG },
    };
}

/** Whether every choice is on (drives the settings page's "All" box). */
export function isAll(options: HeroOptions): boolean {
    return (
        HERO_FEATURES.every((f) => options.features[f]) &&
        HOLIDAY_IDS.every((id) => options.holidays.includes(id))
    );
}

/** A month-day like '11-25' that exists in a leap year. */
export function isMonthDay(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [m, d] = value.split('-').map(Number);

    return m >= 1 && m <= 12 && d >= 1 && d <= DAYS_IN_MONTH[m - 1];
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Options from the server (or anywhere), with anything unknown dropped
 *  and anything missing switched on. */
export function normalizeOptions(raw: unknown): HeroOptions {
    const all = allOptions();

    if (!raw || typeof raw !== 'object') {
        return all;
    }

    const value = raw as Partial<Record<keyof HeroOptions, unknown>>;
    const features = (value.features ?? {}) as Record<string, unknown>;
    const hmong = (value.hmong ?? {}) as Record<string, unknown>;

    return {
        features: Object.fromEntries(
            HERO_FEATURES.map((f) => [f, features[f] !== false]),
        ) as Record<HeroFeature, boolean>,
        holidays: Array.isArray(value.holidays)
            ? HOLIDAY_IDS.filter((id) =>
                  (value.holidays as unknown[]).includes(id),
              )
            : all.holidays,
        hmong: {
            start: isMonthDay(hmong.start) ? hmong.start : DEFAULT_HMONG.start,
            end: isMonthDay(hmong.end) ? hmong.end : DEFAULT_HMONG.end,
        },
    };
}

// --- Local calendar time.

export type LocalTime = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone?: string): Intl.DateTimeFormat {
    const key = timeZone ?? '';
    let f = FORMATTERS.get(key);

    if (!f) {
        try {
            f = new Intl.DateTimeFormat('en-US', {
                timeZone,
                hourCycle: 'h23',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
            });
        } catch {
            // An unknown zone: the browser's own.
            f = formatter(undefined);
        }

        FORMATTERS.set(key, f);
    }

    return f;
}

/** The wall-clock date and time at `date` in `timeZone` (the browser's
 *  own zone when omitted or unknown). */
export function localTime(date: Date, timeZone?: string): LocalTime {
    const parts = Object.fromEntries(
        formatter(timeZone)
            .formatToParts(date)
            .map((p) => [p.type, Number(p.value)]),
    ) as Record<string, number>;

    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour % 24,
        minute: parts.minute,
        second: parts.second,
    };
}

/** The moment a wall-clock time happens in `timeZone`. */
export function zonedDate(
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
    timeZone?: string,
): Date {
    const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
    let guess = wanted;

    // Two rounds settle any zone offset (and DST change) that applies.
    for (let i = 0; i < 2; i++) {
        const t = localTime(new Date(guess), timeZone);
        const seen = Date.UTC(
            t.year,
            t.month - 1,
            t.day,
            t.hour,
            t.minute,
            t.second,
        );
        guess += wanted - seen;
    }

    return new Date(guess);
}

// --- Calendar arithmetic on whole days (days since 1970-01-01).

const DAY_MS = 86_400_000;

export const dayNumber = (year: number, month: number, day: number) =>
    Math.round(Date.UTC(year, month - 1, day) / DAY_MS);

/** The nth (1-based; -1 = last) weekday (0 = Sunday) of a month. */
export function nthWeekday(
    year: number,
    month: number,
    weekday: number,
    n: number,
): number {
    if (n < 0) {
        const last = dayNumber(year, month + 1, 0);
        const lastWeekday = new Date(last * DAY_MS).getUTCDay();

        return last - ((lastWeekday - weekday + 7) % 7);
    }

    const first = dayNumber(year, month, 1);
    const firstWeekday = new Date(first * DAY_MS).getUTCDay();

    return first + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
}

/** Easter Sunday (Western), by the anonymous Gregorian algorithm. */
export function easter(year: number): number {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return dayNumber(year, month, day);
}

// Holidays that follow other calendars, from published dates (US dates).
// Years outside the table simply aren't decorated for — extend as needed.

/** Lunar New Year's day. */
const LUNAR_NEW_YEAR: Record<number, string> = {
    2026: '02-17',
    2027: '02-06',
    2028: '01-26',
    2029: '02-13',
    2030: '02-03',
    2031: '01-23',
    2032: '02-11',
    2033: '01-31',
    2034: '02-19',
    2035: '02-08',
};

/** Hanukkah: the day of the evening the first candle is lit. */
const HANUKKAH: Record<number, string> = {
    2026: '12-04',
    2027: '12-24',
    2028: '12-12',
    2029: '12-01',
    2030: '12-20',
    2031: '12-09',
    2032: '11-27',
    2033: '12-16',
    2034: '12-06',
    2035: '12-25',
};

/** Diwali (the main day, Lakshmi Puja). */
const DIWALI: Record<number, string> = {
    2026: '11-08',
    2027: '10-29',
    2028: '10-17',
    2029: '11-05',
    2030: '10-26',
    2031: '11-14',
    2032: '11-02',
    2033: '10-22',
    2034: '11-10',
    2035: '10-30',
};

function fromTable(table: Record<number, string>, year: number): number | null {
    const md = table[year];

    if (!md) {
        return null;
    }

    const [m, d] = md.split('-').map(Number);

    return dayNumber(year, m, d);
}

const md = (year: number, value: string) => {
    const [m, d] = value.split('-').map(Number);

    return dayNumber(
        year,
        m,
        Math.min(d, new Date(Date.UTC(year, m, 0)).getUTCDate()),
    );
};

type Window = [number, number];

/** The days (inclusive) a holiday shows in a given year, or null. A window
 *  may run into the next year (New Year's, a wrapped Hmong New Year). */
export function holidayWindow(
    id: HolidayId,
    year: number,
    hmong = DEFAULT_HMONG,
): Window | null {
    const day = (m: number, d: number): Window => [
        dayNumber(year, m, d),
        dayNumber(year, m, d),
    ];
    const around = (
        d: number | null,
        before: number,
        after: number,
    ): Window | null => (d === null ? null : [d - before, d + after]);

    switch (id) {
        case 'new-year':
            return [dayNumber(year, 12, 31), dayNumber(year + 1, 1, 1)];
        case 'mlk-day':
            return around(nthWeekday(year, 1, 1, 3), 0, 0);
        case 'lunar-new-year':
            return around(fromTable(LUNAR_NEW_YEAR, year), 1, 6);
        case 'valentines':
            return [dayNumber(year, 2, 7), dayNumber(year, 2, 14)];
        case 'presidents-day':
            return around(nthWeekday(year, 2, 1, 3), 2, 0);
        case 'st-patricks':
            return [dayNumber(year, 3, 14), dayNumber(year, 3, 17)];
        case 'easter':
            return around(easter(year), 6, 0);
        case 'cinco-de-mayo':
            return day(5, 5);
        case 'mothers-day':
            return around(nthWeekday(year, 5, 0, 2), 2, 0);
        case 'memorial-day':
            return around(nthWeekday(year, 5, 1, -1), 2, 0);
        case 'fathers-day':
            return around(nthWeekday(year, 6, 0, 3), 2, 0);
        case 'juneteenth':
            return day(6, 19);
        case 'july-4':
            return [dayNumber(year, 7, 1), dayNumber(year, 7, 4)];
        case 'labor-day':
            return around(nthWeekday(year, 9, 1, 1), 2, 0);
        case 'halloween':
            return [dayNumber(year, 10, 1), dayNumber(year, 10, 31)];
        case 'diwali':
            return around(fromTable(DIWALI, year), 2, 2);
        case 'veterans-day':
            return day(11, 11);
        case 'thanksgiving':
            return around(nthWeekday(year, 11, 4, 4), 0, 3);
        case 'hmong-new-year': {
            const start = md(year, hmong.start);
            let end = md(year, hmong.end);

            if (end < start) {
                end = md(year + 1, hmong.end);
            }

            return [start, end];
        }
        case 'hanukkah':
            return around(fromTable(HANUKKAH, year), 0, 7);
        case 'christmas':
            return [dayNumber(year, 12, 1), dayNumber(year, 12, 25)];
    }
}

/** The holidays showing on a local date, in calendar order. */
export function activeHolidays(
    t: Pick<LocalTime, 'year' | 'month' | 'day'>,
    enabled: readonly HolidayId[] = HOLIDAY_IDS,
    hmong = DEFAULT_HMONG,
): HolidayId[] {
    const today = dayNumber(t.year, t.month, t.day);

    return HOLIDAY_IDS.filter(
        (id) =>
            enabled.includes(id) &&
            [t.year - 1, t.year].some((y) => {
                const w = holidayWindow(id, y, hmong);

                return w !== null && today >= w[0] && today <= w[1];
            }),
    );
}

/** Which night of Hanukkah it is (1–8), or null. */
export function hanukkahNight(
    t: Pick<LocalTime, 'year' | 'month' | 'day'>,
): number | null {
    const today = dayNumber(t.year, t.month, t.day);

    for (const y of [t.year - 1, t.year]) {
        const start = fromTable(HANUKKAH, y);

        if (start !== null && today >= start && today <= start + 7) {
            return today - start + 1;
        }
    }

    return null;
}

/**
 * The special scene for a local date (owner-confirmed windows):
 *  - Halloween: Oct 1 00:00 until midnight ending Oct 31 (mummies).
 *  - Christmas: Dec 1 00:00 until midnight ending Dec 25 (Santa's sleigh).
 *  - New Year's: Dec 26 00:00 through the end of Jan 1 (fireworks).
 */
export function specialOf(t: Pick<LocalTime, 'month' | 'day'>): Special | null {
    if (t.month === 10) {
        return 'halloween';
    }

    if (t.month === 12 && t.day <= 25) {
        return 'christmas';
    }

    if ((t.month === 12 && t.day >= 26) || (t.month === 1 && t.day === 1)) {
        return 'new-year';
    }

    return null;
}

/** How long the midnight New Year finale glows, from 00:00 on Jan 1. */
export const FINALE_SECONDS = 60;

/** Whether it's the first minute of the new year (the finale). */
export function isNewYearFinale(t: LocalTime): boolean {
    return (
        t.month === 1 &&
        t.day === 1 &&
        t.hour === 0 &&
        t.minute * 60 + t.second < FINALE_SECONDS
    );
}

/** The season for a local date (northern hemisphere, by the equinoxes and
 *  solstices: spring from Mar 20, summer Jun 21, fall Sep 22 — except
 *  winter starts Dec 1 so Christmas gets snow, not falling leaves). */
export function seasonOf(t: Pick<LocalTime, 'month' | 'day'>): Season {
    const n = t.month * 100 + t.day;

    if (n >= 320 && n < 621) {
        return 'spring';
    }

    if (n >= 621 && n < 922) {
        return 'summer';
    }

    if (n >= 922 && n < 1201) {
        return 'fall';
    }

    return 'winter';
}

// --- The sun and the moon.

const RAD = Math.PI / 180;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

/** Days since J2000.0. */
const toDays = (date: Date) => date.getTime() / DAY_MS - 0.5 + J1970 - J2000;

const rightAscension = (l: number, b: number) =>
    Math.atan2(
        Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
        Math.cos(l),
    );

const declination = (l: number, b: number) =>
    Math.asin(
        Math.sin(b) * Math.cos(OBLIQUITY) +
            Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l),
    );

const siderealTime = (d: number, lw: number) =>
    RAD * (280.16 + 360.9856235 * d) - lw;

const altitudeOf = (H: number, phi: number, dec: number) =>
    Math.asin(
        Math.sin(phi) * Math.sin(dec) +
            Math.cos(phi) * Math.cos(dec) * Math.cos(H),
    );

function sunCoords(d: number) {
    const M = RAD * (357.5291 + 0.98560028 * d);
    const C =
        RAD *
        (1.9148 * Math.sin(M) +
            0.02 * Math.sin(2 * M) +
            0.0003 * Math.sin(3 * M));
    const L = M + C + RAD * 102.9372 + Math.PI;

    return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d: number) {
    const L = RAD * (218.316 + 13.176396 * d);
    const M = RAD * (134.963 + 13.064993 * d);
    const F = RAD * (93.272 + 13.22935 * d);
    const l = L + RAD * 6.289 * Math.sin(M);
    const b = RAD * 5.128 * Math.sin(F);

    return { dec: declination(l, b), ra: rightAscension(l, b) };
}

/** The sun's altitude above the horizon, in degrees. */
export function sunAltitude(date: Date, lat: number, lng: number): number {
    const d = toDays(date);
    const c = sunCoords(d);

    return (
        altitudeOf(siderealTime(d, RAD * -lng) - c.ra, RAD * lat, c.dec) / RAD
    );
}

/** The moon's altitude above the horizon, in degrees. */
export function moonAltitude(date: Date, lat: number, lng: number): number {
    const d = toDays(date);
    const c = moonCoords(d);

    return (
        altitudeOf(siderealTime(d, RAD * -lng) - c.ra, RAD * lat, c.dec) / RAD
    );
}

/** Sunrise/sunset altitude (refraction and the sun's radius) and the
 *  moon's (its radius, parallax and refraction roughly cancel). */
export const SUN_HORIZON = -0.833;
export const MOON_HORIZON = 0.133;

type AltitudeFn = (date: Date) => number;

const STEP_MS = 10 * 60_000;
const SEARCH_MS = 40 * 3_600_000;

/** The moment between a and b (alt(a) and alt(b) on opposite sides of h0)
 *  where the altitude crosses h0, to within a few seconds. */
function bisect(alt: AltitudeFn, a: number, b: number, h0: number): number {
    const below = alt(new Date(a)) < h0;

    for (let i = 0; i < 18; i++) {
        const mid = (a + b) / 2;

        if (alt(new Date(mid)) < h0 === below) {
            a = mid;
        } else {
            b = mid;
        }
    }

    return (a + b) / 2;
}

/** The nearest crossing of h0 from `from`, searching forward (dir 1) or
 *  back (dir -1), or null if none within the search range (polar day). */
function crossing(
    alt: AltitudeFn,
    from: number,
    h0: number,
    dir: 1 | -1,
): number | null {
    const up = alt(new Date(from)) >= h0;

    for (let t = from; Math.abs(t - from) < SEARCH_MS; t += dir * STEP_MS) {
        const next = t + dir * STEP_MS;

        if (alt(new Date(next)) >= h0 !== up) {
            return bisect(alt, t, next, h0);
        }
    }

    return null;
}

/** A point on the banner's sky arc: `p` 0 at rising → 1 at setting, and
 *  where to draw it (percent of the banner's width and height). */
export type ArcPoint = { p: number; x: number; y: number; altitude: number };

/** The arc: from the left edge, low behind the trees, up to its highest
 *  point (kept below the sky title) and down to the right edge, where the
 *  signpost stands in front of it. */
export const ARC = { left: 4, right: 96, horizon: 68, peak: 40 };

export function arcPosition(p: number): { x: number; y: number } {
    const clamped = Math.min(1, Math.max(0, p));

    return {
        x: ARC.left + (ARC.right - ARC.left) * clamped,
        y: ARC.horizon - (ARC.horizon - ARC.peak) * Math.sin(Math.PI * clamped),
    };
}

/** Where a body is on its arc, or null while it's below the horizon. */
export function arcPoint(
    alt: AltitudeFn,
    date: Date,
    h0: number,
): ArcPoint | null {
    const t = date.getTime();
    const altitude = alt(date);

    if (altitude < h0) {
        return null;
    }

    const rise = crossing(alt, t, h0, -1);
    const set = crossing(alt, t, h0, 1);
    // Up all day (polar summer): treat as the middle of its arc.
    const p = rise === null || set === null ? 0.5 : (t - rise) / (set - rise);

    return { p, ...arcPosition(p), altitude };
}

/** Sunrise, sunset and solar noon on the local date of `date`. */
export function sunTimes(
    date: Date,
    lat: number,
    lng: number,
    timeZone?: string,
): { sunrise: Date | null; sunset: Date | null; solarNoon: Date } {
    const t = localTime(date, timeZone);
    const midnight = zonedDate(
        t.year,
        t.month,
        t.day,
        0,
        0,
        0,
        timeZone,
    ).getTime();
    const alt: AltitudeFn = (d) => sunAltitude(d, lat, lng);
    let sunrise: number | null = null;
    let sunset: number | null = null;
    let noon = midnight + DAY_MS / 2;
    let best = -Infinity;

    for (let at = midnight; at < midnight + DAY_MS; at += STEP_MS) {
        const a = alt(new Date(at));
        const b = alt(new Date(at + STEP_MS));

        if (a < SUN_HORIZON && b >= SUN_HORIZON) {
            sunrise = bisect(alt, at, at + STEP_MS, SUN_HORIZON);
        } else if (a >= SUN_HORIZON && b < SUN_HORIZON) {
            sunset = bisect(alt, at, at + STEP_MS, SUN_HORIZON);
        }

        if (a > best) {
            best = a;
            noon = at;
        }
    }

    // Refine solar noon to the minute.
    for (let at = noon - STEP_MS; at <= noon + STEP_MS; at += 60_000) {
        const a = alt(new Date(at));

        if (a > best) {
            best = a;
            noon = at;
        }
    }

    return {
        sunrise: sunrise === null ? null : new Date(sunrise),
        sunset: sunset === null ? null : new Date(sunset),
        solarNoon: new Date(noon),
    };
}

/** Where the main site (no park) puts its sun and moon: about the middle
 *  of the US, at the visitor's own zone's standard longitude so the sun is
 *  highest near midday on their clock. */
export const DEFAULT_LATITUDE = 38;

export function defaultLongitude(date: Date, timeZone?: string): number {
    const year = date.getUTCFullYear();
    // Minutes west of UTC on Jan 1 and Jul 1 in that zone; standard time
    // is the larger offset.
    const offset = (month: number) => {
        const at = Date.UTC(year, month, 1, 12);
        const t = localTime(new Date(at), timeZone);

        return (
            (at - Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute)) /
            60_000
        );
    };

    return -Math.max(offset(0), offset(6)) / 4;
}

// --- Time of day and the sky.

/** Dawn and dusk run while the sun is within this many degrees of the
 *  horizon (civil twilight below it, the golden hour above). */
export const TWILIGHT_DEG = 6;

export function timeOfDay(sunAlt: number, rising: boolean): TimeOfDay {
    if (sunAlt >= TWILIGHT_DEG) {
        return 'day';
    }

    if (sunAlt <= -TWILIGHT_DEG) {
        return 'night';
    }

    return rising ? 'dawn' : 'dusk';
}

export type SkyState = {
    timeOfDay: TimeOfDay;
    sunAltitude: number;
    /** 0 = full night, 1 = full day — the sky blends between them. */
    dayness: number;
    /** 0–1: how strong the sunrise/sunset glow at the horizon is. */
    glow: number;
    sun: ArcPoint | null;
    moon: ArcPoint | null;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (n: number) => n * n * (3 - 2 * n);

/** The sky at a moment and place. With time of day switched off it's
 *  always night (the moon still follows its real path). */
export function skyState(
    date: Date,
    lat: number,
    lng: number,
    timeOfDayOn = true,
): SkyState {
    const sunAlt = sunAltitude(date, lat, lng);
    const later = sunAltitude(new Date(date.getTime() + 10 * 60_000), lat, lng);
    const moon = arcPoint((d) => moonAltitude(d, lat, lng), date, MOON_HORIZON);

    if (!timeOfDayOn) {
        return {
            timeOfDay: 'night',
            sunAltitude: -30,
            dayness: 0,
            glow: 0,
            sun: null,
            moon,
        };
    }

    return {
        timeOfDay: timeOfDay(sunAlt, later > sunAlt),
        sunAltitude: sunAlt,
        dayness: smooth(clamp01((sunAlt + TWILIGHT_DEG) / (TWILIGHT_DEG * 2))),
        glow: clamp01(1 - Math.abs(sunAlt + 1) / 9),
        sun: arcPoint((d) => sunAltitude(d, lat, lng), date, SUN_HORIZON),
        moon,
    };
}

// --- Everything the banner needs, in one go.

export type HeroLook = SkyState & {
    local: LocalTime;
    season: Season | null;
    holidays: HolidayId[];
    hanukkahNight: number | null;
    special: Special | null;
    finale: boolean;
    weather: Weather;
    /** What the plane's banner says. */
    planeText: string;
};

export type HeroPlace = {
    /** The park's zone; the visitor's own when omitted. */
    timeZone?: string;
    /** The park's map centre; a default for the main site. */
    lat?: number | null;
    lng?: number | null;
    /** The park's weather now (park sites only). */
    weather?: Weather;
};

export function heroLook(
    date: Date,
    place: HeroPlace,
    options: HeroOptions,
    name: string,
): HeroLook {
    const f = options.features;
    const local = localTime(date, place.timeZone);
    const lat = place.lat ?? DEFAULT_LATITUDE;
    const lng = place.lng ?? defaultLongitude(date, place.timeZone);
    let special = specialOf(local);

    if (
        (special === 'halloween' && !f.zombies) ||
        (special === 'christmas' && !f.santa) ||
        (special === 'new-year' && !f.fireworks)
    ) {
        special = null;
    }

    return {
        ...skyState(date, lat, lng, f.timeOfDay),
        local,
        season: f.seasons ? seasonOf(local) : null,
        holidays: f.holidays
            ? activeHolidays(local, options.holidays, options.hmong)
            : [],
        hanukkahNight: hanukkahNight(local),
        special,
        finale: special === 'new-year' && isNewYearFinale(local),
        weather: f.weather ? (place.weather ?? 'clear') : 'clear',
        planeText:
            special === 'new-year' ? `Happy New Year from ${name}!` : name,
    };
}

// --- "Preview as" (Settings) and the local-only ?hero_preview= override.

export type PreviewLook =
    'today' | Season | Special | 'finale' | HolidayId | `weather-${Weather}`;

export type PreviewTime = 'live' | TimeOfDay;

/** A clean date in each season (no holiday or special that year). */
const SEASON_DATES: Record<Season, string> = {
    spring: '04-28',
    summer: '08-12',
    fall: '09-28',
    winter: '03-03',
};

const SPECIAL_DATES: Record<Special, string> = {
    halloween: '10-25',
    christmas: '12-15',
    // Both the special scene and the New Year's decorations.
    'new-year': '12-31',
};

/** The moment to show for a "Preview as" choice: the look's date this year
 *  (today for 'today' and the weather looks) at the chosen time of day —
 *  dawn just before sunrise, day mid-morning, dusk just after sunset, night
 *  late evening, or the time it is now ('live'). */
export function previewDate(
    now: Date,
    look: PreviewLook,
    time: PreviewTime,
    place: HeroPlace,
    hmong = DEFAULT_HMONG,
): Date {
    const tz = place.timeZone;
    const t = localTime(now, tz);
    let year = t.year;
    let month = t.month;
    let day = t.day;
    const setMd = (value: string) => {
        [month, day] = value.split('-').map(Number);
    };

    if (look === 'finale') {
        return zonedDate(year + 1, 1, 1, 0, 0, 5, tz);
    }

    if (look in SEASON_DATES) {
        setMd(SEASON_DATES[look as Season]);
    } else if (look in SPECIAL_DATES) {
        setMd(SPECIAL_DATES[look as Special]);
    } else if ((HOLIDAY_IDS as string[]).includes(look)) {
        let w = holidayWindow(look as HolidayId, year, hmong);

        for (let y = year + 1; !w && y <= year + 10; y++) {
            year = y;
            w = holidayWindow(look as HolidayId, y, hmong);
        }

        for (let y = 2026; !w && y <= 2035; y++) {
            year = y;
            w = holidayWindow(look as HolidayId, y, hmong);
        }

        if (w) {
            // The last day: the holiday itself for those with a lead-up.
            const d = new Date(w[1] * DAY_MS);
            year = d.getUTCFullYear();
            month = d.getUTCMonth() + 1;
            day = d.getUTCDate();
        }
    }

    const lat = place.lat ?? DEFAULT_LATITUDE;
    const lng = place.lng ?? defaultLongitude(now, tz);
    const noonish = zonedDate(year, month, day, 12, 0, 0, tz);
    const sun = sunTimes(noonish, lat, lng, tz);
    const at = (h: number, m = 0) => zonedDate(year, month, day, h, m, 0, tz);

    switch (time) {
        case 'live':
            return at(t.hour, t.minute);
        case 'dawn':
            return sun.sunrise
                ? new Date(sun.sunrise.getTime() - 12 * 60_000)
                : at(6);
        case 'day':
            return new Date(sun.solarNoon.getTime() - 150 * 60_000);
        case 'dusk':
            return sun.sunset
                ? new Date(sun.sunset.getTime() + 8 * 60_000)
                : at(19);
        case 'night':
            return at(22, 30);
    }
}

/** A preview spec from the ?hero_preview= override (local/testing only —
 *  the server never passes it in production). Format, comma separated:
 *  `look:<PreviewLook>`, `time:<PreviewTime>`, `at:<ISO date-time>`,
 *  `speed:<n>` (clock speed-up), `weather:<Weather>`. */
export type PreviewSpec = {
    look?: PreviewLook;
    time?: PreviewTime;
    at?: string;
    speed?: number;
    weather?: Weather;
};

export function parsePreview(
    value: string | null | undefined,
): PreviewSpec | null {
    if (!value) {
        return null;
    }

    const spec: PreviewSpec = {};

    for (const part of value.split(',')) {
        const i = part.indexOf(':');
        const key = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();

        if (key === 'look') {
            spec.look = v as PreviewLook;
        } else if (
            key === 'time' &&
            ['live', 'dawn', 'day', 'dusk', 'night'].includes(v)
        ) {
            spec.time = v as PreviewTime;
        } else if (key === 'at' && !Number.isNaN(Date.parse(v))) {
            spec.at = v;
        } else if (key === 'speed' && Number(v) > 0) {
            spec.speed = Math.min(3_600, Number(v));
        } else if (key === 'weather' && (WEATHERS as string[]).includes(v)) {
            spec.weather = v as Weather;
        }
    }

    return spec;
}
