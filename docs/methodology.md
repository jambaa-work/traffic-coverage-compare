<!--
  @file        docs/methodology.md
  @author      jambaa
  @created     2026-11-18
  @description How to run a repeatable traffic coverage comparison and record the results.
-->
# Methodology

The goal is to answer, with numbers, whether a provider's traffic layer covers a given city and how
closely it matches Google, which serves as the reference.

## 1. Check official coverage first

Look up each provider's published coverage list before testing:

| Provider | Where to look |
| --- | --- |
| TomTom Traffic API | docs.tomtom.com → Traffic API → Market coverage ("missing = not supported") |
| HERE Traffic API | HERE documentation → Traffic coverage |
| Mapbox Traffic v1 | docs.mapbox.com → mapbox-traffic-v1 (no per-country list) |

If your country is missing from a list, expect that pane to be empty. The test then confirms the gap.

## 2. Measure coverage

- **Raster providers (TomTom, HERE):** the badge downloads the 3×3 tiles around the view center and
  reports the share of pixels with alpha > 16. `0.00%` means the tiles are fully transparent.
- **Line providers (Mapbox, custom feed):** the badge reports how many features are rendered in the view,
  grouped by `congestion`.
- **Control test:** `npm run control-test -- --cities <yours>,berlin,bangkok`. If well-covered cities return
  data with the same endpoints and keys, an empty result for your city is a coverage gap.

## 3. Scenarios

1. **Peak hours:** for example 08:00–09:30 and 17:30–19:30 local time. Visit each preset, take a screenshot
   and record the coverage numbers.
2. **Night:** one measurement around 23:00. This helps tell real-time data from typical or historical patterns.
3. **Freshness:** leave the page open for 10 minutes and check whether tiles actually change.
4. **Quota:** count tile requests per hour in DevTools → Network to estimate production cost.

## 4. Zoom note

MapLibre uses 512 px tiles and Google uses 256 px tiles, so **Google zoom = MapLibre zoom + 1**. The Google
pane uses a vector map (`DEMO_MAP_ID`) so that fractional zoom levels render at the correct scale.

## 5. Recording results

Copy this table into `docs/findings/<city>-<yyyy-mm-dd>.md`:

| Criterion | Google (reference) | TomTom | HERE | Mapbox | Custom feed |
| --- | --- | --- | --- | --- | --- |
| Coverage (center, z13) | | | | | |
| Coverage (whole city) | | | | | |
| Match with Google (1–5) | — | | | | |
| Updates in real time | | | | | |
| License allows use on OSM/MapLibre | ✗ | | | ? | ✓ |
| Price / quota | | | | | |

Include the date, local time, and whether it was peak or off-peak.
