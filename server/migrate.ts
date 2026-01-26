import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runMigrations() {
  console.log("Running database migrations...");
  
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set, skipping migrations");
    return;
  }

  try {
    console.log("Pushing schema to database...");
    const { stdout, stderr } = await execAsync("npx drizzle-kit push --force", {
      env: { ...process.env },
      timeout: 60000,
    });
    
    if (stdout) {
      console.log("Migration output:", stdout);
    }
    if (stderr && !stderr.includes("No config path provided")) {
      console.log("Migration stderr:", stderr);
    }
    
    console.log("Database migrations complete");
  } catch (error) {
    console.error("Migration error:", error instanceof Error ? error.message : error);
    // Don't throw - let the server continue starting
  }
}
