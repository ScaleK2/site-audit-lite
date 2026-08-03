# Site Audit Lite v1 Checklist

`SPEC.md` remains authoritative.

## Baseline

- [ ] Inspect/test repository and reconcile scripts/docs
- [ ] Ensure `.gitignore` excludes `.env`, output, HARs, and secrets

## Analysis

- [ ] Canonical HAR/page context and parameter decoding
- [ ] Exhaustive inventory and tracking subset
- [ ] Modular parsers and central registry
- [ ] Unknown inference with confidence
- [ ] Duplicate/missing-ID/email/phone diagnostics
- [ ] Consolidated multi-HAR analysis

## Capture

- [ ] Isolated context per URL and collision-safe HAR names
- [ ] TXT/CSV list capture
- [ ] Bounded same-host crawler with optional subdomains
- [ ] Passive forms without values and safe templates

## Interactions

- [ ] Config validation and complete-URL matching
- [ ] All seven supported actions
- [ ] Redacted environment substitution
- [ ] Observation attribution
- [ ] Config and run-level submission authorisation

## UX/output

- [ ] Domain/run manager; CSV/JSON; errors; summary
- [ ] Six-item menu and stable CLI
- [ ] README matches reality

## Verification

- [ ] Synthetic acceptance tests pass
- [ ] Harmless smoke test; no submissions
- [ ] Every mode exercised
- [ ] Final diff and `git status` reviewed
