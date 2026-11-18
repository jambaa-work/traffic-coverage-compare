/**
 * @file        scripts/check-keys.mjs
 * @author      jambaa
 * @created     2026-11-18
 * @description Sends one request per provider using the keys in .env.local and prints
 *              the result. Each request targets the city center (z13), so the output is
 *              also a first coverage signal. Keys are always masked in the output.
 *
 * Usage: npm run check-keys [-- --city <id>]
 * SPDX-License-Identifier: MIT
 */
import { getCity, loadEnv, mask, ORIGIN_HEADERS, parseArgs, tileXY } from './lib.mjs'

const args = parseArgs()
loadEnv(typeof args.env === 'string' ? args.env : undefined)
const city = getCity(args.city)
const { lat, lng } = city.view
const Z = 13
const [X, Y] = tileXY(lat, lng, Z)

console.log(`City: ${city.name} (${lat}, ${lng}), tile z${Z}/${X}/${Y}\n`)

const checks = [
  {
    name: 'Google',
    env: 'VITE_GOOGLE_MAPS_KEY',
    // The Maps JS API answers 200 even for bad keys; referrer restrictions are only enforced in a browser.
    run: async () => 'browser-only check (look for InvalidKeyMapError in the browser console)',
  },
  {
    name: 'TomTom',
    env: 'VITE_TOMTOM_KEY',
    run: async (k) => {
      const r = await fetch(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${Z}/${X}/${Y}.png?key=${k}`, {
        headers: ORIGIN_HEADERS,
      })
      const bytes = (await r.arrayBuffer()).byteLength
      return `HTTP ${r.status}, tile ${bytes} bytes${r.ok && bytes < 200 ? ' (probably an empty tile)' : ''}`
    },
  },
  {
    name: 'HERE',
    env: 'VITE_HERE_KEY',
    run: async (k) => {
      const r = await fetch(
        `https://data.traffic.hereapi.com/v7/flow?in=circle:${lat},${lng};r=2000&locationReferencing=none&apiKey=${k}`,
      )
      const body = await r.json().catch(() => ({}))
      const count = Array.isArray(body.results) ? body.results.length : '?'
      return `HTTP ${r.status}, flow segments within 2 km of center: ${count}${body.error ? ` (${body.error})` : ''}`
    },
  },
  {
    name: 'Mapbox',
    env: 'VITE_MAPBOX_TOKEN',
    run: async (k) => {
      const r = await fetch(
        `https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/${Z}/${X}/${Y}.vector.pbf?access_token=${k}`,
        { headers: ORIGIN_HEADERS },
      )
      const bytes = (await r.arrayBuffer()).byteLength
      return `HTTP ${r.status}, traffic tile ${bytes} bytes${r.ok && bytes === 0 ? ' (no data)' : ''}`
    },
  },
]

for (const c of checks) {
  const v = process.env[c.env]?.trim()
  if (!v) {
    console.log(`– ${c.name.padEnd(7)} ${c.env} is empty, skipped`)
    continue
  }
  try {
    console.log(`• ${c.name.padEnd(7)} [${mask(v)}] ${await c.run(v)}`)
  } catch (e) {
    console.log(`✗ ${c.name.padEnd(7)} [${mask(v)}] error: ${e.message}`)
  }
}

// Optional reminder to revoke short-lived test keys (see docs/api-keys.md).
const created = Date.parse(process.env.KEYS_CREATED_AT ?? '')
if (!Number.isNaN(created)) {
  const hours = (Date.now() - created) / 36e5
  console.log(
    hours > 24
      ? `\n⚠ Keys were created ${hours.toFixed(0)} h ago. Consider revoking them (docs/api-keys.md → "Cleaning up").`
      : `\nKey age: ${hours.toFixed(1)} h.`,
  )
}
