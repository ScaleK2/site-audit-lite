# Site Audit Lite v1 Specification

## 1. Authority and scope

This is the authoritative v1 product contract. Site Audit Lite is an evidence-capture and request-classification tool—not an SEO crawler, dashboard, scoring product, or proof of downstream processing.

Out of scope: screenshots, AI APIs, scoring, GUIs, unrestricted crawling, autonomous form completion, CAPTCHA/authentication bypass, and speculative features.

## 2. Required modes

### Website capture

Inputs: starting URL, maximum URLs (default 100), optional subdomains (default false), optional wait timing. Capture the start page, discover rendered internal links, and continue until the maximum, exhausted queue, user stop, or safe limit. Stay on the starting hostname unless subdomains are enabled. Record individual failures and continue.

Discovery resolves relative links; accepts only HTTP(S); removes fragments; avoids equivalent duplicates/static assets; blocks obvious logout, delete, unsubscribe, checkout, payment, and destructive paths; and bounds query/calendar/faceted expansion. Meaningful query strings remain in evidence.

### URL-list capture

Input: TXT or CSV. Visit only supplied URLs; allow multiple domains. TXT supports blanks and `#` comments. CSV supports a `url` column/header. Invalid URLs become structured errors without aborting the batch.

### Configured interaction capture

Inputs: config JSON, either config URLs or a supplied list, and explicit submission confirmation. Validate before opening a browser, capture page-load traffic first, run only interactions matching the complete page URL, attribute subsequent requests to the interaction name, and continue safely after action failures.

Actions: `click`, `fill`, `select`, `check`, `uncheck`, `press`, `wait`.

Submission requires `submissionAllowed: true` plus final interactive confirmation or CLI `--confirm-submissions`. Treat submit controls conservatively. Never discover/submit other forms. Unresolved `${ENVIRONMENT_VARIABLE}` values are safe errors and resolved values are never logged.

### One HAR / HAR folder analysis

Analyse one `.har` or consolidate every `.har` in a folder without a browser. Default prompt path is `inputs/har/`. Never modify sources; preferably copy them into run evidence and retain original paths. Continue past malformed files where safe.

## 3. Menu and CLI

`npm start` shows the six choices in `README.md`. Stable command shapes:

```text
capture-site --url <url> [--max-urls 100] [--include-subdomains]
capture-list --urls <txt-or-csv>
capture-config --config <json> [--urls <txt-or-csv>] [--confirm-submissions]
analyse --har <file>
analyse --har-dir <folder>
```

## 4. Run/output management

Derive the primary domain from the starting hostname, first valid list URL, config domain/first URL, or first credible HAR document/navigation page. Remove `www.`, ports, and unsafe characters; lowercase it; preserve meaningful subdomains. Multi-domain runs retain actual full page URLs and hostnames on every row.

