# GPS and live navigation

## What is implemented

`frontend/components/CityMap.tsx` uses the browser Geolocation API for one-time
positioning, continuous navigation, current-location origins, route-heading
updates, off-route rerouting, walking distance/time tracking, a walked-path
polyline, accuracy warnings, and anti-drift filtering.

The browser supplies coordinates. The application cannot improve physical GPS
hardware or bypass operating-system privacy settings.

## Browser requirements

1. Serve production over HTTPS (`localhost` is the development exception).
2. Enable Location Services on the device.
3. Grant Location permission to the browser.
4. Enable Precise Location for the browser/application.
5. Test outdoors or near a window for a stronger satellite fix.

A desktop without a GNSS receiver may return a Wi-Fi/IP estimate with accuracy
measured in kilometres. That is expected and is not turn-by-turn precision.

## Permission states

- `prompt`: the browser can show its permission dialog;
- `granted`: location calls may proceed;
- `denied`: the user must change site/browser settings manually.

Do not repeatedly prompt after denial. Show a clear settings instruction.

## Accuracy and tracking

Navigation requests high accuracy. The walking tracker ignores fixes worse than
30 metres and movements under one metre to reduce stationary drift. Accuracy
still varies by device, sky visibility, nearby buildings, and power-saving mode.

## Android WebView

Add permissions to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Request runtime permission, enable WebView geolocation, and handle
`WebChromeClient.onGeolocationPermissionsShowPrompt`. Load the page from HTTPS
and grant only the trusted map origin.

Background navigation additionally requires a foreground service and visible
notification. Ask for background location only when truly required.

## iOS WKWebView

Add `NSLocationWhenInUseUsageDescription` to `Info.plist`, request When In Use
authorization, and use HTTPS. Background tracking requires additional iOS
capabilities and App Store justification.

## Privacy

- Request location only after a user action.
- Do not store raw location history by default.
- Stop geolocation watchers when tracking/navigation ends.
- Explain that route providers receive origin/destination coordinates.
- Add consent and retention controls before trip-history analytics.

## Troubleshooting

| Symptom | Check |
|---|---|
| Permission denied | Site settings and OS app permissions |
| Location is far away | Precise Location, VPN, desktop without GPS |
| GPS never resolves | HTTPS, Location Services, timeout, indoor signal |
| Marker jumps while stationary | Accuracy threshold and power-saving mode |
| Works locally, not deployed | TLS and `Permissions-Policy` header |

Recommended header when embedding is not needed:

```text
Permissions-Policy: geolocation=(self)
```

For an approved embedding origin, include it explicitly in this policy and in
the iframe `allow` attribute.
