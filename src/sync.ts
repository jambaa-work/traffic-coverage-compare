/**
 * @file        src/sync.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Camera model shared by all panes and the logic that keeps every
 *              map at the same center and zoom.
 * SPDX-License-Identifier: MIT
 */

/** Camera state. `zoom` is a MapLibre zoom (512px world). Google zoom = zoom + 1. */
export interface View {
  lng: number
  lat: number
  zoom: number
}

export interface Syncable {
  setView(v: View): void
  onMove(cb: (v: View) => void): void
}

const EPS_DEG = 1e-7
const EPS_ZOOM = 1e-3

export const sameView = (a: View | null, b: View) =>
  !!a && Math.abs(a.lng - b.lng) < EPS_DEG && Math.abs(a.lat - b.lat) < EPS_DEG && Math.abs(a.zoom - b.zoom) < EPS_ZOOM

/**
 * Moving any map moves all the others.
 * Each pane ignores move events that match the view it was last given (sameView),
 * so programmatic moves do not echo back and cause a feedback loop.
 */
export function linkViews(items: Syncable[]) {
  for (const src of items) {
    src.onMove((v) => {
      for (const dst of items) if (dst !== src) dst.setView(v)
    })
  }
}
