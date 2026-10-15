# Audit and redesign report

Project: BrowserExtensionManager (vanilla HTML/CSS/JS answer to the Frontend Mentor "Browser extensions manager UI" challenge).
Baseline: commit `69b99e3` on branch `redesign` (the pre-existing uncommitted work, committed unchanged).
Evidence: screenshots in `docs/redesign-screenshots/before/` (not in git); measurements from `GitHub/.claude/tools/extmgr-audit.mjs` (headless Edge, 1440 and 390 px, both themes).

## 1. Baseline scores

| Area | Score | Evidence |
|------|:-----:|----------|
| Visual design & consistency | 5/10 | Internally consistent tokens (`style.css:9-29`) but a stock look: near-black ground with one neon lime accent, italic display serif for the emphasised half of the H1, mono "eyebrow" labels (`style.css:43`), a decorative section number "01 /" (`index.html:42`) and a hero metric "12" (`style.css:60`, 72 px). The big decorative number outweighs the extension list it summarises. Five filler taglines compete ("A place for your browser tools", "Your browser workspace", "extensions in your toolkit", "Enable only what you need.", the demo note). One token is never used (`--surface-selected`, `style.css:14`). |
| UX & navigation | 6/10 | Filters keep their selection while toggling and focus is recovered (`script.js:146-152`), good. But **Remove** is instant and only undoable through **Reset list**, which also wipes every toggle (`script.js:217-237`). Switches are scattered across a 3-column grid with the state as 10 px text, so "what is on?" needs card-by-card reading (`before/dark-all-1440.png`). Four vocabularies for two states: Enabled/Paused (cards), Active/Inactive (filters), enabled/disabled (announcements), active/paused (summary). Error state shows a permanent `cursor: wait` on the disabled filters (`style.css:37`) and a left-aligned "Try again" under a centred message (`before/dark-error-1440.png`). Grammar: "1 extensions", "00" when empty (`script.js:130-132`). |
| Responsiveness / mobile | 7/10 | No horizontal overflow at 390 or 1440 (`shoot.mjs`), 3→2→1 columns (`style.css:126-185`), 44 px switch and button targets. Weaknesses: about 460 px of intro before the first extension on a 390 px phone (`before/dark-all-390.png`), all sizes in fixed px, so the browser's default font-size setting is ignored. |
| Accessibility | 6/10 | Strong base: skip link, `role="switch"` with names, live announcements, focus recovery, reduced motion, 0 text-contrast failures in either theme. Failures: **43 text elements at 10–11 px** (eyebrows, filter labels, captions, status labels, footer); light-theme state indicators fail WCAG 1.4.11 non-text contrast: switch-on track `#d4f65b` on `#fdfdf8` = **1.20:1**, switch-off track **1.94:1**, selected filter fill **1.11:1** (dark-theme off track 2.24:1); every card title is an `h2`, the same level as "Your extensions" (`script.js:87`); two polite live regions (`#announcement` and `#feedback`, `index.html:54-55`) announce the same event twice; `aria-label` on a generic `div` is ignored (`index.html:36`); theme ignores `prefers-color-scheme` and a returning light-theme visitor sees a dark flash because the theme is applied by the deferred module (`script.js:239-241`). |
| Performance | 4/10 | **2.07 MB decoded per visit, 1.95 MB of it a single Noto Sans TTF** (`assets/fonts/NotoSans-VariableFont_wdth,wght.ttf`). It is listed as the fallback in `--font-sans` (`style.css:1-7, 26`); while Manrope is still loading, the browser falls back to it and downloads the whole variable TTF. Plus a render-blocking third-party stylesheet and three woff2 files (66 KB) from Google Fonts for two families. The theme switch swaps an `<img>` source, so each first toggle is another request. Every toggle rebuilds all 12 cards (`script.js:122-127`). JS (10.7 KB) and CSS (12.4 KB) are small. |
| Code quality & structure | 7/10 | `initExtensionManager(doc, options)` with injected fetch/storage is testable; data validation is strict; 10 Node/JSDOM tests pass. Against it: full re-render on every change (kills the switch transition in `style.css:36,95` because the input is replaced before it can animate), the retry button borrows `.remove-btn` and then overrides it (`index.html:56`, `style.css:104`), single-line minified rules make the stylesheet hard to maintain, magic `padStart(2,"0")`, unused token, and unreferenced files in `assets/` (`logo.svg`, `logo_white.svg`, `assets/fonts/static/*`, Noto Sans Italic) plus `screenshot.png` of the old design. |
| SEO basics | 5/10 | Good `<title>` and meta description, `lang="en"`. Missing: Open Graph / Twitter card tags, canonical URL, `theme-color`; the H1 is a slogan ("Good tools. Less clutter.") that never names the product. |
| Security red flags | 8/10 | No secrets, no `innerHTML`; names and descriptions go through `textContent`; logos are restricted to relative `./…svg|png` paths without `..` (`script.js:17-30`); corrupt storage is caught. Report-only notes: no Content-Security-Policy; Google Fonts sends every visitor's IP address to Google (a GDPR complaint risk for an EU-based owner; self-hosting the fonts removes it); no Subresource Integrity is possible for the Google Fonts stylesheet. |

**Baseline average: 6.0 / 10.**

## 2. Top 10 problems, ranked by impact

1. **A 1.95 MB fallback font downloads on every visit** (94% of page weight). Why it matters: on a phone connection this is seconds of transfer and data for a font that should never be shown.
2. **Text is too small to read comfortably**: 43 elements at 10–11 px, all in fixed px. Why: captions, filter labels, status labels and the footer are where the state of the app is written; low-vision users and anyone on a phone pay for it, and the user's font-size preference is ignored.
3. **The app's core state fails contrast in the light theme**: switch tracks at 1.20:1 and 1.94:1, selected filter at 1.11:1 (WCAG 1.4.11 needs 3:1). Why: "is it on?" is the only question this UI answers.
4. **Removing an extension can't be undone on its own**; the only way back is Reset list, which also discards every toggle. Why: a destructive action with no confirmation should at least be reversible; one mis-tap costs all other changes.
5. **State can't be scanned**: switches scattered over a 3-column grid, state as 10 px text, four different words for on/off. Why: a manager is used by scanning a column of states, not by reading 12 cards.
6. **Every toggle rebuilds the whole list.** Why: the switch animation never plays (the element is replaced), focus has to be reconstructed by hand, and the DOM churn grows with the list.
7. **Theme ignores the OS setting and flashes dark** before switching to a saved light theme. Why: first impression is the wrong theme; a flash of dark is jarring in a bright room.
8. **Generic visual identity**: near-black + neon accent + italic serif + mono eyebrows + section numbers + a hero metric. Why: for a portfolio piece the look reads as a template, and the decoration (the "12") is louder than the content (the list).
9. **Semantics around the list**: all card titles are H2 like the section heading; two live regions double-announce; a named generic `div`. Why: screen-reader users navigate by headings and hear every message twice.
10. **No social or canonical metadata, and the H1 doesn't name the product.** Why: links shared from a CV or LinkedIn render as bare URLs, and search engines get no product name in the main heading.

Smaller items fixed along the way: misaligned "Try again", `cursor: wait` on an error, "1 extensions", "00", unused token.

## 3. Redesign direction

_Filled in after the build: see below._
