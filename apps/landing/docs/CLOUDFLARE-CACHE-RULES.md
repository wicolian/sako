# Cloudflare Cache Rules for trysako.com

These cache rules optimize the delivery of static assets, improving PageSpeed scores especially on mobile.

## Prerequisites

- Cloudflare dashboard access for trysako.com
- Rules > Cache Rules section

---

## Rule 1: Next.js Static Assets (Long Cache)

**Purpose:** Cache JS, CSS, and font chunks with immutable hashes for maximum performance.

### Settings

| Field | Value |
|-------|-------|
| **Rule name** | Next.js Static Assets |
| **When incoming requests match** | Custom filter expression |
| **Field** | URI Path |
| **Operator** | starts with |
| **Value** | `/_next/static/` |

### Cache Eligibility

| Setting | Value |
|---------|-------|
| **Cache eligibility** | Eligible for cache |
| **Edge TTL** | Override origin, 1 month (2592000 seconds) |
| **Browser TTL** | Override origin, 1 year (31536000 seconds) |
| **Cache Key** | Include query string: All |

### Expression (for Copy/Paste)

```
(starts_with(http.request.uri.path, "/_next/static/"))
```

---

## Rule 2: Next.js Optimized Images

**Purpose:** Cache optimized images served by Next.js Image component.

### Settings

| Field | Value |
|-------|-------|
| **Rule name** | Next.js Optimized Images |
| **When incoming requests match** | Custom filter expression |
| **Field** | URI Path |
| **Operator** | starts with |
| **Value** | `/_next/image` |

### Cache Eligibility

| Setting | Value |
|---------|-------|
| **Cache eligibility** | Eligible for cache |
| **Edge TTL** | Override origin, 1 day (86400 seconds) |
| **Browser TTL** | Override origin, 1 week (604800 seconds) |
| **Cache Key** | Include query string: All |

### Expression (for Copy/Paste)

```
(starts_with(http.request.uri.path, "/_next/image"))
```

---

## Rule 3: Static Public Assets

**Purpose:** Cache favicons, fonts, and other static assets in /public.

### Settings

| Field | Value |
|-------|-------|
| **Rule name** | Static Public Assets |
| **When incoming requests match** | Custom filter expression |

### Expression

```
(http.request.uri.path contains "/favicons/") or 
(http.request.uri.path contains "/fonts/") or 
(ends_with(http.request.uri.path, ".svg")) or 
(ends_with(http.request.uri.path, ".png")) or 
(ends_with(http.request.uri.path, ".jpg")) or 
(ends_with(http.request.uri.path, ".webp"))
```

### Cache Eligibility

| Setting | Value |
|---------|-------|
| **Cache eligibility** | Eligible for cache |
| **Edge TTL** | Override origin, 1 month (2592000 seconds) |
| **Browser TTL** | Override origin, 1 year (31536000 seconds) |

---

## Rule 4: Bypass Cache for HTML/API

**Purpose:** Ensure dynamic content is never cached at the edge.

### Settings

| Field | Value |
|-------|-------|
| **Rule name** | Bypass Dynamic Content |
| **When incoming requests match** | Custom filter expression |

### Expression

```
(starts_with(http.request.uri.path, "/api/")) or
(http.request.uri.path eq "/") or
(not http.request.uri.path contains ".")
```

### Cache Eligibility

| Setting | Value |
|---------|-------|
| **Cache eligibility** | Bypass cache |

---

## Rule Order (Important!)

Rules are evaluated in order. Set them up in this priority:

1. **Bypass Dynamic Content** (highest priority - prevents HTML caching)
2. **Next.js Static Assets**
3. **Next.js Optimized Images**
4. **Static Public Assets**

---

## Verification

After applying rules:

1. Open DevTools → Network tab
2. Load trysako.com
3. Check `CF-Cache-Status` header on static assets:
   - `HIT` = Served from Cloudflare edge (good!)
   - `MISS` = First request, next one will be cached
   - `DYNAMIC` = Not cached (check rule order)
   - `BYPASS` = Intentionally not cached

4. CSS/JS files should show:
   - `Cache-Control: public, max-age=31536000, immutable`
   - `CF-Cache-Status: HIT`

---

## Performance Impact

| Metric | Before | After (estimated) |
|--------|--------|-------------------|
| CSS/JS load time | ~590ms blocking | ~50-100ms from edge |
| Font load time | Variable | Consistent from edge |
| Mobile LCP | 4.3s | ~2.5-3.5s |
| Repeat visits | Full reload | Instant from cache |

---

## Notes

- These rules work alongside Next.js's built-in caching headers
- The `immutable` directive is already set by Next.js for `/_next/static/`
- Cloudflare rules ensure edge caching even when browser cache is cleared
- Monitor Cache Analytics in Cloudflare dashboard to verify hit rates

