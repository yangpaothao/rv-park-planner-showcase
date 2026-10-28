# Code samples

These files come from the private RV Park Planner repository. Each one has a header comment saying what it shows. Apart from that header they are unchanged, with two small exceptions: the test files' import paths point at this folder, and the contact address in `HeroWeather.php`'s User-Agent is replaced with a placeholder.

I chose code that shows how I work without revealing anything sensitive. Payment logic, fee rules, authorization internals, AI prompts, configuration and deploy scripts are deliberately left out.

## `hero-banner/`: front-end maths for the living banner (TypeScript)

The animated banner on each park's website is a React component. All of its decisions come from pure, dependency-free TypeScript modules: what the sky looks like, where the sun and moon are, which holiday it is, and who is lit by headlights. Because they're pure, they can be tested without a browser.

| File | What to look at |
|---|---|
| `hero-calendar.ts` | Wall-clock time in any IANA zone using only `Intl`, and the reverse (`zonedDate`). Whole-day calendar arithmetic. Easter by the anonymous Gregorian algorithm, and "nth weekday of the month" rules. Holiday windows, including table-driven ones for Lunar New Year, Hanukkah and Diwali. Seasons. Sun and moon altitude from low-precision ephemeris formulas (after suncalc), with a bisection search for rise and set times that places each body on an on-screen arc. |
| `hero-walkers.ts` | Position maths that matches the CSS animations: where a vehicle is at time *t* and how far its headlight beam reaches. Interval overlap to decide whether a walker is lit. A small state machine for wandering and chasing, with eased turns, a chase speed cap and edge handling. Stride timing tied to speed, so the legs don't slide. |
| `moon-phase.ts` | A compact, fully typed pure function: phase, age, illumination, waxing or waning, and one of eight phase names. |
| `*.test.mjs` | 41 tests using Node's built-in `node:test` and `assert/strict`. They cover known dates (moon phases, Easter, DST changes), behaviour at the edges, and the state machine's invariants. |

Run them (Node 22.18+ reads `.ts` files directly):

```bash
cd code-samples/hero-banner
node --test
```

In the full project, a PHPUnit test also runs these Node tests, so one `php artisan test` command covers both languages.

## `laravel/`: tenancy and an external API client (PHP)

| File | What to look at |
|---|---|
| `ResolveTenant.php` | Middleware that maps the request host to a tenant. The central domain shows the marketing site. `{slug}.` subdomains are looked up by slug, and an old slug 301-redirects to the current one. A custom domain must have proven ownership, and its `www.` form 301s to the bare domain. On a custom domain the session cookie becomes host-only. One detail: a redirect from an old address *re-signs* a still-valid signed URL for the new host, because the signature covers the host. |
| `HeroWeather.php` | A service that calls the US National Weather Service: the points lookup, then the hourly forecast, reduced to one of six banner looks. It runs only on the server, is cached per park for an hour, has 3–4 second timeouts, follows only links back to `api.weather.gov`, and returns `'clear'` on any error. |

In the full app, `bootstrap/app.php` registers both middleware against Laravel's middleware priority list. This makes them run before route-model binding and before `auth`, so tenant global scopes and authentication always see the right tenant.
