# Coding Agent Instructions

## Mission

Implement the complete Site Audit Lite v1 defined in `SPEC.md`. Do not merely scaffold or return snippets. Inspect the repository before editing and preserve useful existing behaviour.

## Priority

1. Current explicit user instruction
2. `SPEC.md`
3. `ARCHITECTURE.md`
4. `IMPLEMENTATION_PLAN.md`
5. `README.md`

Call out conflicts and follow the higher-priority source.

## Rules

- Work only in this repository.
- Check `git status` before/after; preserve unrelated edits.
- Keep Node.js 20+, ESM, Playwright, and minimal dependencies unless repository evidence justifies change.
- Use modular parsers and a central domain registry.
- Never discard unknown HTTP(S) requests.
- Never log secrets or complete sensitive values.
- Never submit a live form during development/testing.
- Do not commit, push, open a PR, or delete user work without explicit approval.
- Keep README commands aligned with implementation.

## Workflow

1. Inspect structure, scripts, source, fixtures, and tests.
2. Run existing tests and report baseline failures.
3. Summarise current behaviour/gaps against `SPEC.md`.
4. Plan concise vertical slices.
5. Implement with small synthetic fixtures—never real-world HARs.
6. Run full tests and harmless smoke tests.
7. Verify menu and every CLI mode.
8. Inspect final diff and remaining limitations.

## Completion report

Report implementation, important files, install/run commands, test results, assumptions/limitations, `git status`, and any incomplete requirement with its exact blocker.
