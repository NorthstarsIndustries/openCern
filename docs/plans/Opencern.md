# Opencern Release Plan

Central registry for pull requests evaluated against the next OpenCERN app release. Each entry is classified by **release fit**, **CI/test health**, and **security posture** (npm/bun audit at `--audit-level=high`, CodeQL, Trivy where applicable).

**Last updated:** 2026-05-25  
**Base branch:** `main`  
**Maintained on branch:** `cursor/opencern-features-categorization-f414`

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

**Review cadence:** Re-run when a PR is opened, updated, or when `Security Scan` / `PR Check` workflows complete.

---

## Features

Pull requests that are **good for the next release** and currently **pass tests with no blocking vulnerabilities** in their scope.

| PR | Title | Author | Release value | CI / tests | Security |
|----|-------|--------|---------------|------------|----------|
| — | *No open PRs meet all criteria as of 2026-05-25* | — | — | — | — |

### Reference: recently merged (met bar at merge time)

These are not queued for the next release but illustrate the bar for **Features**:

| PR | Title | Merged | Notes |
|----|-------|--------|-------|
| [#21](https://github.com/NorthstarsIndustries/openCern/pull/21) | feat: CLI release architecture and enterprise test suite | 2026-03-22 | Major release capability; full PR Check green at merge. |
| [#17](https://github.com/NorthstarsIndustries/openCern/pull/17) | feat: migrate TUI from Ink/React to @opentui/Solid.js | 2026-03-22 | User-facing TUI stack migration. |
| [#22](https://github.com/NorthstarsIndustries/openCern/pull/22) | fix: resolve auth test timeout under fake timers | 2026-03-22 | Auth worker reliability. |
| [#16](https://github.com/NorthstarsIndustries/openCern/pull/16) | fix: CI for containers, workers, and macOS launcher | 2026-03-21 | Pipeline stability for release trains. |

---

## Failed Features

Pull requests that **would help the next release** but have **problems** (failed checks, vulnerabilities, or incomplete verification).

### PR #60 — `chore(deps): bump uuid and svix in /workers/auth-system`

| Field | Detail |
|-------|--------|
| **URL** | https://github.com/NorthstarsIndustries/openCern/pull/60 |
| **Branch** | `dependabot/npm_and_yarn/workers/auth-system/multi-123741231c` → `main` |
| **Author** | dependabot[bot] |
| **Type** | Dependency maintenance (auth worker) |
| **Verdict** | **Failed Feature** — improves auth-system dependency tree but **does not pass** repo `NPM Audit (workers/auth-system)` at `--audit-level=high`. |

#### What changed (deep diff)

| Item | Detail |
|------|--------|
| **Files touched** | 1 — `workers/auth-system/package-lock.json` only |
| **Lines** | +4 / −18 (lockfile-only) |
| **Runtime code** | None — no changes to `src/index.ts`, `wrangler.toml`, or tests |
| **Direct dependency** | `svix` **1.85.0 → 1.94.0** (Clerk webhook verification library) |
| **Removed transitive** | `uuid@10.0.0` — dropped from tree because svix ≥1.92.2 no longer depends on `uuid` (see [svix v1.92.2 release notes](https://github.com/svix/svix-webhooks/releases/tag/v1.92.2)) |
| **package.json** | Unchanged (`"svix": "^1.85.0"` range still satisfied by 1.94.0) |

#### Functional impact

- **Worker role:** Cloudflare Worker at `workers/auth-system` verifies Clerk webhooks via `svix` `Webhook.verify()` and forwards `email.created` events through Resend for desktop OTP delivery.
- **Risk surface:** Patch-level SDK bump across nine svix minor versions (1.85 → 1.94). No API changes in project code; behavior should remain signature-verification compatible.
- **Release value:** Reduces transitive dependency count and removes `uuid` from the auth worker lockfile; aligns with upstream security hygiene.

#### Test results

| Suite | Result | Notes |
|-------|--------|-------|
| `workers/auth-system` — `npm test` (vitest) | **9/9 passed** | Verified locally on PR commit `c99a47b` |
| PR Check — `cli/*`, `launcher/*` | **Success** | Unaffected by lockfile scope |
| PR Check — `ui/*` | In progress at triage time | Not modified by this PR |
| Changelog Check | **Success** | Dependabot chore exempt |

#### Security / vulnerability analysis

| Scope | `main` (before) | PR #60 branch (after) |
|-------|-----------------|------------------------|
| **npm audit (high+)** | 5 issues (incl. `uuid` via `svix`) | **3 issues** (improvement) |
| **Removed** | `uuid` transitive | — |
| **Remaining (dev/transitive)** | — | `vite@7.3.1` (high, via vitest), `picomatch@4.0.3` (high), `postcss` (moderate) |

**CI failures (blocking Features tab):**

1. `NPM Audit (workers/auth-system)` — **FAILURE** (`npm audit --audit-level=high`)
2. `NPM Audit (app/launcher)` — **FAILURE** (repo-wide; not introduced by this PR’s diff)
3. `NPM Audit (workers/install)` — **FAILURE** (repo-wide; not introduced by this PR’s diff)

**Path to Features tab:** Bump or override dev toolchain (`vitest` / `vite`) in `workers/auth-system` so `npm audit --audit-level=high` is clean, or adjust audit policy for dev-only transitive deps. Re-run full `Security Scan` on the PR branch.

#### Recommendation

- **Merge priority:** Medium — net security improvement for auth worker despite audit gate.
- **Do not** treat as a user-facing “feature” in release notes; classify under **Maintenance / Security**.
- **Pair with:** PR [#59](https://github.com/NorthstarsIndustries/openCern/pull/59) (broader security fixes) or a focused vitest/vite lockfile refresh in `workers/auth-system`.

---

### PR #59 — `security: fix 22 CodeQL findings + 3 critical dep advisories` (watchlist)

| Field | Detail |
|-------|--------|
| **URL** | https://github.com/NorthstarsIndustries/openCern/pull/59 |
| **Verdict** | **Failed Feature** — high release value, multiple failing checks (`NPM Audit` matrix, `Bun Audit`, `build`). |
| **Note** | Intended to clear security debt; promote to **Features** when audit and build jobs are green. |

---

## Automation log

| Date | Trigger | Action |
|------|---------|--------|
| 2026-05-25 | PR #60 opened | Deep analysis; PR #60 added to **Failed Features**; plan created. |
