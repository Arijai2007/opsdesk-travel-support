import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import pg from "pg";
import "./local-setup.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
const preview = process.argv.includes("--preview");
const externalDatabase = process.argv.includes("--external-db");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function start(command, args, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  children.push(child);
  return child;
}
async function run(args) {
  const child = start(npm, args);
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`npm ${args.join(" ")} exited ${code}`)),
    );
  });
}
const env = dotenv.parse(
  readFileSync(new URL("../backend/.env", import.meta.url)),
);
if (env.OPSDESK_DEMO === "true" && env.NODE_ENV !== "production" && !env.OPSDESK_ATTACHMENT_SIGNING_SECRET && !process.env.OPSDESK_ATTACHMENT_SIGNING_SECRET)
  process.env.OPSDESK_ATTACHMENT_SIGNING_SECRET = randomBytes(32).toString("hex");
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  await run(["run", "build", "--workspace=packages/shared"]);
  if (!externalDatabase) start(process.execPath, ["scripts/local-db.mjs"]);
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 1000,
  });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      await pool.query("SELECT 1");
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await pool.end();
  if (!ready)
    throw new Error(
      "Local PostgreSQL did not become ready. Check the database output above.",
    );
  await run(["run", "prisma:generate", "--workspace=backend"]);
  await run([
    "exec",
    "--workspace=backend",
    "--",
    "prisma",
    "migrate",
    "deploy",
  ]);
  await run([
    "exec",
    "--workspace=backend",
    "--",
    "tsx",
    "prisma/seed-travel.ts",
  ]);
  await run(["run", "build", "--workspace=backend"]);
  if (preview) await run(["run", "build", "--workspace=frontend"]);
  const api = start(
    process.execPath,
    ["dist/src/main.js"],
    fileURLToPath(new URL("../backend/", import.meta.url)),
  );
  const web = start(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/next/dist/bin/next", import.meta.url),
      ),
      preview ? "start" : "dev",
      "--port",
      new URL(env.FRONTEND_URL).port || "3000",
      "--hostname",
      "127.0.0.1",
    ],
    fileURLToPath(new URL("../frontend/", import.meta.url)),
  );
  for (const child of [api, web])
    child.on("exit", (code) => {
      if (!stopping) {
        console.error(`Application process exited ${code}.`);
        stop();
      }
    });
  console.log(
    `\nOpsDesk is starting: ${env.FRONTEND_URL}\nSign in as manager@opsdesk.demo / OpsDeskDemo!2026\nPress Ctrl+C to stop. Your records remain on disk.\n`,
  );
} catch (error) {
  console.error(error.message);
  stop();
  process.exitCode = 1;
}
