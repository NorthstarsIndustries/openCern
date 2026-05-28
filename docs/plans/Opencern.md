# Opencern Release Plan

Central registry for pull requests evaluated against the next OpenCERN app release. Each entry is classified by **release fit**, **CI/test health**, and **security posture** (npm/bun audit at `--audit-level=high`, CodeQL, Trivy, Rust crypto deps where applicable).

**Last updated:** 2026-05-28  
**Base branch:** `main`  
**Maintained on branch:** `cursor/opencern-feature-planning-324b`

**Confluence (EDA space):**

- [Opencern](https://northstarcorp.atlassian.net/wiki/spaces/E/pages/2129921/Opencern) (parent)
- [Features](https://northstarcorp.atlassian.net/wiki/spaces/E/pages/2162689/Features) (tab)
- [Failed Features](https://northstarcorp.atlassian.net/wiki/spaces/E/pages/2195457/Failed+Features) (tab)

---

## How to use this plan

| Tab | Meaning |
|-----|---------|
| [Features](#features) | Ready for the next release: meaningful improvement, all required checks green, no known high/critical dependency vulnerabilities in affected packages. |
| [Failed Features](#failed-features) | Worth shipping but blocked: failing checks, open high-severity advisories, incomplete CI, or cross-cutting audit failures on the PR branch. |

**Review cadence:** Re-run when a PR is opened, updated, or when `Security Scan` / `PR Check` / `Launcher CI` workflows complete.

---

## Features

Pull requests that are **good for the next release** and currently **pass tests with no blocking vulnerabilities** in their scope.

| PR | Title | Author | Release value | CI / tests | Security |
|----|-------|--------|---------------|------------|----------|
| — | *No open PRs meet all criteria as of 2026-05-28* | — | — | — | — |

### Reference: recently merged (met bar at merge time)

| PR | Title | Merged | Notes |
|----|-------|--------|-------|
| [#21](https://github.com/NorthstarsIndustries/openCern/pull/21) | feat: CLI release architecture and enterprise test suite | 2026-03-22 | Major release capability; full PR Check green at merge. |
| [#17](https://github.com/NorthstarsIndustries/openCern/pull/17) | feat: migrate TUI from Ink/React to @opentui/Solid.js | 2026-03-22 | User-facing TUI stack migration. |
| [#22](https://github.com/NorthstarsIndustries/openCern/pull/22) | fix: resolve auth test timeout under fake timers | 2026-03-22 | Auth worker reliability. |
| [#16](https://github.com/NorthstarsIndustries/openCern/pull/16) | fix: CI for containers, workers, and macOS launcher | 2026-03-21 | Pipeline stability for release trains. |

---

## Failed Features

Pull requests that **would help the next release** but have **problems** (failed checks, vulnerabilities, or incomplete verification).

### PR #62 — `chore(deps): bump openssl from 0.10.76 to 0.10.80 in /app/launcher/src-tauri`

| Field | Detail |
|-------|--------|
| **URL** | https://github.com/NorthstarsIndustries/openCern/pull/62 |
| **Branch** | `dependabot/cargo/app/launcher/src-tauri/openssl-0.10.80` → `main` |
| **Author** | dependabot[bot] |
| **Commit** | `1cc188ac7635a698784eaf9f5141ca16c14b87f0` |
| **Opened** | 2026-05-28 |
| **Type** | Rust dependency maintenance (Tauri launcher native TLS stack) |
| **Verdict** | **Failed Feature** — **fixes Rust `openssl` security bugs** and all launcher/CLI tests pass, but **repo `NPM Audit` matrix still fails** at `--audit-level=high` (pre-existing; not introduced by this diff). |

#### What changed (deep diff)

| Item | Detail |
|------|--------|
| **Files touched** | **1** — `app/launcher/src-tauri/Cargo.lock` only |
| **Lines** | +4 / −5 (lockfile-only) |
| **Runtime / app source** | None — no edits to `Cargo.toml`, `src/`, or `app/launcher/package.json` |
| **Direct dependency bump** | `openssl` **0.10.76 → 0.10.80** |
| **Transitive bump** | `openssl-sys` **0.9.112 → 0.9.116** |
| **Lockfile cleanup** | Removes `once_cell` from `openssl` dependency list (upstream now uses `std::sync::LazyLock` / `OnceLock` since 0.10.79) |

#### Dependency graph (why this crate matters)

`openssl` is **not** declared in `app/launcher/src-tauri/Cargo.toml`. It enters the tree as a **transitive** dependency:

```
opencern-launcher
  └── reqwest (features: json) — HTTP client for updates/API
        └── hyper / hyper-tls
              └── native-tls
                    └── openssl + openssl-sys  ← bumped by this PR
```

The Tauri desktop launcher uses `reqwest` for HTTPS (e.g. update checks, remote calls). On Linux/macOS builds, `native-tls` binds to system/OpenSSL via `rust-openssl`, so this bump affects **TLS and crypto** in the shipped launcher binary.

#### Upstream security fixes (release value)

Per [rust-openssl 0.10.80 release notes](https://github.com/rust-openssl/rust-openssl/releases/tag/openssl-v0.10.80):

| Fix | Impact |
|-----|--------|
| **Buffer overflow in `cipher_update_inplace`** for AES key-wrap-with-padding | Memory-safety fix in crypto path — primary reason to merge |
| Prefer Homebrew `openssl@4`; stop probing `openssl@1.1` | Build/link reliability on macOS dev/CI |
| `openssl-sys` 0.9.116 | FFI layer aligned with `openssl` 0.10.80 |

Intermediate versions (0.10.77–0.10.79) also include EC/group UB fixes, SSL callback abort fixes, and OpenSSL 4 prep — this PR jumps 0.10.76 → 0.10.80 in one step.

#### Test results (CI triage 2026-05-28)

| Suite | Result | Notes |
|-------|--------|-------|
| **Launcher CI** — `test` | **Pass** | Vitest/unit workflow for launcher package |
| **Launcher CI** — `typecheck` | **Pass** | |
| **Launcher CI** — `build` | **Pass** | Tauri/Rust build on CI (~1m14s) |
| **PR Check** — `launcher / test` | **Pass** | |
| **PR Check** — `launcher / typecheck` | **Pass** | |
| **PR Check** — `launcher / build` | **Pass** | |
| **PR Check** — `launcher-e2e` | **Pass** | |
| **PR Check** — `cli/*` (lint, test, build, audit, typecheck, …) | **Pass** | Unaffected by Cargo.lock scope |
| **CodeQL** (js/ts, python) | **Pass** | |
| **Trivy** (xrootd, streamer, quantum, data-processor) | **Pass** | Container scans not modified by lockfile |
| **Bun Audit (opencern-cli)** | **Pass** | |
| **Changelog Check** | **Pass** | Dependabot chore |

**Still running / pending at triage:** `ui/*`, `web-ui-e2e`, `NPM Audit (app/next-ui)`, `Trivy` (api) — not blocked on Rust lockfile.

#### Security / vulnerability analysis

| Layer | PR #62 effect |
|-------|----------------|
| **Rust `openssl` (in scope)** | **Improvement** — patches known `rust-openssl` issues including buffer overflow in cipher update path |
| **npm `app/launcher` (CI gate)** | **FAIL** — high/critical advisories remain (`axios`, `@xmldom/xmldom`, `uuid` via `dockerode`, etc.); **unchanged by this PR** (no `package-lock.json` diff) |
| **npm `workers/auth-system`** | **FAIL** — pre-existing vitest/vite transitive highs |
| **npm `workers/install`** | **FAIL** — pre-existing |
| **npm `app/next-ui`** | **FAIL** — pre-existing |

**CI failures (blocking Features tab):**

1. `NPM Audit (app/launcher)` — **FAILURE**
2. `NPM Audit (workers/auth-system)` — **FAILURE**
3. `NPM Audit (workers/install)` — **FAILURE**
4. `NPM Audit (app/next-ui)` — **FAILURE**

**Path to Features tab:** Either (a) clear high-severity npm audit findings repo-wide / in `app/launcher`, or (b) adopt a scoped audit policy so Rust-only lockfile PRs are gated on `cargo`/launcher build + relevant scans, not unrelated npm trees. Re-run full `Security Scan` green on PR branch.

#### Recommendation

- **Merge priority:** **High for security** — low risk lockfile-only change with real Rust crypto fixes; safe to merge despite npm audit noise if policy allows.
- **Release notes:** **Maintenance / Security** (Tauri launcher TLS stack), not a user-facing feature.
- **Do not confuse** with npm `openssl` package — this is the **Rust** `openssl` crate used by `native-tls`.

---

### PR #61 — `chore(deps-dev): bump tmp from 0.2.5 to 0.2.7 in /app/launcher`

| Field | Detail |
|-------|--------|
| **URL** | https://github.com/NorthstarsIndustries/openCern/pull/61 |
| **Branch** | `dependabot/npm_and_yarn/app/launcher/tmp-0.2.7` → `main` |
| **Verdict** | **Failed Feature** — launcher tests pass; `tmp@0.2.7` clean; **`NPM Audit (app/launcher)` still fails** (14 high/critical-class issues). |

#### What changed

| Item | Detail |
|------|--------|
| **Files** | `app/launcher/package-lock.json` only (+67 / −3) |
| **Bump** | dev transitive `tmp` 0.2.5 → 0.2.7 (`tmp-promise` → `@malept/flatpak-bundler` → electron-builder) |
| **Artifact** | Lockfile entries for `@tailwindcss/oxide-wasm32-wasi` optional bundles (resolution only) |

#### Tests

Launcher CI typecheck/test **pass**; Changelog/CodeQL **pass**.

#### Security

`tmp@0.2.7` not in audit report. PR does **not** fix `NPM Audit (app/launcher)` (axios, xmldom, uuid/dockerode, etc.).

**Path to Features:** Green `NPM Audit (app/launcher)` on PR branch.

---

### PR #60 — `chore(deps): bump uuid and svix in /workers/auth-system`

| Field | Detail |
|-------|--------|
| **URL** | https://github.com/NorthstarsIndustries/openCern/pull/60 |
| **Verdict** | **Failed Feature** — `svix` 1.85→1.94, removes `uuid` transitive; vitest **9/9 pass**; **`NPM Audit (workers/auth-system)` fails** (vite/picomatch via vitest). |

#### What changed

`workers/auth-system/package-lock.json` only (+4 / −18). No application source changes.

#### Security

npm audit improved 5 → 3 issues; still fails high gate.

**Path to Features:** Resolve high-severity audit in `workers/auth-system`.

---

### PR #59 — `security: fix CodeQL + dep advisories` (watchlist)

| Field | Detail |
|-------|--------|
| **URL** | https://github.com/NorthstarsIndustries/openCern/pull/59 |
| **Verdict** | **Failed Feature** — high value; blocked by NPM/Bun audit matrix and build. Promote when audit/build green. |

---

## Automation log

| Date | Trigger | Action |
|------|---------|--------|
| 2026-05-25 | PR #60 opened | Deep analysis; PR #60 → **Failed Features**; plan created. |
| 2026-05-28 | PR #61 opened | PR #61 → **Failed Features**; Confluence tabs updated. |
| 2026-05-28 | PR #62 opened | Deep analysis; PR #62 → **Failed Features**; Confluence + `docs/plans/Opencern.md` updated. |
