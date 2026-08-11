import { exactParser } from "./parsers/index.js";
import { domainMatch } from "./domain-registry.js";
const EVENT_ROLES = new Set(["beacon", "conversion", "attribution"]);
export function classify(record) {
  const inferred = /(?:^|\.)(analytics|tracking|pixel|metrics)[.-]/i.test(
    record.hostname,
  )
    ? {
        vendor: record.hostname,
        product: "Unresolved technology",
        category: "unknown-marketing-tech",
        request_role: "unknown",
        classification_method: "hostname_inference",
        classification_confidence: "low",
      }
    : null;
  const match = exactParser(record.request_url, record.parameters) ||
    domainMatch(record.hostname) ||
    inferred || {
      vendor: null,
      product: null,
      category: "unknown",
      request_role: "unknown",
      classification_method: "unknown",
      classification_confidence: "low",
    };
  const identifiers = match.identifiers || [];
  return Object.assign(record, match, {
    identifiers,
    identifiers_json: identifiers,
    identifier_type: identifiers[0]?.type || null,
    identifier_value: identifiers[0]?.value || null,
    tag_id: identifiers[0]?.value || null,
    is_tracking: EVENT_ROLES.has(match.request_role),
    is_tracking_event: EVENT_ROLES.has(match.request_role),
    consent_signals: ["gcd", "dma", "npa"].filter(
      (key) => record.parameters?.[key],
    ),
  });
}