```text
output/<primary-domain>/<collision-safe-run-id>/
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

Never overwrite or scatter run evidence. HAR filenames must not collide across hosts, paths, queries, repeated visits, or similar slugs.

## 5. Capture contract

Each live URL uses an isolated Playwright Chromium context. Start network/HAR capture before navigation; wait for initial/delayed traffic; record responses; inspect rendered forms; optionally run matching interactions; save a complete HAR; close the context; continue.

`observation_context` is `page_load` before interactions and the configured name afterward. It is an observation, not proof of an implementation trigger.

## 6. HAR traceability

The analyser works independently of Playwright and tolerates manual, incomplete, or mildly inconsistent HARs. Every finding retains `source_har_file`, `har_page_reference`, and `request_index`. Derive page URLs conservatively; use `page_url_source` and uncertainty instead of fabrication.

## 7. Request inventory

Retain every HTTP(S) request. Fields where available:

```text
run_id, captured_at, primary_domain, page_url, page_url_source,
hostname, observation_context, source_har_file, har_page_reference,
request_index, request_timestamp, request_method, request_url,
request_path, response_status, mime_type, resource_type, vendor,
category, classification_method, classification_confidence, tag_id,
event_name, conversion_label, parameters, potential_issues, notes
```

JSON preserves nested data. CSV stores nested values as JSON text. Never shorten or replace original URLs.

## 8. Tracking view and classification

`tracking-events` is the identifiable analytics, advertising, conversion, tag-management, consent, replay, experimentation, customer-data, automation, affiliate, and relevant marketing-tech subset. Generic assets/APIs/infrastructure remain only in inventory.

Classification order: exact parser, known-domain registry, cautious hostname inference, unknown fallback. Methods: `recognised`, `domain_match`, `inferred_from_domain`, `unknown`. Confidence: `high`, `medium`, `low`. Never fabricate event names, IDs, or purpose.

Detailed baseline: GA4, GTM, Google Ads, CM360/Floodlight, Meta, TikTok, Pinterest, LinkedIn, Microsoft UET/Clarity, Adobe Analytics, Hotjar.

Registry baseline: Snapchat, Reddit, X/Twitter, Criteo, HubSpot, Segment, Tealium, Adobe Launch, Mixpanel, Amplitude, Sentry, FullStory, Contentsquare, Crazy Egg, Optimizely, VWO, OneTrust, Cookiebot, reCAPTCHA, common CDN/infrastructure. It is not an allowlist.

## 9. Parameters and Floodlight

Decode queries/repeated parameters, URL-encoded bodies, JSON bodies, safe multipart/simple HAR post data, malformed payloads where possible, and embedded JSON strings. Preserve complete decoded parameters while normalising `tag_id`, `event_name`, and `conversion_label`.

Floodlight also attempts advertiser/source ID, activity group/tag, inferable request/counting type, `ord`, `num`, `u1`/other custom variables, and all transmitted parameters. Observation does not prove correct CM360 configuration.

## 10. Diagnostics

Conservatively flag potential duplicates, recognised requests missing expected IDs, possible email addresses, possible phone numbers, and other obvious sensitive values. A duplicate is materially similar on the same page/context within a short window. Flag but never remove originals. Never reproduce detected sensitive values in logs/summaries.

## 11. Passive form detection

Passive modes inspect forms without interacting or recording values. Record:

```text
page_url, hostname, form_index, form_id, form_name, form_action,
form_method, form_selector, field_count, submit_controls, fields,
likely_form_type, classification_confidence, requires_manual_config, notes
```

Nested fields include element/input type, name, ID, candidate selector/certainty, placeholder, label, required, autocomplete, and select options. Inferred types: `contact`, `newsletter`, `search`, `login`, `registration`, `quote`, `application`, `checkout`, `unknown`.

Optional templates contain no real values, mark uncertainty, require review, and default to `submissionAllowed: false`.

## 12. Errors and summary

`errors.json`: timestamp, mode, page URL, source HAR, interaction, action index, category, safe message, continued status.

`run-summary.json`: run/domain/times/mode/inputs; start URL/limit; discovery, attempt, completion and failure counts; domains; request/tracking/form totals; interaction/submission counts; HARs/original sources; outputs; error count.

## 13. Acceptance tests

Synthetic tests must cover:

1. all detailed parsers, IDs/events, and Floodlight custom fields;
2. unknown retention, domain matches, low-confidence inference, and asset exclusion;
3. full page URLs and collision-safe HAR/run paths;
4. TXT/CSV parsing and invalid inputs;
5. crawl hostname/subdomain rules, normalisation, and expansion protection;
6. form detection without values and safe templates;
7. submission blocking at config and CLI layers;
8. environment substitution without leakage and full-URL interaction matching;
9. malformed/multi-HAR handling and domain derivation;
10. conservative duplicate/sensitive flags with originals retained.

Live smoke tests use harmless pages and never submit forms.

## 14. Definition of done

All modes work through the menu and documented CLI; outputs match this contract; tests and safe smoke tests pass; README matches reality; evidence is traceable; secrets do not leak; and the diff contains no live HARs, generated runs, `.env`, credentials, or personal data.
