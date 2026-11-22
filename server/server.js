// Flex & Fit server: serves the web app and the sync API from one port, with no npm dependencies.
// Runs on the Mac in Docker (see docker-compose.yml), or locally with `npm run serve`.
//
//   PORT          default 3334
//   DATA_DIR      where flexfit.db lives (default ./data)
//   WEB_DIR       the web app to serve (default ./web)
//   BACKUP_DIRS   comma-separated folders for the weekly backups (none by default)
//   SYNC_TOKEN    if set, /api/sync needs "Authorization: Bearer <token>"
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const store = require("./db");
const backup = require("./backup");

const MAX_BODY = 5 * 1024 * 1024;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon" };

function tokenOk(req, token) {
  if (!token) return true;
  const got = Buffer.from(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(token);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function send(res, status, body, headers = {}) {
  const json = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, { "Content-Type": json ? "application/json" : "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(json ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("demasiado grande"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(webDir, req, res) {
  const url = new URL(req.url, "http://x");
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(webDir, "." + rel);
  if (!file.startsWith(path.resolve(webDir) + path.sep)) return send(res, 404, "No encontrado");
  // The path was checked to stay inside webDir just above (a test covers ../ escapes).
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "No encontrado");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.createReadStream(file).pipe(res);
  });
}

function createServer({ db, webDir, token, version = "dev" }) {
  return http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, "http://x");
      if (pathname === "/api/salud" && req.method === "GET") {
        return send(res, 200, { ok: true, version, registros: db.count(), token: !!token });
      }
      if (pathname === "/api/sync") {
        if (req.method !== "POST") return send(res, 405, { error: "usa POST" });
        if (!tokenOk(req, token)) return send(res, 401, { error: "clave incorrecta" });
        let body;
        try {
          body = JSON.parse(await readBody(req));
        } catch (e) {
          return send(res, e.status || 400, { error: e.status ? "demasiado grande" : "JSON no válido" });
        }
        const desde = Number.isSafeInteger(body?.desde) && body.desde >= 0 ? body.desde : 0;
        const cambios = Array.isArray(body?.cambios) ? body.cambios : [];
        for (const c of cambios) {
          const why = store.invalid(c);
          if (why) return send(res, 400, { error: why });
        }
        return send(res, 200, db.sync(desde, cambios));
      }
      if (pathname.startsWith("/api/")) return send(res, 404, { error: "no existe" });
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Método no permitido");
      return serveStatic(webDir, req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) send(res, 500, { error: "error del servidor" });
    }
  });
}

if (require.main === module) {
  const root = path.join(__dirname, "..");
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
  const webDir = path.resolve(process.env.WEB_DIR || path.join(root, "web"));
  const port = Number(process.env.PORT || 3334);
  const dirs = (process.env.BACKUP_DIRS || "").split(",").map((d) => d.trim()).filter(Boolean);
  const db = store.open(path.join(dataDir, "flexfit.db"));
  const version = process.env.APP_VERSION || "dev";
  const server = createServer({ db, webDir, token: process.env.SYNC_TOKEN || "", version });

  const backupNow = () => {
    try {
      for (const f of backup.runDue(db, dirs)) console.log(`Copia de seguridad: ${f}`);
    } catch (e) {
      console.error("La copia de seguridad falló:", e.message);
    }
  };
  backupNow();
  setInterval(backupNow, 3600 * 1000).unref();

  server.listen(port, "0.0.0.0", () => console.log(`Flex & Fit ${version} en http://0.0.0.0:${port} (datos en ${dataDir}, copias en ${dirs.join(", ") || "ningún sitio"})`));
  const stop = () => server.close(() => { db.close(); process.exit(0); });
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

module.exports = { createServer };
