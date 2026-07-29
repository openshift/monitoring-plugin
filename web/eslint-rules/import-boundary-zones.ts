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

export function buildImportBoundaryZones(directoryPrefix = './src/features'): Zone[] {
  const features = getSubdirectories(directoryPrefix);

  const crossFeatureZones: Zone[] = features.map((feature) => ({
    target: `${directoryPrefix}/${feature}`,
    from: directoryPrefix,
    except: [`./${feature}`],
    message:
      `Feature '${feature}' must not import from other features. ` +
      'Move shared code to src/shared/ instead.',
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

  return [...crossFeatureZones, ...crossPageZones];
}

export const importBoundaryZones = buildImportBoundaryZones(
  path.resolve(process.cwd(), 'src/features'),
);
