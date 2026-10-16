type Child = Node | string | null | undefined | false;

/** Tiny hyperscript helper for the DOM overlay. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & {
    class?: string;
    dataset?: Record<string, string>;
  } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { class: cls, dataset, ...rest } = props;
  if (cls) el.className = cls;
  if (dataset) Object.assign(el.dataset, dataset);
  Object.assign(el, rest);
  for (const child of children) {
    if (child) el.append(child);
  }
  return el;
}

export function uiRoot(): HTMLElement {
  const root = document.getElementById('ui');
  if (!root) throw new Error('#ui overlay missing');
  return root;
}

/** localStorage that never throws (private mode, blocked storage…). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Preferences are a convenience; ignore storage failures.
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // As above.
    }
  },
};
