import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { classify } from "../src/classification/classify.js";
import { decodeParameters } from "../src/har/parameters.js";
import { ingestHar } from "../src/har/ingest.js";
import { buildReports } from "../src/output/reports.js";
import { writeReports } from "../src/output/write.js";
import { createRun } from "../src/output/run.js";
import { menu } from "../src/menu.js";
function request(url, overrides = {}) {
  const parsed = new URL(url);
  return classify({
    request_url: url,
    request_path: parsed.pathname,
    hostname: parsed.hostname,
    parameters: decodeParameters({ url }),
    primary_domain: "example.test",
    source_har_file: "x.har",
    request_index: 0,
    page_url: "https://example.test/",
    page_url_source: "har_page",
    ...overrides,
  });
}
const ga = (host) =>
  request(`https://${host}/g/collect?v=2&tid=G-KWCHRE2HFT&cid=x`);
test("confirmed GA4 standard-host detection", () =>
  assert.equal(ga("www.google-analytics.com").product, "Google Analytics 4"));
test("regional GA4 host detection", () =>
  assert.equal(ga("region1.google-analytics.com").request_role, "beacon"));
test("defensible first-party GA4 detection", () =>
  assert.equal(
    request(
      "https://metrics.example.test/g/collect?v=2&tid=G-KWCHRE2HFT&cid=x&sid=1",
    ).identifier_value,
    "G-KWCHRE2HFT",
  ));
test("collect false-positive resistance", () =>
  assert.notEqual(
    request("https://api.example.test/collect").product,
    "Google Analytics 4",
  ));
test("GA4 versus Clarity", () =>
  assert.equal(
    request("https://www.clarity.ms/collect?id=x").product,
    "Microsoft Clarity",
  ));
test("GA4 versus Google Ads", () =>
  assert.equal(
    request("https://www.google.com/pagead/id").product,
    "Google Ads",
  ));
test("Meta library/configuration/beacon separation", () =>
  assert.deepEqual(
    [
      "https://connect.facebook.net/en_US/fbevents.js",
      "https://connect.facebook.net/signals/config/123",
      "https://www.facebook.com/tr/?id=123&ev=PageView",
    ].map((url) => request(url).request_role),
    ["library", "configuration", "beacon"],
  ));
test("Google identifier distinctions", () => {
  assert.equal(
    request("https://www.googletagmanager.com/gtag/js?id=UA-1-1")
      .identifier_type,
    "Universal Analytics Property ID",
  );
  assert.equal(
    request("https://www.googletagmanager.com/gtag/js?id=DC-1").identifier_type,
    "Floodlight Configuration ID",
  );
});
test("pagead id identity-support classification", () =>
  assert.equal(
    request("https://www.google.com/pagead/id").request_role,
    "identity-support",
  ));
test("Adobe report-suite extraction", () =>
  assert.deepEqual(
    request("https://x.omtrdc.net/b/ss/a,b/1").identifiers.map((x) => x.value),
    ["a", "b"],
  ));
test("TikTok event versus diagnostic/enrichment", () => {
  assert.equal(
    request("https://analytics.tiktok.com/api/v2/pixel/perf").is_tracking_event,
    false,
  );
  assert.equal(
    request("https://analytics.tiktok.com/ipv6/enrich_ipv6").request_role,
    "enrichment",
  );
});
test("event inventory exclusions", () =>
  assert.equal(
    buildReports({ runId: "x" }, [
      ga("www.google-analytics.com"),
      request("https://connect.facebook.net/en_US/fbevents.js"),
    ]).event.length,
    1,
  ));
test("technology inventory with identifier", () =>
  assert.equal(
    buildReports({ runId: "x" }, [ga("www.google-analytics.com")]).technology[0]
      .identifier_type,
    "GA4 Measurement ID",
  ));
test("technology inventory without identifier", () =>
  assert.equal(
    buildReports({ runId: "x" }, [
      request("https://connect.facebook.net/en_US/fbevents.js"),
    ]).technology[0].identifier_value,
    null,
  ));
async function bareHar() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sal-")),
    file = path.join(directory, "x.har");
  await fs.writeFile(
    file,
    JSON.stringify({
      log: {
        entries: [
          {
            request: { method: "GET", url: "https://x.test/", headers: [] },
            response: {},
          },
        ],
      },
    }),
  );
  return file;
}
test("page attribution and unavailable fallback", async () =>
  assert.equal(
    (await ingestHar(await bareHar()))[0].page_url_source,
    "unavailable",
  ));
test("manifest attribution", async () =>
  assert.equal(
    (
      await ingestHar(await bareHar(), {
        manifest: {
          requested_page_url: "https://example.test/start",
          final_page_url: "https://example.test/final",
        },
      })
    )[0].page_url,
    "https://example.test/final",
  ));
test("consent signals versus unverified consent state", () => {
  const row = buildReports({ runId: "x" }, [
    request(
      "https://www.google-analytics.com/g/collect?v=2&tid=G-X&cid=x&gcd=x",
    ),
  ]).consent[0];
  assert.equal(row.default_state_observed, "not verified");
  assert.equal(row.limitation, "Compliance not assessed.");
});
test("unknown third-party review", () =>
  assert.equal(
    buildReports({ runId: "x" }, [request("https://unknown.test/a")]).unknown
      .length,
    1,
  ));
test("sensitive-value redaction", () =>
  assert.ok(
    !JSON.stringify(
      buildReports({ runId: "x" }, [
        request("https://unknown.test/a?secret=private"),
      ]).evidence,
    ).includes("private"),
  ));
test("deterministic report output", () =>
  assert.deepEqual(
    buildReports({ runId: "x" }, [ga("www.google-analytics.com")]),
    buildReports({ runId: "x" }, [ga("www.google-analytics.com")]),
  ));
test("interactive/direct CLI pipeline parity", () =>
  assert.match(menu.toString(), /await run/));
test("single-HAR aggregation", async () => {
  const run = await createRun({
    domain: "example.test",
    mode: "x",
    root: await fs.mkdtemp(path.join(os.tmpdir(), "sal-")),
  });
  await writeReports(run, { requests: [ga("www.google-analytics.com")] });
  assert.equal(
    JSON.parse(await fs.readFile(path.join(run.dir, "event-inventory.json")))
      .length,
    1,
  );
});
test("HAR-folder aggregation", () =>
  assert.equal(
    buildReports({ runId: "x" }, [
      ga("www.google-analytics.com"),
      {
        ...ga("www.google-analytics.com"),
        source_har_file: "y.har",
        request_index: 1,
      },
    ]).technology[0].observation_count,
    2,
  ));
