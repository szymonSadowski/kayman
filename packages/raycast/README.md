# @kayman/raycast

Raycast extension for kayman. Invokes the `kayman` CLI via `execa`.

## Local Development

The extension shells out to the global `kayman` binary, so the CLI must be linked first.

```sh
# 1. Install workspace deps from repo root
pnpm install

# 2. Link the CLI globally (so `kayman` is on PATH)
cd packages/cli
pnpm link --global

# 3. Run the Raycast extension in dev mode
cd ../raycast
pnpm dev   # runs `ray develop`
```

Open Raycast and search for `kayman` — all 6 commands (`Start Recording`, `Stop Recording`, `Last Meeting`, `Record Memo`, `Recording Status`, `Recording Indicator`) should appear.

If commands fail with `kayman CLI not found in PATH`, re-run `pnpm link --global` from `packages/cli`.

## Architecture

- All command logic invokes the CLI via `runKayman()` from `src/lib/cli.ts` (never `child_process` directly — see FR27).
- `.npmrc` sets `node-linker=hoisted` because Raycast's bundler does not follow pnpm's symlinked layout.
- Real command logic lands in Story 4.3+; this scaffold only wires the helper.
