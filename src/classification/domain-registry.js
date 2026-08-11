export const REGISTRY = [
  ["snap.licdn.com", "LinkedIn", "advertising"],
  ["linkedin.com", "LinkedIn", "advertising"],
  ["snapchat.com", "Snapchat", "advertising"],
  ["redditstatic.com", "Reddit", "advertising"],
  ["twitter.com", "X/Twitter", "advertising"],
  ["criteo.com", "Criteo", "advertising"],
  ["hubspot.com", "HubSpot", "automation"],
  ["segment.com", "Segment", "customer-data"],
  ["tealiumiq.com", "Tealium", "tag-management"],
  ["mixpanel.com", "Mixpanel", "analytics"],
  ["amplitude.com", "Amplitude", "analytics"],
  ["sentry.io", "Sentry", "monitoring"],
  ["fullstory.com", "FullStory", "replay"],
  ["contentsquare.net", "Contentsquare", "replay"],
  ["crazyegg.com", "Crazy Egg", "experimentation"],
  ["optimizely.com", "Optimizely", "experimentation"],
  ["visualwebsiteoptimizer.com", "VWO", "experimentation"],
  ["onetrust.com", "OneTrust", "consent"],
  ["cookiebot.com", "Cookiebot", "consent"],
  ["recaptcha.net", "reCAPTCHA", "security"],
  ["googleapis.com", "Google infrastructure", "infrastructure"],
  ["cloudflare.com", "Cloudflare", "infrastructure"],
];
export function domainMatch(host) {
  const x = REGISTRY.find(([d]) => host === d || host.endsWith(`.${d}`));
  return (
    x && {
      vendor: x[1],
      product: x[1],
      category: x[2],
      request_role: "unknown",
      classification_method: "hostname",
      classification_confidence: "medium",
    }
  );
}
