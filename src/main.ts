/**
 * @file        src/main.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description App entry point. Builds the 2x2 grid (Google reference + three OSM
 *              panes), links their cameras, and wires the toolbar: city picker,
 *              location presets, grayscale toggle and clock.
 * SPDX-License-Identifier: MIT
 */
import './style.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { hhmmss } from './badge'
import { CITIES, findCity, rememberCity, resolveInitialCity, type City } from './cities'
import { GooglePane } from './google-pane'
import { TrafficPane } from './maplibre-pane'
import { linkViews, type View } from './sync'

setWorkerUrl(maplibreWorkerUrl)

const $ = (id: string) => document.getElementById(id)!

let city = resolveInitialCity()
rememberCity(city)

const google = new GooglePane($('pane-google'), city.view)
const tr = new TrafficPane($('pane-tr'), 'tomtom', city, { selectable: true })
const bl = new TrafficPane($('pane-bl'), 'here', city, { selectable: true })
const br = new TrafficPane($('pane-br'), 'mapbox', city, { selectable: true })
const osmPanes = [tr, bl, br]
const panes = [google, ...osmPanes]
linkViews(panes)
if (import.meta.env.DEV) Object.assign(window, { __panes: { google, tr, bl, br } })

const goTo = (v: View) => panes.forEach((p) => p.setView(v))

function renderPresets(c: City) {
  const presets = $('presets')
  presets.replaceChildren()
  for (const p of c.presets) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = p.name
    b.onclick = () => goTo(p.view)
    presets.append(b)
  }
}

const citySelect = $('city') as HTMLSelectElement
for (const c of CITIES) citySelect.append(new Option(`${c.name} (${c.country})`, c.id, false, c.id === city.id))
citySelect.addEventListener('change', () => {
  const next = findCity(citySelect.value)
  if (!next) return
  city = next
  rememberCity(city)
  renderPresets(city)
  osmPanes.forEach((p) => p.setCity(city))
  goTo(city.view)
})
renderPresets(city)

$('gray').addEventListener('change', (e) => {
  const gray = (e.target as HTMLInputElement).checked
  for (const p of osmPanes) p.setGray(gray)
})

const clock = $('clock')
const tick = () => (clock.textContent = `Now ${hhmmss()}`)
tick()
window.setInterval(tick, 1000)
