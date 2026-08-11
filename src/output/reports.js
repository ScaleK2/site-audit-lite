import { partyFor } from "../utils/domains.js";
import { formSignature } from "../capture/forms.js";

const EVENT_ROLES = new Set(["beacon", "conversion", "attribution"]);
const MATERIAL_CATEGORIES = new Set([
  "advertising", "analytics", "tag-management", "consent-management",
  "session-replay-ux", "experimentation-personalisation",
  "performance-monitoring", "customer-data", "unknown-marketing-tech",
]);

export function sortedUnique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))].sort();
}

export function serialiseList(values, delimiter = " | ") {
  return sortedUnique(values).join(delimiter);
}

export function evidenceReference(request) {
  return request ? `${request.source_har_file}#${request.request_index}` : null;
}

function safePath(request) {
  if (request.request_path) return request.request_path;
  try { return new URL(request.request_url).pathname; } catch { return null; }
}

function primaryIdentifier(request) {
  return request.identifiers?.[0]
    ? `${request.identifiers[0].type}: ${request.identifiers[0].value}`
    : null;
}

export function aggregateForms(forms, maximumPages = 10) {
  const groups = new Map();
  for (const observation of forms) {
    const signature = observation.form_signature || formSignature(observation);
    const group = groups.get(signature) || {
      form_signature: signature,
      form_type: observation.likely_form_type,
      action: observation.form_action,
      method: observation.form_method,
      pages: [],
      observations: [],
      fields: observation.fields,
      submit_controls_raw: observation.submit_controls || [],
      confidence: observation.classification_confidence,
    };
    group.pages.push(observation.page_url);
    group.observations.push(observation);
    groups.set(signature, group);
  }
  const json = [...groups.values()].map((group) => ({
    ...group,
    pages: sortedUnique(group.pages),
    page_count: sortedUnique(group.pages).length,
    observation_count: group.observations.length,
  }));
  const csv = json.map((group) => {
    const fields = group.fields;
    const pages = group.pages.slice(0, maximumPages);
    if (group.pages.length > maximumPages) pages.push(`… ${group.pages.length - maximumPages} more (see JSON)`);
    return {
      form_signature: group.form_signature,
      form_type: group.form_type,
      action: group.action,
      method: group.method,
      pages_found: pages.join(" | "),
      page_count: group.page_count,
      observation_count: group.observation_count,
      field_count: fields.length,
      required_field_count: fields.filter((field) => field.required).length,
      field_names: serialiseList(fields.map((field) => field.name)),
      field_ids: serialiseList(fields.map((field) => field.id)),
      field_labels: serialiseList(fields.map((field) => field.label)),
      field_placeholders: serialiseList(fields.map((field) => field.placeholder)),
      field_types: serialiseList(fields.map((field) => field.input_type || field.element)),
      required_fields: serialiseList(fields.filter((field) => field.required).map((field) => field.name || field.id || field.label)),
      submit_controls: serialiseList(group.submit_controls_raw),
      confidence: group.confidence,
      finding: group.page_count > 1 ? `Repeated form observed on ${group.page_count} pages.` : "Form observed on one page.",
    };
  });
  return { csv, json };
}

function technologyInventory(requests) {
  const groups = new Map();
  for (const request of requests) {
    if (!request.vendor || !MATERIAL_CATEGORIES.has(request.category)) continue;
    for (const identifier of request.identifiers?.length ? request.identifiers : [{}]) {
      const key = [request.vendor, request.product, identifier.type, identifier.value].join("|");
      const row = groups.get(key) || {
        vendor: request.vendor,
        product: request.product,
        category: request.category,
        identifier_type: identifier.type || null,
        identifier_value: identifier.value || null,
        activity: [], hostnames: [], parties: [], pages: [], request_count: 0,
        confidence: request.classification_confidence,
        evidence_reference: evidenceReference(request),
      };
      row.activity.push(request.request_role);
      row.hostnames.push(request.hostname);
      row.parties.push(partyFor(request.hostname, request.primary_domain));
      row.pages.push(request.page_url);
      row.request_count++;
      groups.set(key, row);
    }
  }
  return [...groups.values()].map((row) => ({
    vendor: row.vendor,
    product: row.product,
    category: row.category,
    identifier_type: row.identifier_type,
    identifier_value: row.identifier_value,
    activity_observed: serialiseList(row.activity),
    hostname: serialiseList(row.hostnames),
    party: sortedUnique(row.parties).length === 1 ? row.parties[0] : "unknown",
    request_count: row.request_count,
    page_count: sortedUnique(row.pages).length,
    pages_observed: serialiseList(row.pages),
    confidence: row.confidence,
    finding: EVENT_ROLES.has(row.activity.find((role) => EVENT_ROLES.has(role)))
      ? "Technology and event-bearing request observed."
      : "Technology presence observed; event transmission not confirmed.",
    evidence_reference: row.evidence_reference,
  }));
}

