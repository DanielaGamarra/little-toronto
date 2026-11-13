# Little Toronto

A tiny wooden puzzle of Toronto, built piece by piece. A birthday gift for Joseline.

- 54 laser-cut style pieces across 8 chapters: the base, Queen Street, a bay-and-gable row, the 504 streetcar, the Gooderham Flatiron (with a DAGA rooftop billboard), the CN Tower, an autumn neighbourhood (with two monkeys) and a birthday surprise.
- Tap a piece from the tray that snaps onto something already built. Drag to turn the city, pinch or scroll to zoom. Some pieces hide on the back.
- When the last piece lands the city lights up for the night.

Plain static site: `index.html` + ES modules, three.js loaded from a pinned CDN. No build step.

Run locally:

```bash
npx serve .
```

Works on phones, tablets and desktop browsers.

Before each commit run `sh scripts/bump.sh` so browsers fetch the new files instead of cached ones.
