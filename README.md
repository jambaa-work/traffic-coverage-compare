<!--
  @file        README.md
  @author      jambaa
  @created     2026-11-18
  @description Project overview, quick start and usage guide.
-->
# Map Traffic Compare

How accurately does each map provider show live traffic in **your** city?

Google Maps often has the best traffic coverage in cities where other providers have little or none,
but Google's terms only allow its traffic data on a Google map. This tool helps you find out which
alternatives actually have data for your city, using a single synchronized screen and measured numbers
instead of guesswork.

```
┌──────────────────────────┬──────────────────────────┐
│ Google Maps              │ OSM + provider ▼         │
│ + TrafficLayer           │ (default: TomTom flow)   │
│ (reference)              │                          │
├──────────────────────────┼──────────────────────────┤
│ OSM + provider ▼         │ OSM + provider ▼         │
│ (default: HERE flow)     │ (default: Mapbox)        │
└──────────────────────────┴──────────────────────────┘
  Each pane badge: coverage · tiles ok/errors · last refresh
```

- All four maps move together. Pan or zoom any of them.
- Each OSM pane can show any provider: **TomTom flow**, **TomTom incidents**, **HERE flow**,
  **Mapbox Traffic v1**, **your own GeoJSON feed**, a **synthetic demo**, or nothing.
- The badge shows **coverage**: for raster tiles, the share of painted pixels in the 3×3 tiles around
  the center; for line layers, the number of visible features by congestion level. 0% / 0 features
  means the provider has no data there.
- City picker, per-city location presets, and a grayscale toggle that makes traffic colors stand out.

## Quick start

Requires Node.js 22.12 or newer.

```bash
git clone <this repo> && cd map-traffic-compare
npm install
cp .env.example .env.local     # add the keys you have; see docs/api-keys.md
npm run check-keys             # one request per provider, keys are masked
npm run dev                    # opens http://localhost:5190
```

Every key is optional. A pane whose key is missing shows a notice and the rest keep working.
The port is fixed at 5190 so it matches the referrer restrictions on your keys.

## Test your own city

1. Add an entry to [`src/config/cities.json`](src/config/cities.json):

   ```json
   {
     "id": "nairobi",
     "name": "Nairobi",
     "country": "KE",
     "view": { "lng": 36.8219, "lat": -1.2864, "zoom": 13 },
     "presets": [
       { "name": "CBD", "view": { "lng": 36.8219, "lat": -1.2864, "zoom": 13 } },
       { "name": "Whole city", "view": { "lng": 36.85, "lat": -1.28, "zoom": 11 } }
     ]
   }
   ```

   `zoom` is a MapLibre zoom. The Google pane adds 1 automatically (Google uses 256 px tiles).

2. Open `http://localhost:5190/?city=nairobi`, or set `VITE_DEFAULT_CITY=nairobi` in `.env.local`.
3. (Optional) Fetch major roads from OpenStreetMap for the synthetic demo provider:

   ```bash
   npm run fetch-roads -- --city nairobi --radius-km 8
   ```

   Then add `"sampleRoads": "samples/nairobi-roads.geojson"` to the city entry.

4. Run the control test to confirm that an empty result is a coverage gap, not a setup problem:

   ```bash
   npm run control-test -- --cities nairobi,berlin
   ```

   It calls the same TomTom and HERE endpoints with the same keys for every city. If Berlin returns
   data and your city does not, the provider has no coverage there.

## Show your own traffic data

Choose **Custom GeoJSON feed** in any OSM pane and point `VITE_CUSTOM_TRAFFIC_URL` at a
`FeatureCollection` of `LineString` features with a `congestion` property:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "congestion": "heavy" },
      "geometry": { "type": "LineString", "coordinates": [[106.88, 47.917], [106.917, 47.918]] }
    }
  ]
}
```

| `congestion` | Color |
| --- | --- |
| `low` | green `#30b455` |
| `moderate` | orange `#f5a623` |
| `heavy` | red `#e53935` |
| `severe` | dark red `#8b0000` |

The feed is re-fetched every 30 seconds and must allow CORS from `http://localhost:5190`.
To try it, set `VITE_CUSTOM_TRAFFIC_URL=/samples/custom-feed-example.geojson`.

The **Synthetic demo** provider paints random, time-of-day weighted congestion on the city's
`sampleRoads`. It shows what a feed would look like before you have one. Its values are not real traffic.

## Providers

| Provider | Type | Refresh | Key |
| --- | --- | --- | --- |
| Google TrafficLayer | Maps JS API (reference pane only) | by Google | `VITE_GOOGLE_MAPS_KEY` |
| TomTom flow / incidents | raster tiles | 60 s | `VITE_TOMTOM_KEY` |
| HERE flow | raster tiles (v3) | 60 s | `VITE_HERE_KEY` |
| Mapbox Traffic v1 | vector tiles | 5 min | `VITE_MAPBOX_TOKEN` |
| Custom GeoJSON feed | GeoJSON | 30 s | `VITE_CUSTOM_TRAFFIC_URL` |
| Synthetic demo | generated | 30 s | none |

Before relying on any provider in production, check its terms. For example, Google traffic may only
be shown on Google maps, and you should confirm whether Mapbox allows its traffic tiles in MapLibre.

To add another provider, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5190 |
| `npm run build` | Type-check and production build |
| `npm run check-keys [-- --city <id>]` | One request per provider for the city center; prints status and a first coverage signal |
| `npm run control-test [-- --cities a,b]` | Compares TomTom and HERE results across cities |
| `npm run fetch-roads -- --city <id>` | Downloads OSM major roads for the synthetic demo |

## Project layout

```
src/main.ts              grid, toolbar, city picker, presets
src/google-pane.ts       Google + TrafficLayer reference pane
src/maplibre-pane.ts     OSM pane: provider layer, refresh, badge, coverage
src/providers.ts         provider registry (URLs, kind, refresh, key)
src/probe.ts             raster coverage measurement
src/sync.ts              camera synchronization
src/synthetic.ts         synthetic congestion generator
src/cities.ts            city resolution
src/config/cities.json   city and preset definitions
public/samples/          sample road geometry and an example custom feed
scripts/                 Node scripts (key check, control test, road fetch)
docs/                    API key guide, methodology, findings
```

## Findings

Results are recorded per city in [`docs/findings/`](docs/findings/). The first one,
[Ulaanbaatar, 2026-11-18](docs/findings/ulaanbaatar-2026-11-18.md), found that TomTom and HERE returned
no traffic data for the city, while Mapbox did. Contributions of results from other cities are welcome.
See [docs/methodology.md](docs/methodology.md) for how to run a comparable test.

## Security

`VITE_*` variables are embedded in the browser bundle. Use only public, browser-restricted keys, never
secret tokens. `npm run build` puts your keys into `dist/`, which is git-ignored. Do not publish a build
made with your keys. See [docs/api-keys.md](docs/api-keys.md).

## License

[MIT](LICENSE). Map data © OpenStreetMap contributors (ODbL). Traffic data belongs to the respective providers.
