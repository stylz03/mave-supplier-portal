# tools/

Build and asset tooling. Not part of the deployed site — `vercel.json`
excludes this directory.

| File | Purpose |
|---|---|
| `serve.js` | Local static server for preview (`node tools/serve.js`). Used by `.claude/launch.json`. |
| `kie.js` | kie.ai API client — upload, create task, poll, download. Reads `KIE_API_KEY` from `tools/.env` (gitignored). |
| `restage.js` | Stage 1 of the vehicle pipeline: composites the van into the showroom at the film's grade. |
| `grade.js` | Solves for the gamma that lands an image on the film's reference mean luma (76) and bakes it in. |
| `extract-frames.js` | Turns generated clips into the numbered JPG sequence the canvas reads. |

Install once: `cd tools && npm install`

See `VEO_PROMPT.md` for the video generation prompts and
`VEHICLE_SWAP.md` for the measured shot spec.
