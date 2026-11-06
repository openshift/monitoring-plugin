const API_DISCOVERY_RESOURCES_LOCAL_STORAGE_KEY = 'bridge/api-discovery-resources';

export const getCachedResources = () => {
  const resourcesJSON = localStorage.getItem(API_DISCOVERY_RESOURCES_LOCAL_STORAGE_KEY);

  if (resourcesJSON) {
    const resources = JSON.parse(resourcesJSON);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Untyped SERVER_FLAGS.
    const windowWithFlags = window as any;
    const { consoleVersion: currentVersion } = windowWithFlags.SERVER_FLAGS;
    const { consoleVersion: cachedVersion } = resources;
    if (cachedVersion !== currentVersion) {
      return null;
    }
    return resources;
  }

  return null;
};
