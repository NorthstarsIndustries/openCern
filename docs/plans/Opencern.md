# Opencern — Release planning

Registry for **OpenCERN** pull requests evaluated for the next app release.

| Tab | Meaning |
|-----|---------|
| [Features](#features) | Ready to ship: tests green, no blocking high/critical vulnerabilities in PR scope |
| [Failed Features](#failed-features) | Valuable for release but blocked by CI or security gates |

**Last updated:** 2026-05-28  
**Confluence:** [Opencern](https://northstarcorp.atlassian.net/wiki/spaces/E/pages/2129921/Opencern) (child pages: Features, Failed Features)

---

## Features

Pull requests **good for the next OpenCERN release** that passed required tests and have **no blocking high/critical vulnerabilities** in their scope (per `npm audit --audit-level=high` on affected workspaces).

### Open PRs (ready for merge)

| PR | Title | Status |
|----|-------|--------|
| — | *No open PRs meet all criteria as of 2026-05-28* | — |

### Recently merged (reference)

| PR | Title | Merged |
|----|-------|--------|
| [#21](https://github.com/NorthstarsIndustries/openCern/pull/21) | feat: CLI release architecture and enterprise test suite | 2026-03-22 |
| [#17](https://github.com/NorthstarsIndustries/openCern/pull/17) | feat: migrate TUI to @opentui/Solid.js | 2026-03-22 |
| [#22](https://github.com/NorthstarsIndustries/openCern/pull/22) | fix: auth test timeout under fake timers | 2026-03-22 |
| [#16](https://github.com/NorthstarsIndustries/openCern/pull/16) | fix: CI for containers, workers, macOS launcher | 2026-03-21 |

---

## Failed Features

Pull requests that would help the next release but are **blocked** by failing checks or open high/critical vulnerabilities.

### PR #61 — chore(deps-dev): bump tmp from 0.2.5 to 0.2.7 in /app/launcher

**Status:** Failed Feature · [GitHub PR #61](https://github.com/NorthstarsIndustries/openCern/pull/61) · dependabot · branch `dependabot/npm_and_yarn/app/launcher/tmp-0.2.7` · opened 2026-05-28

#### What changed

| File | Change |
|------|--------|
| `app/launcher/package-lock.json` | +67 / −3 lines (only file in PR) |

**Direct dependency bump:** `tmp` **0.2.5 → 0.2.7** (`dev: true`, MIT).

**Transitive chain:** `tmp` ← `tmp-promise` ← `@malept/flatpak-bundler` (electron-builder / Flatpak packaging, dev-only).

**Lockfile noise:** npm also materialized nested optional bundles under `@tailwindcss/oxide-wasm32-wasi` (`@emnapi/*`, `@napi-rs/wasm-runtime`, `tslib`). These are lockfile resolution artifacts, not application code changes.

**No changes to:** `package.json`, Electron/Next source, workers, CLI, or runtime dependencies.

#### Why Dependabot opened it

- Bumps [node-tmp](https://github.com/raszi/node-tmp) for hardening commits (reject non-string `prefix`/`postfix`/`template`, stricter relative-path checks).
- `tmp` is **not** listed in current `npm audit` output on this branch (no active advisory for 0.2.7).
- Historical **CVE-2025-54798** (symlink `dir` bypass, GHSA-52f5-9888-hmc6) is fixed in ≥0.2.4; 0.2.5 was already patched — this PR is incremental maintenance, not a critical unblock by itself.

#### CI / tests (2026-05-28)

| Check | Result |
|-------|--------|
| Launcher CI — typecheck | ✅ SUCCESS |
| Launcher CI — test | ✅ SUCCESS |
| Launcher CI — build | ⏳ in progress at analysis time |
| PR Check — launcher typecheck / test / build | ⏳ in progress |
| Changelog Check | ✅ SUCCESS |
| CodeQL (JS/TS, Python) | ✅ SUCCESS |
| Bun Audit (opencern-cli) | ✅ SUCCESS |
| NPM Audit (app/launcher) | ❌ **FAILURE** |
| NPM Audit (workers/auth-system) | ❌ FAILURE (repo-wide, not introduced by PR) |
| NPM Audit (workers/install) | ❌ FAILURE (repo-wide, not introduced by PR) |

`app/launcher` has **no `npm test` script**; launcher tests run via dedicated CI workflow (vitest/jest in launcher CI — passed).

#### Security (`app/launcher`, local `npm audit`)

**14 vulnerabilities** (7 moderate, 6 high, 1 critical) at `--audit-level=high` gate — **unchanged blocking set** vs main:

| Package | Severity | Notes |
|---------|----------|--------|
| `@xmldom/xmldom` | high | XML injection / DoS (transitive) |
| `axios` | high | SSRF / auth bypass advisories (transitive) |
| `uuid` | critical | buffer bounds (via `dockerode`) |
| `@protobufjs/utf8` | moderate | UTF-8 decoding |
| *(others)* | moderate/high | see full `npm audit` |

**PR-specific win:** `tmp` advisory cleared from tree; **does not** clear `NPM Audit (app/launcher)` workflow.

#### Release value

- **Low–medium:** dev-toolchain hygiene for Electron builder; no user-facing feature.
- Safe to merge from a **functional** perspective (launcher tests green).
- **Not** eligible for Features tab until `app/launcher` passes high-severity audit (likely needs coordinated bumps: `dockerode`/`uuid`, `axios`, `@xmldom/xmldom`, or PR #59-style security batch).

#### Path to Features tab

1. Clear high/critical findings in `app/launcher` lockfile (pair with [#59](https://github.com/NorthstarsIndustries/openCern/pull/59) or targeted overrides).
2. Confirm `NPM Audit (app/launcher)` green on PR branch.
3. Re-run full Security Scan + Launcher CI.

---

### PR #60 — chore(deps): bump uuid and svix in /workers/auth-system

**Status:** Failed Feature · [GitHub PR #60](https://github.com/NorthstarsIndustries/openCern/pull/60) · dependabot · branch `dependabot/npm_and_yarn/workers/auth-system/multi-123741231c`

#### Summary

Lockfile-only: `svix` 1.85.0 → 1.94.0; removes transitive `uuid`. No application source changes.

#### Files changed

- `workers/auth-system/package-lock.json` (+4 / −18)

#### Tests

- workers/auth-system vitest: 9/9 passed (local)
- PR Check (cli, launcher): success

#### Security

npm audit improved 5 → 3 on auth-system. Still fails `NPM Audit (workers/auth-system)` (vite/picomatch/postcss via vitest). Repo-wide: app/launcher, workers/install audits also fail.

#### Path to Features tab

Resolve high-severity dev transitive in `workers/auth-system` and re-run Security Scan.

---

### PR #59 — security: fix CodeQL + dep advisories (watchlist)

**Status:** Failed Feature · [PR #59](https://github.com/NorthstarsIndustries/openCern/pull/59) — high value; blocked by NPM/Bun audit matrix and build.

---

## Evaluation criteria

1. **Scope:** What ships (launcher, CLI, workers, containers).
2. **Tests:** Required workflows for touched areas must pass.
3. **Security:** `npm audit --audit-level=high` per workspace in [security-scan.yml](https://github.com/NorthstarsIndustries/openCern/blob/main/.github/workflows/security-scan.yml).
4. **Release fit:** User-facing feature vs maintenance — maintenance can ship in patch releases once gates pass.
