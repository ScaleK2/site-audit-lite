import fs from "node:fs/promises";
import path from "node:path";
import { buildReports } from "./reports.js";
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
function csvCell(value) {
  const rendered =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\n]/.test(rendered)
    ? `"${rendered.replaceAll('"', '""')}"`
    : rendered;
}
async function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] || {});
  await fs.writeFile(
    file,
    [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")),
    ].join("\n") + "\n",
  );
}
export async function writeReports(
  run,
  {
    requests = [],
    forms = [],
    errors = [],
    summary = {},
    templates = [],
    manifest = [],
  },
) {
  const reports = buildReports(run, requests, manifest, errors),
    files = {
      executive: "executive-summary",
      technology: "technology-inventory",
      matrix: "page-technology-matrix",
      event: "event-inventory",
      domain: "domain-inventory",
      consent: "consent-diagnostics",
      unknown: "unknown-technologies",
      evidence: "request-evidence",
    };
  for (const [key, name] of Object.entries(files)) {
    await fs.writeFile(path.join(run.dir, `${name}.json`), json(reports[key]));
    await writeCsv(path.join(run.dir, `${name}.csv`), reports[key]);
  }
  await fs.writeFile(
    path.join(run.dir, "tracking-events.json"),
    json(reports.event),
  );
  await writeCsv(path.join(run.dir, "tracking-events.csv"), reports.event);
  await fs.writeFile(
    path.join(run.dir, "request-inventory.json"),
    json(requests),
  );
  await writeCsv(path.join(run.dir, "request-inventory.csv"), reports.evidence);
  await fs.writeFile(path.join(run.dir, "forms-detected.json"), json(forms));
  await writeCsv(path.join(run.dir, "forms-detected.csv"), forms);
  await fs.writeFile(
    path.join(run.dir, "capture-manifest.json"),
    json(manifest),
  );
  await fs.writeFile(path.join(run.dir, "errors.json"), json(errors));
  const result = {
    ...summary,
    ...reports.executive[0],
    run_id: run.runId,
    primary_domain: run.primaryDomain,
    request_count: requests.length,
    tracking_count: reports.event.length,
    form_count: forms.length,
    error_count: errors.length,
    outputs: Object.fromEntries(
      Object.values(files).map((name) => [
        name.replaceAll("-", "_"),
        `${name}.json`,
      ]),
    ),
  };
  await fs.writeFile(path.join(run.dir, "run-summary.json"), json(result));
  return result;
}
