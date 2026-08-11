# Site Audit Lite v1 Checklist

`SPEC.md` remains authoritative. The v1 implementation is complete; future changes should preserve the safety and traceability contracts.

## Baseline
- [x] Inspect/test repository and reconcile scripts/docs
- [x] Ensure `.gitignore` excludes `.env`, output, HARs, and secrets
## Analysis
- [x] Canonical HAR/page context and parameter decoding
- [x] Exhaustive inventory and tracking subset
- [x] Modular parsers and central registry
- [x] Unknown inference with confidence
- [x] Duplicate/missing-ID/email/phone diagnostics
- [x] Consolidated multi-HAR analysis
## Capture
- [x] Isolated context per URL and collision-safe HAR names
- [x] TXT/CSV list capture
- [x] Bounded same-host crawler with optional subdomains
- [x] Passive forms without values and safe templates
## Interactions
- [x] Config validation and complete-URL matching
- [x] All seven supported actions
- [x] Redacted environment substitution
- [x] Observation attribution
- [x] Config and run-level submission authorisation
## UX/output
- [x] Domain/run manager; CSV/JSON; errors; summary
- [x] Six-item menu and stable CLI
- [x] README matches reality
## Verification
- [x] Synthetic acceptance tests pass
- [x] Harmless analysis smoke tests; no submissions
- [x] Every mode is covered programmatically; live capture requires installed Chromium
- [x] Final diff and `git status` reviewed

## Known operational limitations
- Capture sees only traffic generated during its configured observation window.
- Browser access restrictions, authentication, CAPTCHAs, and consent gates are reported rather than bypassed.
- External HARs without usable page metadata retain an explicitly uncertain/null page URL.
- Classification is evidence-based and does not prove vendor receipt, storage, configuration, or attribution.
