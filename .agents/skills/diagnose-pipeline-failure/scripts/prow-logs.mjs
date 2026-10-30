#!/usr/bin/env node
// Fetch a Prow log and summarise the failure. Node builtins only.
//
//   node prow-logs.mjs report <prow-or-storage-url> [--history N]
//   node prow-logs.mjs report <job-name> <run-id> [--history N]
//   node prow-logs.mjs selftest

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC = 'test-platform-results-public';
const PRIVATE = 'test-platform-results';
const SIGNATURES = [
  /^AssertionError:.*/,
  /^.*Error: .*/,
  /^\s*✖\s+\d+ of \d+ failed.*/,
  /^.*Step .* failed after .*/,
];
const ANSI = /\x1b\[[0-9;]*m/g;
const ARTIFACT = /screenshots?\/|videos?\/|\.xml$|build-log\.txt$/;
// Periodic/postsubmit: logs/<job>/<run>. Presubmit: pr-logs/pull/<org_repo>/<pr>/<job>/<run>.
const RUN_PATH = /\/((?:logs|pr-logs\/pull\/[^/]+\/\d+)\/([^/]+))\/(\d+)(?:\/|$)/;

const objectUrl = (bucket, path) =>
  `https://storage.googleapis.com/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

const apiUrl = (bucket, query) =>
  `https://storage.googleapis.com/storage/v1/b/${bucket}/o?${new URLSearchParams(query)}`;

async function getText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// Only the public bucket reads anonymously; private jobs need gcloud, which this script does not use.
async function fetchObject(path) {
  try {
    return await getText(objectUrl(PUBLIC, path));
  } catch (err) {
    if (/^40[134] /.test(err.message)) {
      err.message += ` (private job? try: gcloud storage cat gs://${PRIVATE}/${path})`;
    }
    throw err;
  }
}

// Returns { jobDir, job, run }; jobDir is the bucket path holding every run of the job.
function resolve(target, runId) {
  if (!target.startsWith('http')) {
    if (!runId) throw new Error('give a run id when passing a bare job name');
    return { jobDir: `logs/${target}`, job: target, run: runId };
  }
  const match = new URL(target).pathname.match(RUN_PATH);
  if (!match) {
    throw new Error('expected logs/<job>/<run-id> or pr-logs/pull/<repo>/<pr>/<job>/<run-id>');
  }
  return { jobDir: match[1], job: match[2], run: match[3] };
}

// fields is a GCS partial-response selector, e.g. "items(name,size)"; key is the top-level field.
async function listAll(query, key, fields = key) {
  const out = [];
  let pageToken;
  do {
    const page = JSON.parse(
      await getText(
        apiUrl(PUBLIC, {
          ...query,
          fields: `${fields},nextPageToken`,
          ...(pageToken && { pageToken }),
        }),
      ),
    );
    out.push(...(page[key] || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

async function listPrefixes(prefix) {
  return (await listAll({ prefix, delimiter: '/' }, 'prefixes')).map((p) =>
    p.slice(prefix.length).replace(/\/$/, ''),
  );
}

async function listObjects(prefix) {
  return (await listAll({ prefix }, 'items', 'items(name,size)')).map((o) => [
    o.name.slice(prefix.length),
    parseInt(o.size, 10),
  ]);
}

const FAILED_STEP = /Step (\S+) failed after (\S+?)\./g;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Output of the first failed step: from its 'Running step' line through its 'failed after' line.
// ci-operator dumps the step's pod logs in between. Falls back to the whole log. Input must be ANSI-free.
function failure(text) {
  const steps = [...text.matchAll(FAILED_STEP)];
  const step = steps[0]?.[1];
  let block = text;
  if (step) {
    const end = text.indexOf('\n', steps[0].index);
    const head = text.slice(0, steps[0].index);
    const starts = [...head.matchAll(new RegExp(`Running step ${escape(step)}\\.`, 'g'))];
    const start = starts.length ? starts[starts.length - 1].index : 0;
    block = text.slice(start, end === -1 ? text.length : end);
  }
  return { steps, block, signature: signature(block) };
}

// The single line that best names this failure. Input must be ANSI-free.
function signature(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const pattern of SIGNATURES) {
    const hit = lines.find((line) => pattern.test(line));
    if (hit) return hit;
  }
  return lines.length ? lines[lines.length - 1] : '(no output)';
}

// Drop what differs between runs of the same failure: log timestamps, durations, CI namespaces.
function normalize(line) {
  return line
    .replace(/^[A-Z]+\[[^\]]*\]\s*/, '')
    .replace(/\b\d+(?:\.\d+)?(?:h|m|s|ms)(?:\d+(?:\.\d+)?(?:m|s|ms))*\b/g, '<dur>')
    .replace(/\bci-op-[a-z0-9]+\b/g, 'ci-op-<id>')
    .trim();
}

function cypressBlocks(text, maxLines = 20) {
  return text
    .split('\n')
    .flatMap((line, i, all) =>
      /^\s+1\) /.test(line) ? [all.slice(i, i + maxLines).join('\n')] : [],
    );
}

// Artifacts live at artifacts/<test>/<step>/; build-log names steps '<test>-<step>'.
// Returns { items } on a successful listing, { error } when the listing itself failed.
async function artifactsFor(runDir, step) {
  if (!step) return { items: [] };
  const base = `${runDir}/artifacts/`;
  try {
    for (const test of await listPrefixes(base)) {
      if (!step.startsWith(`${test}-`)) continue;
      for (const sub of await listPrefixes(`${base}${test}/`)) {
        if (`${test}-${sub}` !== step) continue;
        const prefix = `${base}${test}/${sub}/`;
        const out = [];
        for (const [name, size] of await listObjects(prefix)) {
          if (ARTIFACT.test(name))
            out.push(`${objectUrl(PUBLIC, `${prefix}${name}`)} (${size} bytes)`);
        }
        return { items: out };
      }
    }
  } catch (err) {
    return { error: err.message }; // private run, network error, or API failure
  }
  return { items: [] };
}

async function history(jobDir, run, limit, ownSignature) {
  const byId = (a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
  const runs = (await listPrefixes(`${jobDir}/`))
    .filter((id) => /^\d+$/.test(id))
    .sort(byId)
    .slice(-limit);
  const rows = [];
  for (const other of runs) {
    let passed = false;
    try {
      passed = Boolean(JSON.parse(await fetchObject(`${jobDir}/${other}/finished.json`)).passed);
    } catch {
      rows.push(`  ${other}  UNKNOWN`);
      continue;
    }
    if (passed) {
      rows.push(`  ${other}  PASS`);
      continue;
    }
    if (other === run) {
      rows.push(`  ${other}  FAIL  (this run)`);
      continue;
    }
    let same = ' different';
    try {
      const text = (await fetchObject(`${jobDir}/${other}/build-log.txt`)).replace(ANSI, '');
      if (normalize(failure(text).signature) === normalize(ownSignature)) same = ' same-signature';
    } catch {
      same = '';
    }
    rows.push(`  ${other}  FAIL${same}`);
  }
  return rows;
}

async function report(target, runId, limit) {
  const { jobDir, job, run } = resolve(target, runId);
  const runDir = `${jobDir}/${run}`;
  const text = (await fetchObject(`${runDir}/build-log.txt`)).replace(ANSI, '');
  const outDir = join('/tmp', `prow-${run}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'build-log.txt'), text);

  let result = 'unknown';
  try {
    const info = JSON.parse(await fetchObject(`${runDir}/finished.json`));
    result = info.passed ? 'PASS' : `FAIL (${info.result || 'unknown'})`;
  } catch {
    /* unfinished run */
  }

  const { steps, block, signature: own } = failure(text);

  console.log(`job     : ${job}`);
  console.log(`run     : ${run}`);
  console.log(`prow    : https://prow.ci.openshift.org/view/gs/${PUBLIC}/${runDir}`);
  console.log(`result  : ${result}`);
  console.log(`log     : ${join(outDir, 'build-log.txt')} (${text.length} bytes)`);

  console.log('\nfailed steps:');
  for (const [, name, took] of steps) console.log(`  ${name} (after ${took})`);
  if (!steps.length) console.log('  none reported - check for an expired/failed log fetch first');

  console.log(`\nfailure:\n  ${own}`);

  const cypress = cypressBlocks(block)[0];
  if (cypress) {
    console.log('\ncypress block:');
    for (const line of cypress.split('\n')) console.log(`  ${line}`);
  }

  console.log('\nartifacts for the first failed step:');
  const artifacts = await artifactsFor(runDir, steps[0]?.[1]);
  if (artifacts.error) console.log(`  listing unavailable (${artifacts.error})`);
  else if (!artifacts.items.length) console.log('  none listed (the step wrote nothing)');
  for (const line of artifacts.items || []) console.log(`  ${line}`);

  if (text.includes('creating the session')) {
    console.log('\nnote: session/before-all setup failed - no product assertion ran.');
  }

  console.log(`\nhistory (last ${limit} runs):`);
  try {
    for (const row of await history(jobDir, run, limit, own)) console.log(row);
  } catch (err) {
    console.log(`  unavailable (${err.message})`);
  }
}

function parseHistory(args) {
  const flag = args.indexOf('--history');
  if (flag === -1) return 6;
  const value = args.splice(flag, 2)[1];
  if (!/^[1-9]\d*$/.test(value || '')) throw new Error('--history needs a positive integer');
  return parseInt(value, 10);
}

function selftest() {
  const eq = (actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
  };
  const periodic = { jobDir: 'logs/j', job: 'j', run: '2113' };
  const prow = 'https://prow.ci.openshift.org/view/gs/test-platform-results-public/logs/j/2113';
  eq(resolve(prow), periodic);
  eq(resolve(`${prow}/build-log.txt?Expires=1&Signature=x`), periodic);
  eq(
    resolve(
      'https://storage.googleapis.com/test-platform-results-public/logs/j/2113/build-log.txt?X=1',
    ),
    periodic,
  );
  eq(
    resolve(
      'https://prow.ci.openshift.org/view/gs/test-platform-results-public/pr-logs/pull/openshift_monitoring-plugin/1174/pull-ci-e2e/42',
    ),
    {
      jobDir: 'pr-logs/pull/openshift_monitoring-plugin/1174/pull-ci-e2e',
      job: 'pull-ci-e2e',
      run: '42',
    },
  );
  eq(resolve('job-name', '99'), {
    jobDir: 'logs/job-name',
    job: 'job-name',
    run: '99',
  });
  const sample = [
    'INFO Running step a-pre.',
    '   AssertionError: unrelated earlier failure',
    'INFO Step a-pre succeeded after 1m.',
    'INFO Running step a-b.',
    'INFO Logs for container test in pod a-b:',
    '   1) "before all" hook for X',
    '   AssertionError: nope',
    'INFO Step a-b failed after 3m.',
    '   AssertionError: later noise',
  ].join('\n');
  const parsed = failure(sample);
  eq(parsed.steps[0][1], 'a-b');
  eq(parsed.signature, 'AssertionError: nope');
  eq(failure('no steps here\nError: boom').signature, 'Error: boom');
  if (!cypressBlocks(parsed.block)[0].startsWith('   1) "before all"'))
    throw new Error('cypress block parse failed');
  eq(
    normalize('INFO[2026-10-30T06:05:28Z] Step e2e-ui failed after 8m27s.'),
    normalize('INFO[2026-10-31T01:00:00Z] Step e2e-ui failed after 1h2m3s.'),
  );
  eq(normalize('pod ci-op-hcpchqgc/x'), normalize('pod ci-op-abc123/x'));
  eq(parseHistory(['a', '--history', '3']), 3);
  console.log('selftest ok');
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'selftest') {
    selftest();
  } else if (command === 'report') {
    const limit = parseHistory(rest);
    await report(rest[0], rest[1], limit);
  } else {
    console.error('usage: prow-logs.mjs report <url | job-name run-id> [--history N] | selftest');
    process.exit(2);
  }
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}
