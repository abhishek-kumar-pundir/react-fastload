# generate-assets.py

Generates the self-hosted benchmark images under `../public/gallery/`,
`../public/hero.jpg`, and `../public/posters/`, plus
`../src/asset-sizes.json` with their exact byte sizes.

Requires Pillow and numpy: `pip install Pillow numpy`.

Re-run this if you change image counts/dimensions in `src/data.ts`'s
`buildGallery`/`buildVideos` — the generated files and the manifest need
to stay in sync with what those functions expect to find at `/gallery/<id>.jpg`
and `/posters/<id>.jpg`.

```bash
python3 generate-assets.py
```

These are self-hosted specifically so the benchmark serves plain `200`
responses with no redirects (see docs/METHODOLOGY.md) and so image byte
sizes used in the "estimated deferred bytes" metric are exact, not a
formula guess.
