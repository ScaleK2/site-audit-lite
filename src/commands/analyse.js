import fs from "node:fs/promises";
import path from "node:path";
import { ingestHar, crediblePage } from "../har/ingest.js";
import { createRun } from "../output/run.js";
import { writeReports } from "../output/write.js";
import { diagnose } from "../diagnostics/index.js";
import { safeMessage } from "../utils/redact.js";
import { createProgress } from "../progress.js";
export async function analyse({ har, harDir, outputRoot, quiet = false, progress = createProgress({ quiet }) }) {
  let files = har
    ? [har]
    : (await fs.readdir(harDir, { withFileTypes: true }))
        .filter((x) => x.isFile() && x.name.toLowerCase().endsWith(".har"))
        .map((x) => path.join(harDir, x.name))
        .sort();
  if (!files.length) throw new Error("No HAR files found");
  progress.found(files.length, "HAR files to analyse");
  let manifest = [];
  for (const candidate of [
    har && path.join(path.dirname(har), "capture-manifest.json"),
    harDir && path.join(harDir, "capture-manifest.json"),
    harDir && path.join(path.dirname(harDir), "capture-manifest.json"),
  ].filter(Boolean))
    try {
      manifest = JSON.parse(await fs.readFile(candidate, "utf8"));
      break;
    } catch {}
  let domain = "unknown";
  for (const f of files)
    try {
      const h = JSON.parse(await fs.readFile(f));
      domain = crediblePage(h) || domain;
      if (domain !== "unknown") break;
    } catch {}
  const run = await createRun({
    domain,
    mode: har ? "analyse-har" : "analyse-har-dir",
    inputs: { har, har_dir: harDir, original_sources: files },
    root: outputRoot,
  });
  let requests = [],
    errors = [],
    copied = [],
    companions = [],
    failedFiles = 0;
  for (let index = 0; index < files.length; index++) {
    const f = files[index];
    progress.start(index + 1, files.length, "Analysing", f);
    try {
      const dest = path.join(run.dir, "har", path.basename(f));
      await fs.copyFile(f, dest);
      copied.push(dest);
      const companionSource = f.replace(/\.har$/i, ".datalayer.json");
      try {
        const companion = JSON.parse(await fs.readFile(companionSource, "utf8"));
        companion.source_file = path.basename(companionSource);
        companions.push(companion);
        await fs.copyFile(companionSource, path.join(run.dir, "har", path.basename(companionSource)));
      } catch (error) {
        if (error.code !== "ENOENT") {
          errors.push({
            timestamp: new Date().toISOString(), mode: run.mode, page_url: null,
            source_har: companionSource, interaction: null, action_index: null,
            category: "datalayer_ingestion", message: safeMessage(error), continued: true,
          });
        }
      }
      requests.push(
        ...(await ingestHar(f, {
          runId: run.runId,
          primaryDomain: run.primaryDomain,
          capturedAt: run.startedAt,
          manifest: manifest.find?.(
            (item) => item.source_har_file === path.basename(f),
          ),
        })),
      );
      progress.success(index + 1, files.length, "Analysed", f);
    } catch (e) {
      failedFiles++;
      errors.push({
        timestamp: new Date().toISOString(),
        mode: run.mode,
        page_url: null,
        source_har: f,
        interaction: null,
        action_index: null,
        category: "har_ingestion",
        message: safeMessage(e),
        continued: true,
      });
      progress.failure(index + 1, files.length, f, e.message);
    }
  }
  diagnose(requests);
  const summary = await writeReports(run, {
    requests,
    errors,
    manifest,
    summary: {
      har_files: copied,
      original_sources: files,
      domains: [...new Set(requests.map((r) => r.hostname))],
      attempted_count: files.length,
      completed_count: files.length - failedFiles,
      failed_count: failedFiles,
    },
    companions,
    progress,
  });
  progress.summary({ processed: files.length, succeeded: files.length - failedFiles, failed: failedFiles, output: run.dir });
  return { run, summary };
}
