/**
 * A DOM small enough to test the shell against, since the repo ships zero
 * runtime dependencies and the shell only uses createElement / append /
 * replaceChildren / getElementById / textContent / className / attributes.
 *
 * Deliberately not a DOM implementation: it supports exactly what `shell.ts`
 * calls, so a shell change that reaches for something new fails loudly here
 * rather than passing against a permissive mock.
 */
export class FakeElement {
  tagName: string;
  className = "";
  href = "";
  children: FakeElement[] = [];
  private attrs = new Map<string, string>();
  private text = "";
  ownerDocument: FakeDocument;

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
  }

  set textContent(value: string) {
    this.text = value;
    this.children = [];
  }

  get textContent(): string {
    return this.children.length > 0 ? this.children.map((c) => c.textContent).join("") : this.text;
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children = [...nodes];
    this.text = "";
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  /** Test helper: every descendant with the given class, document order. */
  queryClass(cls: string): FakeElement[] {
    const hits: FakeElement[] = [];
    const walk = (el: FakeElement) => {
      for (const c of el.children) {
        if (c.className.split(/\s+/).includes(cls)) hits.push(c);
        walk(c);
      }
    };
    walk(this);
    return hits;
  }
}

export class FakeDocument {
  title = "";
  private byId = new Map<string, FakeElement>();

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  getElementById(id: string): FakeElement | null {
    return this.byId.get(id) ?? null;
  }

  /** Seed a root element, as the served document does. */
  mountRoot(id = "root"): FakeElement {
    const el = new FakeElement("div", this);
    this.byId.set(id, el);
    return el;
  }
}

export interface FakeHost {
  document: FakeDocument;
  location: { hash: string };
  listeners: Map<string, (() => void)[]>;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  /** Set the hash and fire hashchange, as a browser would. */
  navigate(hash: string): void;
}

export function makeHost(hash = ""): FakeHost {
  const document = new FakeDocument();
  document.mountRoot();
  const listeners = new Map<string, (() => void)[]>();
  return {
    document,
    location: { hash },
    listeners,
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
    },
    navigate(next) {
      this.location.hash = next;
      for (const fn of listeners.get("hashchange") ?? []) fn();
    },
  };
}
