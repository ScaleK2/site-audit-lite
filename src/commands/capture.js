import { createRun } from "../output/run.js";
import { captureUrls } from "../capture/browser.js";
import { allowedLink } from "../capture/links.js";
import { parseUrlList } from "../input/url-list.js";
import { loadConfig } from "../input/config.js";
import { ingestHar } from "../har/ingest.js";
import { diagnose } from "../diagnostics/index.js";
import { writeReports } from "../output/write.js";
import { createProgress } from "../progress.js";
export async function captureList({ urls, outputRoot, waitMs, quiet = false, progress = createProgress({ quiet }) }) {
  const parsed = await parseUrlList(urls),
    valid = parsed.filter((x) => x.valid).map((x) => x.value),
    errs = parsed
      .filter((x) => !x.valid)
      .map((x) =>
        err("capture-list", x.value, "invalid_url", "Invalid HTTP(S) URL"),
      );
  if (!valid.length) throw new Error("URL list contains no valid HTTP(S) URLs");
  return finish(
    await createRun({
      domain: valid[0],
      mode: "capture-list",
      inputs: { urls },
      root: outputRoot,
    }),
    valid,
    { waitMs, progress },
    errs,
  );
}
export async function captureSite({
  url,
  maxUrls = 100,
  includeSubdomains = false,
  outputRoot,
  waitMs,
  quiet = false,
  progress = createProgress({ quiet }),
}) {
  const run = await createRun({
    domain: url,
    mode: "capture-site",
    inputs: { url, max_urls: maxUrls, include_subdomains: includeSubdomains },
    root: outputRoot,
  });
  const seen = new Set(),
    queue = [url],
    all = {
      harFiles: [],
      manifest: [],
      forms: [],
      templates: [],
      errors: [],
      completed: 0,
      interactions: 0,
      submissions: 0,
      dataLayerFiles: [],
    };
  while (queue.length && seen.size < maxUrls) {
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    const c = await import("../capture/browser.js").then((m) =>
      m.captureUrls(run, [u], { waitMs, discover: true, progress }),
    );
    merge(all, c);
    for (const raw of c.discovered || []) {
      const x = allowedLink(raw, url, { includeSubdomains });
      if (
        x &&
        !seen.has(x) &&
        !queue.includes(x) &&
        seen.size + queue.length < maxUrls
      )
        queue.push(x);
    }
    progress.crawl(seen.size, maxUrls, seen.size + queue.length, queue.length);
  }
  const result = await finalise(run, all, [], { discovered_count: seen.size }, progress);
  progress.summary({ processed: all.harFiles.length, succeeded: all.completed, failed: all.harFiles.length - all.completed, output: run.dir });
  return result;
}
export async function captureConfig({
  config,
  urls,
  confirmSubmissions = false,
  outputRoot,
  waitMs,
  quiet = false,
  progress = createProgress({ quiet }),
}) {
  const cfg = await loadConfig(config),
    parsed = urls
      ? await parseUrlList(urls)
      : cfg.interactions.map((i, index) => ({
          value: i.url,
          index,
          valid: true,
        })),
    valid = parsed.filter((x) => x.valid).map((x) => x.value),
    errs = parsed
      .filter((x) => !x.valid)
      .map((x) =>
        err("capture-config", x.value, "invalid_url", "Invalid HTTP(S) URL"),
      );
  const run = await createRun({
    domain: cfg.domain || valid[0],
    mode: "capture-config",
    inputs: { config, urls, confirm_submissions: confirmSubmissions },
    root: outputRoot,
  });
  return finish(
    run,
    valid,
    { waitMs, interactions: cfg.interactions, confirmSubmissions, progress },
    errs,
  );
}
async function finish(run, urls, opts, errs) {
  const { captureUrls } = await import("../capture/browser.js");
  const capture = await captureUrls(run, urls, opts);
  const result = await finalise(run, capture, errs, {}, opts.progress);
  opts.progress?.summary({ processed: capture.harFiles.length, succeeded: capture.completed, failed: capture.harFiles.length - capture.completed, output: run.dir });
  return result;
}
async function finalise(run, c, initial = [], extra = {}, progress) {
  let requests = [];
  for (let i = 0; i < c.harFiles.length; i++) {
    const f = c.harFiles[i];
    try {
      requests.push(
        ...(await ingestHar(f, {
          runId: run.runId,
          primaryDomain: run.primaryDomain,
          capturedAt: run.startedAt,
          manifest: c.manifest?.[i],
        })),
      );
    } catch (e) {
      c.errors.push(err(run.mode, null, "har_ingestion", e.message, f));
    }
  }
  diagnose(requests);
  const errors = [...initial, ...c.errors];
  const summary = await writeReports(run, {
    requests,
    forms: c.forms,
    templates: c.templates,
    errors,
    manifest: c.manifest || [],
    summary: {
      ...extra,
      attempted_count: c.harFiles.length,
      completed_count: c.completed,
      failed_count: c.harFiles.length - c.completed,
      interaction_count: c.interactions,
      submission_count: c.submissions,
      har_files: c.harFiles,
      domains: [...new Set(requests.map((r) => r.hostname))],
    },
    companions: await loadCompanions(c.dataLayerFiles || []),
    progress,
  });
  return { run, summary };
}
function merge(a, b) {
  for (const k of ["harFiles", "manifest", "forms", "templates", "errors", "dataLayerFiles"])
    a[k].push(...b[k]);
  for (const k of ["completed", "interactions", "submissions"]) a[k] += b[k];
  a.discovered = b.discovered;
}
const err = (mode, page_url, category, message, source_har = null) => ({
  timestamp: new Date().toISOString(),
  mode,
  page_url,
  source_har,
  interaction: null,
  action_index: null,
  category,
  message: String(message).slice(0, 500),
  continued: true,
});
async function loadCompanions(files) {
  const companions = [];
  for (const file of files) {
    try {
      const companion = JSON.parse(await import("node:fs/promises").then((module) => module.readFile(file, "utf8")));
      companion.source_file = file.split(/[\\/]/).pop();
      companions.push(companion);
    } catch {}
  }
  return companions;
}
