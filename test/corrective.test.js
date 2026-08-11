import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { aggregateForms, buildReports } from "../src/output/reports.js";
import { CSV_SCHEMAS, writeCsv, writeReports } from "../src/output/write.js";
import { formSignature, formTemplate } from "../src/capture/forms.js";
import { companionPath, safeSerialize } from "../src/capture/datalayer.js";
import { uniqueHarPath, createRun } from "../src/output/run.js";
import { registrableDomain, partyFor } from "../src/utils/domains.js";
import { ingestHar } from "../src/har/ingest.js";
import { classify } from "../src/classification/classify.js";
import { decodeParameters } from "../src/har/parameters.js";
import { diagnose } from "../src/diagnostics/index.js";
import { ProgressReporter } from "../src/progress.js";
import { parseArgs } from "../src/cli.js";

function field(overrides = {}) {
  return {
    element: "input", input_type: "text", name: "message", id: "message",
    label: "Message", placeholder: "How can we help?", required: true,
    candidate_selector: "#message", ...overrides,
  };
}

function form(page, overrides = {}) {
  const base = {
    page_url: page, hostname: new URL(page).hostname, form_index: 0,
    form_id: "contact", form_name: "contact", form_action: "https://example.test/contact",
    form_method: "POST", submit_controls: ["button[type=submit]"], fields: [field()],
    likely_form_type: "contact", classification_confidence: "medium",
  };
  return { ...base, form_signature: formSignature({ ...base, ...overrides }), ...overrides };
}

function request(url, overrides = {}) {
  const parsed = new URL(url);
  return classify({
    request_url: url, request_path: parsed.pathname, hostname: parsed.hostname,
    parameters: decodeParameters({ url }), primary_domain: "example.test",
    source_har_file: "capture.har", request_index: 0,
    page_url: "https://example.test/final", page_url_source: "capture_manifest",
    request_timestamp: "2026-01-01T00:00:01.000Z", potential_issues: [],
    ...overrides,
  });
}

test("stable form signatures ignore page URL and form index", () => {
  assert.equal(form("https://example.test/a").form_signature, form("https://example.test/b", { form_index: 9 }).form_signature);
});

test("sitewide forms aggregate across pages", () => {
  const result = aggregateForms([form("https://example.test/a"), form("https://example.test/b")]);
  assert.equal(result.csv.length, 1);
  assert.equal(result.csv[0].page_count, 2);
  assert.equal(result.json[0].observations.length, 2);
});

test("structurally different forms remain separate", () => {
  const result = aggregateForms([form("https://example.test/a"), form("https://example.test/a", { fields: [field({ name: "email", input_type: "email" })] })]);
  assert.equal(result.csv.length, 2);
});

test("form CSV exposes readable field attributes", () => {
  const row = aggregateForms([form("https://example.test/a")]).csv[0];
  assert.equal(row.field_names, "message");
  assert.equal(row.field_labels, "Message");
  assert.equal(row.required_fields, "message");
  assert.ok(!row.field_names.startsWith("["));
});

test("form JSON preserves complete observations", () => {
  const row = aggregateForms([form("https://example.test/a")]).json[0];
  assert.equal(row.observations[0].fields[0].placeholder, "How can we help?");
});

test("form templates contain blank values and disable submissions", () => {
  const template = formTemplate(form("https://example.test/a"));
  assert.equal(template.submissionAllowed, false);
  assert.equal(template.actions[0].value, "");
});

test("meaningful network events appear in simplified tracking output", () => {
  const reports = buildReports({ runId: "run" }, [request("https://www.google-analytics.com/g/collect?v=2&tid=G-X&cid=x&en=purchase")]);
  assert.equal(reports.tracking[0].event_source, "network");
  assert.equal(reports.tracking[0].event_name, "purchase");
});

test("configuration and identity-support requests are excluded from tracking CSV", () => {
  const reports = buildReports({ runId: "run" }, [
    request("https://connect.facebook.net/signals/config/123"),
    request("https://www.google.com/pagead/id"),
  ]);
  assert.equal(reports.tracking.length, 0);
});

test("duplicate tracking events aggregate", () => {
  const one = request("https://www.google-analytics.com/g/collect?v=2&tid=G-X&cid=x&en=view_item");
  const reports = buildReports({ runId: "run" }, [one, { ...one, request_index: 1 }]);
  assert.equal(reports.tracking[0].occurrence_count, 2);
});

test("dataLayer-only events remain browser evidence", () => {
  const reports = buildReports({ runId: "run" }, [], [], [], [{
    capture_id: "capture", final_page_url: "https://example.test/final",
    records: [{ event_name: "signup", timestamp: "2026-01-01T00:00:00.000Z" }],
  }]);
  assert.equal(reports.tracking[0].event_source, "dataLayer");
});

test("strong dataLayer and network evidence correlates", () => {
  const network = request("https://www.google-analytics.com/g/collect?v=2&tid=G-X&cid=x&en=purchase");
  const reports = buildReports({ runId: "run" }, [network], [], [], [{
    capture_id: "capture", final_page_url: network.page_url,
    records: [{ event_name: "purchase", timestamp: "2026-01-01T00:00:00.000Z" }],
  }]);
  assert.equal(reports.tracking[0].event_source, "correlated");
});

test("ambiguous dataLayer and network evidence is not correlated", () => {
  const network = request("https://www.google-analytics.com/g/collect?v=2&tid=G-X&cid=x&en=purchase");
  const reports = buildReports({ runId: "run" }, [network], [], [], [{
    capture_id: "capture", final_page_url: network.page_url,
    records: [{ event_name: "signup", timestamp: "2026-01-01T00:00:00.000Z" }],
  }]);
  assert.deepEqual(reports.tracking.map((row) => row.event_source).sort(), ["dataLayer", "network"]);
});

