import express, { type Express } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexHtmlPath = path.resolve(distPath, "index.html");
  const swPath = path.resolve(distPath, "sw.js");
  // (indexHtmlPath is reused by the collector-install + SPA fallback handlers.)

  // Derive a build version from the built index.html. Its content references
  // the hashed asset filenames, which change on every build, so this hash is
  // stable within a deploy but different across deploys. We inject it into the
  // service worker so each deploy ships a byte-different sw.js and the browser
  // reliably detects the update.
  let buildVersion = "dev";
  try {
    const indexSource = fs.readFileSync(indexHtmlPath, "utf-8");
    buildVersion = crypto
      .createHash("sha1")
      .update(indexSource)
      .digest("hex")
      .slice(0, 12);
  } catch {
    // Fall back to the default; the worker still functions, just without
    // per-deploy versioning.
  }

  // Serve a versioned service worker (must be registered before the static
  // middleware so this handler wins for /sw.js).
  app.get("/sw.js", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.type("application/javascript");
    try {
      const swSource = fs.readFileSync(swPath, "utf-8");
      res.send(swSource.replace(/__SW_VERSION__/g, buildVersion));
    } catch {
      res.status(404).end();
    }
  });

  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  app.use(express.static(distPath, {
    maxAge: 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html") || filePath.endsWith("sw.js") || filePath.endsWith("manifest.json")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  }));

  app.get("/collector-install", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    const source = fs.readFileSync(indexHtmlPath, "utf-8");
    const manifestPattern = /<link id="app-manifest"[^>]*href="\/manifest\.json"[^>]*\/?>/;
    const html = manifestPattern.test(source)
      ? source.replace(manifestPattern, `<link id="app-manifest" rel="manifest" href="/manifest-collector.json" />`)
      : source;
    if (!manifestPattern.test(source)) {
      console.warn("[collector-install] manifest link not found in built index.html — PWA install may not work");
    }
    res.type("html").send(html);
  });

  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(indexHtmlPath);
  });
}
