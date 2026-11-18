/**
 * @file        src/probe.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Objective coverage measurement for raster traffic tiles: downloads the
 *              3x3 tiles around the view center and counts non-transparent pixels.
 *              0% means the provider has no traffic data for that area.
 * SPDX-License-Identifier: MIT
 */
export interface ProbeResult {
  /** Share of non-transparent pixels, 0-100. */
  pct: number
  tiles: number
  failed: number
}

const tileXY = (lng: number, lat: number, z: number) => {
  const n = 2 ** z
  const r = (lat * Math.PI) / 180
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  }
}

/** Alpha above this value counts as "painted". Filters out anti-aliasing noise. */
const ALPHA_THRESHOLD = 16

export async function probeRaster(template: string, lng: number, lat: number, zoom: number): Promise<ProbeResult> {
  const z = Math.max(0, Math.floor(zoom))
  const c = tileXY(lng, lat, z)
  const urls: string[] = []
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      urls.push(template.replace('{z}', String(z)).replace('{x}', String(c.x + dx)).replace('{y}', String(c.y + dy)))

  let opaque = 0
  let total = 0
  let failed = 0
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u)
        if (!res.ok) throw new Error(String(res.status))
        const bmp = await createImageBitmap(await res.blob())
        const canvas = new OffscreenCanvas(bmp.width, bmp.height)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(bmp, 0, 0)
        const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height)
        for (let i = 3; i < data.length; i += 4) if (data[i] > ALPHA_THRESHOLD) opaque++
        total += bmp.width * bmp.height
      } catch {
        failed++
      }
    }),
  )
  return { pct: total ? (opaque / total) * 100 : 0, tiles: urls.length - failed, failed }
}
