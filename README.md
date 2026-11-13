# Little Toronto

A tiny wooden puzzle of Toronto, built piece by piece on your phone. A birthday gift for Joseline.

- 49 laser-cut style pieces across 8 chapters: the base, Queen Street, a bay-and-gable row, the 504 streetcar, the Gooderham Flatiron, the CN Tower, the neighbourhood and a birthday surprise.
- Tap a piece from the tray that snaps onto something already built. Drag to turn the city, pinch to zoom. Some pieces hide on the back.
- When the last piece lands the city lights up for the night.

Plain static site: `index.html` + ES modules, three.js loaded from a pinned CDN. No build step.

Run locally:

```bash
npx serve .
```

Phones and tablets only. Desktop browsers see a QR code instead (a desktop can be unlocked with a private key in the URL).
