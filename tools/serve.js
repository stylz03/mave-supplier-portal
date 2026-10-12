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
    if (rel === "/cms" || rel === "/admin" || rel === "/admin.html") rel = "/cms.html";

    // Handle serverless email endpoint in local preview
    if (rel === "/api/send-supplier-email") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const resendKey = parsed.apiKey || process.env.RESEND_API_KEY;
          console.log(`[Local Dev] /api/send-supplier-email called: ${parsed.type} -> ${parsed.to}`);
          
          if (resendKey && typeof fetch === "function") {
            const apiModule = await import("../api/send-supplier-email.js");
            // Wrap in minimal mock req/res
            const mockReq = { method: req.method, body: parsed, headers: req.headers };
            const mockRes = {
              statusCode: 200,
              setHeader(k, v) { res.setHeader(k, v); },
              status(code) { this.statusCode = code; return this; },
              json(data) {
                res.writeHead(this.statusCode, { "Content-Type": "application/json" });
                res.end(JSON.stringify(data));
              },
              end() { res.end(); }
            };
            return apiModule.default(mockReq, mockRes);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            simulated: true,
            message: "Local dev mode: email captured and queued.",
            recipient: parsed.to,
            trackingCode: parsed.trackingCode
          }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

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
