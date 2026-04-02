import { type Express, type Response, type NextFunction } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  const clientTemplate = path.resolve(
    import.meta.dirname,
    "..",
    "client",
    "index.html",
  );

  async function serveIndexHtml(url: string, res: Response, next: NextFunction, manifestOverride?: string) {
    try {
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      if (manifestOverride) {
        const manifestPattern = /<link rel="manifest" href="\/manifest\.json"\s*\/?>/;
        if (manifestPattern.test(template)) {
          template = template.replace(manifestPattern, `<link rel="manifest" href="${manifestOverride}" />`);
        } else {
          viteLogger.warn(`[collector-install] manifest link not found in index.html — PWA install may not work`);
        }
      }
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  }

  app.get("/collector-install", (req, res, next) => {
    serveIndexHtml(req.originalUrl, res, next, "/manifest-collector.json");
  });

  app.use("*", async (req, res, next) => {
    serveIndexHtml(req.originalUrl, res, next);
  });
}
