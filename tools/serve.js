/* Minimal static server for local preview.

   Replaces the `python3 -m http.server` in .claude/launch.json — on
   Windows `python3` is usually the Microsoft Store alias stub, which
   exits with code 49 instead of serving anything. Node is already a
   dependency of the tooling here, so this has no extra install.

     node tools/serve.js [port]
*/
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2]) || 8899;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/") rel = "/index.html";

    const file = path.join(ROOT, rel);
    /* path.join normalises separators, so compare against the resolved
       root rather than the raw string — otherwise ".." escapes it. */
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end("403");
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("404 " + rel);
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}`);
  });
