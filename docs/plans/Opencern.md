# Opencern

Release planning registry for **OpenCERN**. This document is the canonical copy; Confluence child pages mirror the tab content.

| Tab | Confluence |
|-----|------------|
| [Features](#features) | [Features](https://northstarcorp.atlassian.net/wiki/spaces/E/pages/2162689) |
| [Failed Features](#failed-features) | [Failed Features](https://northstarcorp.atlassian.net/wiki/spaces/E/pages/2195457) |

**Classification rules**

- **Features**: Good for the next release; required CI green; no blocking high/critical npm audit findings in PR scope.
- **Failed Features**: Valuable for the next release but blocked by failing checks or open vulnerabilities.

**Changelog**

- 2026-05-28 — PR #63 analyzed (Dependabot `protobufjs` 7.5.4→7.6.1, launcher lockfile).
- 2026-05-28 — PR #62 analyzed (Dependabot Rust `openssl` bump, Tauri `Cargo.lock`).
- 2026-05-28 — PR #61 analyzed (Dependabot `tmp` bump, launcher lockfile).

---

## Features

Pull requests **good for the next OpenCERN release** that passed required tests and have **no blocking high/critical vulnerabilities** in their scope.

| PR | Title | Status |
|----|-------|--------|
| — | *No open PRs meet all criteria as of 2026-05-28* | — |

> **PR #63** ([protobufjs 7.5.4→7.6.1](https://github.com/NorthstarsIndustries/openCern/pull/63)) — security hardening for Docker/gRPC stack; all launcher/PR Check jobs pass, but `NPM Audit (app/launcher)` still reports 13 issues (7 high). Listed under **Failed Features**.
>
> **PR #62** ([openssl 0.10.76→0.10.80](https://github.com/NorthstarsIndustries/openCern/pull/62)) — Rust TLS fix; launcher CI green; repo npm audit matrix still fails. Listed under **Failed Features**.
>
> **PR #61** ([tmp 0.2.5→0.2.7](https://github.com/NorthstarsIndustries/openCern/pull/61)) — launcher tests pass; `NPM Audit (app/launcher)` still fails. Listed under **Failed Features**.

### Recently merged (reference)

| PR | Title | Merged |
|----|-------|--------|
| [#21](https://github.com/NorthstarsIndustries/openCern/pull/21) | feat: CLI release architecture and enterprise test suite | 2026-03-22 |
| [#17](https://github.com/NorthstarsIndustries/openCern/pull/17) | feat: migrate TUI to @opentui/Solid.js | 2026-03-22 |
| [#22](https://github.com/NorthstarsIndustries/openCern/pull/22) | fix: auth test timeout under fake timers | 2026-03-22 |
| [#16](https://github.com/NorthstarsIndustries/openCern/pull/16) | fix: CI for containers, workers, macOS launcher | 2026-03-21 |

---

## Failed Features

Pull requests that would help the next release but are **blocked** by failing checks or open vulnerabilities.

### PR #63 — chore(deps): bump protobufjs from 7.5.4 to 7.6.1 in /app/launcher

**Status:** Failed Feature · [GitHub PR #63](https://github.com/NorthstarsIndustries/openCern/pull/63) · dependabot · branch `dependabot/npm_and_yarn/app/launcher/protobufjs-7.6.1` · opened 2026-05-28

#### Summary

Lockfile-only Dependabot PR. Bumps transitive **`protobufjs`** used by the desktop launcher’s Docker integration (`dockerode` → `@grpc/grpc-js` / `@grpc/proto-loader`). Span includes **7.5.4 → 7.6.1** (also picks up intermediate 7.5.5–7.5.9 hardening). No application source changes.

**Why it matters:** `protobufjs` parses protobuf descriptors for gRPC calls to the Docker Engine API. Recent 7.x releases add parser/input hardening, bundler-safe optional lookups, BigInt conversion support (7.6.0), and misc utility fixes (7.6.1).

#### Files changed

| File | Δ | Notes |
|------|---|--------|
| `app/launcher/package-lock.json` | +89 / −26 | **Only file** |

**Not changed:** `package.json`, Rust/Tauri, workers, CLI, or UI packages.

#### Dependency paths (why protobufjs is in the launcher)

`protobufjs` is **indirect** (Dependabot: `dependency-type: indirect`). Primary consumers in `app/launcher`:

```
opencern-launcher
└── dockerode@^4.0.4
    ├── protobufjs@^7.3.2          → resolved to 7.6.1 on this branch
    ├── @grpc/grpc-js@^1.11.1
    │   └── @grpc/proto-loader → protobufjs@^7.5.3
    └── @grpc/proto-loader@^0.7.13 → protobufjs@^7.2.5
```

Declared in `package.json` as `"dockerode": "^4.0.4"` (Electron main process talks to local Docker).

**Lockfile collateral:** Also bumps several `@protobufjs/*` sub-packages (codegen 2.0.4→2.0.5, eventemitter/fetch/utf8 1.1.0→1.1.1, inquire 1.1.0→1.1.2) and adds optional `@tailwindcss/oxide-wasm32-wasi` nested bundles (resolution artifact from Tailwind 4 optional platforms, not runtime app code).

#### Version delta highlights (7.5.4 → 7.6.1)

| Version | Type | Notable changes |
|---------|------|-----------------|
| 7.5.6–7.5.8 | fix | Input/parser hardening backports |
| 7.5.9 | fix | Bundler-safe optional module lookups |
| 7.6.0 | feat | BigInt conversions (7.x) |
| 7.6.1 | fix | Misc utility hardening; fixed64 treated as unsigned in converters |

#### CI / tests (2026-05-28 run on PR branch)

| Check | Result |
|-------|--------|
| Launcher CI — test, typecheck, build | ✅ |
| PR Check — launcher/test, typecheck, build | ✅ |
| PR Check — ui/lint, test, build | ✅ |
| PR Check — cli/* (lint, test, build, audit, typecheck, coverage) | ✅ |
| launcher-e2e, web-ui-e2e | ✅ |
| CodeQL (JS/TS, Python), Trivy containers, Bun Audit (opencern-cli) | ✅ |
| **NPM Audit (app/launcher)** | ❌ 13 vulnerabilities (6 moderate, **7 high**) |
| NPM Audit (app/next-ui), workers/auth-system, workers/install | ❌ (pre-existing matrix failures) |

`protobufjs` does **not** appear in `npm audit` output for this lockfile; failures are unrelated packages.

#### Security

**In PR scope (protobufjs):** Improvement — upstream hardening and bug fixes across 7.5.5–7.6.1. No advisory reported against `protobufjs@7.6.1` in launcher audit.

**Blocking CI (npm, pre-existing):** `NPM Audit (app/launcher)` fails on e.g. `axios`, `electron`, `next`, `lodash`, `picomatch`, `tmp` (&lt;0.2.6 still flagged on main lockfile paths), `uuid` via `dockerode`, `@xmldom/xmldom`, `follow-redirects`, `ip-address`, `postcss`. Count unchanged vs main for high-severity gate (13 total on PR branch).

#### Release value

Medium-high maintenance: hardens protobuf parsing used by Docker/gRPC in the shipped Electron launcher. Low regression risk (lockfile only; launcher test + e2e green). Does not clear the repo npm audit gate alone.

#### Path to Features tab

1. Green `NPM Audit (app/launcher)` on the PR branch (resolve or override unrelated high findings), **or**
2. Scoped audit policy for transitive-only bumps with no new advisories in changed packages.

---

### PR #62 — chore(deps): bump openssl from 0.10.76 to 0.10.80 in /app/launcher/src-tauri

**Status:** Failed Feature · [GitHub PR #62](https://github.com/NorthstarsIndustries/openCern/pull/62)

Lockfile-only Dependabot PR. Bumps transitive Rust `openssl` (via `reqwest` → `native-tls`) for Tauri launcher HTTPS. Patches buffer overflow in cipher routines. **Only file:** `app/launcher/src-tauri/Cargo.lock`.

- **Tests:** Launcher CI, PR Check launcher/*, launcher-e2e, cli/*, CodeQL, Trivy — pass.
- **Security (Rust):** Improvement for launcher TLS.
- **Blocker:** NPM Audit matrix fails (axios, xmldom, vite, etc.) — no `package-lock.json` changes.

**Path to Features:** Green full Security Scan npm matrix or scoped audit for Rust-only lockfile PRs.

---

### PR #61 — chore(deps-dev): bump tmp from 0.2.5 to 0.2.7 in /app/launcher

**Status:** Failed Feature · [GitHub PR #61](https://github.com/NorthstarsIndustries/openCern/pull/61)

Lockfile-only; bumps dev transitive `tmp` (electron-builder / flatpak). **Only file:** `app/launcher/package-lock.json`.

- **Tests:** Launcher typecheck/test — pass.
- **Blocker:** `NPM Audit (app/launcher)` — 14 issues on earlier triage; `tmp` path may still conflict with audit ranges on other branches.

**Path to Features:** Clear high-severity `app/launcher` audit findings.

---

### PR #60 — chore(deps): bump uuid and svix in /workers/auth-system

**Status:** Failed Feature · [GitHub PR #60](https://github.com/NorthstarsIndustries/openCern/pull/60)

Lockfile-only: `svix` 1.85→1.94; removes transitive `uuid`. Vitest 9/9 pass. Audit improved 5→3 but still fails `NPM Audit (workers/auth-system)` (vite/picomatch/postcss via vitest).

---

### PR #59 — security: fix CodeQL + dep advisories (watchlist)

**Status:** Failed Feature · [GitHub PR #59](https://github.com/NorthstarsIndustries/openCern/pull/59)

High value; blocked by NPM/Bun audit matrix and build.
