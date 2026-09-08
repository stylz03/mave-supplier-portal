/* ============================================================
   Minimal kie.ai client.

   Async job model: createTask returns a taskId, then you poll
   recordInfo until it reports success or failure.

   Usage as a module:
     const { run } = require("./kie");
     const urls = await run("model/id", { prompt: "...", ... });

   Usage from the shell:
     node kie.js <model> '<input-json>'
     node kie.js --status <taskId>

   The API key is read from KIE_API_KEY (env or a .env file at the
   repo root or in tools/). Never hard-code it — this repo is public.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const API = "https://api.kie.ai/api/v1/jobs";

/* ---- config ------------------------------------------------ */

function loadEnv() {
  if (process.env.KIE_API_KEY) return process.env.KIE_API_KEY;
  for (const p of [
    path.join(__dirname, ".env"),
    path.join(__dirname, "..", ".env"),
  ]) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.KIE_API_KEY;
}

function key() {
  const k = loadEnv();
  if (!k) {
    throw new Error(
      "KIE_API_KEY not set. Put it in tools/.env as KIE_API_KEY=... " +
        "(that file is gitignored) or export it in your shell."
    );
  }
  return k;
}

const headers = () => ({
  Authorization: "Bearer " + key(),
  "Content-Type": "application/json",
});

/* ---- core -------------------------------------------------- */

async function createTask(model, input) {
  const res = await fetch(API + "/createTask", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model, input }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`createTask HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  // The envelope has been seen as {code,msg,data:{taskId}}; be lenient.
  const taskId =
    body?.data?.taskId || body?.data?.task_id || body?.taskId || body?.task_id;
  if (!taskId) {
    throw new Error("No taskId in response: " + JSON.stringify(body));
  }
  return taskId;
}

async function status(taskId) {
  const res = await fetch(
    API + "/recordInfo?taskId=" + encodeURIComponent(taskId),
    { headers: headers() }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`recordInfo HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body?.data ?? body;
}

/* Result URLs turn up under different keys depending on the model,
   and resultJson is sometimes a JSON string rather than an object. */
function resultUrls(d) {
  let r = d?.resultJson ?? d?.result ?? d?.response ?? d;
  if (typeof r === "string") {
    try {
      r = JSON.parse(r);
    } catch {
      return /^https?:\/\//.test(r) ? [r] : [];
    }
  }
  const out = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === "string") {
      if (/^https?:\/\/\S+$/.test(v)) out.push(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(r);
  return [...new Set(out)];
}

const DONE = /^(success|succeeded|completed|SUCCESS|GENERATE_SUCCESS)$/i;
const FAILED = /^(fail|failed|error|FAILURE|GENERATE_FAILED)$/i;

async function waitForTask(taskId, { timeoutMs = 900000, everyMs = 5000 } = {}) {
  const started = Date.now();
  let last = "";
  for (;;) {
    const d = await status(taskId);
    const state = String(
      d?.state ?? d?.status ?? d?.successFlag ?? ""
    );
    if (state !== last) {
      process.stderr.write(`  [${taskId}] ${state || "pending"}\n`);
      last = state;
    }
    if (DONE.test(state) || state === "1") {
      const urls = resultUrls(d);
      if (!urls.length) throw new Error("Task done but no URLs: " + JSON.stringify(d));
      return urls;
    }
    if (FAILED.test(state) || state === "2" || state === "3") {
      throw new Error(
        `Task ${taskId} failed: ${d?.failMsg || d?.errorMessage || JSON.stringify(d)}`
      );
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

async function run(model, input, opts) {
  const taskId = await createTask(model, input);
  process.stderr.write(`  task ${taskId} created (${model})\n`);
  return waitForTask(taskId, opts);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download HTTP ${res.status} for ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/* ---- upload ------------------------------------------------
   Models take image inputs as URLs, not base64, so local files
   have to be hosted first. kie.ai's own uploader is free and
   keeps files for 24h — long enough for a generation run.
   ------------------------------------------------------------ */

const UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

async function upload(localPath, uploadPath = "images/mave") {
  const buf = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const res = await fetch(UPLOAD, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      base64Data: `data:${mime};base64,${buf.toString("base64")}`,
      uploadPath,
      fileName: path.basename(localPath),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload HTTP ${res.status}: ${JSON.stringify(body)}`);
  const url =
    body?.data?.downloadUrl || body?.data?.fileUrl || body?.data?.url || body?.url;
  if (!url) throw new Error("No URL in upload response: " + JSON.stringify(body));
  return url;
}

module.exports = { createTask, status, waitForTask, run, download, upload, resultUrls };

/* ---- CLI --------------------------------------------------- */

if (require.main === module) {
  (async () => {
    const [a, b] = process.argv.slice(2);
    if (a === "--status") {
      console.log(JSON.stringify(await status(b), null, 2));
      return;
    }
    if (!a) {
      console.error("usage: node kie.js <model> '<input-json>' | --status <taskId>");
      process.exit(1);
    }
    console.log((await run(a, JSON.parse(b || "{}"))).join("\n"));
  })().catch((e) => {
    console.error(String(e.message || e));
    process.exit(1);
  });
}
