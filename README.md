# Engineering portfolio

Personal portfolio for Trylen Stephens, focused on controls, instrumentation, robotics, and industrial data analysis.

- [Portfolio](https://trylen22.github.io/)
- [Captioned project demonstrations](https://trylen22.github.io/demos/)

## Run locally

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`. This is a static GitHub Pages site with no package installation or build step. The main page uses a WebGL background; the demonstration gallery uses ordinary HTML and native video playback.

## Demonstrations

The `demos/` directory contains ten recorded walkthroughs. Each project page includes a preview, MP4 player, source link, and downloadable subtitles. Captions are burned into the video; an optional WebVTT track and editable SRT file are also provided.

Recordings distinguish simulations, concept animations, local application behavior, and existing lab footage. The gallery does not connect to a robot or PLC. Synthetic data is used for the idea-board walkthrough.

`demos/catalog.json` records titles, recording types, durations, source links, file sizes, and SHA-256 hashes. Media is stored here so individual code repositories can link to a playable demo without duplicating MP4 files.

## Editing and publishing

Edit `index.html` for the portfolio and `demos/index.html` for the gallery. Keep each demo's `index.html`, `demo.mp4`, `poster.webp`, `captions.srt`, and `captions.vtt` together. Update the catalog when replacing a recording. GitHub Pages publishes the root of `main`.

Keep project descriptions consistent with the repositories' current status. Concept animations should not be described as commissioned hardware.
