import session from "express-session";
import pg from "pg";

interface PgStoreOptions {
  pool: pg.Pool;
  tableName?: string;
  pruneInterval?: number; // seconds, false to disable
}

export class PgSessionStore extends session.Store {
  private pool: pg.Pool;
  private tableName: string;
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor(options: PgStoreOptions) {
    super();
    this.pool = options.pool;
    this.tableName = options.tableName || "user_sessions";

    this.createTable().catch(err => console.error("Failed to create session table:", err));

    const pruneInterval = options.pruneInterval ?? 900;
    if (pruneInterval) {
      this.pruneTimer = setInterval(() => {
        this.pool.query(`DELETE FROM "${this.tableName}" WHERE "expire" < NOW()`)
          .catch(err => console.error("Session prune error:", err));
      }, pruneInterval * 1000);
      if (this.pruneTimer.unref) this.pruneTimer.unref();
    }
  }

  private async createTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS "${this.tableName}" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "${this.tableName}_pkey" PRIMARY KEY ("sid")
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_${this.tableName}_expire" ON "${this.tableName}" ("expire");
    `);
  }

  get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void) {
    this.pool.query(
      `SELECT "sess" FROM "${this.tableName}" WHERE "sid" = $1 AND "expire" > NOW()`,
      [sid]
    ).then(result => {
      if (result.rows.length === 0) return callback(null, null);
      callback(null, result.rows[0].sess);
    }).catch(err => callback(err));
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    const maxAge = sessionData.cookie?.maxAge || 86400000;
    const expire = new Date(Date.now() + maxAge);
    this.pool.query(
      `INSERT INTO "${this.tableName}" ("sid", "sess", "expire") VALUES ($1, $2, $3)
       ON CONFLICT ("sid") DO UPDATE SET "sess" = $2, "expire" = $3`,
      [sid, JSON.stringify(sessionData), expire]
    ).then(() => callback?.()).catch(err => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    this.pool.query(
      `DELETE FROM "${this.tableName}" WHERE "sid" = $1`,
      [sid]
    ).then(() => callback?.()).catch(err => callback?.(err));
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    const maxAge = sessionData.cookie?.maxAge || 86400000;
    const expire = new Date(Date.now() + maxAge);
    this.pool.query(
      `UPDATE "${this.tableName}" SET "expire" = $1 WHERE "sid" = $2`,
      [expire, sid]
    ).then(() => callback?.()).catch(err => callback?.(err));
  }
}
