import { getDomain } from "tldts";

export function registrableDomain(value) {
  if (!value) return null;
  let hostname = value;
  try {
    hostname = new URL(value).hostname;
  } catch {}
  return getDomain(hostname, { allowPrivateDomains: true }) || hostname.toLowerCase();
}

export function partyFor(hostname, primaryDomain) {
  if (!hostname || !primaryDomain) return "unknown";
  return registrableDomain(hostname) === registrableDomain(primaryDomain)
    ? "first-party"
    : "third-party";
}
