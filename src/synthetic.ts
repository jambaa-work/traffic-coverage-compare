/**
 * @file        src/synthetic.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Synthetic congestion generator. Paints random, time-of-day weighted
 *              congestion levels onto real road geometry (a city's `sampleRoads`
 *              GeoJSON) to preview how your own traffic feed would look on OSM.
 *              The values are random and must not be read as real traffic.
 * SPDX-License-Identifier: MIT
 */
import type { FeatureCollection, LineString } from 'geojson'
import type { CongestionLevel } from './providers'

const LEVELS: CongestionLevel[] = ['low', 'moderate', 'heavy', 'severe']

export type RoadCollection = FeatureCollection<LineString, { highway?: string }>

const cache = new Map<string, Promise<RoadCollection>>()

/** Loads road geometry from a path relative to /public. Cached per path. */
export function loadRoads(path: string): Promise<RoadCollection> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}${path}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`)
      return r.json() as Promise<RoadCollection>
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p
}

/** Busier during typical morning (08-10) and evening (17-20) peaks, and on major roads. */
export function synthesizeCongestion(roads: RoadCollection, now = new Date()): FeatureCollection {
  const h = now.getHours() + now.getMinutes() / 60
  const peak = (h >= 8 && h < 10) || (h >= 17 && h < 20) ? 1 : h >= 7 && h < 21 ? 0.5 : 0.1
  return {
    type: 'FeatureCollection',
    features: roads.features.map((f) => {
      const roadWeight = f.properties?.highway === 'secondary' ? 0.6 : 1
      const score = Math.random() * 0.6 + peak * roadWeight * 0.6
      const level = LEVELS[Math.min(3, Math.floor(score * 3))]
      return { ...f, properties: { ...f.properties, congestion: level } }
    }),
  }
}
