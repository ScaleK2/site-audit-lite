import fs from "node:fs/promises";
import path from "node:path";
import { decodeParameters, first } from "./parameters.js";
import { classify } from "../classification/classify.js";
export async function ingestHar(file, meta = {}) {
  const har = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(har?.log?.entries))
    throw new Error("HAR does not contain log.entries");
  const pages = new Map((har.log.pages || []).map((page) => [page.id, page]));
  const primaryDocument = findPrimaryDocument(har, meta.manifest);
  return har.log.entries.flatMap((entry, requestIndex) => {
    let parsed;
    try {
      parsed = new URL(entry?.request?.url);
    } catch {
      return [];
    }
    if (!/^https?:$/.test(parsed.protocol)) return [];
    const parameters = decodeParameters(entry.request);
    const validUrl = (value) => {
      try {
        return /^https?:$/.test(new URL(value).protocol) ? value : null;
      } catch {
        return null;
      }
    };
    const manifest = meta.manifest;
    const harPage = validUrl(pages.get(entry.pageref)?.title);
    const requestPage = validUrl(first(parameters, "dl", "page_location"));
    const referer = validUrl(
      entry.request.headers?.find((header) => /referer/i.test(header.name))
        ?.value,
    );
    const requestedPage = manifest?.requested_page_url || null;
    const finalPage = manifest?.final_page_url || requestedPage;
    const pageUrl = manifest
      ? finalPage || requestedPage
      : harPage || primaryDocument || requestPage || referer || null;
    const pageSource = manifest
      ? "capture_manifest"
      : harPage
        ? "har_page"
        : primaryDocument
          ? "inferred"
        : requestPage
          ? "request_parameter"
          : referer
            ? "referer"
            : "unavailable";
    return [
      classify({
        run_id: meta.runId || null,
        captured_at: meta.capturedAt || new Date().toISOString(),
        primary_domain: meta.primaryDomain || null,
        requested_page_url: requestedPage,
        final_page_url: finalPage,
        page_url: pageUrl,
        page_url_source: pageSource,
        hostname: parsed.hostname,
        observation_context: entry._observation_context || "page_load",
        source_har_file: path.basename(file),
        har_page_reference: entry.pageref || null,
        request_index: requestIndex,
        request_timestamp: entry.startedDateTime || null,
        request_method: entry.request.method,
        request_url: entry.request.url,
        request_path: parsed.pathname,
        resource_type: entry._resourceType || null,
        response_status: entry.response?.status ?? null,
        parameters,
        potential_issues: [],
      }),
    ];
  });
}
function findPrimaryDocument(har, manifest) {
  const requested = manifest?.requested_page_url;
  const documents = (har?.log?.entries || []).filter(
    (entry) => entry._resourceType === "document" && /^https?:/i.test(entry.request?.url || ""),
  );
  if (requested) {
    const origin = new URL(requested).origin;
    const sameOrigin = documents.find((entry) => new URL(entry.request.url).origin === origin);
    if (sameOrigin) return sameOrigin.request.url;
  }
  const pageRefs = new Set((har?.log?.pages || []).map((page) => page.id));
  const topLevel = documents.find((entry) => !entry.pageref || pageRefs.has(entry.pageref));
  return topLevel?.request?.url || null;
}
export function crediblePage(har) {
  const pages = har?.log?.pages || [];
  for (const p of pages)
    try {
      if (/^https?:$/.test(new URL(p.title).protocol)) return p.title;
    } catch {}
  return findPrimaryDocument(har, null) || null;
}
