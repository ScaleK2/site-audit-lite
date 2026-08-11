import { first } from "../../har/parameters.js";

function addIdentifier(identifiers, type, value, source) {
  for (const candidate of Array.isArray(value) ? value : [value]) {
    if (
      typeof candidate !== "string" ||
      candidate.length > 200 ||
      /@|\s/.test(candidate)
    )
      continue;
    if (
      !identifiers.some(
        (item) => item.type === type && item.value === candidate,
      )
    )
      identifiers.push({ type, value: candidate, source });
  }
}
function technology(vendor, product, category, requestRole, extra = {}) {
  return { vendor, product, category, request_role: requestRole, ...extra };
}
function isGa4Collection(hostname, pathname, parameters) {
  const pathMatches = /^\/(?:g\/)?collect\/?$/.test(pathname);
  const idMatches = /^G-[A-Z0-9]+$/i.test(first(parameters, "tid") || "");
  const standardHost = /(?:^|\.)google-analytics\.com$/i.test(hostname);
  const payloadEvidence = ["cid", "_p", "sid", "gcd"].some(
    (key) => first(parameters, key) != null,
  );
  return (
    pathMatches &&
    first(parameters, "v") === "2" &&
    idMatches &&
    (standardHost || payloadEvidence)
  );
}
function parseGoogle(hostname, pathname, parameters, identifiers) {
  if (isGa4Collection(hostname, pathname, parameters)) {
    addIdentifier(
      identifiers,
      "GA4 Measurement ID",
      first(parameters, "tid"),
      "parameter:tid",
    );
    return technology("Google", "Google Analytics 4", "analytics", "beacon", {
      event_name: first(parameters, "en"),
    });
  }
  if (
    /(?:^|\.)googletagmanager\.com$/.test(hostname) &&
    pathname === "/gtm.js"
  ) {
    addIdentifier(
      identifiers,
      "GTM Container ID",
      first(parameters, "id"),
      "parameter:id",
    );
    return technology(
      "Google",
      "Google Tag Manager",
      "tag-management",
      "library",
    );
  }
  if (
    /(?:^|\.)googletagmanager\.com$/.test(hostname) &&
    pathname === "/gtag/js"
  ) {
    const id = first(parameters, "id");
    if (/^UA-/i.test(id || "")) {
      addIdentifier(
        identifiers,
        "Universal Analytics Property ID",
        id,
        "parameter:id",
      );
      return technology(
        "Google",
        "Universal Analytics / Google tag",
        "analytics",
        "library",
      );
    }
    if (/^DC-/i.test(id || "")) {
      addIdentifier(
        identifiers,
        "Floodlight Configuration ID",
        id,
        "parameter:id",
      );
      return technology(
        "Google",
        "Campaign Manager 360 / Floodlight",
        "advertising",
        "library",
      );
    }
    if (/^AW-/i.test(id || "")) {
      addIdentifier(
        identifiers,
        "Google Ads Conversion ID",
        id,
        "parameter:id",
      );
      return technology("Google", "Google Ads", "advertising", "library");
    }
    addIdentifier(
      identifiers,
      /^G-/i.test(id || "") ? "GA4 Measurement ID" : "Google Tag ID",
      id,
      "parameter:id",
    );
    return technology("Google", "Google tag", "analytics", "library");
  }
  if (/google\.com$/.test(hostname) && /pagead\/id/.test(pathname))
    return technology(
      "Google",
      "Google Ads",
      "advertising",
      "identity-support",
    );
  if (
    /google(?:adservices)?\.com$/.test(hostname) &&
    /conversion/.test(pathname)
  ) {
    const result = technology(
        "Google",
        "Google Ads",
        "advertising",
        "conversion",
      ),
      sendTo = first(parameters, "send_to");
    if (/^AW-\d+\/.+/.test(sendTo || "")) {
      addIdentifier(
        identifiers,
        "Google Ads Conversion ID",
        sendTo.split("/")[0],
        "parameter:send_to",
      );
      result.conversion_label = sendTo.split("/")[1];
    }
    return result;
  }
  if (/doubleclick\.net$/.test(hostname) && /activity/.test(pathname)) {
    addIdentifier(
      identifiers,
      "Floodlight Advertiser/Source ID",
      first(parameters, "src"),
      "parameter:src",
    );
    return technology(
      "Google",
      "Campaign Manager 360 / Floodlight",
      "advertising",
      "conversion",
      {
        event_name: first(parameters, "type"),
        conversion_label: first(parameters, "cat"),
        floodlight: {
          custom_variables: Object.fromEntries(
            Object.entries(parameters).filter(([key]) => /^u\d+$/.test(key)),
          ),
        },
      },
    );
  }
}
function parseMeta(hostname, pathname, parameters, identifiers) {
  if (hostname === "connect.facebook.net" && /fbevents\.js$/.test(pathname))
    return technology("Meta", "Meta Pixel", "advertising", "library");
  if (hostname === "connect.facebook.net" && /signals\/config/.test(pathname)) {
    addIdentifier(
      identifiers,
      "Meta Pixel ID",
      pathname.match(/config\/(\d+)/)?.[1],
      "path",
    );
    return technology("Meta", "Meta Pixel", "advertising", "configuration");
  }
  if (/facebook\.com$/.test(hostname) && pathname === "/tr/") {
    addIdentifier(
      identifiers,
      "Meta Pixel ID",
      first(parameters, "id"),
      "parameter:id",
    );
    return technology(
      "Meta",
      "Meta Pixel",
      "advertising",
      first(parameters, "id", "ev") ? "beacon" : "unknown",
      { event_name: first(parameters, "ev") },
    );
  }
}
function parseTikTok(hostname, pathname, parameters, identifiers) {
  if (hostname !== "analytics.tiktok.com") return;
  if (/events\.js$/.test(pathname)) {
    addIdentifier(
      identifiers,
      "TikTok Pixel ID",
      first(parameters, "sdkid"),
      "parameter:sdkid",
    );
    return technology("TikTok", "TikTok Pixel", "advertising", "library");
  }
  if (/pixel\/perf/.test(pathname))
    return technology(
      "TikTok",
      "TikTok Pixel Diagnostics",
      "functional",
      "diagnostic",
    );
  if (/enrich_ipv6/.test(pathname))
    return technology(
      "TikTok",
      "TikTok Pixel Diagnostics",
      "functional",
      "enrichment",
    );
  return technology("TikTok", "TikTok Pixel", "advertising", "beacon", {
    event_name: first(parameters, "event"),
  });
}
function parseAdobe(hostname, pathname, identifiers) {
  if (hostname === "assets.adobedtm.com")
    return technology(
      "Adobe",
      "Adobe Launch",
      "tag-management",
      pathname.endsWith(".js") ? "library" : "configuration",
    );
  if (/adobedc\.net$/.test(hostname))
    return technology(
      "Adobe",
      "Adobe Experience Platform Edge Network",
      "customer-data",
      "beacon",
    );
  if (/^rum\.hlx\./.test(hostname))
    return technology(
      "Adobe",
      "Adobe Helix RUM",
      "performance-monitoring",
      "beacon",
    );
  if (
    /(?:omtrdc\.net|2o7\.net)$/.test(hostname) &&
    pathname.includes("/b/ss/")
  ) {
    for (const suite of decodeURIComponent(
      pathname.match(/\/b\/ss\/([^/]+)/)?.[1] || "",
    ).split(","))
      addIdentifier(identifiers, "Adobe Report Suite ID", suite, "path");
    return technology("Adobe", "Adobe Analytics", "analytics", "beacon");
  }
}
function parseOther(hostname, pathname, parameters, identifiers) {
  if (/pinterest\.com$/.test(hostname)) {
    addIdentifier(
      identifiers,
      "Pinterest Tag ID",
      first(parameters, "tid", "tag_id"),
      "parameter:tid",
    );
    return technology("Pinterest", "Pinterest Tag", "advertising", "beacon");
  }
  if (hostname === "bat.bing.com") {
    addIdentifier(
      identifiers,
      "Microsoft UET Tag ID",
      first(parameters, "ti"),
      "parameter:ti",
    );
    return technology(
      "Microsoft",
      "Microsoft Advertising UET",
      "advertising",
      "beacon",
    );
  }
  if (/clarity\.ms$/.test(hostname))
    return technology(
      "Microsoft",
      "Microsoft Clarity",
      "session-replay-ux",
      /collect/.test(pathname) ? "beacon" : "library",
    );
  if (/hotjar\.(?:com|io)$/.test(hostname))
    return technology("Hotjar", "Hotjar", "session-replay-ux", "beacon");
  if (/linkedin\.com$/.test(hostname) && /collect|attribution/.test(pathname)) {
    addIdentifier(
      identifiers,
      "LinkedIn Partner ID",
      first(parameters, "pid"),
      "parameter:pid",
    );
    return technology(
      "LinkedIn",
      "LinkedIn Insight Tag",
      "advertising",
      /attribution/.test(pathname) ? "attribution" : "beacon",
    );
  }
}
export function exactParser(url, parameters = {}) {
  const parsed = new URL(url),
    identifiers = [];
  const result =
    parseGoogle(parsed.hostname, parsed.pathname, parameters, identifiers) ||
    parseMeta(parsed.hostname, parsed.pathname, parameters, identifiers) ||
    parseTikTok(parsed.hostname, parsed.pathname, parameters, identifiers) ||
    parseAdobe(parsed.hostname, parsed.pathname, identifiers) ||
    parseOther(parsed.hostname, parsed.pathname, parameters, identifiers);
  return result
    ? {
        ...result,
        identifiers,
        classification_method: "parser",
        classification_confidence: "high",
      }
    : null;
}
