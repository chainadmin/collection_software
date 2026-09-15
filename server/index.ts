import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { pool } from "./db";
import { PgSessionStore } from "./pg-session-store";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Railway terminates public requests at one edge proxy. Do not enable proxy
// trust merely because an arbitrary deployment is production: otherwise a
// directly reachable server could accept spoofed forwarding headers.
// Non-Railway deployments must opt in explicitly to this same one-hop topology.
if (process.env.RAILWAY_ENVIRONMENT || process.env.TRUST_PROXY_HOPS === "1") {
  app.set("trust proxy", 1);
}

// Declare session data types
declare module "express-session" {
  interface SessionData {
    collector?: {
      id: string;
      organizationId: string;
      role: string;
      name: string;
      email: string;
    };
    globalAdmin?: {
      id: string;
      username: string;
      name: string;
    };
  }
}

// The admin/office app and the collector workstation app are installed as
// two separate PWAs specifically so the same computer can be signed into an
// admin account and a collector account at the same time. That only holds up
// if they don't share one session cookie, so each context gets its own
// cookie name and session store; which one applies to a given request is
// picked below by the X-App-Context header the client sends (see
// client/src/lib/app-context.ts / queryClient.ts) rather than by the shared
// `connect.sid` cookie every request used to carry.
declare global {
  namespace Express {
    interface Request {
      sessionCookieName?: string;
    }
  }
}

const ADMIN_COOKIE_NAME = "admin.sid";
const COLLECTOR_COOKIE_NAME = "collector.sid";

// In production the server must never fall back to a predictable session
// secret — forgeable sessions would defeat all authentication.
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: SESSION_SECRET is not set. Refusing to start in production.");
    process.exit(1);
  }
  console.warn("[startup] SESSION_SECRET not set — using an insecure development-only secret.");
  return "dev-secret-change-in-production";
}

function makeSessionMiddleware(cookieName: string, pruneInterval: number) {
  return session({
    name: cookieName,
    store: new PgSessionStore({
      pool: pool,
      tableName: "user_sessions",
      pruneInterval,
    }),
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  });
}

// Two independent session stores backed by the same table — only one of the
// two middlewares below ever runs for a given request, so there is no
// interaction between them (no shared mutable state, no clobbered cookies).
const adminSessionMiddleware = makeSessionMiddleware(ADMIN_COOKIE_NAME, 900);
// Both stores prune the same shared table; only one of them needs to run the
// sweep.
const collectorSessionMiddleware = makeSessionMiddleware(COLLECTOR_COOKIE_NAME, 0);

app.use((req, res, next) => {
  const isCollectorContext = req.get("x-app-context") === "collector";
  req.sessionCookieName = isCollectorContext ? COLLECTOR_COOKIE_NAME : ADMIN_COOKIE_NAME;
  const middleware = isCollectorContext ? collectorSessionMiddleware : adminSessionMiddleware;
  middleware(req, res, next);
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run database migrations at startup
  try {
    const { runMigrations } = await import("./migrate");
    await runMigrations();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "production") {
      // Schema drift in production causes confusing runtime failures later —
      // fail fast and loudly instead of starting in a broken state.
      console.error("FATAL: Database migration failed at startup:", message);
      process.exit(1);
    }
    console.error("[startup] WARNING: Database migration failed — the schema may be out of date:", message);
  }

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  await registerRoutes(httpServer, app);

  const { initRealtimeSoftphone } = await import("./realtimeSoftphone");
  initRealtimeSoftphone(httpServer);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    // Log instead of re-throwing: throwing after responding can crash the
    // process or trigger duplicate error handling.
    console.error("[error]", err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);

      try {
        const { startAutoPaymentScheduler } = await import("./auto-payment-runner");
        startAutoPaymentScheduler();
        log("Auto payment scheduler started");
      } catch (error) {
        console.error("Failed to start auto payment scheduler:", error);
      }
    },
  );
})();
