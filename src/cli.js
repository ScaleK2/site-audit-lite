#!/usr/bin/env node
import { analyse } from "./commands/analyse.js";
import { captureSite, captureList, captureConfig } from "./commands/capture.js";
import { menu } from "./menu.js";
import { createProgress } from "./progress.js";

const BOOLEAN_FLAGS = new Set([
  "include_subdomains", "confirm_submissions", "quiet", "no_progress",
]);

export function parseArgs(argv) {
  const command = argv[0];
  const options = {};
  for (let index = 1; index < argv.length; index++) {
    const flag = argv[index];
    if (!flag.startsWith("--")) throw new Error(`Unexpected argument: ${flag}`);
    const name = flag.slice(2).replaceAll("-", "_");
    if (BOOLEAN_FLAGS.has(name)) options[name] = true;
    else {
      if (argv[index + 1] == null || argv[index + 1].startsWith("--")) {
        throw new Error(`Missing value for ${flag}`);
      }
      options[name] = argv[++index];
    }
  }
  if (options.max_urls) options.max_urls = Number(options.max_urls);
  if (options.wait_ms) options.wait_ms = Number(options.wait_ms);
  return { command, o: options };
}

export async function main(argv = process.argv.slice(2)) {
  if (!argv.length) return menu(main);
  const { command, o } = parseArgs(argv);
  const quiet = Boolean(o.quiet || o.no_progress);
  const progress = createProgress({ quiet });
  if (command === "analyse") {
    if (Boolean(o.har) === Boolean(o.har_dir)) throw new Error("analyse requires exactly one of --har or --har-dir");
    return analyse({ har: o.har, harDir: o.har_dir, outputRoot: o.output_root, quiet, progress });
  }
  if (command === "capture-site") {
    if (!o.url) throw new Error("capture-site requires --url");
    return captureSite({ url: o.url, maxUrls: o.max_urls, includeSubdomains: o.include_subdomains, waitMs: o.wait_ms, outputRoot: o.output_root, quiet, progress });
  }
  if (command === "capture-list") {
    if (!o.urls) throw new Error("capture-list requires --urls");
    return captureList({ urls: o.urls, waitMs: o.wait_ms, outputRoot: o.output_root, quiet, progress });
  }
  if (command === "capture-config") {
    if (!o.config) throw new Error("capture-config requires --config");
    return captureConfig({ config: o.config, urls: o.urls, confirmSubmissions: o.confirm_submissions, waitMs: o.wait_ms, outputRoot: o.output_root, quiet, progress });
  }
  throw new Error(`Unknown command: ${command}`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
