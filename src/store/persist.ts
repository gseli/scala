/** Tiny observable store persisted to localStorage. */
export function persistentStore<T extends object>(key: string, defaults: T) {
  let value: T = defaults;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* private mode or corrupt data: keep defaults */
  }
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(patch: Partial<T>) {
      value = { ...value, ...patch };
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage full or blocked */
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
