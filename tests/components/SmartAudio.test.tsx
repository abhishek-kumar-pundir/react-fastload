import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { FastLoadProvider } from "../../src/components/FastLoadProvider";
import { SmartAudio } from "../../src/components/SmartAudio";

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

describe("SmartAudio", () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
    Object.defineProperty(global.Audio.prototype, "src", {
      configurable: true,
      set(this: HTMLAudioElement) {
        queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
      },
    });
  });

  it("renders a click-to-load placeholder (not a real <audio>) before entering the preload zone", () => {
    render(
      <FastLoadProvider>
        <SmartAudio src="/song.mp3" label="Track one" priority="LOW" strategy="lazy" />
      </FastLoadProvider>
    );
    const el = screen.getByRole("button", { name: "Load audio: Track one" });
    expect(el.tagName).toBe("DIV");
    expect(document.querySelector("audio")).toBeNull();
  });

  it("mounts a real <audio> immediately for CRITICAL priority", async () => {
    render(
      <FastLoadProvider>
        <SmartAudio src="/theme.mp3" priority="CRITICAL" />
      </FastLoadProvider>
    );

    await waitFor(() => {
      const el = document.querySelector("audio");
      expect(el).not.toBeNull();
      expect(el?.getAttribute("src")).toBe("/theme.mp3");
    });
  });

  it("mounts a real <audio> once clicked, even before entering the preload zone", async () => {
    render(
      <FastLoadProvider>
        <SmartAudio src="/song.mp3" label="Track two" priority="LOW" strategy="lazy" />
      </FastLoadProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Load audio: Track two" }));

    await waitFor(() => {
      expect(document.querySelector("audio")).not.toBeNull();
    });
  });
});
