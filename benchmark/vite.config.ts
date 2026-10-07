import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

// The benchmark imports react-fastload directly from source (not the built
// dist/) so it always reflects the current state of the library during
// development. `npm run build` in the library root produces the real
// published package for actual consumers.

const GITHUB_URL = "https://github.com/abhishek-kumar-pundir/react-fastload";
const NPM_URL = "https://www.npmjs.com/package/react-fastload";

/**
 * Injects the metadata that depends on WHERE the benchmark is deployed, and
 * the JSON-LD block (so there is a single source of truth for both).
 *
 * The production URL of the benchmark is not known to this repository, so
 * it is never invented. Set VITE_SITE_URL at build time, e.g.
 *
 *   VITE_SITE_URL=https://benchmark.example.com npm run build
 *
 * (or put it in benchmark/.env.production — see .env.example). When it is
 * not set, NONE of the URL-bearing tags are emitted (canonical, og:url,
 * og:image, JSON-LD `url`). og:image is only emitted when VITE_SITE_URL is
 * set AND public/og-image.png exists. localhost / private URLs are
 * rejected, so dev URLs can never end up in production metadata.
 */
function seoPlugin(siteUrlRaw: string | undefined, publicDir: string): Plugin {
  const siteUrl = normalizeSiteUrl(siteUrlRaw);
  const hasOgImage = fs.existsSync(path.join(publicDir, "og-image.png"));

  return {
    name: "react-fastload-seo",
    transformIndexHtml() {
      const tags: HtmlTagDescriptor[] = [];
      const meta = (attrs: Record<string, string>) => tags.push({ tag: "meta", attrs, injectTo: "head" });

      if (siteUrl) {
        tags.push({ tag: "link", attrs: { rel: "canonical", href: `${siteUrl}/` }, injectTo: "head" });
        meta({ property: "og:url", content: `${siteUrl}/` });
      }
      if (siteUrl && hasOgImage) {
        const image = `${siteUrl}/og-image.png`;
        meta({ property: "og:image", content: image });
        meta({ property: "og:image:width", content: "1200" });
        meta({ property: "og:image:height", content: "630" });
        meta({ property: "og:image:alt", content: "ReactFastLoad scheduling timeline dashboard" });
        meta({ name: "twitter:image", content: image });
      }
      meta({ name: "twitter:card", content: siteUrl && hasOgImage ? "summary_large_image" : "summary" });

      const jsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "ReactFastLoad",
        alternateName: "react-fastload",
        description: "Adaptive resource-loading scheduler for React",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web browser",
        isAccessibleForFree: true,
        license: "https://opensource.org/licenses/MIT",
        sameAs: [GITHUB_URL, NPM_URL],
      };
      if (siteUrl) jsonLd.url = `${siteUrl}/`;

      tags.push({
        tag: "script",
        attrs: { type: "application/ld+json" },
        // "<" escaped so the JSON can never terminate the script element.
        children: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        injectTo: "head",
      });
      return tags;
    },
  };
}

function normalizeSiteUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname;
    const isLocal =
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host === "[::1]" ||
      /^(127|10|0)\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (isLocal) return null; // never put dev URLs into production metadata
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  return {
    plugins: [react(), seoPlugin(env.VITE_SITE_URL, path.resolve(__dirname, "public"))],
    resolve: {
      alias: {
        "react-fastload": path.resolve(__dirname, "../src/index.ts"),
      },
    },
  };
});
