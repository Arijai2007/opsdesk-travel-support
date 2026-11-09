import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const root = new URL("../", import.meta.url);
const env = dotenv.parse(readFileSync(new URL("backend/.env", root)));
const dir = fileURLToPath(new URL(".opsdesk/postgres", root));
mkdirSync(fileURLToPath(new URL(".opsdesk", root)), { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "opsdesk",
  password: env.LOCAL_POSTGRES_PASSWORD,
  port: 55432,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message) => console.error(String(message)),
});
if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const { rows } = await client.query(
  "SELECT 1 FROM pg_database WHERE datname='opsdesk'",
);
if (!rows.length) await client.query("CREATE DATABASE opsdesk");
await client.end();
console.log(
  "OpsDesk PostgreSQL ready on 127.0.0.1:55432. Data persists in .opsdesk/postgres.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
setInterval(() => {}, 60000);
