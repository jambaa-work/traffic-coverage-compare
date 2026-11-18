/**
 * @file        scripts/control-test.mjs
 * @author      jambaa
 * @created     2026-11-18
 * @description Control test: queries the same TomTom and HERE endpoints with the same
 *              keys for several cities. If a well-covered city returns data and yours
 *              does not, the empty result is a coverage gap, not a bug in your setup.
 *
 * Usage: npm run control-test [-- --cities ulaanbaatar,berlin] [--env path/to/.env]
 *        Defaults to every city in src/config/cities.json.
 * SPDX-License-Identifier: MIT
 */
import { getCity, loadCities, loadEnv, ORIGIN_HEADERS, parseArgs, pngOpaquePct, tileXY } from './lib.mjs'

const args = parseArgs()
loadEnv(typeof args.env === 'string' ? args.env : undefined)
const T = process.env.VITE_TOMTOM_KEY?.trim()
const H = process.env.VITE_HERE_KEY?.trim()
if (!T && !H) {
  console.error('✗ Neither VITE_TOMTOM_KEY nor VITE_HERE_KEY is set.')
  process.exit(1)
}

const ids = typeof args.cities === 'string' ? args.cities.split(',') : loadCities().cities.map((c) => c.id)
const Z = 13

const json = (r) => r.json().catch(() => ({}))
const snippet = (v) => JSON.stringify(v).slice(0, 120)

for (const id of ids) {
  const city = getCity(id.trim())
  const { lat, lng } = city.view
  const [x, y] = tileXY(lat, lng, Z)
  const out = []

  if (T) {
    let r = await fetch(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${Z}/${x}/${y}.png?key=${T}`, {
      headers: ORIGIN_HEADERS,
    })
    const b = Buffer.from(await r.arrayBuffer())
    out.push(`TomTom tile       ${r.status} ${b.length}B painted=${r.ok ? pngOpaquePct(b) : '-'}`)

    r = await fetch(
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lng}&key=${T}`,
      { headers: ORIGIN_HEADERS },
    )
    let j = await json(r)
    const s = j.flowSegmentData
    out.push(
      `TomTom segment    ${r.status} ${s ? `current=${s.currentSpeed} free=${s.freeFlowSpeed} km/h conf=${s.confidence}` : snippet(j.detailedError ?? j.error ?? j)}`,
    )

    const bbox = `${lng - 0.05},${lat - 0.05},${lng + 0.05},${lat + 0.05}`
    r = await fetch(
      `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields={incidents{type}}&key=${T}`,
      { headers: ORIGIN_HEADERS },
    )
    j = await json(r)
    out.push(`TomTom incidents  ${r.status} n=${j.incidents?.length ?? snippet(j)}`)
  }

  if (H) {
    let r = await fetch(`https://traffic.maps.hereapi.com/v3/flow/mc/${Z}/${x}/${y}/png?apiKey=${H}`)
    const b = Buffer.from(await r.arrayBuffer())
    out.push(`HERE tile         ${r.status} ${b.length}B painted=${r.ok ? pngOpaquePct(b) : b.toString().slice(0, 100)}`)

    r = await fetch(
      `https://data.traffic.hereapi.com/v7/flow?in=circle:${lat},${lng};r=3000&locationReferencing=none&apiKey=${H}`,
    )
    let j = await json(r)
    out.push(`HERE flow         ${r.status} n=${j.results?.length ?? snippet(j)}`)

    r = await fetch(
      `https://data.traffic.hereapi.com/v7/incidents?in=circle:${lat},${lng};r=5000&locationReferencing=none&apiKey=${H}`,
    )
    j = await json(r)
    out.push(`HERE incidents    ${r.status} n=${j.results?.length ?? snippet(j)}`)
  }

  console.log(`\n== ${city.name} (${city.country})\n  ${out.join('\n  ')}`)
}
