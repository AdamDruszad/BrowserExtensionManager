# Redesign inventory

This is the contract for the redesign: every item below existed in the baseline (commit `69b99e3`, "chore: commit pre-existing uncommitted work") and must still exist and work afterwards. The **Status** column was filled in during verification (section 5 of the redesign brief). ✅ = present and working in the redesign. Where an item was intentionally reshaped, the note says how.

Baseline screenshots: `docs/redesign-screenshots/before/` (kept out of git). After screenshots: `docs/redesign-screenshots/after/`.

## 1. Pages and routes

| # | Item | Baseline location | Status |
|---|------|-------------------|--------|
| 1.1 | Single page `/` (`index.html`), no other routes | `index.html` | |
| 1.2 | Data source `./data.json`, 12 extensions, shape `{ logo, name, description, isActive }` (unchanged) | `data.json`, `script.js:166` | |

## 2. Sections on the page (in reading order)

| # | Section | Contents | Status |
|---|---------|----------|--------|
| 2.1 | Skip link | "Skip to extensions", jumps to `#main` | |
| 2.2 | Site header | Wordmark (four-square glyph + "extensions."), tagline, theme switch | |
| 2.3 | Intro | Label "Your browser workspace", H1, two-line description | |
| 2.4 | Workspace summary | Total count, "extensions in your toolkit", "N active · N paused" | |
| 2.5 | Library toolbar | H2 "Your extensions", filter group (All/Active/Inactive with counts), "Reset list" button | |
| 2.6 | Library caption | "Showing N of N extensions", hint "Enable only what you need." | |
| 2.7 | Status/feedback area | Loading / empty / error message, "Try again" button | |
| 2.8 | Extension list | One card per extension: logo, name, description, "Remove", status label, switch | |
| 2.9 | Demo note | Info marker + demo disclaimer | |
| 2.10 | Footer | Creator link, Frontend Mentor credit | |
| 2.11 | `<noscript>` message | "Please enable JavaScript to use the extension manager." | |

## 3. Text content (verbatim)

| # | Text | Where | Status |
|---|------|-------|--------|
| 3.1 | `Browser Extension Manager \| Biró Ádám` | `<title>` | |
| 3.2 | `A responsive extension manager UI demo with filtering, theme selection and saved extension states. Built by Biró Ádám.` | meta description | |
| 3.3 | `Skip to extensions` | skip link | |
| 3.4 | `extensions.` | wordmark (link label "Extensions home") | |
| 3.5 | `A place for your browser tools` | header tagline (hidden below 800px in baseline) | |
| 3.6 | `Light mode` / `Dark mode` | theme switch label (hidden below 540px in baseline) | |
| 3.7 | `Your browser workspace` | intro label | |
| 3.8 | `Good tools. Less clutter.` (second sentence emphasised) | H1 | |
| 3.9 | `Keep what works. Pause what doesn’t.` / `Make a little room for a more focused browser.` | intro description | |
| 3.10 | `extensions in your toolkit`, `N active · N paused` | summary | |
| 3.11 | `Loading your workspace` | summary while loading | |
| 3.12 | `Library unavailable`, `Your tools could not be loaded` | summary/caption on error | |
| 3.13 | `Your extensions` | H2 | |
| 3.14 | `All`, `Active`, `Inactive` + counts | filter buttons | |
| 3.15 | `Reset list` | reset button | |
| 3.16 | `Showing N of N extensions`, `Getting your tools ready…` | caption (loaded / loading) | |
| 3.17 | `Enable only what you need.` | caption hint (hidden below 540px in baseline) | |
| 3.18 | `Loading extensions…` | feedback while loading | |
| 3.19 | `No extensions left. Use Reset list to restore the demo.` | feedback, all removed | |
| 3.20 | `No active extensions.` / `No inactive extensions.` / `No matching extensions.` | feedback, empty filter | |
| 3.21 | `Extensions could not be loaded. Check your connection and try again.` | feedback, error | |
| 3.22 | `Loading extensions took too long. Check your connection and try again.` | feedback, timeout | |
| 3.23 | `Try again` | retry button | |
| 3.24 | 12 extension names and descriptions | `data.json` | |
| 3.25 | `Remove`, `Enabled`, `Paused` | card controls | |
| 3.26 | `An interactive demo. Manage this sample library; your actual browser extensions stay untouched.` | demo note | |
| 3.27 | `Built by Biró Ádám` | footer creator link | |
| 3.28 | `A Frontend Mentor project.` | footer credit | |
| 3.29 | `Please enable JavaScript to use the extension manager.` | noscript | |

### Screen-reader-only text (live region `#announcement`)

