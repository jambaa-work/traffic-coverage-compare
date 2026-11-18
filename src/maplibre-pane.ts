/**
 * @file        src/maplibre-pane.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description One OSM/MapLibre pane with a selectable traffic provider overlay.
 *              Handles periodic refresh, tile ok/error counters and the coverage
 *              badge (pixel coverage for raster, feature counts for line layers).
 * SPDX-License-Identifier: MIT
 */
import {
  Map as MlMap,
  type GeoJSONSource,
  type RasterTileSource,
  type StyleSpecification,
  type VectorTileSource,
  type ExpressionSpecification,
} from 'maplibre-gl'
import { createBadge, hhmmss, showNotice, statRows, type Badge, type BadgeState } from './badge'
import type { City } from './cities'
import { CONGESTION_COLORS, keyFor, PROVIDERS, SELECTABLE, type ProviderId } from './providers'
import { probeRaster } from './probe'
import { loadRoads, synthesizeCongestion } from './synthetic'
import { sameView, type Syncable, type View } from './sync'

const SRC = 'traffic'
const LAYER = 'traffic'

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.9 } }],
}

const congestionColor: ExpressionSpecification = [
  'match',
  ['get', 'congestion'],
  'low', CONGESTION_COLORS.low,
  'moderate', CONGESTION_COLORS.moderate,
  'heavy', CONGESTION_COLORS.heavy,
  'severe', CONGESTION_COLORS.severe,
  '#888888',
]

/** Appends a timestamp so the browser and CDN return fresh tiles on refresh. */
const withBuster = (url: string) => `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`

const MUTED = (text: string) => `<span class="muted">${text}</span>`

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

export class TrafficPane implements Syncable {
  readonly map: MlMap
  private badge: Badge
  private notice: HTMLElement | null = null
  private provider: ProviderId = 'none'
  /** Incremented on every provider switch so stale async work can detect it was superseded. */
  private generation = 0
  private timer: number | undefined
  private probeTimer: number | undefined
  private lastSet: View | null = null
  private ok = 0
  private err = 0
  private lastRefresh: Date | null = null
  private coverage = MUTED('measuring…')
  private covState: BadgeState = 'idle'

  constructor(
    private root: HTMLElement,
    initial: ProviderId,
    private city: City,
    opts: { selectable: boolean },
  ) {
    const mapEl = document.createElement('div')
    mapEl.className = 'map'
    root.append(mapEl)
    this.map = new MlMap({
      container: mapEl,
      style: OSM_STYLE,
      center: [city.view.lng, city.view.lat],
      zoom: city.view.zoom,
      attributionControl: { compact: true },
    })
    this.badge = createBadge(root, PROVIDERS[initial].label)
    if (opts.selectable) this.addSelect(initial)

    this.map.on('data', (e) => {
      if ('sourceId' in e && e.sourceId === SRC && 'tile' in e && e.tile) this.ok++
    })
    this.map.on('error', (e) => {
      if ('sourceId' in e && e.sourceId === SRC) this.err++
      this.render()
    })
    this.map.on('idle', () => this.scheduleProbe())
    this.map.once('load', () => this.setProvider(initial))
  }

  setView(v: View) {
    this.lastSet = v
    this.map.jumpTo({ center: [v.lng, v.lat], zoom: v.zoom })
  }

  onMove(cb: (v: View) => void) {
    this.map.on('move', () => {
      const c = this.map.getCenter()
      const v = { lng: c.lng, lat: c.lat, zoom: this.map.getZoom() }
      if (sameView(this.lastSet, v)) return
      cb(v)
    })
  }

  setGray(gray: boolean) {
    if (this.map.getLayer('osm')) this.map.setPaintProperty('osm', 'raster-saturation', gray ? -0.9 : 0)
  }

  /** Switches city. Only the synthetic provider depends on the city, so only it is reloaded. */
  setCity(city: City) {
    this.city = city
    if (PROVIDERS[this.provider].kind === 'synthetic' && this.map.loaded()) this.setProvider(this.provider)
  }

  setProvider(id: ProviderId) {
    const p = PROVIDERS[id]
    const gen = ++this.generation
    this.provider = id
    window.clearInterval(this.timer)
    this.notice?.remove()
    this.notice = null
    if (this.map.getLayer(LAYER)) this.map.removeLayer(LAYER)
    if (this.map.getSource(SRC)) this.map.removeSource(SRC)
    this.ok = this.err = 0
    this.coverage = MUTED('measuring…')
    this.covState = 'idle'
    this.lastRefresh = null
    const sel = this.root.querySelector('select')
    if (!sel) this.badge.titleEl.textContent = p.label

    const key = keyFor(p)
    if (p.envKey && !key) return this.fail(`${p.envKey} is not set (.env.local)`)

    const refreshed = () => {
      this.lastRefresh = new Date()
      this.render()
    }

    if (p.kind === 'raster') {
      this.map.addSource(SRC, {
        type: 'raster',
        tiles: [p.tileUrl!(key)],
        tileSize: p.tileSize ?? 256,
        maxzoom: p.maxzoom,
        attribution: p.attribution,
      })
      this.map.addLayer({ id: LAYER, type: 'raster', source: SRC, paint: { 'raster-fade-duration': 0 } })
      this.timer = window.setInterval(() => {
        ;(this.map.getSource(SRC) as RasterTileSource | undefined)?.setTiles([withBuster(p.tileUrl!(key))])
        refreshed()
      }, p.refreshMs)
    } else if (p.kind === 'vector') {
      this.map.addSource(SRC, { type: 'vector', tiles: [p.tileUrl!(key)], maxzoom: p.maxzoom, attribution: p.attribution })
      this.map.addLayer(this.lineLayer('traffic'))
      this.timer = window.setInterval(() => {
        ;(this.map.getSource(SRC) as VectorTileSource | undefined)?.setTiles([withBuster(p.tileUrl!(key))])
        refreshed()
      }, p.refreshMs)
    } else if (p.kind === 'geojson') {
      // `key` is the feed URL. MapLibre fetches it; failures surface as source errors.
      this.map.addSource(SRC, { type: 'geojson', data: key, attribution: p.attribution })
      this.map.addLayer(this.lineLayer())
      this.timer = window.setInterval(() => {
        ;(this.map.getSource(SRC) as GeoJSONSource | undefined)?.setData(withBuster(key))
        refreshed()
        this.scheduleProbe()
      }, p.refreshMs)
    } else if (p.kind === 'synthetic') {
      void this.startSynthetic(gen)
      return
    } else {
      this.coverage = MUTED('no overlay')
    }
    refreshed()
  }

