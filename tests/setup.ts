import "@testing-library/react";

// jsdom does not implement IntersectionObserver or PerformanceObserver.
// Individual test files install more specific mocks where behavior matters;
// this global stub just prevents "not defined" crashes for code paths that
// merely check `"IntersectionObserver" in window`.
if (typeof (globalThis as any).IntersectionObserver === "undefined") {
  (globalThis as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
