---
title: 'Fix @kayman/shared exports & add Raycast dev script'
slug: 'fix-shared-exports-raycast-dev-script'
created: '2026-04-10'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['pnpm workspaces', 'turbo', 'tsup', 'esbuild', 'raycast']
files_to_modify:
  - 'packages/shared/package.json'
  - 'packages/shared/tsup.config.ts'
  - 'package.json'
code_patterns:
  - 'tsup defineConfig pattern in packages/shared/tsup.config.ts'
  - 'turbo scripts in root package.json (build/dev/test/lint/typecheck)'
  - 'pnpm --filter <name> for package-scoped script execution'
test_patterns:
  - 'no tests needed — pure config changes'
---

# Tech-Spec: Fix @kayman/shared exports & add Raycast dev script

**Created:** 2026-04-10

## Overview

### Problem Statement

`pnpm build` fails because `ray build` (Raycast's esbuild-based bundler) cannot resolve `@kayman/shared`. The shared package only exports a `require` (CJS) condition with no `default` or `import` fallback. esbuild, when bundling Raycast extensions, looks for `import` or `default` export conditions — finds neither — and fails with "Could not resolve '@kayman/shared'". Additionally, there is no convenient root-level script to build everything and enter Raycast dev mode for live testing.

### Solution

1. Add ESM output to `@kayman/shared` (tsup outputs both CJS `.js` and ESM `.mjs`)
2. Update `packages/shared/package.json` exports to include `import` and `default` conditions
3. Add a root-level `dev:raycast` script: builds shared first (via turbo filter), then runs `ray develop` in the raycast package

### Scope

**In Scope:**
- Fix `@kayman/shared/package.json` exports map
- Add ESM format to shared's tsup config
- Add `dev:raycast` script to root `package.json`

**Out of Scope:**
- CLI dev workflow changes
- Raycast extension submission/deployment
- Changes to other packages

## Context for Development

### Codebase Patterns

- Monorepo: pnpm workspaces + turbo
- `shared` uses tsup for bundling, currently CJS only (`format: ['cjs']`)
- `raycast` uses `ray build` / `ray develop` (Raycast CLI, available at `node_modules/.bin/ray`)
- Turbo `build` task: `dependsOn: ["^build"]` — builds dependencies first automatically
- Symlink: `packages/raycast/node_modules/@kayman/shared → ../../../shared`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/shared/tsup.config.ts` | Build config for shared — add `esm` format here |
| `packages/shared/package.json` | Exports map — add `import` and `default` conditions |
| `package.json` (root) | Add `dev:raycast` script here |
| `turbo.json` | Build task graph — no changes needed |

### Technical Decisions

- Output ESM as `.mjs` extension (tsup default for dual CJS/ESM) to avoid ambiguity
- Add both `import` (for bundlers like esbuild) and `default` (universal fallback) conditions
- `dev:raycast` script uses `turbo build --filter=@kayman/shared` then `pnpm --filter kayman dev` so shared is always fresh before Raycast dev mode starts

## Implementation Plan

### Tasks

- [x] Task 1: Add ESM format to shared tsup config
  - File: `packages/shared/tsup.config.ts`
  - Action: Change `format: ['cjs']` to `format: ['cjs', 'esm']`
  - Notes: tsup will auto-output `dist/index.js` (CJS) and `dist/index.mjs` (ESM). No other changes needed — `dts: true` already handles types.

- [x] Task 2: Update shared package.json exports map
  - File: `packages/shared/package.json`
  - Action: Replace the `exports` block and add `module` field:
    ```json
    "main": "./dist/index.js",
    "module": "./dist/index.mjs",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.mjs",
        "require": "./dist/index.js",
        "default": "./dist/index.js"
      }
    }
    ```
  - Notes: `types` must be first so TypeScript picks it up before runtime conditions. `default` is the universal fallback for bundlers that match no other condition.

- [x] Task 3: Add `dev:raycast` script to root package.json
  - File: `package.json` (root)
  - Action: Add to `scripts`:
    ```json
    "dev:raycast": "turbo build --filter=@kayman/shared && pnpm --filter kayman dev"
    ```
  - Notes: Ensures shared is always freshly built before Raycast dev mode. Turbo will use cache if sources unchanged, so it's fast on subsequent runs.

### Acceptance Criteria

- [x] AC 1: Given a clean repo (no shared dist), when `pnpm build` runs from root, then all 3 packages succeed with no "Could not resolve '@kayman/shared'" errors
- [x] AC 2: Given `pnpm --filter @kayman/shared build` runs, when complete, then both `packages/shared/dist/index.js` and `packages/shared/dist/index.mjs` exist
- [x] AC 3: Given repo root, when `pnpm dev:raycast` runs, then shared builds first and `ray develop` launches the Raycast extension dev session
- [x] AC 4: Given shared is already built (cached), when `pnpm dev:raycast` runs again, then turbo skips the shared build (cache hit) and jumps directly to `ray develop`

## Additional Context

### Dependencies

- No new package dependencies — `tsup` already supports ESM natively

### Testing Strategy

- Manual: run `rm -rf packages/shared/dist && pnpm build` from root — confirm all 3 tasks green
- Manual: confirm `packages/shared/dist/index.mjs` exists after build
- Manual: run `pnpm dev:raycast` — confirm Raycast dev session opens

### Notes

- `ray` binary is at `node_modules/.bin/ray` — not in global PATH but pnpm scripts resolve it correctly
- Turbo caches shared build; `dev:raycast` is fast on re-runs unless `packages/shared/src` changes
- The `kayman` filter in `pnpm --filter kayman dev` matches the raycast package by its `name: "kayman"` field in `packages/raycast/package.json`

## Review Notes
- Adversarial review completed
- Findings: 11 total, 6 fixed (F1, F2, F3-verified, F7, F8, F9-verified), 5 skipped (F4, F5, F6-noise, F10, F11)
- Resolution approach: auto-fix
