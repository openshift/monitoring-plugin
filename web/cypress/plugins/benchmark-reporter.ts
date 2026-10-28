import * as fs from 'fs-extra';
import * as path from 'path';
import type { BenchmarkReport } from '../support/benchmark-utils';

/**
 * Node-side half of the Cypress benchmark reporting feature.
 *
 * Flow:
 *  1. Specs use `BenchmarkCollector` (see cypress/support/benchmark-utils.ts) to time
 *     operations in the browser and assert them against a threshold.
 *  2. When a spec finishes, the collector's `writeReport()` calls
 *     `cy.task('writeBenchmarkReport', report)`, which is handled here by
 *     `writeBenchmarkReport` and persists the report as JSON under
 *     `cypress/reports/benchmarks/`.
 *  3. Cypress's `after:spec` node event then calls
 *     `injectBenchmarksIntoMochawesome(spec.relative)`, which locates the mochawesome
 *     JSON report mocha just wrote for that spec and attaches the benchmark summary to
 *     every test in it as `context`, so it shows up in the mochawesome HTML report.
 */

// Where per-spec benchmark JSON is staged before being merged into mochawesome.
const BENCHMARK_REPORTS_DIR = path.join(process.cwd(), 'cypress', 'reports', 'benchmarks');

// Must match `mochawesomeReporterOptions.reportDir` in reporter-config.json.
const MOCHAWESOME_REPORT_DIR = path.join(process.cwd(), 'screenshots');

// Mochawesome writes its JSON report asynchronously once mocha's run ends, which can
// race with Cypress's `after:spec` event, so we poll briefly rather than assume it's
// already on disk.
const MOCHAWESOME_LOOKUP_RETRIES = 10;
const MOCHAWESOME_LOOKUP_DELAY_MS = 250;

function sanitizeSpecName(specFile: string): string {
  return specFile.replace(/[\\/]/g, '__').replace(/\.[^.]+$/, '');
}

function benchmarkReportPath(specFile: string): string {
  return path.join(BENCHMARK_REPORTS_DIR, `${sanitizeSpecName(specFile)}.json`);
}

/**
 * Cypress task handler: persists a benchmark report produced by `BenchmarkCollector`
 * to disk so it can later be merged into the mochawesome report for the same spec.
 *
 * @returns the absolute path the report was written to
 */
export function writeBenchmarkReport(report: BenchmarkReport): string {
  fs.ensureDirSync(BENCHMARK_REPORTS_DIR);
  const filePath = benchmarkReportPath(report.specFile);
  fs.writeJsonSync(filePath, report, { spaces: 2 });
  return filePath;
}

function readBenchmarkReport(specFile: string): BenchmarkReport | null {
  const filePath = benchmarkReportPath(specFile);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readJsonSync(filePath) as BenchmarkReport;
}

function formatBenchmarkContext(report: BenchmarkReport): { title: string; value: unknown } {
  return {
    title: 'Benchmarks',
    value: {
      environment: report.environment,
      summary: report.summary,
      benchmarks: report.benchmarks,
    },
  };
}

interface MochaTest {
  context?: unknown;
  [key: string]: unknown;
}

interface MochaSuite {
  tests?: MochaTest[];
  suites?: MochaSuite[];
  [key: string]: unknown;
}

interface MochawesomeReport {
  results?: Array<MochaSuite & { file?: string; fullFile?: string }>;
  [key: string]: unknown;
}

/** Mirrors mochawesome's own `addContext` semantics for the `context` field. */
function addContextToTest(test: MochaTest, context: { title: string; value: unknown }): void {
  if (!test.context) {
    test.context = context;
  } else if (Array.isArray(test.context)) {
    test.context.push(context);
  } else {
    test.context = [test.context, context];
  }
}

function walkSuite(suite: MochaSuite, visit: (test: MochaTest) => void): void {
  (suite.tests || []).forEach(visit);
  (suite.suites || []).forEach((child) => walkSuite(child, visit));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Finds the mochawesome JSON report that mocha just wrote for the given spec by
 * matching `results[0].fullFile`/`file` against the spec's absolute path, preferring
 * the most recently written candidate if more than one matches.
 */
async function findMochawesomeReportFile(specAbsolutePath: string): Promise<string | null> {
  for (let attempt = 0; attempt < MOCHAWESOME_LOOKUP_RETRIES; attempt += 1) {
    if (fs.existsSync(MOCHAWESOME_REPORT_DIR)) {
      const candidates = fs
        .readdirSync(MOCHAWESOME_REPORT_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((name) => path.join(MOCHAWESOME_REPORT_DIR, name));

      let bestMatch: { file: string; mtimeMs: number } | null = null;
      for (const candidate of candidates) {
        try {
          const json = fs.readJsonSync(candidate) as MochawesomeReport;
          const rootSuite = json.results?.[0];
          const reportFile = rootSuite?.fullFile || rootSuite?.file;
          if (reportFile && path.resolve(reportFile) === specAbsolutePath) {
            const { mtimeMs } = fs.statSync(candidate);
            if (!bestMatch || mtimeMs > bestMatch.mtimeMs) {
              bestMatch = { file: candidate, mtimeMs };
            }
          }
        } catch {
          // Report may still be mid-write; ignore and retry on the next pass.
        }
      }

      if (bestMatch) {
        return bestMatch.file;
      }
    }

    await sleep(MOCHAWESOME_LOOKUP_DELAY_MS);
  }

  return null;
}

/**
 * Merges the benchmark report collected for a spec (if any) into the mochawesome JSON
 * report mocha generated for that same spec, then removes the staged benchmark file.
 * No-ops if the spec never recorded any benchmarks.
 */
export async function injectBenchmarksIntoMochawesome(specRelative: string): Promise<void> {
  const benchmarkReport = readBenchmarkReport(specRelative);
  if (!benchmarkReport) {
    return;
  }

  const specAbsolutePath = path.resolve(process.cwd(), specRelative);
  const mochawesomeFile = await findMochawesomeReportFile(specAbsolutePath);
  if (!mochawesomeFile) {
    throw new Error(`No mochawesome report found for spec "${specRelative}"`);
  }

  const mochawesomeJson = fs.readJsonSync(mochawesomeFile) as MochawesomeReport;
  const rootSuite = mochawesomeJson.results?.[0];
  if (!rootSuite) {
    throw new Error(`Mochawesome report "${mochawesomeFile}" has no results`);
  }

  const context = formatBenchmarkContext(benchmarkReport);
  walkSuite(rootSuite, (test) => addContextToTest(test, context));

  fs.writeJsonSync(mochawesomeFile, mochawesomeJson, { spaces: 2 });
  fs.removeSync(benchmarkReportPath(specRelative));
}
