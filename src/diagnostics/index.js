const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phone = /^\+?[\d ().-]{8,}$/;
const IDENTIFIER_PRODUCTS = new Set([
  "Google Analytics 4",
  "Google Tag Manager",
  "Google Ads",
  "Meta Pixel",
  "TikTok Pixel",
  "Pinterest Tag",
  "LinkedIn Insight Tag",
  "Microsoft UET",
]);

export function diagnose(rows) {
  const prior = [];
  for (const row of rows) {
    const issues = [];
    if (
      row.classification_method === "parser" &&
      !row.tag_id &&
      IDENTIFIER_PRODUCTS.has(row.product)
    ) {
      issues.push("recognised_request_missing_expected_id");
    }
    const values = Object.values(row.parameters || {}).flat(Infinity).map(String);
    if (values.some((value) => email.test(value))) issues.push("possible_email_address");
    if (values.some((value) => phone.test(value))) issues.push("possible_phone_number");
    const timestamp = Date.parse(row.request_timestamp);
    if (prior.some((candidate) => (
      candidate.page_url === row.page_url &&
      candidate.observation_context === row.observation_context &&
      candidate.request_method === row.request_method &&
      stripVolatileParameters(candidate.request_url) === stripVolatileParameters(row.request_url) &&
      Math.abs(timestamp - Date.parse(candidate.request_timestamp)) <= 2000
    ))) {
      issues.push("potential_duplicate");
    }
    row.potential_issues = issues;
    prior.push(row);
  }
  return rows;
}

function stripVolatileParameters(value) {
  try {
    const url = new URL(value);
    for (const key of ["ord", "num", "_", "z", "cachebuster"]) {
      url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return value;
  }
}
