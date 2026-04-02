import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

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

  const indexHtmlPath = path.resolve(distPath, "index.html");

  app.get("/collector-install", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    const source = fs.readFileSync(indexHtmlPath, "utf-8");
    const manifestPattern = /<link rel="manifest" href="\/manifest\.json"\s*\/?>/;
    const html = manifestPattern.test(source)
      ? source.replace(manifestPattern, `<link rel="manifest" href="/manifest-collector.json">`)
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