  private async startSynthetic(gen: number) {
    const p = PROVIDERS.synthetic
    const path = this.city.sampleRoads
    if (!path) return this.fail(`No sampleRoads configured for ${this.city.name}. Run: npm run fetch-roads -- --city ${this.city.id}`)
    try {
      const roads = await loadRoads(path)
      if (gen !== this.generation) return
      this.map.addSource(SRC, { type: 'geojson', data: synthesizeCongestion(roads), attribution: p.attribution })
      this.map.addLayer(this.lineLayer())
      this.timer = window.setInterval(() => {
        ;(this.map.getSource(SRC) as GeoJSONSource | undefined)?.setData(synthesizeCongestion(roads))
        this.lastRefresh = new Date()
        this.scheduleProbe()
      }, p.refreshMs)
      this.lastRefresh = new Date()
      this.render()
    } catch (e) {
      if (gen === this.generation) this.fail(`Could not load ${path}: ${(e as Error).message}`)
    }
  }

  private fail(message: string) {
    this.notice = showNotice(this.root, message)
    this.coverage = MUTED('not configured')
    this.covState = 'idle'
    this.render()
  }

  private lineLayer(sourceLayer?: string) {
    return {
      id: LAYER,
      type: 'line' as const,
      source: SRC,
      ...(sourceLayer ? { 'source-layer': sourceLayer } : {}),
      layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
      paint: {
        'line-color': congestionColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 13, 2.5, 16, 5] as ExpressionSpecification,
      },
    }
  }

  private scheduleProbe() {
    window.clearTimeout(this.probeTimer)
    this.probeTimer = window.setTimeout(() => void this.probe(), 400)
  }

  private async probe() {
    const p = PROVIDERS[this.provider]
    const key = keyFor(p)
    if (p.kind === 'raster' && key) {
      const c = this.map.getCenter()
      const gen = this.generation
      const r = await probeRaster(p.tileUrl!(key), c.lng, c.lat, this.map.getZoom())
      if (gen !== this.generation) return
      this.covState = r.pct === 0 ? 'bad' : r.pct < 0.5 ? 'warn' : 'good'
      const meta = `${r.tiles} tiles${r.failed ? ` · ${r.failed} failed` : ''}`
      this.coverage = `<strong class="${this.covState}">${r.pct.toFixed(2)}%</strong> <span class="muted">${meta}</span>`
    } else if (p.kind !== 'raster' && p.kind !== 'none' && this.map.getLayer(LAYER)) {
      const feats = this.map.queryRenderedFeatures({ layers: [LAYER] })
      const by: Record<string, number> = {}
      for (const f of feats) {
        const k = String(f.properties?.congestion ?? '?')
        by[k] = (by[k] ?? 0) + 1
      }
      this.covState = feats.length === 0 ? 'bad' : 'good'
      const chips = Object.entries(by)
        .map(([k, n]) => {
          const color = CONGESTION_COLORS[k as keyof typeof CONGESTION_COLORS] ?? '#888888'
          return `<span class="chip" title="${escapeHtml(k)}"><i style="background:${color}"></i>${n}</span>`
        })
        .join('')
      this.coverage = `<strong class="${this.covState}">${feats.length}</strong> <span class="muted">features</span>${chips ? `<span class="chips">${chips}</span>` : ''}`
    }
    this.render()
  }

  private render() {
    const errors = this.err ? `<span class="bad">${this.err} errors</span>` : `<span class="muted">0 errors</span>`
    const rows: [string, string][] = [
      ['Coverage', this.coverage],
      ['Tiles', `${this.ok} ok · ${errors}`],
    ]
    if (this.lastRefresh) rows.push(['Updated', hhmmss(this.lastRefresh)])
    this.badge.setStats(statRows(rows))
    this.badge.setState(this.err && this.ok === 0 ? 'bad' : this.covState)
  }

  private addSelect(initial: ProviderId) {
    const sel = document.createElement('select')
    sel.setAttribute('aria-label', 'Traffic provider')
    for (const id of SELECTABLE) {
      const o = document.createElement('option')
      o.value = id
      o.textContent = PROVIDERS[id].label
      o.selected = id === initial
      sel.append(o)
    }
    sel.addEventListener('change', () => this.setProvider(sel.value as ProviderId))
    this.badge.titleEl.textContent = ''
    this.badge.titleEl.append(sel)
  }
}
