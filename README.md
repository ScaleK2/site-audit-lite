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

Commands print durable line-based progress to stderr, including each URL/HAR,
recoverable failures, report generation, and final succeeded/failed counts. Use
`--quiet` or its alias `--no-progress` to suppress routine progress while still
printing errors and the final run directory. Crawl progress reports observed,
discovered, and queued pages without inventing an unknown final total.

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

The three primary analyst-facing CSVs are:

- `forms-detected.csv`: one structural form signature per row, with readable
  field names, IDs, labels, placeholders, types, required fields, and all pages
  observed. Complete per-page observations remain in `forms-detected.json`.
- `tracking-events.csv`: aggregated meaningful network, runtime `dataLayer`, or
  conservatively correlated events. It excludes libraries, configuration,
  identity support, diagnostics, enrichment, and ordinary assets.
- `technology-inventory.csv`: one vendor/product/typed-identifier row with
  observed activity, hostnames, party, request/page counts, and safe evidence.

`request-inventory.json` remains the exhaustive forensic evidence. The CSV of
the same name is a safe compatibility projection, not the primary technology
report. `event-inventory.json` retains request-level interpreted network event
evidence; its CSV is the detailed compatibility view.

Live capture HARs use readable deterministic names based on sequence, hostname,
sanitised path, and a short canonical-URL hash. Query values never appear in
the readable name. A same-stem `.datalayer.json` companion stores bounded,
redacted runtime evidence without modifying the HAR.

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

## Progressive analyst reports
All interactive and direct CLI modes share the same classifier, HAR ingestion, attribution, and report writer. Runs produce CSV and JSON for `executive-summary`, `technology-inventory`, `page-technology-matrix`, `event-inventory`, `domain-inventory`, `consent-diagnostics`, `unknown-technologies`, and safe `request-evidence`. `tracking-events.csv` is the simplified, aggregated analyst view; `event-inventory.json` preserves request-level interpreted network events. Both exclude libraries, configuration, diagnostics, enrichment, identity support, and assets. Full forensic URLs and parameters remain only in controlled JSON evidence; default reports use safe paths and HAR entry references without query values, bodies, cookies, credentials, client IDs, or session IDs.

GA4 requires a supported collection path, `v=2`, a valid `G-*` measurement ID, and either a Google Analytics host or corroborating GA4 parameters for a first-party endpoint. `/collect` alone is insufficient. Google `UA-*`, `GT-*`, `GTM-*`, `AW-*`, and `DC-*` identifiers remain distinct. Meta library/configuration/beacon evidence, Adobe products, and TikTok events versus diagnostics/enrichment are reported separately.

Live capture records requested/final URLs and outcomes in `capture-manifest.json`; attribution uses manifest, HAR page/pageref, a primary top-level navigation document, reliable page parameter, referer, then unavailable. Single-HAR analysis discovers an unambiguous adjacent manifest. Consent parameters such as `gcd`, `dma`, and `npa` indicate signalling only: default/update states are not verified, accept/reject are not tested, and compliance is not assessed. CSV/JSON are used instead of XLSX to avoid a new workbook dependency.

Runtime correlation requires the same captured page, the same normalised event
name, and timestamps within five seconds. Page co-occurrence alone is never
enough. Ambiguous evidence remains separate. Instrumentation has explicit
depth, item-count, and payload limits, redacts sensitive keys, and cannot make a
HAR capture fail. Legacy HARs remain supported and record companion evidence as
unavailable once in the run summary.
