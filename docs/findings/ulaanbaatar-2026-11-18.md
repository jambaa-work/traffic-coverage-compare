<!--
  @file        docs/findings/ulaanbaatar-2026-11-18.md
  @author      jambaa
  @created     2026-11-18
  @description First measured results for Ulaanbaatar, Mongolia: which providers have traffic data.
-->
# Ulaanbaatar, Mongolia (2026-11-18)

**Time:** 11:28 local time, off-peak.
**Question:** Can any traffic layer usable on OSM/MapLibre replace Google's traffic layer in Ulaanbaatar?

## Official coverage

Mongolia is **not listed** in the TomTom or HERE traffic coverage lists. Mapbox publishes no per-country list.

## In-app results

| Provider | City center (z13) | Whole city (z11.5) | Notes |
| --- | --- | --- | --- |
| Google | ✓ red / orange / green | ✓ | Reference. Its terms do not allow use on OSM |
| TomTom flow | **0.00%** | **0.00%** | Tiles are fully transparent |
| HERE flow | **0.00%** | **0.00%** | Flow API v7 also returned 0 segments |
| Mapbox Traffic v1 | 41 features | 13 features | **Has data.** Mostly `low`. Compare against Google's red segments at peak hours |

## Control test (`npm run control-test`)

Same endpoints and same keys for cities with known coverage:

| City | TomTom tile | TomTom segment | TomTom incidents | HERE tile | HERE flow | HERE incidents |
| --- | --- | --- | --- | --- | --- | --- |
| **Ulaanbaatar** | **0.00%** | **400 "Point too far from nearest existing segment"** | **0** | **0.00%** | **0** | **0** |
| Almaty | 1.76% | 21/36 km/h | 106 | 0.00% | 0 | 0 |
| Bangkok | 13.23% | 18/22 km/h | 185 | 20.65% | 1,727 | 6 |
| Berlin | 15.79% | 15/15 km/h | 247 | 7.48% | 516 | 164 |

## Conclusion

- The endpoints and keys work, because other cities return data.
- TomTom and HERE have **no traffic data** for Ulaanbaatar. TomTom's "nearest existing segment" error shows
  it has no traffic segments in the city at all.
- HERE returning 0 for Almaty matches Kazakhstan's absence from HERE's coverage list.
- Mapbox is the only provider tested with data for Ulaanbaatar. Its accuracy against Google still needs
  to be checked at peak hours.

## Next steps

Repeat the measurements at 08:00–09:30, 17:30–19:30 and at night (see [methodology](../methodology.md)).
