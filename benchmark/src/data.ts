/**
 * Deliberately expensive, intentionally-not-optimized content for the
 * benchmark. Images are generated, self-hosted assets (see
 * `scripts/generate-assets.py` and `public/gallery/`) served directly by
 * Vite's static file server with plain 200 responses — earlier versions
 * used picsum.photos, whose `/id/N/W/H` URLs 302-redirect to a CDN host
 * before the actual JPEG, which added noise/steps to the network
 * waterfall a clean benchmark shouldn't have. Byte sizes below are the
 * REAL sizes of the generated files (from asset-sizes.json), not a
 * formula guess — see METHODOLOGY for why that distinction matters.
 */
import assetSizes from "./asset-sizes.json";

export type ScenarioName = "light" | "heavy" | "extreme";

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  /** REAL file size in bytes of the generated JPEG, not an estimate. */
  estimatedSize: number;
}

export interface VideoAsset {
  id: string;
  src: string;
  poster: string;
  posterSize: number;
  /** Video bytes are NOT known exactly (external sample clips) — this stays a rough estimate; see METHODOLOGY.md. */
  estimatedSize: number;
}

export interface ScenarioConfig {
  name: ScenarioName;
  label: string;
  description: string;
  imageCount: number;
  videoCount: number;
  widgetCount: number;
}

export const SCENARIOS: Record<ScenarioName, ScenarioConfig> = {
  light: {
    name: "light",
    label: "Light",
    description: "5 images, 1 component, 0 videos — expect Baseline ≈ ReactFastLoad.",
    imageCount: 5,
    videoCount: 0,
    widgetCount: 1,
  },
  heavy: {
    name: "heavy",
    label: "Heavy",
    description: "30 images, 3 videos, 10 components — expect a real, measurable gap.",
    imageCount: 30,
    videoCount: 3,
    widgetCount: 10,
  },
  extreme: {
    name: "extreme",
    label: "Extreme",
    description: "50 images, 5 videos, 20 components — stress test for the scheduler.",
    imageCount: 50,
    videoCount: 5,
    widgetCount: 20,
  },
};

export function parseScenario(value: string | null): ScenarioName {
  return value === "heavy" || value === "extreme" ? value : "light";
}

export function buildGallery(count: number): GalleryImage[] {
  return Array.from({ length: count }, (_, i) => {
    const id = 100 + i;
    const large = i % 7 === 0;
    const width = large ? 1600 : 600;
    const height = large ? 1000 : 400;
    return {
      id: String(id),
      src: `/gallery/${id}.jpg`,
      alt: `Gallery photo ${i + 1}`,
      width,
      height,
      estimatedSize: (assetSizes.gallery as Record<string, number>)[String(id)] ?? 0,
    };
  });
}

// MDN's CC0 sample clips remain external — generating real video files isn't
// practical in this environment. These are small clips (a few MB) and,
// unlike the old image host, don't redirect before serving.
const VIDEO_SOURCES = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
];

export function buildVideos(count: number): VideoAsset[] {
  return Array.from({ length: count }, (_, i) => {
    const posterId = 1040 + i;
    return {
      id: `video-${i}`,
      src: VIDEO_SOURCES[i % VIDEO_SOURCES.length]!,
      poster: `/posters/${posterId}.jpg`,
      posterSize: (assetSizes.posters as Record<string, number>)[String(posterId)] ?? 0,
      // Genuinely unknown without fetching the file ourselves — labeled
      // "estimated" deliberately, unlike the now-exact image sizes above.
      estimatedSize: 4_500_000,
    };
  });
}

export const heroImage: GalleryImage = {
  id: "hero",
  src: "/hero.jpg",
  alt: "Hero banner",
  width: 1600,
  height: 900,
  estimatedSize: assetSizes.hero,
};
