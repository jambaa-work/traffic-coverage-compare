/**
 * @file        src/vite-env.d.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Type declarations for the VITE_* environment variables read by the app.
 * SPDX-License-Identifier: MIT
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_KEY?: string
  readonly VITE_TOMTOM_KEY?: string
  readonly VITE_HERE_KEY?: string
  readonly VITE_MAPBOX_TOKEN?: string
  readonly VITE_DEFAULT_CITY?: string
  readonly VITE_CUSTOM_TRAFFIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