function detailedEvents(requests) {
  return requests.filter((request) => request.is_tracking_event).map((request) => ({
    page: request.page_url,
    vendor: request.vendor,
    product: request.product,
    endpoint_type: safePath(request),
    request_role: request.request_role,
    event_name: request.event_name || null,
    identifier_type: request.identifier_type,
    identifier_value: request.identifier_value,
    conversion_label: request.conversion_label || null,
    consent_signals_present: request.consent_signals,
    source_har_file: request.source_har_file,
    request_index: request.request_index,
    request_timestamp: request.request_timestamp,
    parameters: request.parameters,
    evidence_reference: evidenceReference(request),
    confidence: request.classification_confidence,
    notes: request.notes || null,
  }));
}

function networkTrackingRows(events) {
  return events.filter((event) => event.event_name || event.conversion_label).map((event) => ({
    event_source: "network",
    page_url: event.page,
    event_name: event.event_name || `conversion:${event.conversion_label}`,
    destination_vendor: event.vendor,
    destination_product: event.product,
    destination_identifier: event.identifier_value,
    event_type: event.request_role,
    transmission_status: "request_observed",
    occurrence_count: 1,
    confidence: event.confidence,
    potential_issue: null,
    evidence_reference: event.evidence_reference,
    request_timestamp: event.request_timestamp,
  }));
}

function dataLayerRows(companions) {
  return companions.flatMap((companion) => (companion.records || [])
    .filter((record) => record.event_name)
    .map((record, index) => ({
      event_source: "dataLayer",
      page_url: companion.final_page_url || companion.requested_page_url,
      event_name: record.event_name,
      destination_vendor: null,
      destination_product: null,
      destination_identifier: null,
      event_type: "browser_event",
      transmission_status: "browser_event_observed",
      occurrence_count: 1,
      confidence: "medium",
      potential_issue: "No defensible matching outbound request was observed.",
      evidence_reference: `${companion.source_file || companion.capture_id}#${index}`,
      request_timestamp: record.timestamp,
    })));
}

function correlateTracking(network, browser, windowMs = 5000) {
  const available = [...network];
  const output = [];
  for (const dataLayer of browser) {
    const eventName = dataLayer.event_name.toLowerCase();
    const index = available.findIndex((candidate) => {
      if (candidate.page_url !== dataLayer.page_url || candidate.event_name?.toLowerCase() !== eventName) return false;
      const networkTime = Date.parse(candidate.request_timestamp);
      const browserTime = Date.parse(dataLayer.request_timestamp);
      return Number.isFinite(networkTime) && Number.isFinite(browserTime) && Math.abs(networkTime - browserTime) <= windowMs;
    });
    if (index < 0) output.push(dataLayer);
    else {
      const match = available.splice(index, 1)[0];
      output.push({
        ...match,
        event_source: "correlated",
        transmission_status: "browser_event_and_request_observed",
        confidence: "high",
        potential_issue: null,
        evidence_reference: `${dataLayer.evidence_reference} | ${match.evidence_reference}`,
      });
    }
  }
  return [...output, ...available];
}

function aggregateTracking(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.event_source, row.page_url, row.event_name, row.destination_vendor, row.destination_product, row.destination_identifier, row.event_type].join("|");
    const group = groups.get(key) || { ...row, evidence: [] };
    group.occurrence_count = (group.occurrence_count || 0) + (groups.has(key) ? 1 : 0);
    group.evidence.push(row.evidence_reference);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ evidence, request_timestamp: _timestamp, ...row }) => ({
    ...row,
    evidence_reference: serialiseList(evidence),
  }));
}

function pageMatrix(requests, technology, manifest) {
  return technology.flatMap((technologyRow) => {
    const technologyRequests = requests.filter((request) => {
      if (request.vendor !== technologyRow.vendor || request.product !== technologyRow.product) return false;
      if (!technologyRow.identifier_value) return true;
      return request.identifiers?.some((identifier) => identifier.type === technologyRow.identifier_type && identifier.value === technologyRow.identifier_value);
    });
    const attributedPages = sortedUnique(technologyRequests.map((request) => request.page_url));
    const pages = attributedPages.length ? attributedPages : [null];
    return pages.map((page) => {
      const matches = technologyRequests.filter((request) => request.page_url === page);
      const evidence = matches[0] || technologyRequests[0];
      return {
      requested_url: evidence?.requested_page_url || page,
      final_url: evidence?.final_page_url || page,
      page_url_source: evidence?.page_url_source || "unavailable",
      capture_outcome: manifest.find((item) => (item.final_page_url || item.requested_page_url) === page)?.capture_outcome || "not_available",
      vendor: technologyRow.vendor,
      product: technologyRow.product,
      category: technologyRow.category,
      identifier_type: technologyRow.identifier_type,
      identifier_value: technologyRow.identifier_value,
      request_count: matches.length || technologyRow.request_count,
      potential_issue: page ? null : "Page attribution unavailable; site-level technology evidence retained.",
      evidence_reference: technologyRow.evidence_reference,
      };
    });
  });
}

