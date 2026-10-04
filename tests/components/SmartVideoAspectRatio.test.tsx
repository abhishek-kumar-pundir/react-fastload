import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FastLoadProvider } from "../../src/components/FastLoadProvider";
import { SmartVideo } from "../../src/components/SmartVideo";

// Regression test for a real CLS bug caught during benchmarking: the
// pre-eligible placeholder and the real <video> element had different
// default box sizes (minHeight:120 vs. the video's natural rendered
// height), so swapping between them shifted layout. aspectRatio fixes
// this by reserving the same box for both states.

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("SmartVideo aspectRatio", () => {
  beforeEach(() => {
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
  });

  it("applies the same aspect-ratio to the pre-eligible placeholder and the real <video>", async () => {
    render(
      <FastLoadProvider>
        <SmartVideo src="/clip.mp4" poster="/poster.jpg" priority="LOW" strategy="lazy" aspectRatio="16/9" />
      </FastLoadProvider>
    );

    const placeholder = screen.getByRole("button", { name: "Load video" });
    expect(placeholder.style.aspectRatio).toBe("16/9");
  });

  it("applies aspectRatio to the mounted <video> for CRITICAL/eager priority", async () => {
    render(
      <FastLoadProvider>
        <SmartVideo src="/clip.mp4" poster="/poster.jpg" priority="CRITICAL" aspectRatio="16/9" />
      </FastLoadProvider>
    );

    await waitFor(() => {
      const video = document.querySelector("video");
      expect(video).not.toBeNull();
      expect((video as HTMLVideoElement).style.aspectRatio).toBe("16/9");
    });
  });
});
