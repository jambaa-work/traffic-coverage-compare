/**
 * @file        scripts/lib.mjs
 * @author      jambaa
 * @created     2026-11-18
 * @description Shared helpers for the Node scripts: CLI args, .env loading, city
 *              config lookup, tile math, key masking and a dependency-free PNG
 *              alpha-coverage decoder.
 * SPDX-License-Identifier: MIT
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Must match the dev server port in vite.config.ts and your key restrictions. */
export const ORIGIN = 'http://localhost:5190'
export const ORIGIN_HEADERS = { Origin: ORIGIN, Referer: `${ORIGIN}/` }

/** Parses `--name value` and `--flag` style arguments. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true
    else out[a.slice(2)] = argv[++i]
  }
  return out
}

/** Loads .env.local (or the given file) into process.env. Exits with a hint if it is missing. */
export function loadEnv(path = `${ROOT}.env.local`) {
  if (!existsSync(path)) {
    console.error(`✗ ${path} not found. Create it with: cp .env.example .env.local`)
    process.exit(1)
  }
  process.loadEnvFile(path)
}

export function loadCities() {
  return JSON.parse(readFileSync(`${ROOT}src/config/cities.json`, 'utf8'))
}

/** Resolves a city id (or the configured default) to its config entry. Exits on unknown ids. */
export function getCity(id) {
  const cfg = loadCities()
  const wanted = (id || process.env.VITE_DEFAULT_CITY || cfg.defaultCity).toLowerCase()
  const city = cfg.cities.find((c) => c.id === wanted)
  if (!city) {
    console.error(`✗ Unknown city "${wanted}". Known: ${cfg.cities.map((c) => c.id).join(', ')}`)
    process.exit(1)
  }
  return city
}

/** Slippy-map tile x/y for a coordinate at zoom z. */
export function tileXY(lat, lng, z) {
  const n = 2 ** z
  const r = (lat * Math.PI) / 180
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)]
}

/** Never print a full key. */
export const mask = (v) => (v.length <= 8 ? '****' : `${v.slice(0, 4)}…${v.slice(-4)}`)

/**
 * Percentage of pixels with alpha > 16 in an 8-bit PNG, without image dependencies.
 * Supports RGBA, gray+alpha, palette (with tRNS) and opaque RGB/gray.
 */
export function pngOpaquePct(buf) {
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  const depth = buf[24]
  const ctype = buf[25]
  if (depth !== 8) return `unsupported (depth ${depth}, color type ${ctype})`

  const idat = []
  let trns = null
  for (let off = 8; off < buf.length; ) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IDAT') idat.push(data)
    if (type === 'tRNS') trns = data
    off += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = { 6: 4, 2: 3, 3: 1, 4: 2, 0: 1 }[ctype] ?? 1
  const stride = w * bpp
  const px = Buffer.alloc(stride * h)

  // Undo PNG scanline filters (None, Sub, Up, Average, Paeth).
  let p = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[p++]
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0
      const b = y ? px[(y - 1) * stride + x] : 0
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0
      let v = raw[p++]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[y * stride + x] = v & 255
    }
  }

  let opaque = 0
  const n = w * h
  for (let i = 0; i < n; i++) {
    let alpha = 255
    if (ctype === 6) alpha = px[i * 4 + 3]
    else if (ctype === 4) alpha = px[i * 2 + 1]
    else if (ctype === 3) alpha = trns && px[i] < trns.length ? trns[px[i]] : 255
    if (alpha > 16) opaque++
  }
  return `${((opaque / n) * 100).toFixed(2)}%`
}
