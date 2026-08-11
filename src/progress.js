function safeTarget(value) {
  if (!value) return "unknown";
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return String(value).replace(/\?.*$/, "");
  }
}

export class ProgressReporter {
  constructor({ quiet = false, stream = process.stderr } = {}) {
    this.quiet = quiet;
    this.stream = stream;
  }

  line(message, { always = false } = {}) {
    if (!this.quiet || always) this.stream.write(`${message}\n`);
  }

  found(count, kind) {
    this.line(`Found ${count} ${kind}.`);
  }

  start(index, total, action, target) {
    this.line(`[${index}/${total}] ${action} ${safeTarget(target)}...`);
  }

  success(index, total, action, target) {
    this.line(`[${index}/${total}] ✓ ${action} ${safeTarget(target)}`);
  }

  failure(index, total, target, error) {
    this.line(
      `[${index}/${total}] ✗ Failed ${safeTarget(target)} — ${String(error).replace(/\?.*$/, "")}`,
      { always: true },
    );
  }

  crawl(processed, limit, discovered, queued) {
    this.line(`Capturing page ${processed} of up to ${limit}...`);
    this.line(`Observed ${processed} pages; discovered ${discovered} eligible URLs; ${queued} remain queued.`);
  }

  report(filename) {
    this.line(`✓ ${filename}`);
  }

  summary({ processed, succeeded, failed, output }) {
    this.line(`Completed ${processed}/${processed}: ${succeeded} succeeded, ${failed} failed.`, { always: true });
    this.line(`Run saved to: ${output}`, { always: true });
  }
}

export function createProgress(options = {}) {
  return new ProgressReporter(options);
}
