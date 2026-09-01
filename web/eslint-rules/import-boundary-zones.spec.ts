import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildImportBoundaryZones,
  getPageScopes,
  getSubdirectories,
} from './import-boundary-zones';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'boundary-zones-test-'));
}

function mkdir(base: string, ...segments: string[]): string {
  const full = path.join(base, ...segments);
  fs.mkdirSync(full, { recursive: true });
  return full;
}

/** Creates an empty file. */
function touch(base: string, ...segments: string[]): void {
  const full = path.join(base, ...segments);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '');
}

describe('subdirectories', () => {
  let tmp: string;
  beforeEach(() => (tmp = makeTmpDir()));
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('returns names of immediate subdirectories', () => {
    mkdir(tmp, 'alpha');
    mkdir(tmp, 'beta');
    expect(getSubdirectories(tmp).sort()).toEqual(['alpha', 'beta']);
  });

  it('excludes files', () => {
    mkdir(tmp, 'a-dir');
    touch(tmp, 'a-file.ts');
    expect(getSubdirectories(tmp)).toEqual(['a-dir']);
  });

  it('returns an empty array when the directory does not exist', () => {
    expect(getSubdirectories(path.join(tmp, 'nonexistent'))).toEqual([]);
  });

  it('returns an empty array for an empty directory', () => {
    expect(getSubdirectories(tmp)).toEqual([]);
  });
});

describe('getPageScopes', () => {
  let tmp: string;
  beforeEach(() => (tmp = makeTmpDir()));
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('includes subdirectories ending with "-page"', () => {
    mkdir(tmp, 'alerts-page');
    mkdir(tmp, 'silences-page');
    expect(getPageScopes(tmp).sort()).toEqual(['alerts-page', 'silences-page']);
  });

  it('includes files matching *Page.tsx', () => {
    touch(tmp, 'AlertsDetailsPage.tsx');
    touch(tmp, 'SilenceCreatePage.tsx');
    expect(getPageScopes(tmp).sort()).toEqual(['AlertsDetailsPage.tsx', 'SilenceCreatePage.tsx']);
  });

  it('excludes subdirectories not ending with "-page"', () => {
    mkdir(tmp, 'alerts-page');
    mkdir(tmp, 'components');
    mkdir(tmp, 'helpers');
    expect(getPageScopes(tmp)).toEqual(['alerts-page']);
  });

  it('excludes files not matching *Page.tsx', () => {
    touch(tmp, 'AlertsDetailsPage.tsx');
    touch(tmp, 'filter-alerts.ts');
    touch(tmp, 'utils.tsx');
    expect(getPageScopes(tmp)).toEqual(['AlertsDetailsPage.tsx']);
  });

  it('handles a mix of -page dirs and *Page.tsx files', () => {
    mkdir(tmp, 'alerts-page');
    touch(tmp, 'AlertsDetailsPage.tsx');
    touch(tmp, 'filter-alerts.ts');
    expect(getPageScopes(tmp).sort()).toEqual(['AlertsDetailsPage.tsx', 'alerts-page']);
  });

  it('returns an empty array when the directory does not exist', () => {
    expect(getPageScopes(path.join(tmp, 'nonexistent'))).toEqual([]);
  });
});

describe('buildImportBoundaryZones', () => {
  let tmp: string;
  beforeEach(() => (tmp = makeTmpDir()));
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('produces one cross-feature zone per feature', () => {
    mkdir(tmp, 'alerts');
    mkdir(tmp, 'metrics');
    const zones = buildImportBoundaryZones(tmp);
    const featureZones = zones.filter((z) => z.from === tmp);
    expect(featureZones).toHaveLength(2);
  });

  it('cross-feature zone targets and exceptions are correct', () => {
    mkdir(tmp, 'alerts');
    const [zone] = buildImportBoundaryZones(tmp);
    expect(zone.target).toBe(`${tmp}/alerts`);
    expect(zone.from).toBe(tmp);
    expect(zone.except).toEqual(['./alerts']);
  });

  it('cross-feature zone message names the feature', () => {
    mkdir(tmp, 'alerts');
    const [zone] = buildImportBoundaryZones(tmp);
    expect(zone.message).toContain("Feature 'alerts'");
  });

  it('produces one cross-page zone per page scope', () => {
    mkdir(tmp, 'alerts', 'pages', 'alerts-page');
    mkdir(tmp, 'alerts', 'pages', 'silences-page');
    touch(tmp, 'alerts', 'pages', 'AlertsDetailsPage.tsx');
    const zones = buildImportBoundaryZones(tmp);
    const pageZones = zones.filter((z) => z.from !== tmp);
    expect(pageZones).toHaveLength(3);
  });

  it('cross-page zone targets and exceptions are correct', () => {
    mkdir(tmp, 'alerts', 'pages', 'alerts-page');
    const zones = buildImportBoundaryZones(tmp);
    const pageZone = zones.find((z) => z.target.includes('alerts-page'))!;
    expect(pageZone.target).toBe(`${tmp}/alerts/pages/alerts-page`);
    expect(pageZone.from).toBe(`${tmp}/alerts/pages`);
    expect(pageZone.except).toEqual(['./alerts-page']);
  });

  it('cross-page zone message names the page', () => {
    mkdir(tmp, 'alerts', 'pages', 'alerts-page');
    const zones = buildImportBoundaryZones(tmp);
    const pageZone = zones.find((z) => z.target.includes('alerts-page'))!;
    expect(pageZone.message).toContain("Page 'alerts-page'");
  });

  it('ignores feature directories that have no pages/ directory', () => {
    mkdir(tmp, 'alerts');
    // No pages/ subdirectory created
    const zones = buildImportBoundaryZones(tmp);
    const pageZones = zones.filter((z) => z.from !== tmp);
    expect(pageZones).toHaveLength(0);
  });

  it('returns an empty array when the features directory is empty', () => {
    expect(buildImportBoundaryZones(tmp)).toEqual([]);
  });
});
