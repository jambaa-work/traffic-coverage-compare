/**
 * @file        scripts/fetch-roads.mjs
 * @author      jambaa
 * @created     2026-11-18
 * @description Downloads major-road geometry (motorway/trunk/primary/secondary) around a
 *              city center from the OpenStreetMap Overpass API and writes it as GeoJSON
 *              for the "Synthetic demo" provider. Data © OpenStreetMap contributors (ODbL).
 *
 * Usage: npm run fetch-roads -- --city <id> [--radius-km 8] [--out public/samples/<id>-roads.geojson]
 * SPDX-License-Identifier: MIT
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { getCity, parseArgs, ROOT } from './lib.mjs'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const HIGHWAYS = 'motorway|trunk|primary|secondary'

const args = parseArgs()
const city = getCity(args.city)
const radiusM = Math.round(Number(args['radius-km'] ?? 8) * 1000)
const out = typeof args.out === 'string' ? args.out : `${ROOT}public/samples/${city.id}-roads.geojson`
const { lat, lng } = city.view

const query = `[out:json][timeout:90];way["highway"~"^(${HIGHWAYS})$"](around:${radiusM},${lat},${lng});out geom;`
console.log(`Fetching ${HIGHWAYS} roads within ${radiusM / 1000} km of ${city.name} from Overpass…`)

const res = await fetch(OVERPASS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-traffic-compare' },
  body: new URLSearchParams({ data: query }),
})
if (!res.ok) {
  console.error(`✗ Overpass returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  process.exit(1)
}
const body = await res.json()

const round = (v) => Math.round(v * 1e5) / 1e5
const features = body.elements
  .filter((e) => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length > 1)
  .map((e, i) => ({
    type: 'Feature',
    id: i,
    properties: { highway: e.tags?.highway },
    geometry: { type: 'LineString', coordinates: e.geometry.map((g) => [round(g.lon), round(g.lat)]) },
  }))

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))

const servedPath = relative(`${ROOT}public`, out)
console.log(`✓ Wrote ${features.length} roads to ${relative(ROOT, out)}`)
if (!servedPath.startsWith('..')) {
  console.log(`  Add "sampleRoads": "${servedPath.split('\\').join('/')}" to "${city.id}" in src/config/cities.json if it is not there yet.`)
}