function domainInventory(requests) {
  const groups = new Map();
  for (const request of requests) {
    const row = groups.get(request.hostname) || { hostname: request.hostname, requests: [] };
    row.requests.push(request);
    groups.set(request.hostname, row);
  }
  return [...groups.values()].map(({ hostname, requests: matches }) => ({
    hostname,
    first_or_third_party: partyFor(hostname, matches[0].primary_domain),
    vendor: sortedUnique(matches.map((request) => request.vendor)),
    product: sortedUnique(matches.map((request) => request.product)),
    category: sortedUnique(matches.map((request) => request.category)),
    request_count: matches.length,
    pages_observed: sortedUnique(matches.map((request) => request.page_url)),
    request_roles_observed: sortedUnique(matches.map((request) => request.request_role)),
    identifiers_observed: sortedUnique(matches.map(primaryIdentifier)),
    classification_method: sortedUnique(matches.map((request) => request.classification_method)),
    confidence: sortedUnique(matches.map((request) => request.classification_confidence)),
    safe_sample_path: safePath(matches[0]),
    review_required: partyFor(hostname, matches[0].primary_domain) === "third-party" && matches.every((request) => !request.vendor),
  }));
}

function consentDiagnostics(requests, manifest) {
  const pages = sortedUnique([...manifest.map((item) => item.final_page_url || item.requested_page_url), ...requests.map((request) => request.page_url)]);
  return (pages.length ? pages : [null]).map((page) => {
    const matches = requests.filter((request) => request.page_url === page);
    const signals = matches.filter((request) => request.consent_signals?.length);
    return {
      page,
      CMP_or_consent_vendor: sortedUnique(matches.filter((request) => request.category === "consent-management").map((request) => request.vendor)),
      Google_consent_signal_present: signals.length > 0,
      default_state_observed: "not verified",
      updated_state_observed: "not verified",
      post_accept_state: "not tested",
      post_reject_state: "not tested",
      evidence_reference: signals.map(evidenceReference),
      result: signals.length ? "Consent-related signal observed; behaviour not verified." : "No supported consent signal observed.",
      confidence: signals.length ? "medium" : "low",
      limitation: "Compliance not assessed.",
    };
  });
}

function requestEvidence(requests) {
  return requests.map((request) => ({
    page_url: request.page_url, page_url_source: request.page_url_source,
    hostname: request.hostname, safe_path: safePath(request),
    request_method: request.request_method, response_status: request.response_status,
    vendor: request.vendor, product: request.product, category: request.category,
    request_role: request.request_role, classification_method: request.classification_method,
    confidence: request.classification_confidence, identifier_type: request.identifier_type,
    identifier_value: request.identifier_value, identifiers_json: request.identifiers,
    consent_signals: request.consent_signals, source_har_file: request.source_har_file,
    request_index: request.request_index, potential_issues: request.potential_issues,
  }));
}

function executiveSummary(run, requests, manifest, errors, technology, tracking, consent, unknown) {
  const findings = technology
    .filter((item) => item.product === "Google Analytics 4" && item.activity_observed.includes("beacon"))
    .map((item) => `GA4 measurement ID ${item.identifier_value} was observed transmitting collection requests.`);
  return [{
    run_identifier: run.runId,
    pages_requested: manifest.length || sortedUnique(requests.map((request) => request.page_url)).length,
    pages_captured_successfully: manifest.filter((item) => item.capture_outcome === "completed").length,
    pages_failed: errors.length,
    total_requests: requests.length,
    third_party_requests: requests.filter((request) => partyFor(request.hostname, request.primary_domain) === "third-party").length,
    recognised_technologies: technology.length,
    technologies_with_confirmed_event_transmission: new Set(tracking.filter((event) => ["network", "correlated"].includes(event.event_source)).map((event) => event.destination_product)).size,
    consent_technologies_or_signals_observed: consent.filter((row) => row.Google_consent_signal_present || row.CMP_or_consent_vendor.length).length,
    unknown_third_party_domains: unknown.length,
    high_confidence_findings: findings,
    observations_requiring_review: unknown.map((row) => `Review ${row.hostname}`),
    capture_and_analysis_limitations: ["Consent compliance is not assessed.", "Unavailable attribution is not guessed."],
  }];
}

export function buildReports(run, requests, manifest = [], errors = [], companions = []) {
  const technology = technologyInventory(requests);
  const event = detailedEvents(requests);
  const tracking = aggregateTracking(correlateTracking(networkTrackingRows(event), dataLayerRows(companions)));
  const domain = domainInventory(requests);
  const consent = consentDiagnostics(requests, manifest);
  const unknown = domain.filter((row) => row.review_required).map((row) => ({
    hostname: row.hostname, safe_path_pattern: row.safe_sample_path,
    request_count: row.request_count, pages_observed: row.pages_observed,
    current_classification: "unknown", why_unresolved: "No parser or exact registry evidence matched.",
    confidence: "low", evidence_reference: evidenceReference(requests.find((request) => request.hostname === row.hostname)),
    recommended_registry_action: "Review endpoint semantics before adding a rule.",
  }));
  return {
    executive: executiveSummary(run, requests, manifest, errors, technology, tracking, consent, unknown),
    technology,
    matrix: pageMatrix(requests, technology, manifest),
    event,
    tracking,
    domain,
    consent,
    unknown,
    evidence: requestEvidence(requests),
  };
}
