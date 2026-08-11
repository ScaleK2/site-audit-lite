function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
function evidenceReference(request) {
  return `${request.source_har_file}#${request.request_index}`;
}
function isThirdParty(request) {
  return (
    request.primary_domain &&
    request.hostname !== request.primary_domain &&
    !request.hostname.endsWith(`.${request.primary_domain}`)
  );
}
function safePath(request) {
  return request.request_path || new URL(request.request_url).pathname;
}
function technologyInventory(requests) {
  const groups = new Map();
  for (const request of requests) {
    if (!request.vendor) continue;
    for (const identifier of request.identifiers.length
      ? request.identifiers
      : [{}]) {
      const key = [
        request.vendor,
        request.product,
        identifier.type,
        identifier.value,
      ].join("|");
      const row = groups.get(key) || {
        vendor: request.vendor,
        product: request.product,
        category: request.category,
        identifier_type: identifier.type || null,
        identifier_value: identifier.value || null,
        pages_observed: [],
        request_roles_observed: [],
        events_observed: [],
        observation_count: 0,
        classification_confidence: request.classification_confidence,
        evidence_reference: evidenceReference(request),
        notes: request.notes || null,
      };
      row.pages_observed.push(request.page_url);
      row.request_roles_observed.push(request.request_role);
      if (request.is_tracking_event)
        row.events_observed.push(request.event_name || request.request_role);
      row.observation_count++;
      groups.set(key, row);
    }
  }
  return [...groups.values()].map((row) => ({
    ...row,
    pages_observed: sortedUnique(row.pages_observed),
    request_roles_observed: sortedUnique(row.request_roles_observed),
    events_observed: sortedUnique(row.events_observed),
  }));
}
function pageMatrix(requests, technology, manifest) {
  return technology.flatMap((item) =>
    item.pages_observed.map((page) => {
      const matches = requests.filter(
        (r) =>
          r.page_url === page &&
          r.vendor === item.vendor &&
          r.product === item.product,
      );
      return {
        requested_url: matches[0]?.requested_page_url || page,
        final_url: matches[0]?.final_page_url || page,
        page_url_source: matches[0]?.page_url_source,
        capture_outcome:
          manifest.find((m) => m.final_page_url === page)?.capture_outcome ||
          "not_available",
        vendor: item.vendor,
        product: item.product,
        category: item.category,
        identifier_type: item.identifier_type,
        identifier_value: item.identifier_value,
        library_observed: matches.some((r) => r.request_role === "library"),
        configuration_observed: matches.some(
          (r) => r.request_role === "configuration",
        ),
        beacon_observed: matches.some((r) => r.request_role === "beacon"),
        conversion_observed: matches.some(
          (r) => r.request_role === "conversion",
        ),
        attribution_observed: matches.some(
          (r) => r.request_role === "attribution",
        ),
        event_names_observed: sortedUnique(matches.map((r) => r.event_name)),
        request_count: matches.length,
        consent_signal_observed: matches.some((r) => r.consent_signals.length),
        potential_issue: page ? null : "Page attribution unavailable",
        evidence_reference: evidenceReference(matches[0]),
      };
    }),
  );
}
function eventInventory(requests) {
  return requests
    .filter((r) => r.is_tracking_event)
    .map((r) => ({
      page: r.page_url,
      vendor: r.vendor,
      product: r.product,
      endpoint_type: safePath(r),
      request_role: r.request_role,
      event_name: r.event_name || null,
      identifier_type: r.identifier_type,
      identifier_value: r.identifier_value,
      conversion_label: r.conversion_label || null,
      consent_signals_present: r.consent_signals,
      source_har_file: r.source_har_file,
      request_index: r.request_index,
      evidence_reference: evidenceReference(r),
      confidence: r.classification_confidence,
      notes: r.notes || null,
    }));
}
function domainInventory(requests) {
  const groups = new Map();
  for (const r of requests) {
    const row = groups.get(r.hostname) || {
      hostname: r.hostname,
      first_or_third_party: isThirdParty(r) ? "third-party" : "first-party",
      vendor: [],
      product: [],
      category: [],
      request_count: 0,
      pages_observed: [],
      request_roles_observed: [],
      identifiers_observed: [],
      classification_method: [],
      confidence: [],
      safe_sample_path: safePath(r),
      review_required: false,
    };
    row.vendor.push(r.vendor);
    row.product.push(r.product);
    row.category.push(r.category);
    row.request_count++;
    row.pages_observed.push(r.page_url);
    row.request_roles_observed.push(r.request_role);
    row.identifiers_observed.push(
      ...r.identifiers.map((i) => `${i.type}: ${i.value}`),
    );
    row.classification_method.push(r.classification_method);
    row.confidence.push(r.classification_confidence);
    row.review_required ||= isThirdParty(r) && !r.vendor;
    groups.set(r.hostname, row);
  }
  return [...groups.values()].map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        Array.isArray(value) ? sortedUnique(value) : value,
      ]),
    ),
  );
}
function consentDiagnostics(requests, manifest) {
  const pages = sortedUnique([
    ...manifest.map((m) => m.final_page_url || m.requested_page_url),
    ...requests.map((r) => r.page_url),
  ]);
  return (pages.length ? pages : [null]).map((page) => {
    const matches = requests.filter((r) => r.page_url === page),
      signals = matches.filter((r) => r.consent_signals.length);
    return {
      page,
      CMP_or_consent_vendor: sortedUnique(
        matches.filter((r) => r.category === "consent").map((r) => r.vendor),
      ),
      Google_consent_signal_present: signals.length > 0,
      default_state_observed: "not verified",
      updated_state_observed: "not verified",
      post_accept_state: "not tested",
      post_reject_state: "not tested",
      evidence_reference: signals.map(evidenceReference),
      result: signals.length
        ? "Consent-related signal observed; behaviour not verified."
        : "No supported consent signal observed.",
      confidence: signals.length ? "medium" : "low",
      limitation: "Compliance not assessed.",
    };
  });
}
function requestEvidence(requests) {
  return requests.map((r) => ({
    page_url: r.page_url,
    page_url_source: r.page_url_source,
    hostname: r.hostname,
    safe_path: safePath(r),
    request_method: r.request_method,
    response_status: r.response_status,
    vendor: r.vendor,
    product: r.product,
    category: r.category,
    request_role: r.request_role,
    classification_method: r.classification_method,
    confidence: r.classification_confidence,
    identifier_type: r.identifier_type,
    identifier_value: r.identifier_value,
    identifiers_json: r.identifiers,
    consent_signals: r.consent_signals,
    source_har_file: r.source_har_file,
    request_index: r.request_index,
    potential_issues: r.potential_issues,
  }));
}
function executiveSummary(
  run,
  requests,
  manifest,
  errors,
  technology,
  events,
  consent,
  unknown,
) {
  const findings = technology
    .filter(
      (t) => t.product === "Google Analytics 4" && t.events_observed.length,
    )
    .map(
      (t) =>
        `GA4 measurement ID ${t.identifier_value} was observed transmitting collection requests.`,
    );
  if (
    technology.some(
      (t) =>
        t.product === "Meta Pixel" &&
        t.request_roles_observed.some((role) =>
          ["library", "configuration"].includes(role),
        ),
    ) &&
    !events.some((e) => e.product === "Meta Pixel")
  )
    findings.push(
      "Meta Pixel library/configuration observed; no standard event beacon confirmed during this capture.",
    );
  return [
    {
      run_identifier: run.runId,
      pages_requested:
        manifest.length || sortedUnique(requests.map((r) => r.page_url)).length,
      pages_captured_successfully: manifest.filter(
        (m) => m.capture_outcome === "completed",
      ).length,
      pages_failed: errors.length,
      total_requests: requests.length,
      third_party_requests: requests.filter(isThirdParty).length,
      recognised_technologies: technology.length,
      technologies_with_confirmed_event_transmission: new Set(
        events.map((e) => e.product),
      ).size,
      consent_technologies_or_signals_observed: consent.filter(
        (c) =>
          c.Google_consent_signal_present || c.CMP_or_consent_vendor.length,
      ).length,
      unknown_third_party_domains: unknown.length,
      high_confidence_findings: findings,
      observations_requiring_review: unknown.map((x) => `Review ${x.hostname}`),
      capture_and_analysis_limitations: [
        "Consent compliance is not assessed.",
        "Unavailable attribution is not guessed.",
      ],
    },
  ];
}
export function buildReports(run, requests, manifest = [], errors = []) {
  const technology = technologyInventory(requests),
    events = eventInventory(requests),
    domains = domainInventory(requests),
    consent = consentDiagnostics(requests, manifest),
    unknown = domains
      .filter(
        (d) => d.first_or_third_party === "third-party" && !d.vendor.length,
      )
      .map((d) => ({
        hostname: d.hostname,
        safe_path_pattern: d.safe_sample_path,
        request_count: d.request_count,
        pages_observed: d.pages_observed,
        current_classification: "unknown",
        why_unresolved: "No parser or exact registry evidence matched.",
        confidence: "low",
        evidence_reference: evidenceReference(
          requests.find((r) => r.hostname === d.hostname),
        ),
        recommended_registry_action:
          "Review endpoint semantics before adding a rule.",
      }));
  return {
    executive: executiveSummary(
      run,
      requests,
      manifest,
      errors,
      technology,
      events,
      consent,
      unknown,
    ),
    technology,
    matrix: pageMatrix(requests, technology, manifest),
    event: events,
    domain: domains,
    consent,
    unknown,
    evidence: requestEvidence(requests),
  };
}
