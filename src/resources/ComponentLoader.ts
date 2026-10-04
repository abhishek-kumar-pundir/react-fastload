export type DynamicImport<T> = () => Promise<{ default: T }>;

/**
 * Caches dynamic import() calls per LazyComponent instance so that the
 * scheduler triggering "load" more than once (which shouldn't normally
 * happen, but could under fast re-renders) never issues duplicate network
 * requests. The import promise itself is the cache key's value — React.lazy
 * expects a function that returns the *same* promise across renders once
 * resolved, so we memoize at this layer rather than inside the component.
 */
export function createComponentLoader<T>(importFn: DynamicImport<T>): DynamicImport<T> {
  let cached: Promise<{ default: T }> | undefined;

  return () => {
    if (!cached) {
      cached = importFn();
    }
    return cached;
  };
}
