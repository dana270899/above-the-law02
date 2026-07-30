# Project Architecture Notes

## Editor Graph Persistence

This project uses file-backed editor data, not browser `localStorage`, for the main node graph.

- Canonical editor graph: `data/editor-state-current.json`
- Production artifact: `dist/game-content.json` (generated; never edited directly)
- Timestamped versions: `data/versions/*.json`

The Vite dev server in `vite.config.ts` owns the local write API:

- `GET /api/editor-state` reads `data/editor-state-current.json`
- `POST /api/editor-state` atomically writes `data/editor-state-current.json`
- `GET /api/editor-versions` lists JSON snapshots from `data/versions/`
- `POST /api/editor-versions` writes a new timestamped version JSON file
- `PATCH /api/editor-versions/:id` renames a version
- `DELETE /api/editor-versions/:id` deletes a version

The local editor reads and writes through `src/lib/editorStorage.ts`. The playable game reads only through `src/lib/gameContent.ts`, which loads `/game-content.json`. During local development Vite serves that URL from the canonical graph; during builds Vite emits the same canonical file into `dist/`.

Important: a normal static browser deployment cannot write files back to the project. Local file saving works through the Vite dev server only. If online editing with persistent saves becomes a requirement, add a real backend/database instead of using browser storage.

## Local Editor vs. Public Game

The editor is a local authoring tool and must not be included in public builds.

- `npm run dev` serves the local app from `src/main.tsx`, including `/editor`, preview routes, and the file-backed editor API.
- `npm run build` / `npm run build:game` builds only `game.html` → `src/main.game.tsx`, whose independent import graph contains only the public ranking entry and `/game`. The result is emitted as `dist/index.html`.
- Production copies only `assets/fonts/`, `assets/images/`, `assets/sounds/`, and the generated `game-content.json`. Other files under `assets/` are local/editor artifacts.
- `scripts/verify-game-build.mjs` is a required build gate. It rejects editor routes/code, editor-only public files, a mismatched game-content artifact, and graph references to browser-only IndexedDB media.
- GitHub is source control only. GitHub Pages is not a deployment target; Vercel deploys the game-only build from Git pushes.

Do not add editor imports to `src/GameApp.tsx` or `src/main.game.tsx`. Editor preview query parameters are intentionally ignored outside local development.
