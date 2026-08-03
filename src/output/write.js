import fs from 'node:fs/promises';
import path from 'node:path';

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function csvCell(value) {
  const rendered = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(rendered) ? `"${rendered.replaceAll('"', '""')}"` : rendered;
}

async function writeRows(file, rows, headers) {
  const lines = [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))];
  await fs.writeFile(file, `${lines.join('\n')}\n`);
}

export async function writeReports(run, { requests = [], forms = [], errors = [], summary = {}, templates = [] }) {
  const tracking = requests.filter((request) => request.is_tracking);
  const inventoryHeaders = [
    'run_id', 'captured_at', 'primary_domain', 'page_url', 'page_url_source', 'hostname',
    'observation_context', 'source_har_file', 'har_page_reference', 'request_index',
    'request_timestamp', 'request_method', 'request_url', 'request_path', 'response_status',
    'mime_type', 'resource_type', 'vendor', 'category', 'classification_method',
    'classification_confidence', 'tag_id', 'event_name', 'conversion_label', 'parameters',
    'potential_issues', 'notes',
  ];
  const formHeaders = [
    'page_url', 'hostname', 'form_index', 'form_id', 'form_name', 'form_action', 'form_method',
    'form_selector', 'field_count', 'submit_controls', 'fields', 'likely_form_type',
    'classification_confidence', 'requires_manual_config', 'notes',
  ];

  for (const [name, value] of [
    ['request-inventory', requests],
    ['tracking-events', tracking],
    ['forms-detected', forms],
  ]) {
    await fs.writeFile(path.join(run.dir, `${name}.json`), json(value));
  }
  await writeRows(path.join(run.dir, 'request-inventory.csv'), requests, inventoryHeaders);
  await writeRows(path.join(run.dir, 'tracking-events.csv'), tracking, inventoryHeaders);
  await writeRows(path.join(run.dir, 'forms-detected.csv'), forms, formHeaders);
  await fs.writeFile(path.join(run.dir, 'errors.json'), json(errors));

  for (let index = 0; index < templates.length; index += 1) {
    await fs.writeFile(
      path.join(run.dir, 'form-config-templates', `form-${index + 1}.json`),
      json(templates[index]),
    );
  }

  const runSummary = {
    ...summary,
    run_id: run.runId,
    primary_domain: run.primaryDomain,
    started_at: run.startedAt,
    finished_at: new Date().toISOString(),
    mode: run.mode,
    inputs: run.inputs,
    request_count: requests.length,
    tracking_count: tracking.length,
    form_count: forms.length,
    error_count: errors.length,
    outputs: {
      run_directory: run.dir,
      request_inventory: 'request-inventory.json',
      tracking_events: 'tracking-events.json',
      forms: 'forms-detected.json',
      errors: 'errors.json',
    },
  };
  await fs.writeFile(path.join(run.dir, 'run-summary.json'), json(runSummary));
  return runSummary;
}
