<?php

// ---------------------------------------------------------------------------
// PORTFOLIO SAMPLE - RV Park Planner (c) 2026 Yang Pao Thao. All rights reserved.
// Shows: multi-tenant resolution by host - central domain, {slug} subdomains,
// verified custom domains, 301s for renamed slugs (re-signing still-valid
// signed URLs for the new host), and host-only session cookies on custom
// domains. Copied verbatim from the private repo.
// ---------------------------------------------------------------------------

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Models\TenantSlugHistory;
use App\Support\CurrentTenant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves which Tenant (if any) the current request belongs to, from the
 * host, and makes it available via CurrentTenant for the rest of the
 * request — most importantly before HandleInertiaRequests runs (see the
 * middleware order in bootstrap/app.php), since its shared props query
 * Park, which relies on CurrentTenant being set already.
 *
 * - The exact central domain (rvparkplanner.com, or localhost locally)
 *   shows the SaaS's own marketing/signup pages, not tied to any tenant —
 *   CurrentTenant stays unset there.
 * - {slug}.{central_domain} is looked up against tenants.slug. A slug the
 *   tenant used to have (tenant_slug_history, Settings → Domain → Your web
 *   address) is 301-redirected to the current one, same path and query.
 * - Any other host is a tenant's own domain (Settings → Domain → Connect
 *   your own domain) once its ownership is proven
 *   (custom_domain_verified_at); "www." in front of it 301s to the bare
 *   domain. Session cookies there are host-only (SESSION_DOMAIN is the
 *   central domain's, which a browser would refuse on another domain).
 *
 * No match (or a deactivated tenant) is a 404, same as visiting a Site
 * that doesn't exist.
 */
class ResolveTenant
{
    // Browsers keep a 301 for as long as they're told to; an hour keeps a
    // later change of address (even back to an old one) from looping.
    private const REDIRECT_CACHE_SECONDS = 3600;

    public function handle(Request $request, Closure $next): Response
    {
        $host = Str::lower($request->getHost());
        $centralDomain = Str::lower((string) config('tenancy.central_domain'));

        if ($host === $centralDomain || $host === "www.{$centralDomain}") {
            // No tenant here — and none left over from an earlier request
            // in the same process (tests, long-lived workers).
            app()->forgetInstance('tenant');

            return $next($request);
        }

        if (Str::endsWith($host, ".{$centralDomain}")) {
            return $this->resolveSubdomain($request, $next, Str::before($host, ".{$centralDomain}"), $centralDomain);
        }

        return $this->resolveCustomDomain($request, $next, $host);
    }

    private function resolveSubdomain(Request $request, Closure $next, string $slug, string $centralDomain): Response
    {
        $tenant = Tenant::query()->active()->where('slug', $slug)->first();

        if ($tenant === null) {
            $previous = TenantSlugHistory::query()->where('slug', $slug)->first();
            $current = $previous === null ? null : Tenant::query()->active()->find($previous->tenant_id);

            abort_if($current === null, 404);

            return $this->redirectToHost($request, "{$current->slug}.{$centralDomain}", resign: true);
        }

        CurrentTenant::set($tenant);

        return $next($request);
    }

    private function resolveCustomDomain(Request $request, Closure $next, string $host): Response
    {
        $tenant = self::tenantForCustomDomain($host);

        if ($tenant === null && Str::startsWith($host, 'www.')) {
            $apex = Str::after($host, 'www.');

            abort_if(self::tenantForCustomDomain($apex) === null, 404);

            return $this->redirectToHost($request, $apex);
        }

        abort_if($tenant === null, 404);

        config(['session.domain' => null]);
        CurrentTenant::set($tenant);

        return $next($request);
    }

    public static function tenantForCustomDomain(string $host): ?Tenant
    {
        return Tenant::query()
            ->active()
            ->where('custom_domain', $host)
            ->whereNotNull('custom_domain_verified_at')
            ->first();
    }

    /**
     * Whether this request came in on its tenant's own domain (not the
     * subdomain) — staff sign-in and the staff area live on the subdomain.
     */
    public static function onCustomDomain(Request $request): bool
    {
        $tenant = CurrentTenant::get();

        return $tenant !== null
            && $tenant->custom_domain !== null
            && Str::lower($request->getHost()) === $tenant->custom_domain;
    }

    /**
     * 301 to the same path and query on $host. $resign (old web address ->
     * new one): a signed link that is still valid here (an emailed receipt
     * /paid or deposit dispute link) is re-signed for the new host — the
     * signature covers the host, so it would otherwise show "link expired".
     */
    private function redirectToHost(Request $request, string $host, bool $resign = false): Response
    {
        $port = $request->getPort();
        $defaultPort = $request->isSecure() ? 443 : 80;
        $origin = $request->getScheme().'://'.$host.($port !== null && (int) $port !== $defaultPort ? ":{$port}" : '');
        $target = $origin.$request->getRequestUri();

        if ($resign && $request->query('signature') !== null && URL::hasValidSignature($request)) {
            $query = collect(explode('&', (string) $request->server->get('QUERY_STRING')))
                ->reject(fn (string $parameter) => Str::before($parameter, '=') === 'signature')
                ->join('&');
            $unsigned = rtrim(rtrim($origin.$request->getBaseUrl().$request->getPathInfo(), '/').'?'.$query, '?');
            $target = $unsigned.($query === '' ? '?' : '&').'signature='.hash_hmac('sha256', $unsigned, (string) config('app.key'));
        }

        return redirect()
            ->away($target, 301)
            ->header('Cache-Control', 'public, max-age='.self::REDIRECT_CACHE_SECONDS);
    }
}
