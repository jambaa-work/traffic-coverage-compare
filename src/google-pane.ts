/**
 * @file        src/google-pane.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Reference pane: Google Maps with its TrafficLayer. Google's terms only
 *              allow its traffic data on a Google map, so it is shown separately as the
 *              baseline the OSM panes are compared against.
 * SPDX-License-Identifier: MIT
 */
import { createBadge, hhmmss, showNotice, statRows, type Badge } from './badge'
import { sameView, type Syncable, type View } from './sync'

/* eslint-disable @typescript-eslint/no-explicit-any -- keeps @types/google.maps out of the dependencies */
declare global {
  interface Window {
    google?: any
    __mtcGoogleReady?: () => void
    gm_authFailure?: () => void
  }
}

/** Google zoom (256px world) = MapLibre zoom (512px world) + 1 */
const toGoogleZoom = (z: number) => z + 1
const fromGoogleZoom = (z: number) => z - 1

function loadGoogle(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    window.__mtcGoogleReady = () => resolve()
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__mtcGoogleReady`
    s.async = true
    s.onerror = () => reject(new Error('Failed to load the Maps JavaScript API'))
    document.head.append(s)
  })
}

export class GooglePane implements Syncable {
  private map: any
  private lastSet: View | null = null
  private moveCbs: ((v: View) => void)[] = []
  private pending: View

  constructor(private root: HTMLElement, view: View) {
    this.pending = view
    const badge = createBadge(root, 'Google + TrafficLayer (reference)')
    const key = (import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '').trim()
    if (!key) {
      showNotice(root, 'VITE_GOOGLE_MAPS_KEY is not set (.env.local)')
      badge.setStats(statRows([['Status', '<span class="muted">not configured</span>']]))
      return
    }
    window.gm_authFailure = () => {
      badge.setState('bad')
      badge.setStats(statRows([['Status', '<span class="bad">Invalid key or referrer/API restriction (see console)</span>']]))
    }
    void this.init(key, badge)
  }

  private async init(key: string, badge: Badge) {
    try {
      await loadGoogle(key)
      const { Map } = await window.google.maps.importLibrary('maps')
      const mapEl = document.createElement('div')
      mapEl.className = 'map'
      this.root.prepend(mapEl)
      const v = this.pending
      this.map = new Map(mapEl, {
        center: { lat: v.lat, lng: v.lng },
        zoom: toGoogleZoom(v.zoom),
        // Fractional zoom needs a vector map; raster maps render zooms like 12.5 at the wrong scale.
        // DEMO_MAP_ID is Google's public test vector map id.
        mapId: 'DEMO_MAP_ID',
        renderingType: 'VECTOR',
        isFractionalZoomEnabled: true,
        gestureHandling: 'greedy',
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      })
      new window.google.maps.TrafficLayer().setMap(this.map)
      this.map.addListener('bounds_changed', () => {
        const c = this.map.getCenter()
        const nv = { lng: c.lng(), lat: c.lat(), zoom: fromGoogleZoom(this.map.getZoom()) }
        if (sameView(this.lastSet, nv)) return
        for (const cb of this.moveCbs) cb(nv)
      })
      badge.setState('good')
      badge.setStats(statRows([['Loaded', hhmmss()], ['Refresh', '<span class="muted">managed by Google</span>']]))
    } catch (e) {
      badge.setState('bad')
      badge.setStats(statRows([['Status', `<span class="bad">${(e as Error).message}</span>`]]))
    }
  }

  setView(v: View) {
    this.pending = v
    if (!this.map) return
    this.lastSet = v
    this.map.moveCamera({ center: { lat: v.lat, lng: v.lng }, zoom: toGoogleZoom(v.zoom) })
  }

  onMove(cb: (v: View) => void) {
    this.moveCbs.push(cb)
  }
}
