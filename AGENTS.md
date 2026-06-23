# Project Architecture Notes

## Editor Graph Persistence

This project uses file-backed editor data, not browser `localStorage`, for the main node graph.

- Live editor graph: `data/editor-state-current.json`
- Static/deployable copy: `assets/editor-state-current.json`
- Timestamped versions: `data/versions/*.json`

The Vite dev server in `vite.config.ts` owns the local write API:

- `GET /api/editor-state` reads `data/editor-state-current.json`
- `POST /api/editor-state` writes `data/editor-state-current.json` and mirrors it to `assets/editor-state-current.json`
- `GET /api/editor-versions` lists JSON snapshots from `data/versions/`
- `POST /api/editor-versions` writes a new timestamped version JSON file
- `PATCH /api/editor-versions/:id` renames a version
- `DELETE /api/editor-versions/:id` deletes a version

The editor and game both read through `src/lib/editorStorage.ts`. During local development it uses the API above. For static hosting, it falls back to `assets/editor-state-current.json`.

Important: a normal static browser deployment cannot write files back to the project. Local file saving works through the Vite dev server only. If online editing with persistent saves becomes a requirement, add a real backend/database instead of using browser storage.
