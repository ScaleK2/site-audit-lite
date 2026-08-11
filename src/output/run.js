import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';

import { primaryDomain, safeSlug } from '../utils/urls.js';

export async function createRun({ domain, mode, inputs = {}, root = 'output' }) {
  const now = new Date();
  const runId = `${now.toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  const primary = primaryDomain(domain);
  const dir = path.join(root, primary, runId);

  await fs.mkdir(path.join(dir, 'har'), { recursive: true });
  await fs.mkdir(path.join(dir, 'form-config-templates'), { recursive: true });

  return {
    runId,
    primaryDomain: primary,
    dir,
    startedAt: now.toISOString(),
    mode,
    inputs,
  };
}

export async function uniqueHarPath(run, url, index = 0) {
  const digest = crypto
    .createHash('sha256')
    .update(`${url}|${index}|${Date.now()}|${crypto.randomUUID()}`)
    .digest('hex')
    .slice(0, 10);

  return path.join(
    run.dir,
    'har',
    `${String(index + 1).padStart(4, '0')}-${safeSlug(url)}-${digest}.har`,
  );
}
