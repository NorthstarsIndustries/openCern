# Opencern

Release planning registry for **OpenCERN**. This document is the canonical copy; Confluence mirrors it under the [Opencern](https://northstarcorp.atlassian.net/wiki/spaces/E/pages/2129921/Opencern) space.

- **Features** — PRs ready for the next release (tests green, no blocking vulnerabilities).
- **Failed Features** — Valuable PRs blocked by CI or security findings.

## Changelog

| Date | Event |
| --- | --- |
| 2026-05-29 | PR #64 analyzed (Dependabot `tar` 0.4.44→0.4.46, Tauri `Cargo.lock`). |
| 2026-05-28 | PR #63 analyzed (Dependabot `protobufjs` 7.5.4→7.6.1, launcher `package-lock.json`). |
| 2026-05-28 | PR #62 analyzed (Dependabot Rust `openssl` bump, Tauri `Cargo.lock`). |
| 2026-05-28 | PR #61 analyzed (Dependabot `tmp` bump, launcher lockfile). |

---

## Features

Pull requests **good for the next OpenCERN release** that passed required tests and have **no blocking high/critical vulnerabilities** in their scope.

| PR | Title | Status |
| --- | --- | --- |
| _No open PRs meet all criteria as of 2026-05-29_ | | |

**PR #64** ([tar 0.4.44→0.4.46](https://github.com/NorthstarsIndustries/openCern/pull/64)) — fixes Rust [GHSA-3cv2-h65g-fgmm](https://github.com/advisories/GHSA-3cv2-h65g-fgmm) in `tauri-plugin-updater` archive extraction; all launcher/Rust CI pass, but `cli / test` timed out (unrelated quantum integration flake) and repo `NPM Audit` matrix still fails. Listed under **Failed Features**.

**PR #63** ([protobufjs 7.5.4→7.6.1](https://github.com/NorthstarsIndustries/openCern/pull/63)) — hardens Docker/gRPC protobuf stack via `dockerode`; launcher + e2e CI pass, but `NPM Audit (app/launcher)` still reports 13 issues (7 high). Listed under **Failed Features**.

**PR #62** ([openssl 0.10.76→0.10.80](https://github.com/NorthstarsIndustries/openCern/pull/62)) — fixes Rust crypto buffer overflow and all launcher/CLI CI jobs pass, but repo `NPM Audit` matrix still fails (pre-existing axios/xmldom/etc.). Listed under **Failed Features**.

**PR #61** ([tmp 0.2.5→0.2.7](https://github.com/NorthstarsIndustries/openCern/pull/61)) — launcher tests pass and `tmp` is clean, but `NPM Audit (app/launcher)` still fails. Listed under **Failed Features**.

### Recently merged (reference)

| PR | Title | Merged |
| --- | --- | --- |
| [#21](https://github.com/NorthstarsIndustries/openCern/pull/21) | feat: CLI release architecture and enterprise test suite | 2026-03-22 |
| [#17](https://github.com/NorthstarsIndustries/openCern/pull/17) | feat: migrate TUI to @opentui/Solid.js | 2026-03-22 |
| [#22](https://github.com/NorthstarsIndustries/openCern/pull/22) | fix: auth test timeout under fake timers | 2026-03-22 |
| [#16](https://github.com/NorthstarsIndustries/openCern/pull/16) | fix: CI for containers, workers, macOS launcher | 2026-03-21 |

---

## Failed Features

Pull requests that would help the next release but are **blocked** by failing checks or open vulnerabilities.

### PR #64 — chore(deps): bump tar from 0.4.44 to 0.4.46 in /app/launcher/src-tauri

**Status:** Failed Feature · [GitHub PR #64](https://github.com/NorthstarsIndustries/openCern/pull/64) · dependabot · branch `dependabot/cargo/app/launcher/src-tauri/tar-0.4.46` · opened 2026-05-29

#### Summary

Lockfile-only Dependabot PR. Bumps transitive Rust `tar` crate used when the Tauri desktop launcher **extracts auto-update archives** (`tauri-plugin-updater`). Span 0.4.44→0.4.46 patches [GHSA-3cv2-h65g-fgmm](https://github.com/advisories/GHSA-3cv2-h65g-fgmm) (PAX extended-header desync that could corrupt extraction). No application source changes.

#### Files changed

| File | Change |
| --- | --- |
| `app/launcher/src-tauri/Cargo.lock` | +11 / −11 lines — **only file** |

Lockfile side effects also re-resolve several `windows-sys` entries (0.61.2 → older pins on some packages); these are Cargo resolution artifacts, not direct code edits.

#### Dependency path

```
opencern-launcher (Cargo.toml: tauri-plugin-updater = "2")
  └── tauri-plugin-updater@2.10.0
        └── tar@0.4.46  (was 0.4.44)
              ├── filetime
              ├── libc
              └── xattr
```

`tar` is **not** declared in `Cargo.toml`; it is pulled only for updater bundle extraction on shipped launcher binaries.

#### Tests (CI on PR branch, 2026-05-29)

| Check | Result |
| --- | --- |
| Launcher CI (test, typecheck, build) | pass |
| PR Check `launcher/*` (test, typecheck, build) | pass |
| `launcher-e2e` | pass |
| PR Check `ui/*` (lint, test) | pass |
| PR Check `cli/*` except test | pass (lint, build, audit, typecheck, shellcheck, install-script-test) |
| **`cli / test`** | **fail** — 1/472 tests: `quantum-pipeline.test.ts` timeout (5000ms); unrelated to `tar` / launcher lockfile |
| CodeQL (JS/TS, Python) | pass |
| Trivy (containers: xrootd, streamer, quantum, data-processor) | pass |
| Bun Audit (`opencern-cli`) | pass |
| `web-ui-e2e`, Trivy `api` image | pending at triage time |

#### Security

**In PR scope (Rust):** **Security improvement** — closes GHSA-3cv2-h65g-fgmm for archive parsing in the updater path. Dependabot explicitly opened this as a security update.

**Blocking CI (npm, pre-existing):** `NPM Audit (app/launcher)`, `NPM Audit (workers/auth-system)`, `NPM Audit (workers/install)`, `NPM Audit (app/next-ui)` fail at high severity (axios, electron, vite, etc.). No `package-lock.json` changes in this PR.

#### Release value

**High-priority maintenance** for shipped launcher auto-update integrity. Low regression risk (lockfile only; launcher Rust tests and e2e green). Worth merging for the tar advisory even when npm audit gate is noisy; consider re-running `cli / test` to clear flake before merge.

#### Path to Features tab

1. Green full `Security Scan` npm audit matrix on PR branch, **or** scoped audit policy for Rust-only lockfile PRs with no new advisories.
2. Green `cli / test` (re-run if quantum-pipeline timeout is flaky on main).

---

### PR #63 — chore(deps): bump protobufjs from 7.5.4 to 7.6.1 in /app/launcher

**Status:** Failed Feature · [GitHub PR #63](https://github.com/NorthstarsIndustries/openCern/pull/63)

Lockfile-only Dependabot PR. Bumps transitive `protobufjs` (via `dockerode` → `@grpc/grpc-js`). Only file: `app/launcher/package-lock.json`. Launcher + e2e CI pass; `NPM Audit (app/launcher)` fails (13 issues, 7 high). Path: green `NPM Audit (app/launcher)` or scoped audit policy.

---

### PR #62 — chore(deps): bump openssl from 0.10.76 to 0.10.80 in /app/launcher/src-tauri

**Status:** Failed Feature · [GitHub PR #62](https://github.com/NorthstarsIndustries/openCern/pull/62)

Lockfile-only; fixes Rust `openssl` buffer overflow. Only file: `Cargo.lock`. Launcher CI pass; npm audit matrix fails (pre-existing). Path: green Security Scan npm matrix or Rust-only audit policy.

---

### PR #61 — chore(deps-dev): bump tmp from 0.2.5 to 0.2.7 in /app/launcher

**Status:** Failed Feature · [GitHub PR #61](https://github.com/NorthstarsIndustries/openCern/pull/61)

Lockfile-only dev transitive `tmp`. Only file: `package-lock.json`. Launcher tests pass; `NPM Audit (app/launcher)` still fails.

---

### PR #60 — chore(deps): bump uuid and svix in /workers/auth-system

**Status:** Failed Feature · [GitHub PR #60](https://github.com/NorthstarsIndustries/openCern/pull/60)

Lockfile-only; vitest 9/9 pass; `NPM Audit (workers/auth-system)` still fails at high severity.

---

### PR #59 — security: fix CodeQL + dep advisories (watchlist)

**Status:** Failed Feature · [PR #59](https://github.com/NorthstarsIndustries/openCern/pull/59) — high value; blocked by NPM/Bun audit matrix and build.
