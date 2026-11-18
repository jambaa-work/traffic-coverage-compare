/**
 * @file        vite.config.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Vite dev server config. The fixed port must match the referrer/domain
 *              restrictions you set on your API keys (see docs/api-keys.md).
 * SPDX-License-Identifier: MIT
 */
import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5190, strictPort: true, open: true },
})
