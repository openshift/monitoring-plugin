/*
Shared benchmark utilities for performance tests.

Provides timing instrumentation (markStart / recordBenchmark), structured
JSON report writing, and a formatted CI summary table.  Mochawesome context
injection happens server-side in cypress.config.ts (after:spec hook).

All performance specs should use these instead of rolling
their own — keeps threshold semantics and output format consistent.
*/

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkResult {
  label: string;
  elapsedMs: number;
  thresholdMs: number;
}

export interface BenchmarkReportEntry {
  label: string;
  elapsedMs: number;
  thresholdMs: number;
  status: 'pass' | 'fail';
  headroom: number;
}

export interface BenchmarkReport {
  specFile: string;
  timestamp: string;
  environment: {
    browser: string;
    cypressVersion: string;
    viewport: string;
  };
  benchmarks: BenchmarkReportEntry[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    slowest: string | null;
    fastest: string | null;
  };
}

// ---------------------------------------------------------------------------
// Collector — one instance per spec file
// ---------------------------------------------------------------------------

export class BenchmarkCollector {
  private results: BenchmarkResult[] = [];
  private allResults: BenchmarkResult[] = [];
  private specFile: string;

  constructor(specFile: string) {
    this.specFile = specFile;
  }

  /** Place a Performance.mark at the current point in time. */
  markStart(label: string): void {
    cy.window({ log: false }).then((win) => {
      win.performance.clearMarks(label);
      win.performance.clearMeasures(`measure:${label}`);
      win.performance.mark(label);
    });
  }

  /**
   * Measure elapsed time since the matching markStart call, assert against
   * the threshold, and collect the result.
   *
   * Threshold semantics: elapsed <= thresholdMs  →  PASS.
   */
  recordBenchmark(label: string, thresholdMs: number): void {
    cy.window({ log: false }).then((win) => {
      const entry = win.performance.measure(`measure:${label}`, label);
      const elapsedMs = Math.round(entry.duration);
      const result = { label, elapsedMs, thresholdMs };
      this.results.push(result);
      this.allResults.push(result);

      const status = elapsedMs <= thresholdMs ? 'PASS' : 'FAIL';
      const msg = `BENCHMARK [${status}] ${label}: ${elapsedMs}ms (threshold: ${thresholdMs}ms)`;
      cy.log(msg);
      cy.task('log', msg);

      expect(elapsedMs, `${label} should complete within ${thresholdMs}ms`).to.be.at.most(
        thresholdMs,
      );
    });
  }

  // -------------------------------------------------------------------------
  // afterEach — summary table
  // -------------------------------------------------------------------------

  /**
   * Call from afterEach(() => { collector.reportAfterEach(); }).
   * Logs the summary table and clears per-test results.
   */
  reportAfterEach(): void {
    if (this.results.length === 0) return;

    const enriched = this.enrichResults();
    this.logSummaryTable(enriched);

    this.results.length = 0;
  }

  // -------------------------------------------------------------------------
  // after — write JSON report file
  // -------------------------------------------------------------------------

  /**
   * Call from after(() => { collector.writeReport(); }).
   * Writes a JSON file to cypress/reports/benchmarks/.
   */
  writeReport(): void {
    if (this.allResults.length === 0) return;

    const enriched = this.enrichResults(this.allResults);
    const report = this.buildReport(enriched);

    cy.task('writeBenchmarkReport', report);
    this.allResults.length = 0;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private enrichResults(source: BenchmarkResult[] = this.results): BenchmarkReportEntry[] {
    return source.map((r) => ({
      label: r.label,
      elapsedMs: r.elapsedMs,
      thresholdMs: r.thresholdMs,
      status: (r.elapsedMs <= r.thresholdMs ? 'pass' : 'fail') as 'pass' | 'fail',
      headroom: +((r.thresholdMs - r.elapsedMs) / r.thresholdMs).toFixed(3),
    }));
  }

  private buildReport(entries: BenchmarkReportEntry[]): BenchmarkReport {
    const passed = entries.filter((e) => e.status === 'pass').length;
    const sorted = [...entries].sort((a, b) => b.elapsedMs - a.elapsedMs);

    return {
      specFile: this.specFile,
      timestamp: new Date().toISOString(),
      environment: {
        browser: Cypress.browser?.displayName ?? 'unknown',
        cypressVersion: Cypress.version,
        viewport: `${Cypress.config('viewportWidth')}x${Cypress.config('viewportHeight')}`,
      },
      benchmarks: entries,
      summary: {
        total: entries.length,
        passed,
        failed: entries.length - passed,
        slowest: sorted[0]?.label ?? null,
        fastest: sorted[sorted.length - 1]?.label ?? null,
      },
    };
  }

  private logSummaryTable(entries: BenchmarkReportEntry[]): void {
    const labelWidth = Math.max(20, ...entries.map((e) => e.label.length)) + 2;

    const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
    const rpad = (s: string, w: number) => ' '.repeat(Math.max(0, w - s.length)) + s;
    const fmtMs = (ms: number) => ms.toLocaleString('en-US') + 'ms';
    const fmtHeadroom = (h: number) => (h >= 0 ? '+' : '') + Math.round(h * 100) + '%';

    const hdr =
      `| ${pad('Benchmark', labelWidth)}` +
      `| ${rpad('Elapsed', 10)} ` +
      `| ${rpad('Threshold', 10)} ` +
      `| ${rpad('Headroom', 9)} ` +
      `| ${pad('Status', 6)} |`;

    const sep = hdr.replace(/[^|]/g, '-');

    const rows = entries.map(
      (e) =>
        `| ${pad(e.label, labelWidth)}` +
        `| ${rpad(fmtMs(e.elapsedMs), 10)} ` +
        `| ${rpad(fmtMs(e.thresholdMs), 10)} ` +
        `| ${rpad(fmtHeadroom(e.headroom), 9)} ` +
        `| ${pad(e.status.toUpperCase(), 6)} |`,
    );

    const table = [sep, hdr, sep, ...rows, sep].join('\n');

    cy.task('log', '\n' + table);
  }
}
