import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ViewportObserver } from "../../src/observers/ViewportObserver";

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  trigger(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

describe("ViewportObserver", () => {
  const originalIO = (globalThis as any).IntersectionObserver;

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
  });

  afterEach(() => {
    (globalThis as any).IntersectionObserver = originalIO;
  });

  it("reports distance 0 when intersecting", () => {
    const observer = new ViewportObserver(1000);
    const el = document.createElement("div");
    const cb = vi.fn();
    observer.observe(el, cb);

    const fake = FakeIntersectionObserver.instances[0]!;
    fake.trigger([
      {
        target: el,
        isIntersecting: true,
        boundingClientRect: { top: 0, bottom: 10, left: 0, right: 10 } as DOMRectReadOnly,
        rootBounds: { top: 0, bottom: 800, left: 0, right: 600 } as DOMRectReadOnly,
      },
    ]);

    expect(cb).toHaveBeenCalledWith(0, true);
  });

  it("estimates positive distance when element is below the expanded root", () => {
    const observer = new ViewportObserver(1000);
    const el = document.createElement("div");
    const cb = vi.fn();
    observer.observe(el, cb);

    const fake = FakeIntersectionObserver.instances[0]!;
    fake.trigger([
      {
        target: el,
        isIntersecting: false,
        boundingClientRect: { top: 2000, bottom: 2100, left: 0, right: 10 } as DOMRectReadOnly,
        rootBounds: { top: 0, bottom: 1800, left: 0, right: 600 } as DOMRectReadOnly,
      },
    ]);

    expect(cb).toHaveBeenCalledWith(200, false);
  });

  it("falls back to immediate eligibility when IntersectionObserver is unsupported", () => {
    (globalThis as any).IntersectionObserver = undefined;
    const observer = new ViewportObserver(1000);
    const el = document.createElement("div");
    const cb = vi.fn();

    observer.observe(el, cb);

    expect(cb).toHaveBeenCalledWith(0, true);
  });

  it("unobserve stops delivering callbacks for that element", () => {
    const observer = new ViewportObserver(1000);
    const el = document.createElement("div");
    const cb = vi.fn();
    observer.observe(el, cb);
    observer.unobserve(el);

    const fake = FakeIntersectionObserver.instances[0]!;
    fake.trigger([
      {
        target: el,
        isIntersecting: true,
        boundingClientRect: {} as DOMRectReadOnly,
        rootBounds: {} as DOMRectReadOnly,
      },
    ]);

    expect(cb).not.toHaveBeenCalled();
  });
});
