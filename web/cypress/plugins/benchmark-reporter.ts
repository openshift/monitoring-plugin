/*
Node-side benchmark utilities for cypress.config.ts.

Handles writing benchmark JSON reports and injecting benchmark data into
mochawesome reports (via after:spec, since spec code runs in the browser
and cannot set mochawesome context directly).
*/

import * as fs from 'fs-extra';
import * as path from 'path';
import * as console from 'console';

const REPORTS_DIR = path.join(__dirname, '..', '..', 'screenshots');

export function writeBenchmarkReport(report: {
  specFile: string;
  timestamp: string;
  [key: string]: unknown;
}): null {
  fs.ensureDirSync(REPORTS_DIR);

  const safeName = (report.specFile || 'unknown')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const ts = (report.timestamp || new Date().toISOString())
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);

  const filePath = path.join(REPORTS_DIR, `benchmark-${safeName}-${ts}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  console.log(`Benchmark report written: ${filePath}`);
  return null;
}

/**
 * Reads the most recent benchmark JSON for the given spec and injects its
 * data into the matching mochawesome report's test contexts.
 */
export function injectBenchmarksIntoMochawesome(specRelative: string): void {
  if (!fs.existsSync(REPORTS_DIR)) return;

  const safeName = path
    .basename(specRelative)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const benchFile = fs
    .readdirSync(REPORTS_DIR)
    .filter((f: string) => f.startsWith(`benchmark-${safeName}`) && f.endsWith('.json'))
    .sort()
    .pop();
  if (!benchFile) return;

  const benchmarks: Array<{ label: string; [k: string]: unknown }> =
    fs.readJsonSync(path.join(REPORTS_DIR, benchFile)).benchmarks || [];
  if (benchmarks.length === 0) return;

  const reportFile = fs
    .readdirSync(REPORTS_DIR)
    .filter((f: string) => f.startsWith('cypress_report') && f.endsWith('.json'))
    .sort()
    .pop();
  if (!reportFile) return;

  const reportPath = path.join(REPORTS_DIR, reportFile);
  const report = fs.readJsonSync(reportPath);

  let injected = false;
  const suites = (report.results || []).flatMap((r: any) => r.suites || []);
  for (const suite of suites) {
    for (const test of suite.tests || []) {
      const matched = benchmarks.filter((b: any) => test.code && test.code.includes(b.label));
      if (matched.length > 0) {
        test.context = JSON.stringify([{ title: 'Benchmark Results', value: matched }]);
        injected = true;
      }
    }
  }

  if (injected) {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Benchmark data injected into mochawesome report: ${reportPath}`);
  }
}
