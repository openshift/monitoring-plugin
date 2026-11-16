export function getOCPVersion() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const versionStr = (window as any).SERVER_FLAGS?.releaseVersion ?? '';
  const match = versionStr.match(/^(\d+)\.(\d+)/);
  if (match) {
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
    };
  }
  return undefined;
}
