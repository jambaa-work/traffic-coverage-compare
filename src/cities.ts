/**
 * @file        src/cities.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Typed access to the city presets in src/config/cities.json and
 *              resolution of the active city (URL ?city= > VITE_DEFAULT_CITY > config default).
 * SPDX-License-Identifier: MIT
 */
import config from './config/cities.json'
import type { View } from './sync'

export interface Preset {
  name: string
  view: View
}

export interface City {
  id: string
  name: string
  country: string
  /** Initial camera. `zoom` is a MapLibre zoom. */
  view: View
  /** Optional GeoJSON road geometry (path relative to /public) for the synthetic provider. */
  sampleRoads?: string
  presets: Preset[]
}

export const CITIES: City[] = config.cities

export function findCity(id: string | null | undefined): City | undefined {
  return id ? CITIES.find((c) => c.id === id.toLowerCase()) : undefined
}

/** Picks the city to open with. */
export function resolveInitialCity(): City {
  const fromUrl = new URLSearchParams(window.location.search).get('city')
  return findCity(fromUrl) ?? findCity(import.meta.env.VITE_DEFAULT_CITY) ?? findCity(config.defaultCity) ?? CITIES[0]
}

/** Keeps ?city= in the address bar so a view can be shared or bookmarked. */
export function rememberCity(city: City) {
  const url = new URL(window.location.href)
  url.searchParams.set('city', city.id)
  window.history.replaceState(null, '', url)
}
