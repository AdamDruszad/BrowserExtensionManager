# Browser Extension Manager

A responsive, vanilla JavaScript solution to the [Frontend Mentor Browser extensions manager UI challenge](https://www.frontendmentor.io/challenges/browser-extension-manager-ui-yNZnOfsMAp).

This is a UI demo using bundled sample data. It does not access, install or change actual browser extensions.

[Live demo](https://adamdruszad.github.io/BrowserExtensionManager/) · [Source](https://github.com/AdamDruszad/BrowserExtensionManager)

## Features

- Enable, disable, remove and filter extension cards without losing the current filter.
- Save extension changes and the light/dark theme in local storage.
- Restore the original demo with **Reset list**.
- Loading, empty and error states with a retry action.
- Semantic controls, named switches, keyboard focus recovery and live announcements.
- Responsive CSS Grid, Manrope / Instrument Serif via Google Fonts, a bundled Noto Sans fallback and reduced-motion support.
- Validate loaded data, restrict logos to relative local image paths, and render names and descriptions as text.
- End stalled data requests after ten seconds and offer a retry.

If browser storage is unavailable, the controls still work for the current visit. Removed cards and enabled states are stored by extension name; resetting the list clears these overrides but keeps the chosen theme.

## Run locally

```bash
git clone https://github.com/AdamDruszad/BrowserExtensionManager.git
cd BrowserExtensionManager
python -m http.server 4174
```

Open `http://localhost:4174`. Depending on your Python installation, use `python3` or `py` instead of `python`. Serve the directory over HTTP: opening `index.html` directly as a file prevents reliable loading of the module and JSON data.

There is no build step or production JavaScript dependency. Deploy `index.html`, `script.js`, `style.css`, `data.json` and `assets/` together to a static host.

## Tests

The test tools require Node.js 24.15 or newer in the Node 24 release line and npm. See `package.json` for all supported Node ranges.

```bash
npm ci
npm test
```

Tests use Node's test runner and JSDOM. They cover filtering after toggles, focus recovery, persistence and reset, theme persistence, empty states, failed requests, invalid data and unavailable storage. Visual appearance and device-specific assistive technology behavior still need manual checks.

## Implementation and credits

`script.js` manages one canonical extension list and creates cards using DOM APIs. State changes update the list, persist overrides, render the active filter and restore keyboard focus when a card disappears.

Design and sample assets: Frontend Mentor. Implementation: [AdamDruszad](https://github.com/AdamDruszad).

The original implementation used Gemini 3 Flash for debugging and refactoring assistance. Codex assisted with subsequent reliability, accessibility and regression-test improvements.
