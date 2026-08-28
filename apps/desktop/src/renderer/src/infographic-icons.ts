interface IconData {
  body: string;
  height?: number;
  width?: number;
}

interface IconCollection {
  height?: number;
  icons: Record<string, IconData>;
  width?: number;
}

const collectionLoaders = {
  lucide: () =>
    import('@iconify-json/lucide/icons.json').then(
      (module) => module.default as unknown as IconCollection,
    ),
  mdi: () =>
    import('@iconify-json/mdi/icons.json').then(
      (module) => module.default as unknown as IconCollection,
    ),
};

const collections = new Map<string, Promise<IconCollection>>();
const resolvedIcons = new Map<string, Promise<string | undefined>>();

const loadCollection = (prefix: keyof typeof collectionLoaders): Promise<IconCollection> => {
  const existing = collections.get(prefix);
  if (existing) return existing;
  const loading = collectionLoaders[prefix]();
  collections.set(prefix, loading);
  return loading;
};

const createSvg = (collection: IconCollection, icon: IconData): string => {
  const width = icon.width ?? collection.width ?? 24;
  const height = icon.height ?? collection.height ?? 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${icon.body}</svg>`;
};

const resolve = async (query: string): Promise<string | undefined> => {
  const normalized = query.trim().toLowerCase();
  const slash = normalized.indexOf('/');
  const explicitPrefix = slash > 0 ? normalized.slice(0, slash) : undefined;
  const name = slash > 0 ? normalized.slice(slash + 1) : normalized;
  const prefixes: Array<keyof typeof collectionLoaders> =
    explicitPrefix === 'lucide' || explicitPrefix === 'mdi'
      ? [explicitPrefix]
      : explicitPrefix
        ? []
        : ['lucide', 'mdi'];

  for (const prefix of prefixes) {
    const collection = await loadCollection(prefix);
    const icon = collection.icons[name];
    if (icon) return createSvg(collection, icon);
  }
  return undefined;
};

export const resolveInfographicIcon = (query: string): Promise<string | undefined> => {
  const normalized = query.trim().toLowerCase();
  const existing = resolvedIcons.get(normalized);
  if (existing) return existing;
  const resolving = resolve(normalized);
  resolvedIcons.set(normalized, resolving);
  return resolving;
};