test("safe dataLayer serialization redacts sensitive keys and circular values", () => {
  const value = { event: "login", password: "secret" };
  value.self = value;
  const result = safeSerialize(value);
  assert.equal(result.data.password, "[REDACTED]");
  assert.equal(result.data.self, "[CIRCULAR]");
});

test("safe dataLayer serialization marks depth truncation", () => {
  assert.equal(safeSerialize({ a: { b: { c: 1 } } }, { maxDepth: 2 }).truncated, true);
});

test("HAR and dataLayer companions share a stem", () => {
  assert.equal(companionPath("0001-example-a.har"), "0001-example-a.datalayer.json");
});

test("HAR filenames are deterministic readable and hide query values", async () => {
  const run = await createRun({ domain: "example.test", mode: "test", root: await fs.mkdtemp(path.join(os.tmpdir(), "sal-")) });
  const first = await uniqueHarPath(run, "https://example.test/products/widget?secret=value", 0);
  const second = await uniqueHarPath(run, "https://example.test/products/widget?secret=value", 0);
  assert.equal(first, second);
  assert.match(path.basename(first), /^0001-example\.test-products-widget-/);
  assert.ok(!first.includes("secret") && !first.includes("value"));
});

test("different query values influence only the HAR hash", async () => {
  const run = await createRun({ domain: "example.test", mode: "test", root: await fs.mkdtemp(path.join(os.tmpdir(), "sal-")) });
  assert.notEqual(await uniqueHarPath(run, "https://example.test/a?q=1", 0), await uniqueHarPath(run, "https://example.test/a?q=2", 0));
});

test("HAR filenames remain below the maximum length", async () => {
  const run = await createRun({ domain: "example.test", mode: "test", root: await fs.mkdtemp(path.join(os.tmpdir(), "sal-")) });
  const file = await uniqueHarPath(run, `https://example.test/${"long-path/".repeat(50)}`, 0);
  assert.ok(path.basename(file).length <= 180);
});

test("registrable domains correctly classify com.au parties", () => {
  assert.equal(registrableDomain("www.example.com.au"), "example.com.au");
  assert.equal(partyFor("api.example.com.au", "www.example.com.au"), "first-party");
  assert.equal(partyFor("other.com.au", "www.example.com.au"), "third-party");
});

test("missing identifier diagnostic recognises parser classifications", () => {
  const row = request("https://connect.facebook.net/en_US/fbevents.js");
  diagnose([row]);
  assert.ok(row.potential_issues.includes("recognised_request_missing_expected_id"));
});

async function writeHar(directory, body, filename = "capture.har") {
  const file = path.join(directory, filename);
  await fs.writeFile(file, JSON.stringify(body));
  return file;
}

test("primary navigation document supplies inferred page attribution", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sal-"));
  const file = await writeHar(directory, { log: { entries: [
    { _resourceType: "document", request: { method: "GET", url: "https://example.test/final", headers: [] }, response: {} },
    { request: { method: "GET", url: "https://unknown.test/a", headers: [] }, response: {} },
  ] } });
  const rows = await ingestHar(file);
  assert.equal(rows[1].page_url, "https://example.test/final");
  assert.equal(rows[1].page_url_source, "inferred");
});

test("zero-row CSV retains explicit stable headers", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sal-"));
  const file = path.join(directory, "forms.csv");
  await writeCsv(file, [], CSV_SCHEMAS["forms-detected"]);
  assert.equal((await fs.readFile(file, "utf8")).split("\n")[0], CSV_SCHEMAS["forms-detected"].join(","));
});

test("report writer persists safe templates and inventories outputs", async () => {
  const run = await createRun({ domain: "example.test", mode: "test", root: await fs.mkdtemp(path.join(os.tmpdir(), "sal-")) });
  const summary = await writeReports(run, { forms: [form("https://example.test/final")], templates: [formTemplate(form("https://example.test/final"))] });
  const templates = await fs.readdir(path.join(run.dir, "form-config-templates"));
  assert.equal(templates.length, 1);
  assert.ok(summary.outputs.includes("forms-detected.csv"));
  assert.ok(!JSON.stringify(await fs.readFile(path.join(run.dir, "forms-detected.csv"))).includes("fields\":"));
});

function reporterOutput(quiet = false) {
  const stream = new PassThrough();
  let output = "";
  stream.on("data", (chunk) => { output += chunk; });
  return { reporter: new ProgressReporter({ quiet, stream }), read: () => output };
}

test("progress reports known totals success failure and summary", () => {
  const { reporter, read } = reporterOutput();
  reporter.found(2, "HAR files to analyse");
  reporter.start(1, 2, "Analysing", "https://example.test/a?secret=value");
  reporter.success(1, 2, "Analysed", "https://example.test/a");
  reporter.failure(2, 2, "bad.har", "malformed HAR");
  reporter.summary({ processed: 2, succeeded: 1, failed: 1, output: "/tmp/run" });
  assert.match(read(), /Found 2/);
  assert.match(read(), /1 succeeded, 1 failed/);
  assert.ok(!read().includes("secret=value"));
});

test("crawl progress uses evolving truthful totals", () => {
  const { reporter, read } = reporterOutput();
  reporter.crawl(1, 100, 8, 7);
  assert.match(read(), /page 1 of up to 100/);
  assert.match(read(), /7 remain queued/);
});

test("quiet and no-progress flags suppress normal progress", () => {
  const { reporter, read } = reporterOutput(true);
  reporter.found(2, "URLs");
  assert.equal(read(), "");
  assert.equal(parseArgs(["analyse", "--har", "x.har", "--no-progress"]).o.no_progress, true);
});
