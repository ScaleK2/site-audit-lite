export const REGISTRY = [
  { domain: "snap.licdn.com", vendor: "LinkedIn", product: "LinkedIn Insight Tag", category: "advertising" },
  { domain: "linkedin.com", vendor: "LinkedIn", product: "LinkedIn Insight Tag", category: "advertising" },
  { domain: "snapchat.com", vendor: "Snapchat", product: "Snap Pixel", category: "advertising" },
  { domain: "redditstatic.com", vendor: "Reddit", product: "Reddit Pixel", category: "advertising" },
  { domain: "twitter.com", vendor: "X", product: "X Pixel", category: "advertising" },
  { domain: "criteo.com", vendor: "Criteo", product: "Criteo Advertising", category: "advertising" },
  { domain: "hubspot.com", vendor: "HubSpot", product: "HubSpot", category: "customer-data" },
  { domain: "segment.com", vendor: "Twilio", product: "Segment", category: "customer-data" },
  { domain: "tealiumiq.com", vendor: "Tealium", product: "Tealium iQ", category: "tag-management" },
  { domain: "mixpanel.com", vendor: "Mixpanel", product: "Mixpanel", category: "analytics" },
  { domain: "amplitude.com", vendor: "Amplitude", product: "Amplitude Analytics", category: "analytics" },
  { domain: "sentry.io", vendor: "Sentry", product: "Sentry", category: "performance-monitoring" },
  { domain: "fullstory.com", vendor: "FullStory", product: "FullStory", category: "session-replay-ux" },
  { domain: "contentsquare.net", vendor: "Contentsquare", product: "Contentsquare", category: "session-replay-ux" },
  { domain: "crazyegg.com", vendor: "Crazy Egg", product: "Crazy Egg", category: "experimentation-personalisation" },
  { domain: "optimizely.com", vendor: "Optimizely", product: "Optimizely", category: "experimentation-personalisation" },
  { domain: "visualwebsiteoptimizer.com", vendor: "VWO", product: "VWO", category: "experimentation-personalisation" },
  { domain: "onetrust.com", vendor: "OneTrust", product: "OneTrust CMP", category: "consent-management" },
  { domain: "cookiebot.com", vendor: "Usercentrics", product: "Cookiebot CMP", category: "consent-management" },
  { domain: "recaptcha.net", vendor: "Google", product: "reCAPTCHA", category: "functional" },
  { domain: "googleapis.com", vendor: "Google", product: "Google APIs", category: "infrastructure-cdn" },
  { domain: "cloudflare.com", vendor: "Cloudflare", product: "Cloudflare", category: "infrastructure-cdn" },
];

export function domainMatch(hostname) {
  const entry = REGISTRY.find(
    ({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
  if (!entry) return null;
  return {
    vendor: entry.vendor,
    product: entry.product,
    category: entry.category,
    request_role: "unknown",
    classification_method: "hostname",
    classification_confidence: "medium",
  };
}
