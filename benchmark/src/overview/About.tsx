import React from "react";
import { GITHUB_URL, NPM_URL } from "./site";

/**
 * Visible explanation of what the project is. Every statement here is
 * taken from the library's own README / source (features, API names) —
 * no performance claims, ratings or numbers.
 */
export function About() {
  return (
    <section className="rfl-about" aria-labelledby="rfl-about-h">
      <div>
        <h2 id="rfl-about-h">What is ReactFastLoad?</h2>
        <p style={{ marginTop: 14 }}>
          ReactFastLoad is an open-source resource-loading scheduler for React, published on npm as <code>react-fastload</code>. It
          coordinates the images, video, audio and lazily imported components you register through <code>SmartImage</code>,{" "}
          <code>SmartVideo</code>, <code>SmartAudio</code> and <code>lazyComponent</code>, deciding <strong>when</strong> each one is
          handed to the browser and in <strong>what order</strong>.
        </p>
        <p>
          It is not a CDN, a fetch interceptor, or a compression tool, and it does not make a download itself faster. This page
          visualizes the scheduling decisions so you can inspect them.
        </p>
        <div className="rfl-install">npm install react-fastload</div>
        <div className="rfl-links">
          <a className="rfl-btn" href={GITHUB_URL}>
            View on GitHub
          </a>
          <a className="rfl-btn" href={NPM_URL}>
            View on npm
          </a>
        </div>
      </div>

      <div>
        <dl className="rfl-concepts">
          <div>
            <dt>Priority scheduling</dt>
            <dd>Resources are ranked CRITICAL, HIGH, NORMAL, LOW or IDLE, so important content is dispatched before the rest.</dd>
          </div>
          <div>
            <dt>Concurrency control</dt>
            <dd>A cap on how many scheduler-dispatched loads run at once; the others wait in a queue.</dd>
          </div>
          <div>
            <dt>Viewport-aware preloading</dt>
            <dd>One shared IntersectionObserver makes a resource eligible when it comes within a configurable distance of the viewport.</dd>
          </div>
          <div>
            <dt>Resource deduplication</dt>
            <dd>Components that resolve to the same resource id share one registry entry and one load.</dd>
          </div>
          <div>
            <dt>Connection awareness</dt>
            <dd>LOW and IDLE resources are pushed back on slow or data-saver connections.</dd>
          </div>
          <div>
            <dt>Browser performance metrics</dt>
            <dd>A hook exposes Web Vitals and Resource Timing readings next to the scheduler's own counters, kept separate.</dd>
          </div>
        </dl>

        <div className="rfl-honest">
          <h3>How to read this page</h3>
          <ul>
            <li>
              <strong>Controlled demonstration.</strong> Loads here are fixed artificial delays, not network requests. The page shows what
              the scheduler does, not how fast a real page loads.
            </li>
            <li>
              <strong>Real timestamps.</strong> Eligible, started and completed times are read from the scheduler's registry with{" "}
              <code>performance.now()</code> in this browser.
            </li>
            <li>
              <strong>Includes page overhead.</strong> The first resources' queue wait includes registration and React rendering work on
              this page, so a small non-zero value is expected.
            </li>
            <li>
              <strong>Formulas.</strong> First dispatch = min(started). Queue wait = started − eligible, summarized by its median.
              Completion span = max(completed) − min(started), shown once every resource has finished.
            </li>
            <li>
              <strong>Single run.</strong> One run is one sample. Run it a few times; timings vary with CPU load and browser scheduling.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
