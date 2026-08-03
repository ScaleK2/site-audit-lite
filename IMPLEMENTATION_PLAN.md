# Implementation Plan

Build vertical slices rather than implementing every parser before proving the pipeline.

## Phase 0 — Audit repository

- Inspect source, tests, scripts, and dependencies.
- Run current tests/commands.
- Record useful behaviour and gaps against `SPEC.md`.
- Migrate deliberately; do not remove differing code blindly.

## Phase 1 — Core analysis

- Resilient HAR ingestion and canonical records.
- Query/body decoding and unknown-request retention.
- Parser interface, registry, GA4/GTM/Ads/Floodlight.
- Inventory/tracking JSON+CSV, run manager, errors, summary.

Exit: synthetic HARs produce traceable consolidated reports.

## Phase 2 — Parsers/diagnostics

- Meta, TikTok, Pinterest, LinkedIn, Microsoft, Adobe, Hotjar.
- Registry expansion.
- Duplicate, missing-ID, email, and phone flags.
- Generic asset exclusion from tracking view.

## Phase 3 — Passive capture

- Isolated contexts and collision-safe HAR names.
- TXT/CSV list mode.
- Passive form detection and safe templates.
- Timing configuration and batch continuation.

## Phase 4 — Bounded crawl

- Rendered link discovery/canonical queue.
- Same-host and optional-subdomain controls.
- Static/destructive exclusions and expansion limits.

## Phase 5 — Interactions

- Config validation, full-URL matching, environment substitution/redaction.
- Supported actions and observation attribution.
- Two-layer submission authorisation.

## Phase 6 — UX/hardening

- Six-item menu and stable CLI.
- Multi-HAR consolidation/source copying.
- Documentation/output cross-check.

## Verification

```bash
npm install
npm run install-browser
npm test
npm start
```

Exercise every CLI mode with fixtures or harmless pages. Never submit a live form. Inspect the final diff and `git status`; do not commit or push unless explicitly asked.

## Decision rules

- Prefer traceability over clever classification.
- Prefer explicit unknowns over fabricated certainty.
- Prefer structured bounded failures over batch abortion.
- Prefer deterministic records/simple modules over premature abstraction.
- When ambiguous, choose safer non-interaction and document the assumption.