| # | Text | Trigger | Status |
|---|------|---------|--------|
| 3.30 | `N extensions loaded.` | data loaded | |
| 3.31 | `N extensions shown.` / `N active extensions shown.` / `N inactive extensions shown.` | filter click | |
| 3.32 | `<name> enabled.` / `<name> disabled.` | switch | |
| 3.33 | `<name> removed. Reset list restores removed extensions.` | remove | |
| 3.34 | `The original extension list has been restored.` | reset | |
| 3.35 | `Changes will only last for this visit because browser storage is unavailable.` (appended) | storage write fails | |

## 4. Images, icons and assets

| # | Asset | Use | Status |
|---|-------|-----|--------|
| 4.1 | `assets/images/logo-*.svg` (12) | extension logos, `alt=""` (name is the heading next to it) | |
| 4.2 | `assets/images/icon-sun.svg`, `icon-moon.svg` | theme switch icon (sun in dark theme, moon in light) | |
| 4.3 | `assets/images/favicon-32x32.png` | favicon | |
| 4.4 | Inline SVG four-square "brand mark" | wordmark | |
| 4.5 | Inline SVG reset arrow | Reset list button | |
| 4.6 | Fonts: Manrope + Instrument Serif (Google Fonts), Noto Sans TTF fallback (`assets/fonts/`) | typography | |
| 4.7 | Unreferenced in baseline: `assets/images/logo.svg`, `logo_white.svg`, `assets/fonts/static/*`, Noto Sans Italic, `screenshot.png` | none | |

## 5. Links and attribution

| # | Link | Target | Status |
|---|------|--------|--------|
| 5.1 | Wordmark | `./` | |
| 5.2 | `Built by Biró Ádám ↗` | `https://github.com/AdamDruszad` | |
| 5.3 | `Frontend Mentor` | `https://www.frontendmentor.io?ref=challenge` | |
| 5.4 | Skip link | `#main` | |

## 6. Features and interactions

| # | Feature | Behaviour | Status |
|---|---------|-----------|--------|
| 6.1 | Load data | `fetch("./data.json")`, validated (array, unique non-empty names, string description, relative `./…svg|png` logo without `..`, boolean `isActive`) | |
| 6.2 | Request timeout | aborts after 10 s (`options.loadTimeoutMs`), shows timeout message | |
| 6.3 | Retry | "Try again" reloads without page refresh | |
| 6.4 | Filter | All / Active / Inactive; `aria-pressed`; counts per filter; filter persists while toggling | |
| 6.5 | Toggle extension | switch (`input[type=checkbox][role=switch]`, accessible name = extension name); updates counts, filter results, status label | |
| 6.6 | Remove extension | removes card immediately, no confirmation | |
| 6.7 | Reset list | restores the original 12 with original states, clears saved changes, resets filter to All, keeps theme | |
| 6.8 | Theme switch | dark ⇄ light, default dark, `aria-label`/`title` "Switch to light/dark theme" | |
| 6.9 | Persistence | `localStorage["extension-manager-state-v1"]` (per-name `{ isActive, removed }` overrides), `localStorage["extension-manager-theme"]` | |
| 6.10 | Storage unavailable / corrupted | controls keep working for the visit, announcement explains | |
| 6.11 | Focus recovery | after toggle/remove the focus moves to the same control on the same card, the next card, or the active filter button when the list is empty | |
| 6.12 | Live announcements | every action announced via `#announcement` (`role=status`, polite) | |
| 6.13 | Text-only rendering | names/descriptions set with `textContent`, never HTML | |
| 6.14 | Controls disabled while loading | filters and Reset disabled until data is valid | |
| 6.15 | Skip link + focusable `main` (`tabindex=-1`) | | |
| 6.16 | Reduced motion | transitions/animations off under `prefers-reduced-motion: reduce` | |
| 6.17 | Modals / confirmations | none exist | |

## 7. UI states

| # | State | Baseline evidence | Status |
|---|-------|-------------------|--------|
| 7.1 | Loading (summary "—", "Loading your workspace", "Getting your tools ready…", "Loading extensions…", disabled filters, `aria-busy=true`) | `before/dark-loading-*.png` | |
| 7.2 | Loaded, filter All / Active / Inactive, dark and light | `before/{dark,light}-{all,active,inactive}-*.png` | |
| 7.3 | Empty: every extension removed | `before/{dark,light}-empty-all-removed-*.png` | |
| 7.4 | Empty: filter with no matches | `before/dark-empty-filter-*.png` | |
| 7.5 | Error: HTTP failure / invalid data | `before/{dark,light}-error-*.png` | |
| 7.6 | Error: timeout | covered by tests | |
| 7.7 | Success feedback | live-region announcements only (no visible toast) | |
| 7.8 | Hover and keyboard-focus states for every control | `style.css:36-38` | |
| 7.9 | Responsive layouts: 3 columns (>800px), 2 columns (541–800px), 1 column (≤540px) | `style.css:126-185` | |
