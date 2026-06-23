# Game Project — Working Rules & Workflow

## What this document is
This is the single source of truth for how we work together on this game.
Every decision about process, file structure, and communication style lives here.
Before writing any code, we both agree on what's written below.

---

## The game (summary so far)
- **Type:** Point-and-click adventure
- **Platform:** Web browser (HTML / CSS / JavaScript — no frameworks required unless agreed)
- **UI concept:** The game world looks like a desktop OS with windows. The player navigates by interacting with those windows, not by walking between rooms.
- **Core interactions:** Click objects to trigger events. No inventory system yet — to be decided.
- **Visual style:** Custom / stylized (not mimicking a real OS)
- **Story:** To be defined as we build.

---

## Golden rules (never break these)

1. **Pixel perfect.** Every screen must match the Figma design exactly — spacing, font size, color, alignment. No approximations.
2. **Simple and straight.** No spaghetti code. Every piece of logic has one clear home. If something is hard to explain, it's too complicated.
3. **Explain before building.** Before writing code for any feature, I explain: what I'm building, why I chose this approach, and what file it goes in.
4. **One feature at a time.** We finish and verify one thing before starting the next.
5. **No surprise changes.** I never refactor, rename, or "clean up" code you didn't ask me to touch.
6. **Ask, don't assume.** If a design detail is unclear, I ask before guessing.
7. **All text in English.** Every visible string in the project — UI labels, node text, button text, defaults — is written in English. No Hebrew anywhere in the codebase.

---

## How we communicate

- I write in plain language, no jargon.
- When I reference a file, I always give the full path and explain what it does.
- When I make a choice (e.g. why I use CSS instead of Canvas), I explain the reason in one sentence.
- If there are two valid options, I present both with pros/cons and ask which you prefer.

---

## Figma workflow

1. You share a **Figma view-only link** so I can reference the full design.
2. You **export assets** (PNG or SVG) and place them in the `/assets/` folder before I build that screen.
3. I never invent colors, fonts, or sizes — I read them from Figma or ask you.
4. Asset naming follows the Figma layer name, lowercase with hyphens. Example: `desktop-background.png`, `window-folder.svg`.

---

## File and folder structure

```
pgmr01/
├── index.html          ← the single page that loads the game
├── style.css           ← all visual styles (layout, colors, fonts)
├── game.js             ← all game logic (interactions, state, events)
├── assets/
│   ├── images/         ← exported PNG / SVG from Figma
│   └── fonts/          ← any custom fonts
└── data/
    └── scenes.json     ← (future) scene/window definitions if needed
```

**Rules for files:**
- We start with exactly 3 files: `index.html`, `style.css`, `game.js`.
- We only add new files when there is a clear reason (e.g. too large, clearly separate concern). I explain the reason before creating any new file.
- No build tools, no bundlers, no frameworks until there is a strong reason. The game opens by double-clicking `index.html` in a browser.

---

## How a "window" works in this game

Since the UI is desktop-style with windows instead of scenes:
- Each **window** is an HTML element (a `<div>`) that can be shown, hidden, moved, or resized.
- Windows have a title bar, content area, and close button — styled to match your Figma design.
- **Game state** (which windows are open, what has been clicked) lives in `game.js` in one clear object.
- Clicking an object inside a window triggers a function in `game.js`. That function updates state and changes what's visible.

---

## Step-by-step build order

We build in this order. Each step is a checkpoint — we review before moving on.

| Step | What we build | Why this order |
|------|--------------|----------------|
| 1 | Static HTML shell + CSS base (background, font, colors) | Establish the visual foundation first |
| 2 | One window — static, matches Figma exactly | Prove pixel-perfect rendering before adding logic |
| 3 | Window open/close interaction | Simplest possible game mechanic |
| 4 | First clickable object inside a window | Core game loop proven end-to-end |
| 5 | Game state object in `game.js` | All logic has a home before we add more |
| 6+ | Additional windows, objects, events | One at a time, always reviewed against Figma |

---

## Definition of "done" for each step

A step is done when:
- [ ] It matches the Figma design visually (you confirm this)
- [ ] It works correctly in the browser (Chrome, latest version)
- [ ] The code is readable and I can explain every line in plain language
- [ ] No unused code was left behind

---

## What I will never do without asking you first

- Add a library or framework
- Create a new file
- Change something that already works
- Make a design decision (color, size, position, font)
- Restructure the folder layout

---

*Last updated: project kickoff*
