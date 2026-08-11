import fs from "node:fs/promises";
import path from "node:path";
import { aggregateForms, buildReports } from "./reports.js";

const JSON_REPORTS = {
  executive: "executive-summary",
  technology: "technology-inventory",
  matrix: "page-technology-matrix",
  event: "event-inventory",
  domain: "domain-inventory",
  consent: "consent-diagnostics",
  unknown: "unknown-technologies",
  evidence: "request-evidence",
};

export const CSV_SCHEMAS = {
  "forms-detected": ["form_signature", "form_type", "action", "method", "pages_found", "page_count", "observation_count", "field_count", "required_field_count", "field_names", "field_ids", "field_labels", "field_placeholders", "field_types", "required_fields", "submit_controls", "confidence", "finding"],
  "tracking-events": ["event_source", "page_url", "event_name", "destination_vendor", "destination_product", "destination_identifier", "event_type", "transmission_status", "occurrence_count", "confidence", "potential_issue", "evidence_reference"],
  "technology-inventory": ["vendor", "product", "category", "identifier_type", "identifier_value", "activity_observed", "hostname", "party", "request_count", "page_count", "pages_observed", "confidence", "finding", "evidence_reference"],
  "event-inventory": ["page", "vendor", "product", "endpoint_type", "request_role", "event_name", "identifier_type", "identifier_value", "conversion_label", "consent_signals_present", "source_har_file", "request_index", "evidence_reference", "confidence", "notes"],
};

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function csvCell(value) {
  const rendered = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(rendered) ? `"${rendered.replaceAll('"', '""')}"` : rendered;
}

export async function writeCsv(file, rows, headers) {
  const columns = headers || Object.keys(rows[0] || {});
  const output = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n") + "\n";
  await fs.writeFile(file, output);
}

async function persistTemplates(run, templates) {
  const directory = path.join(run.dir, "form-config-templates");
  const files = [];
  const unique = [...new Map(templates.map((template) => [template.name, template])).values()];
  for (let index = 0; index < unique.length; index++) {
    const template = unique[index];
    const filename = `${String(index + 1).padStart(4, "0")}-${template.name.replace(/[^a-z0-9-]+/gi, "-")}.json`;
    await fs.writeFile(path.join(directory, filename), json(template));
    files.push(path.join("form-config-templates", filename));
  }
  return files;
}

export async function writeReports(run, input) {
  const {
    requests = [], forms = [], errors = [], summary = {}, templates = [],
    manifest = [], companions = [], progress,
  } = input;
  const reports = buildReports(run, requests, manifest, errors, companions);
  const aggregatedForms = aggregateForms(forms);
  const outputs = [];

  progress?.line("Generating reports...");
  for (const [key, name] of Object.entries(JSON_REPORTS)) {
    await fs.writeFile(path.join(run.dir, `${name}.json`), json(reports[key]));
    await writeCsv(
      path.join(run.dir, `${name}.csv`),
      reports[key],
      CSV_SCHEMAS[name],
    );
    outputs.push(`${name}.json`, `${name}.csv`);
  }

  await fs.writeFile(path.join(run.dir, "tracking-events.json"), json(reports.tracking));
  await writeCsv(path.join(run.dir, "tracking-events.csv"), reports.tracking, CSV_SCHEMAS["tracking-events"]);
  outputs.push("tracking-events.json", "tracking-events.csv");

  await fs.writeFile(path.join(run.dir, "request-inventory.json"), json(requests));
  await writeCsv(path.join(run.dir, "request-inventory.csv"), reports.evidence);
  outputs.push("request-inventory.json", "request-inventory.csv");

  await fs.writeFile(path.join(run.dir, "forms-detected.json"), json(aggregatedForms.json));
  await writeCsv(path.join(run.dir, "forms-detected.csv"), aggregatedForms.csv, CSV_SCHEMAS["forms-detected"]);
  outputs.push("forms-detected.json", "forms-detected.csv");

  await fs.writeFile(path.join(run.dir, "capture-manifest.json"), json(manifest));
  await fs.writeFile(path.join(run.dir, "errors.json"), json(errors));
  outputs.push("capture-manifest.json", "errors.json");
  outputs.push(...await persistTemplates(run, templates));

  for (const filename of ["forms-detected.csv", "tracking-events.csv", "technology-inventory.csv", "request-inventory.json"]) progress?.report(filename);

  const result = {
    ...summary,
    ...reports.executive[0],
    run_id: run.runId,
    primary_domain: run.primaryDomain,
    request_count: requests.length,
    tracking_count: reports.tracking.length,
    form_count: aggregatedForms.csv.length,
    form_observation_count: forms.length,
    error_count: errors.length,
    datalayer_evidence: companions.length ? "available" : "not_available_for_legacy_har",
    outputs: [...outputs, "run-summary.json", "har/", "form-config-templates/"].sort(),
  };
  await fs.writeFile(path.join(run.dir, "run-summary.json"), json(result));
  return result;
}
