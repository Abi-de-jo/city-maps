# Web and mobile integration

## Link to the hosted map

Deploy to HTTPS and use deep links:

```text
https://maps.example.com/?region=trichy&lng=78.7047&lat=10.7905&z=16
```

This works from websites, emails, QR codes, and native apps.

## Embed in a website

```html
<iframe
  title="City map"
  src="https://maps.example.com/?region=trichy&lng=78.7047&lat=10.7905&z=13"
  allow="geolocation"
  loading="lazy"
  style="width:100%;height:680px;border:0;border-radius:16px"
></iframe>
```

The map host must permit your website in Content Security Policy
`frame-ancestors`, and its Permissions Policy must allow that origin to use
geolocation.

## Use the JSON API

```ts
const response = await fetch(
  "https://maps.example.com/api/v1/directions" +
    "?origin=10.7905,78.7047" +
    "&destination=10.8315,78.6928" +
    "&mode=driving",
);
const { routes } = await response.json();
```

For cross-origin callers, configure an explicit CORS allowlist. Do not combine
wildcard origins with credentials.

## Android/iOS WebView

The responsive app can run inside a WebView. Production wrappers must load only
the trusted HTTPS origin, forward location permissions, restrict external
navigation, handle back actions, provide an offline/error state, and avoid
exposing JavaScript bridges to untrusted pages.

Use Android intent extras, app links, or iOS universal links to pass the same
`region`, `lng`, `lat`, and `z` values to the map.

## Fully native MapLibre

For maximum performance, render with MapLibre Native and keep the Next.js APIs
as search/routing services. Render returned GeoJSON route geometry as native
line layers. Implement GPS, background navigation, voice, and lifecycle handling
with platform APIs.

## API response contract

The UI expects places with `place_id`, `name`, `category`, `address`, `lat`, and
`lng`; routes with GeoJSON `LineString`, duration, distance, alternatives,
snapped endpoints, and steps; and reverse results with name/address/coordinate.

Keep these response shapes stable when replacing public providers with the
self-hosted backend.

## Recommended topology

```text
Website / Android / iOS
          |
       HTTPS CDN
          |
   Next.js City Maps
      |          |
 map/style    /api/v1
                 |
   self-hosted search/routing or contracted providers
```

Cache static map assets aggressively, cache suitable search responses briefly,
and never shared-cache user-specific navigation/location state.
