import fs from 'fs';
import path from 'path';

export function getSubdirectories(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export function getPageScopes(pagesDirectory: string): string[] {
  if (!fs.existsSync(pagesDirectory)) return [];
  return fs
    .readdirSync(pagesDirectory, { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory() ? entry.name.endsWith('-page') : /Page\.tsx?$/.test(entry.name),
    )
    .map((entry) => entry.name);
}

export type Zone = {
  target: string;
  from: string;
  except: string[];
  message: string;
};

export function getPageComponentFiles(featuresDir: string, relativeTo?: string): string[] {
  const pagesDir = path.join(featuresDir, 'pages');
  if (!fs.existsSync(pagesDir)) return [];

  const baseDir = relativeTo ?? featuresDir;
  const pageFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/Page\.tsx?$/.test(entry.name)) {
        pageFiles.push(`./${path.relative(baseDir, full)}`);
      }
    }
  };
  walk(pagesDir);
  return pageFiles;
}

export function buildImportBoundaryZones(directoryPrefix = './src/features'): Zone[] {
  const features = getSubdirectories(directoryPrefix);

  // Page components may be imported across features (e.g. by routers), so
  // every page file is added as an explicit exception to each zone.
  const pageExceptionPaths = features.flatMap((feature) =>
    getPageComponentFiles(path.join(directoryPrefix, feature), directoryPrefix),
  );

  const crossFeatureZones: Zone[] = features.map((feature) => ({
    target: `${directoryPrefix}/${feature}`,
    from: directoryPrefix,
    except: [`./${feature}`, ...pageExceptionPaths],
    message:
      `Feature '${feature}' must not import from other features. ` +
      'Page components (*Page.tsx) are exempt and may be imported across features; ' +
      'all other shared code belongs in src/shared/ instead.',
  }));

  const crossPageZones: Zone[] = features.flatMap((feature) => {
    const pagesDir = path.join(directoryPrefix, feature, 'pages');
    return getPageScopes(pagesDir).map((page) => ({
      target: `${directoryPrefix}/${feature}/pages/${page}`,
      from: `${directoryPrefix}/${feature}/pages`,
      except: [`./${page}`],
      message:
        `Page '${page}' must not import from other pages. ` +
        "Move shared code to the feature's components/, hooks/, or utils/ instead.",
    }));
  });

  const sharedToFeatureZone: Zone = {
    target: path.resolve(directoryPrefix, '../shared'),
    from: directoryPrefix,
    except: [],
    message: 'Shared code must not import from features. Move shared dependencies to src/shared/.',
  };

  return [...crossFeatureZones, ...crossPageZones, sharedToFeatureZone];
}

export const importBoundaryZones = buildImportBoundaryZones(
  path.resolve(process.cwd(), 'src/features'),
);
