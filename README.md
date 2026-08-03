# Site Audit Lite

Site Audit Lite is a local Node.js tool for capturing and analysing browser network activity across websites. It replaces the repetitive part of opening DevTools, visiting pages, exporting HAR files, and manually identifying tracking requests.

It produces an exhaustive inventory of every observed HTTP(S) request and a cleaner tracking-events report for identifiable marketing technology. Raw HAR files remain the evidence. Unknown requests are preserved.

> Status: v1 implementation target. `SPEC.md` is the authoritative product contract. Inspect and test existing code before assuming any described feature is complete.

## What it can establish

It can report the complete observed page URL; request URL, method, time, and response status; observation context; transmitted identifiers, events, labels, and parameters; and the source HAR/entry.

It cannot prove platform acceptance, downstream storage or attribution, GTM trigger definitions, GA4 key-event configuration, or correct CM360 setup. Domain-inferred vendors are marked as inferred.

## Installation

Requires Node.js 20+, npm, and Playwright Chromium.

```bash
npm install
npm run install-browser
```

## Interactive use

```bash
npm start
```

The menu must expose:

1. Capture and analyse a website
2. Capture and analyse a supplied URL list
3. Capture using a form/interaction config
4. Analyse one existing HAR file
5. Analyse all HAR files in a folder
6. Exit

## CLI use

```bash
node src/cli.js capture-site --url https://example.com --max-urls 100
node src/cli.js capture-site --url https://example.com --max-urls 100 --include-subdomains
node src/cli.js capture-list --urls inputs/urls.txt
node src/cli.js capture-config --config configs/example-site.example.json
node src/cli.js capture-config --urls inputs/urls.txt --config configs/example-site.example.json
node src/cli.js capture-config --config configs/example-site.example.json --confirm-submissions
node src/cli.js analyse --har inputs/har/capture.har
node src/cli.js analyse --har-dir inputs/har
```

The implemented syntax and documentation must remain identical.

## Passive-first form workflow

Normal capture modes detect and document forms but never fill, click, or submit them.

1. Run a passive site or URL-list capture.
2. Review `forms-detected.csv` or `.json`.
3. Inspect the chosen form manually.
4. Create or refine `configs/<primary-domain>.json`.
5. Run configured-interaction mode.
6. Explicitly confirm any authorised submission.

Generated templates contain no real values and default to `submissionAllowed: false`.

## URL-list formats

TXT uses one HTTP(S) URL per line and ignores blanks and `#` comments. CSV uses a documented `url` column. Only supplied URLs are visited in list mode.

## Output

The primary folder is derived from the starting hostname, first valid list URL, config domain, or first usable HAR navigation page. Leading `www.` and ports are removed; meaningful subdomains remain.

```text
output/
  example.com/
    2026-08-03_14-30-22-abc123/
      har/
      form-config-templates/
      request-inventory.csv
      request-inventory.json
      tracking-events.csv
      tracking-events.json
      forms-detected.csv
      forms-detected.json
      errors.json
      run-summary.json
```

Every run has a collision-safe ID. Its evidence stays together and earlier runs are never overwritten.

## Parser baseline

V1 includes GA4, GTM, Google Ads, CM360/Floodlight, Meta Pixel, TikTok Pixel, Pinterest Tag, LinkedIn Insight Tag, Microsoft Ads/UET, Microsoft Clarity, Adobe Analytics, and Hotjar. A central domain registry provides broader best-effort classification but is never an allowlist.

## Safety

- Passive modes never interact with forms.
- Submit-capable interactions require `submissionAllowed: true`.
- Interactive runs require final confirmation; CLI runs also require `--confirm-submissions`.
- Missing environment variables fail safely and resolved values are never logged.
- Authentication, CAPTCHAs, consent controls, and access restrictions are not bypassed.
- Do not commit `.env`, personal data, production form values, HAR evidence, or generated output.

## Project documents

- `SPEC.md` — authoritative v1 requirements and acceptance criteria
- `ARCHITECTURE.md` — component boundaries and data flow
- `IMPLEMENTATION_PLAN.md` — recommended build sequence
- `AGENTS.md` — instructions for Codex and coding agents
- `TODO.md` — implementation checklist

See `SPEC.md` for field definitions, diagnostics, crawling constraints, tests, limitations, and definition of done.

## Options and operational behaviour

Capture timing can be adjusted with `--wait-ms <milliseconds>`. Website discovery is bounded by `--max-urls`; list mode never discovers additional URLs. A failure for one URL, interaction, or HAR is recorded in `errors.json` while safe batch work continues.

Configured interactions match the complete post-navigation page URL. Environment placeholders use `${VARIABLE_NAME}` syntax. Resolve them in the process environment; missing names become safe validation errors and resolved values are not printed. A submit-capable click or Enter press is blocked unless both the matching interaction has `submissionAllowed: true` and the command includes `--confirm-submissions`.

## Testing

```bash
npm test
```

Tests use only small synthetic inputs. Browser installation may require access to Playwright's download CDN. Analysis modes do not require an installed browser.

## Limitations

The reports describe observed evidence, not downstream acceptance or correctness. Capture cannot bypass authentication, CAPTCHA, consent, or browser/network restrictions. External HARs with no credible navigation/page metadata report page attribution as unavailable rather than inventing it. The tracking view intentionally excludes generic assets and infrastructure, while the complete inventory retains them.
