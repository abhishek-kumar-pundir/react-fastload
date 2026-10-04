import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Flushes any pending microtasks (e.g. our mocked Image.onload, which now
// resolves via queueMicrotask) inside an act() scope. waitFor() alone
// wraps each of ITS OWN polling callbacks in act(), but the underlying
// state update can land on a microtask tick between polls, which is what
// produced the "not wrapped in act()" warning — this explicitly flushes
// first so the resulting state settles inside a known act() boundary.
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
import { FastLoadProvider } from "../../src/components/FastLoadProvider";
import { SmartImage } from "../../src/components/SmartImage";

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    FakeIntersectionObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(entries: Partial<IntersectionObserverEntry>[]) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

describe("SmartImage", () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;

    // jsdom's Image never fires load/error on its own; simulate immediate success.
    Object.defineProperty(global.Image.prototype, "src", {
      configurable: true,
      set(this: HTMLImageElement) {
        queueMicrotask(() => this.onload && (this.onload as any)(new Event("load")));
      },
    });
  });

  it("renders a placeholder div (not the real <img>) before entering the preload zone", () => {
    render(
      <FastLoadProvider>
        <SmartImage src="/photo.webp" alt="A photo" priority="LOW" strategy="lazy" />
      </FastLoadProvider>
    );

    const el = screen.getByRole("img", { name: "A photo" });
    expect(el.tagName).toBe("DIV");
  });

  it("renders a real <img> immediately for CRITICAL priority", async () => {
    render(
      <FastLoadProvider>
        <SmartImage src="/hero.webp" alt="Hero" priority="CRITICAL" />
      </FastLoadProvider>
    );

    await flushMicrotasks();
    const el = screen.getByRole("img", { name: "Hero" }) as HTMLImageElement;
    expect(el.tagName).toBe("IMG");
    expect(el.getAttribute("src")).toBe("/hero.webp");
  });

  it("mounts the real <img> once the element enters the preload zone", async () => {
    render(
      <FastLoadProvider preloadDistance={500}>
        <SmartImage src="/card.webp" alt="Card" priority="NORMAL" strategy="lazy" />
      </FastLoadProvider>
    );

    expect(screen.getByRole("img", { name: "Card" }).tagName).toBe("DIV");

    const fake = FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1]!;
    act(() => {
      fake.trigger([
        {
          target: screen.getByRole("img", { name: "Card" }),
          isIntersecting: true,
          boundingClientRect: { top: 0, bottom: 10, left: 0, right: 10 } as DOMRectReadOnly,
          rootBounds: { top: 0, bottom: 800, left: 0, right: 600 } as DOMRectReadOnly,
        },
      ]);
    });

    await flushMicrotasks();
    expect((screen.getByRole("img", { name: "Card" }) as HTMLImageElement).tagName).toBe("IMG");
  });
});
