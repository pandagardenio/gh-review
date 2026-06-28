/**
 * CSP-safe DOM construction (BL-001 / CLAUDE.md / MVP.md §6).
 *
 * github.com's CSP forbids inline `style="…"` attributes and `on*` handlers
 * carried via `innerHTML`. All injected UI must be built with `createElement` +
 * CSSOM (`element.style`) + `addEventListener`. These helpers make that the path
 * of least resistance and keep `innerHTML` out of the codebase entirely.
 */

type StyleProps = Partial<CSSStyleDeclaration>;

type Listeners = {
  [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void;
};

export interface ElementOptions {
  /** Class names to apply. */
  class?: string | string[];
  /** Inline styles, applied via CSSOM (never a `style=` attribute string). */
  style?: StyleProps;
  /** Text content. Set as `textContent`, so it is never parsed as HTML. */
  text?: string;
  /** Non-style attributes (e.g. `href`, `role`, `aria-*`, `data-*`). */
  attrs?: Record<string, string>;
  /** Event listeners, attached via `addEventListener`. */
  on?: Listeners;
  /** Child nodes to append. */
  children?: (Node | string)[];
}

/**
 * Create an element the CSP-safe way. No `innerHTML`, no inline `style`/`on*`
 * attributes — styles go through CSSOM and handlers through `addEventListener`.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (options.class) {
    const classes = Array.isArray(options.class) ? options.class : [options.class];
    node.classList.add(...classes);
  }

  if (options.style) {
    Object.assign(node.style, options.style);
  }

  if (options.text !== undefined) {
    node.textContent = options.text;
  }

  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      node.setAttribute(name, value);
    }
  }

  if (options.on) {
    for (const [type, handler] of Object.entries(options.on)) {
      node.addEventListener(type, handler as EventListener);
    }
  }

  if (options.children) {
    for (const child of options.children) {
      node.append(child);
    }
  }

  return node;
}
