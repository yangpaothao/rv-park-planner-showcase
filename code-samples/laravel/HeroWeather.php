<?php

// ---------------------------------------------------------------------------
// PORTFOLIO SAMPLE - RV Park Planner (c) 2026 Yang Pao Thao. All rights reserved.
// Shows: a resilient third-party API client in Laravel - the US National
// Weather Service's two-step points -> hourly forecast lookup, server-side
// only, cached per park for an hour, tight timeouts, SSRF-safe link following,
// and a fail-quiet default. Copied verbatim except the User-Agent contact
// address, which is replaced with a placeholder.
// ---------------------------------------------------------------------------

namespace App\Services;

use App\Models\Park;
use App\Models\SavedMap;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * The weather the living hero banner draws on a park's own website (never
 * the main site): the National Weather Service's current hourly forecast
 * for the park's map centre, reduced to one of the banner's looks — clear,
 * cloudy, rain, snow, storm or fog.
 *
 * Fetched here on the server (visitors never call the NWS), cached per
 * park for an hour, and quiet on failure: no coordinates, a park outside
 * the US, a timeout or any error all give 'clear'. The NWS asks every
 * caller to send a User-Agent that identifies the app and a contact.
 *
 * Coordinates come from the park's map (Site Designer geocodes the park's
 * address and saves the map's centre): its live map first, else its most
 * recently saved one.
 */
class HeroWeather
{
    public const LOOKS = ['clear', 'cloudy', 'rain', 'snow', 'storm', 'fog'];

    public const CACHE_SECONDS = 3600;

    public const USER_AGENT = 'RVParkPlanner/1.0 (https://rvparkplanner.com; support@example.com)';

    private const API = 'https://api.weather.gov';

    /** The banner's weather for a park right now. */
    public function forPark(Park $park): string
    {
        $coordinates = self::coordinates($park);

        if ($coordinates === null) {
            return 'clear';
        }

        // The NWS wants at most four decimal places (about 11 m).
        $lat = round($coordinates['lat'], 4);
        $lng = round($coordinates['lng'], 4);

        return Cache::remember(
            "hero-weather:park:{$park->id}:{$lat},{$lng}",
            self::CACHE_SECONDS,
            fn () => $this->fetch($lat, $lng),
        );
    }

    /**
     * The park's latitude/longitude from its map, or null.
     *
     * @return array{lat: float, lng: float}|null
     */
    public static function coordinates(Park $park): ?array
    {
        $map = SavedMap::query()
            ->where('park_id', $park->id)
            ->whereNotNull('center_lat')
            ->whereNotNull('center_lng')
            ->orderByDesc('is_live')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->first(['center_lat', 'center_lng']);

        if ($map === null) {
            return null;
        }

        $lat = (float) $map->center_lat;
        $lng = (float) $map->center_lng;

        if (abs($lat) > 90 || abs($lng) > 180 || ($lat === 0.0 && $lng === 0.0)) {
            return null;
        }

        return ['lat' => $lat, 'lng' => $lng];
    }

    /** Asks the NWS: the point's hourly forecast URL, then its first hour. */
    public function fetch(float $lat, float $lng): string
    {
        try {
            $point = $this->get(self::API."/points/{$lat},{$lng}");
            $hourly = $point?->json('properties.forecastHourly');

            // Only ever follow a link back to the NWS itself.
            if (! is_string($hourly) || ! str_starts_with($hourly, self::API.'/')) {
                return 'clear';
            }

            $forecast = $this->get($hourly);
            $text = $forecast?->json('properties.periods.0.shortForecast');

            return is_string($text) ? self::classify($text) : 'clear';
        } catch (Throwable) {
            return 'clear';
        }
    }

    private function get(string $url): ?Response
    {
        $response = Http::withHeaders([
            'User-Agent' => self::USER_AGENT,
            'Accept' => 'application/geo+json',
        ])->timeout(4)->connectTimeout(3)->get($url);

        return $response->successful() ? $response : null;
    }

    /**
     * An NWS "short forecast" ("Chance Rain Showers", "Mostly Cloudy",
     * "Patchy Fog", "Slight Chance T-storms", "Light Snow"…) as one of the
     * banner's looks. The most dramatic word wins.
     */
    public static function classify(string $text): string
    {
        $text = strtolower($text);
        $has = fn (array $words) => collect($words)->contains(fn (string $word) => str_contains($text, $word));

        return match (true) {
            $has(['thunder', 't-storm', 'tstorm']) => 'storm',
            $has(['snow', 'flurr', 'sleet', 'blizzard', 'ice pellets', 'wintry', 'freezing']) => 'snow',
            $has(['rain', 'shower', 'drizzle']) => 'rain',
            $has(['fog', 'haze', 'smoke', 'mist', 'dust']) => 'fog',
            $has(['mostly cloudy', 'cloudy', 'overcast']) && ! str_contains($text, 'partly cloudy') => 'cloudy',
            default => 'clear',
        };
    }
}
