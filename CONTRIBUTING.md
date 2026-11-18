<!--
  @file        CONTRIBUTING.md
  @author      jambaa
  @created     2026-11-18
  @description How to contribute: setup, coding conventions, adding cities, providers and findings.
-->
# Contributing

Thanks for helping. Useful contributions include:

- **Findings for your city:** add `docs/findings/<city>-<yyyy-mm-dd>.md` (see [methodology](docs/methodology.md)).
- **New cities:** add an entry to `src/config/cities.json`. You can also add sample roads with `npm run fetch-roads`.
- **New providers:** see below.
- Bug fixes and documentation improvements.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Before you open a pull request, run `npm run build`. It type-checks and builds. CI runs the same command.

## Conventions

- Code, comments, UI text and docs are in English.
- Every source file starts with a header block:

  ```ts
  /**
   * @file        src/example.ts
   * @author      your-name
   * @created     YYYY-MM-DD
   * @description What this file is for, in one or two sentences.
   * SPDX-License-Identifier: MIT
   */
  ```

  Use `#` comments in shell, YAML and env files, and `<!-- -->` in HTML and Markdown.
- Never commit keys, `.env.local` or `dist/`. Scripts must mask keys in their output (`mask()` in `scripts/lib.mjs`).
- Keep dependencies minimal. The project deliberately has only `maplibre-gl` at runtime.

## Adding a provider

1. Add an id to `ProviderId` and an entry to `PROVIDERS` in `src/providers.ts`:
   - `kind: 'raster'` for PNG tiles. Coverage is measured automatically from pixel alpha.
   - `kind: 'vector'` for MVT tiles. The layer is styled by the `congestion` property in the `traffic` source layer.
     If your provider uses other names, extend `lineLayer()` in `src/maplibre-pane.ts`.
   - `tileUrl` returns a `{z}/{x}/{y}` template. Put the key in the query string.
2. Add the id to `SELECTABLE`.
3. If it needs a key, add the variable to `KeyEnv` (`src/providers.ts`), `src/vite-env.d.ts` and `.env.example`,
   and add a section to `docs/api-keys.md`.
4. Add a check to `scripts/check-keys.mjs` and, if useful, to `scripts/control-test.mjs`.
5. Add a row to the providers table in `README.md`.
