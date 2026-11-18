/**
 * @file        src/providers.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Registry of traffic data providers shown on the OSM panes: tile URL
 *              templates, layer kind, refresh interval and the env var holding the key.
 *              Add a new provider here (see CONTRIBUTING.md).
 * SPDX-License-Identifier: MIT
 */
export type ProviderId = 'tomtom' | 'tomtom-incidents' | 'here' | 'mapbox' | 'custom' | 'synthetic' | 'none'

type KeyEnv = 'VITE_TOMTOM_KEY' | 'VITE_HERE_KEY' | 'VITE_MAPBOX_TOKEN' | 'VITE_CUSTOM_TRAFFIC_URL'

export interface Provider {
  id: ProviderId
  label: string
  /** Name of the import.meta.env variable required by this provider. If empty, the pane shows a notice. */
  envKey?: KeyEnv
  /**
   * raster    - PNG tiles, coverage measured as % of painted pixels
   * vector    - MVT tiles with a `congestion` property
   * geojson   - GeoJSON LineStrings with a `congestion` property, fetched from a URL
   * synthetic - random congestion over the city's sample road geometry
   */
  kind: 'raster' | 'vector' | 'geojson' | 'synthetic' | 'none'
  /** URL template with {z}/{x}/{y} placeholders. `key` goes into the query string. */
  tileUrl?: (key: string) => string
  tileSize?: number
  maxzoom?: number
  refreshMs: number
  attribution?: string
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  tomtom: {
    id: 'tomtom',
    label: 'TomTom flow (relative0)',
    envKey: 'VITE_TOMTOM_KEY',
    kind: 'raster',
    tileUrl: (k) => `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?tileSize=512&key=${k}`,
    tileSize: 512,
    maxzoom: 22,
    refreshMs: 60_000,
    attribution: '© TomTom',
  },
  'tomtom-incidents': {
    id: 'tomtom-incidents',
    label: 'TomTom incidents (s3)',
    envKey: 'VITE_TOMTOM_KEY',
    kind: 'raster',
    tileUrl: (k) => `https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?tileSize=512&key=${k}`,
    tileSize: 512,
    maxzoom: 22,
    refreshMs: 60_000,
    attribution: '© TomTom',
  },
  here: {
    id: 'here',
    label: 'HERE flow (Raster Tile v3)',
    envKey: 'VITE_HERE_KEY',
    kind: 'raster',
    // v3 path: /v3/flow/mc/{zoom}/{column}/{row}/{format}; column = x, row = y
    tileUrl: (k) => `https://traffic.maps.hereapi.com/v3/flow/mc/{z}/{x}/{y}/png?size=512&apiKey=${k}`,
    tileSize: 512,
    maxzoom: 20,
    refreshMs: 60_000,
    attribution: '© HERE',
  },
  mapbox: {
    id: 'mapbox',
    label: 'Mapbox Traffic v1',
    envKey: 'VITE_MAPBOX_TOKEN',
    kind: 'vector',
    tileUrl: (k) => `https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/{z}/{x}/{y}.vector.pbf?access_token=${k}`,
    maxzoom: 16,
    // Mapbox updates its traffic data roughly every 8 minutes.
    refreshMs: 300_000,
    attribution: '© Mapbox',
  },
  custom: {
    id: 'custom',
    label: 'Custom GeoJSON feed (your data)',
    envKey: 'VITE_CUSTOM_TRAFFIC_URL',
    kind: 'geojson',
    refreshMs: 30_000,
  },
  synthetic: {
    id: 'synthetic',
    label: 'Synthetic demo (random)',
    kind: 'synthetic',
    refreshMs: 30_000,
    attribution: '© OpenStreetMap contributors',
  },
  none: { id: 'none', label: 'None (OSM only)', kind: 'none', refreshMs: 0 },
}

export const SELECTABLE: ProviderId[] = ['tomtom', 'tomtom-incidents', 'here', 'mapbox', 'custom', 'synthetic', 'none']

export const keyFor = (p: Provider): string => (p.envKey ? (import.meta.env[p.envKey] ?? '').trim() : '')

/** Colors close to Google's palette. Vector, GeoJSON and synthetic layers all use the `congestion` property. */
export const CONGESTION_COLORS = {
  low: '#30b455',
  moderate: '#f5a623',
  heavy: '#e53935',
  severe: '#8b0000',
} as const

export type CongestionLevel = keyof typeof CONGESTION_COLORS
